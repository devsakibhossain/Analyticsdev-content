import re
from typing import List, Optional, Dict
from dataclasses import dataclass


@dataclass
class DetectedGoogleAds:
    name: str = "Google Ads"
    status: str = "Not detected"
    identifier: Optional[str] = None
    has_conversion_tracking: bool = False
    has_remarketing: bool = False
    confidence: float = 0.0
    evidence: str = "No Google Ads scripts detected"
    source_url: str = ""


GOOGLE_ADS_AW_REGEX = re.compile(r"\b(AW-\d{7,12})\b")
CONVERSION_EVENT_REGEX = re.compile(r"gtag\s*\(\s*['\"]event['\"]\s*,\s*['\"]conversion['\"]", re.I)
REMARKETING_REGEX = re.compile(r"google_remarketing_only|googleads\.g\.doubleclick\.net", re.I)


class AdvertisingDetector:
    """Detect Google Ads implementation, conversion tracking configurations, and remarketing tags."""

    def detect(self, pages: List[dict]) -> DetectedGoogleAds:
        for page in pages:
            url = page.get("url", "")
            html = page.get("html", "")
            network_reqs = page.get("network_requests", [])
            full_context = html + " " + " ".join(network_reqs)

            aw_match = GOOGLE_ADS_AW_REGEX.search(full_context)
            has_script = "googleadservices.com/pagead/conversion" in full_context or "googleads.g.doubleclick.net" in full_context
            has_conv = bool(CONVERSION_EVENT_REGEX.search(full_context))
            has_remk = bool(REMARKETING_REGEX.search(full_context))

            if aw_match or has_script:
                aw_id = aw_match.group(1) if aw_match else None
                evidence_items = []
                if aw_id:
                    evidence_items.append(f"Google Ads account ID '{aw_id}' found")
                if has_conv:
                    evidence_items.append("gtag conversion event config observed")
                if has_remk:
                    evidence_items.append("Google remarketing tag script observed")
                if has_script and not aw_id:
                    evidence_items.append("Google Ads conversion.js / doubleclick script detected")

                return DetectedGoogleAds(
                    name="Google Ads",
                    status="Detected",
                    identifier=aw_id,
                    has_conversion_tracking=has_conv,
                    has_remarketing=has_remk,
                    confidence=1.0 if aw_id else 0.85,
                    evidence="; ".join(evidence_items),
                    source_url=url
                )

        return DetectedGoogleAds()
