import re
import json
import logging
from typing import List, Dict, Optional
from dataclasses import dataclass
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

COPYRIGHT_REGEX = re.compile(
    r"(?:©|&copy;|copyright)\s*(?:\d{4})?\s*([A-Za-z0-9\s.,&'-]+?)(?:\.|\s*(?:all rights reserved|inc|llc|ltd|gmbh|corp))",
    re.I
)


@dataclass
class ExtractedCompanyInfo:
    company_name: str
    website_title: str
    description: str
    confidence: float


class CompanyExtractor:
    """Extract business name, site title, and description using Schema, OpenGraph, and HTML."""

    def extract(self, pages: List[dict], default_name: str = "") -> ExtractedCompanyInfo:
        if not pages:
            return ExtractedCompanyInfo(
                company_name=default_name,
                website_title=default_name,
                description="",
                confidence=0.1
            )

        home_page = pages[0]
        html = home_page.get("html", "")
        if not html:
            return ExtractedCompanyInfo(
                company_name=default_name,
                website_title=default_name,
                description="",
                confidence=0.1
            )

        try:
            soup = BeautifulSoup(html, "lxml")
        except Exception:
            soup = BeautifulSoup(html, "html.parser")

        # 1. Page Title
        website_title = ""
        title_tag = soup.find("title")
        if title_tag and title_tag.string:
            website_title = title_tag.string.strip()

        # 2. Meta description
        description = ""
        meta_desc = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
        if meta_desc and meta_desc.get("content"):
            description = meta_desc["content"].strip()
        else:
            og_desc = soup.find("meta", attrs={"property": re.compile(r"^og:description$", re.I)})
            if og_desc and og_desc.get("content"):
                description = og_desc["content"].strip()

        # 3. Company Name candidate discovery
        company_name = ""
        confidence = 0.0

        # High priority: JSON-LD Organization or LocalBusiness
        for script in soup.find_all("script", type="application/ld+json"):
            if script.string:
                try:
                    data = json.loads(script.string)
                    extracted_name = self._find_schema_org_name(data)
                    if extracted_name:
                        company_name = extracted_name
                        confidence = 0.95
                        break
                except Exception:
                    pass

        # Second priority: OpenGraph og:site_name
        if not company_name:
            og_site = soup.find("meta", attrs={"property": re.compile(r"^og:site_name$", re.I)})
            if og_site and og_site.get("content"):
                candidate = og_site["content"].strip()
                if len(candidate) > 1 and len(candidate) < 60:
                    company_name = candidate
                    confidence = 0.85

        # Third priority: Logo alt text in header/nav
        if not company_name:
            header = soup.find(["header", "nav"]) or soup
            logo_img = header.find("img", attrs={"alt": True, "src": re.compile(r"logo", re.I)}) or header.find("img", attrs={"alt": True})
            if logo_img and logo_img.get("alt"):
                alt_text = logo_img["alt"].strip()
                # Clean "Logo" or "Logo of"
                clean_alt = re.sub(r"(?i)\s*logo\s*", "", alt_text).strip()
                if 2 <= len(clean_alt) <= 50:
                    company_name = clean_alt
                    confidence = 0.75

        # Fourth priority: Footer copyright notice
        if not company_name:
            footer = soup.find(["footer", "address"])
            footer_text = footer.get_text(separator=" ") if footer else soup.get_text(separator=" ")
            c_match = COPYRIGHT_REGEX.search(footer_text)
            if c_match:
                cand = c_match.group(1).strip()
                if 2 <= len(cand) <= 50 and not any(w in cand.lower() for w in ("all rights", "wordpress", "theme", "shopify")):
                    company_name = cand
                    confidence = 0.65

        # Fifth priority: Clean site title (e.g. "Acme Corp | High Quality Widgets" -> "Acme Corp")
        if not company_name and website_title:
            parts = re.split(r"[-–—|•:]", website_title)
            if parts:
                first_part = parts[0].strip()
                if 2 <= len(first_part) <= 50:
                    company_name = first_part
                    confidence = 0.50

        # Fallback to default domain
        if not company_name:
            company_name = default_name
            confidence = 0.20

        return ExtractedCompanyInfo(
            company_name=company_name,
            website_title=website_title or default_name,
            description=description,
            confidence=confidence
        )

    def _find_schema_org_name(self, data) -> Optional[str]:
        if isinstance(data, list):
            for item in data:
                res = self._find_schema_org_name(item)
                if res:
                    return res
            return None

        if isinstance(data, dict):
            type_val = data.get("@type", "")
            if isinstance(type_val, list):
                type_val = " ".join(type_val)

            is_org = any(org_type.lower() in str(type_val).lower() for org_type in (
                "organization", "localbusiness", "corporation", "store", "restaurant", "medicalbusiness", "legalService"
            ))
            if is_org and "name" in data and isinstance(data["name"], str):
                name = data["name"].strip()
                if len(name) > 1:
                    return name

            # Search nested graph
            if "@graph" in data and isinstance(data["@graph"], list):
                return self._find_schema_org_name(data["@graph"])

            for val in data.values():
                if isinstance(val, (dict, list)):
                    res = self._find_schema_org_name(val)
                    if res:
                        return res

        return None
