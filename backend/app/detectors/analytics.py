import re
from typing import List, Optional, Dict
from dataclasses import dataclass


@dataclass
class DetectedAnalyticsItem:
    category: str      # "analytics" or "tag_manager"
    name: str          # "Google Analytics 4", "Google Tag Manager", "Microsoft Clarity", "Matomo", etc.
    status: str        # "Detected", "Not detected", "Unknown"
    identifier: Optional[str]
    confidence: float
    evidence: str
    source_url: str


GA4_REGEX = re.compile(r"\b(G-[A-Z0-9]{7,12})\b")
GTM_REGEX = re.compile(r"\b(GTM-[A-Z0-9]{4,10})\b")
CLARITY_TAG_REGEX = re.compile(r"clarity\.ms/tag/([a-zA-Z0-9]+)", re.I)
CLARITY_SNIPPET_REGEX = re.compile(r'["\']clarity["\']\s*,\s*["\']script["\']\s*,\s*["\']([a-zA-Z0-9]+)["\']', re.I)


class AnalyticsDetector:
    """Detect Google Analytics 4, Google Tag Manager, Microsoft Clarity, and other analytics platforms."""

    def detect(self, pages: List[dict]) -> List[DetectedAnalyticsItem]:
        results: List[DetectedAnalyticsItem] = []
        found_techs: Dict[str, DetectedAnalyticsItem] = {}

        for page in pages:
            url = page.get("url", "")
            html = page.get("html", "")
            network_reqs = page.get("network_requests", [])
            full_context = html + " " + " ".join(network_reqs)

            if not full_context.strip():
                continue

            # 1. Google Tag Manager (GTM)
            if "Google Tag Manager" not in found_techs:
                gtm_match = GTM_REGEX.search(full_context)
                if gtm_match:
                    gtm_id = gtm_match.group(1)
                    found_techs["Google Tag Manager"] = DetectedAnalyticsItem(
                        category="tag_manager",
                        name="Google Tag Manager",
                        status="Detected",
                        identifier=gtm_id,
                        confidence=1.0,
                        evidence=f"GTM Container ID '{gtm_id}' found in script or network request",
                        source_url=url
                    )
                elif "googletagmanager.com/gtm.js" in full_context:
                    found_techs["Google Tag Manager"] = DetectedAnalyticsItem(
                        category="tag_manager",
                        name="Google Tag Manager",
                        status="Detected",
                        identifier=None,
                        confidence=0.9,
                        evidence="googletagmanager.com/gtm.js script loader detected",
                        source_url=url
                    )

            # 2. Google Analytics 4 (GA4)
            if "Google Analytics 4" not in found_techs:
                ga4_match = GA4_REGEX.search(full_context)
                if ga4_match:
                    ga4_id = ga4_match.group(1)
                    found_techs["Google Analytics 4"] = DetectedAnalyticsItem(
                        category="analytics",
                        name="Google Analytics 4",
                        status="Detected",
                        identifier=ga4_id,
                        confidence=1.0,
                        evidence=f"GA4 Measurement ID '{ga4_id}' detected in gtag config or network payload",
                        source_url=url
                    )
                elif "googletagmanager.com/gtag/js" in full_context or "google-analytics.com/g/collect" in full_context:
                    found_techs["Google Analytics 4"] = DetectedAnalyticsItem(
                        category="analytics",
                        name="Google Analytics 4",
                        status="Detected",
                        identifier=None,
                        confidence=0.85,
                        evidence="Google gtag.js / g/collect network endpoint observed",
                        source_url=url
                    )

            # 3. Microsoft Clarity
            if "Microsoft Clarity" not in found_techs:
                clarity_match = CLARITY_TAG_REGEX.search(full_context) or CLARITY_SNIPPET_REGEX.search(full_context)
                if clarity_match:
                    project_id = clarity_match.group(1)
                    found_techs["Microsoft Clarity"] = DetectedAnalyticsItem(
                        category="analytics",
                        name="Microsoft Clarity",
                        status="Detected",
                        identifier=project_id,
                        confidence=1.0,
                        evidence=f"Microsoft Clarity project ID '{project_id}' found in script tag",
                        source_url=url
                    )
                elif "clarity.ms" in full_context:
                    found_techs["Microsoft Clarity"] = DetectedAnalyticsItem(
                        category="analytics",
                        name="Microsoft Clarity",
                        status="Detected",
                        identifier=None,
                        confidence=0.9,
                        evidence="clarity.ms tracking script endpoint detected",
                        source_url=url
                    )

            # 4. Matomo / Piwik
            if "Matomo" not in found_techs:
                if "_paq.push" in full_context or "matomo.js" in full_context:
                    found_techs["Matomo"] = DetectedAnalyticsItem(
                        category="analytics",
                        name="Matomo",
                        status="Detected",
                        identifier=None,
                        confidence=0.95,
                        evidence="_paq Matomo tracker script detected",
                        source_url=url
                    )

        return list(found_techs.values())
