import re
from typing import List, Optional, Dict
from dataclasses import dataclass


@dataclass
class DetectedToolItem:
    category: str  # "crm", "payment", "booking", "behavior", "widget"
    name: str
    status: str
    identifier: Optional[str]
    confidence: float
    evidence: str
    source_url: str


TOOL_SIGNATURES = [
    ("Hotjar", "behavior", [
        (re.compile(r"static\.hotjar\.com|hjid:\s*(\d+)", re.I), "Hotjar session recording script"),
    ]),
    ("HubSpot", "crm", [
        (re.compile(r"js\.hs-scripts\.com/(\d+)\.js|js\.hsforms\.net", re.I), "HubSpot lead tracking / forms"),
    ]),
    ("Intercom", "crm", [
        (re.compile(r"widget\.intercom\.io/widget/([a-zA-Z0-9]+)", re.I), "Intercom live chat messenger"),
    ]),
    ("Klaviyo", "crm", [
        (re.compile(r"static\.klaviyo\.com/onsite/js/klaviyo\.js\?company_id=([a-zA-Z0-9]+)", re.I), "Klaviyo e-commerce marketing platform"),
    ]),
    ("Stripe", "payment", [
        (re.compile(r"js\.stripe\.com/v3", re.I), "Stripe payment gateway integration"),
    ]),
    ("PayPal", "payment", [
        (re.compile(r"paypal\.com/sdk/js", re.I), "PayPal checkout SDK"),
    ]),
    ("Calendly", "booking", [
        (re.compile(r"assets\.calendly\.com/assets/external/widget\.js|calendly\.com/", re.I), "Calendly appointment booking widget"),
    ]),
    ("Google Maps", "widget", [
        (re.compile(r"maps\.googleapis\.com/maps/api/js", re.I), "Google Maps JavaScript API embed"),
    ]),
]


class OtherToolsDetector:
    """Detect CRM, payment gateways, booking widgets, and session replay tools."""

    def detect(self, pages: List[dict]) -> List[DetectedToolItem]:
        results: List[DetectedToolItem] = []
        found: Dict[str, DetectedToolItem] = {}

        for page in pages:
            url = page.get("url", "")
            html = page.get("html", "")
            network_reqs = page.get("network_requests", [])
            full_context = html + " " + " ".join(network_reqs)

            if not full_context.strip():
                continue

            for tool_name, category, rules in TOOL_SIGNATURES:
                if tool_name in found:
                    continue

                for pattern, evidence_desc in rules:
                    match = pattern.search(full_context)
                    if match:
                        tool_id = None
                        if match.groups():
                            tool_id = match.group(1)
                        found[tool_name] = DetectedToolItem(
                            category=category,
                            name=tool_name,
                            status="Detected",
                            identifier=tool_id,
                            confidence=0.95,
                            evidence=f"{evidence_desc} (matched: {match.group(0)[:60]})",
                            source_url=url
                        )
                        break

        return list(found.values())
