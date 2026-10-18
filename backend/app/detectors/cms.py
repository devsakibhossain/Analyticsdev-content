import re
from typing import List, Optional
from dataclasses import dataclass
from bs4 import BeautifulSoup


@dataclass
class DetectedCMS:
    name: str  # WordPress, Shopify, Wix, Webflow, Squarespace, Joomla, Drupal, Ghost, Magento, Other
    confidence: float
    evidence: str
    source_url: str


CMS_SIGNATURES = [
    ("WordPress", [
        (re.compile(r"wp-content|wp-includes", re.I), "WordPress path wp-content/wp-includes"),
        (re.compile(r'<meta[^>]+name=["\']generator["\'][^>]+content=["\']WordPress', re.I), "WordPress generator meta tag"),
        (re.compile(r"/wp-json/", re.I), "WordPress REST API endpoint"),
    ]),
    ("Shopify", [
        (re.compile(r"cdn\.shopify\.com", re.I), "Shopify CDN asset script"),
        (re.compile(r"Shopify\.shop\s*=", re.I), "Shopify JavaScript global object"),
        (re.compile(r"shopify-section", re.I), "Shopify section theme markup"),
    ]),
    ("Webflow", [
        (re.compile(r"assets(?:-global)?\.website-files\.com", re.I), "Webflow CDN asset path"),
        (re.compile(r'<html[^>]+data-wf-page', re.I), "Webflow HTML data-wf-page attribute"),
        (re.compile(r'<meta[^>]+content=["\']Webflow', re.I), "Webflow meta generator tag"),
    ]),
    ("Wix", [
        (re.compile(r"static\.parastorage\.com|static\.wixstatic\.com", re.I), "Wix static storage assets"),
        (re.compile(r'<meta[^>]+name=["\']generator["\'][^>]+content=["\']Wix\.com', re.I), "Wix generator meta tag"),
        (re.compile(r"wix-warmup-data", re.I), "Wix platform warmup data"),
    ]),
    ("Squarespace", [
        (re.compile(r"static1\.squarespace\.com", re.I), "Squarespace static asset CDN"),
        (re.compile(r"<!-- This is Squarespace\. -->", re.I), "Squarespace HTML comment marker"),
        (re.compile(r"Static\.COOKIE_BANNER_CAPABLE", re.I), "Squarespace runtime configuration"),
    ]),
    ("Joomla", [
        (re.compile(r'<meta[^>]+name=["\']generator["\'][^>]+content=["\']Joomla', re.I), "Joomla generator meta tag"),
        (re.compile(r"/media/jui/|/media/system/js/", re.I), "Joomla script paths"),
    ]),
    ("Drupal", [
        (re.compile(r'<meta[^>]+name=["\']generator["\'][^>]+content=["\']Drupal', re.I), "Drupal generator meta tag"),
        (re.compile(r"drupal\.js|drupalSettings", re.I), "Drupal JS settings object"),
    ]),
    ("Ghost", [
        (re.compile(r'<meta[^>]+name=["\']generator["\'][^>]+content=["\']Ghost', re.I), "Ghost generator meta tag"),
        (re.compile(r"ghost\.org|ghost-theme", re.I), "Ghost theme references"),
    ]),
    ("Magento", [
        (re.compile(r"/static/version\d+/frontend/", re.I), "Magento frontend static versioning"),
        (re.compile(r"Mage\.Cookies|requirejs/require\.js", re.I), "Magento requirejs runtime"),
    ]),
]


class CMSDetector:
    """Detect CMS platform via script paths, meta generator, and DOM signatures."""

    def detect(self, pages: List[dict]) -> DetectedCMS:
        for page in pages:
            url = page.get("url", "")
            html = page.get("html", "")
            if not html:
                continue

            for cms_name, rules in CMS_SIGNATURES:
                for pattern, evidence_desc in rules:
                    match = pattern.search(html)
                    if match:
                        snippet = match.group(0)[:80]
                        return DetectedCMS(
                            name=cms_name,
                            confidence=0.95,
                            evidence=f"{evidence_desc} (matched: {snippet})",
                            source_url=url
                        )

        return DetectedCMS(
            name="Unknown",
            confidence=0.0,
            evidence="No matching CMS signatures identified",
            source_url=""
        )
