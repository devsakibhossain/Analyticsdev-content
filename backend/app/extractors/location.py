import re
import json
import logging
from typing import List, Dict, Optional
from dataclasses import dataclass
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


@dataclass
class ExtractedLocation:
    country: str = "Unknown"
    state: str = "Unknown"
    city: str = "Unknown"
    address: str = "Unknown"
    postal_code: str = "Unknown"


# Common country codes and names mapping
COUNTRY_CODES = {
    "us": "United States", "usa": "United States", "united states": "United States",
    "uk": "United Kingdom", "gb": "United Kingdom", "united kingdom": "United Kingdom",
    "ca": "Canada", "canada": "Canada",
    "au": "Australia", "australia": "Australia",
    "de": "Germany", "germany": "Germany",
    "fr": "France", "france": "France",
    "nl": "Netherlands", "netherlands": "Netherlands",
    "es": "Spain", "spain": "Spain",
    "it": "Italy", "italy": "Italy",
    "br": "Brazil", "brazil": "Brazil",
    "in": "India", "india": "India",
    "sg": "Singapore", "singapore": "Singapore",
    "ae": "United Arab Emirates", "uae": "United Arab Emirates",
}


class LocationExtractor:
    """Extract physical address, city, state, country, and zip from schema.org and contact HTML."""

    def extract(self, pages: List[dict]) -> ExtractedLocation:
        for page in pages:
            html = page.get("html", "")
            if not html:
                continue

            try:
                soup = BeautifulSoup(html, "lxml")
            except Exception:
                soup = BeautifulSoup(html, "html.parser")

            # 1. Search JSON-LD for PostalAddress
            for script in soup.find_all("script", type="application/ld+json"):
                if script.string:
                    try:
                        data = json.loads(script.string)
                        loc = self._find_schema_address(data)
                        if loc and (loc.country != "Unknown" or loc.city != "Unknown" or loc.address != "Unknown"):
                            return loc
                    except Exception:
                        pass

            # 2. Search for microdata / HTML address tags
            addr_tag = soup.find("address")
            if addr_tag:
                loc = self._parse_html_address(addr_tag.get_text(separator=", "))
                if loc and (loc.country != "Unknown" or loc.city != "Unknown"):
                    return loc

            # 3. Check Google Maps embed or links
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if "maps.google.com" in href or "goo.gl/maps" in href:
                    maps_match = re.search(r"[?&]q=([^&]+)", href)
                    if maps_match:
                        raw_query = maps_match.group(1).replace("+", " ")
                        parsed = self._parse_html_address(raw_query)
                        if parsed and parsed.city != "Unknown":
                            return parsed

        return ExtractedLocation()

    def _find_schema_address(self, data) -> Optional[ExtractedLocation]:
        if isinstance(data, list):
            for item in data:
                res = self._find_schema_address(item)
                if res:
                    return res
            return None

        if isinstance(data, dict):
            if "@graph" in data and isinstance(data["@graph"], list):
                return self._find_schema_address(data["@graph"])

            # Check if this object contains "address"
            address_obj = data.get("address")
            if isinstance(address_obj, dict):
                country_raw = str(address_obj.get("addressCountry", "")).strip()
                country = COUNTRY_CODES.get(country_raw.lower(), country_raw) if country_raw else "Unknown"
                state = str(address_obj.get("addressRegion", "")).strip() or "Unknown"
                city = str(address_obj.get("addressLocality", "")).strip() or "Unknown"
                street = str(address_obj.get("streetAddress", "")).strip() or "Unknown"
                zip_code = str(address_obj.get("postalCode", "")).strip() or "Unknown"

                return ExtractedLocation(
                    country=country,
                    state=state,
                    city=city,
                    address=street,
                    postal_code=zip_code
                )

            for val in data.values():
                if isinstance(val, (dict, list)):
                    res = self._find_schema_address(val)
                    if res:
                        return res

        return None

    def _parse_html_address(self, text: str) -> Optional[ExtractedLocation]:
        clean = " ".join(text.split())
        # Check if country name appears at the end
        for code, full_name in COUNTRY_CODES.items():
            if re.search(rf"\b{re.escape(code)}\b|\b{re.escape(full_name)}\b", clean, re.I):
                return ExtractedLocation(country=full_name, address=clean[:150])
        return None
