import re
import json
from typing import List, Optional
from dataclasses import dataclass
from bs4 import BeautifulSoup


@dataclass
class DetectedEcommerce:
    is_ecommerce: str  # "Detected" or "Not detected"
    platform: str      # "Shopify", "WooCommerce", "Magento", "BigCommerce", "PrestaShop", "Custom / Generic Store", "Unknown"
    confidence: float
    evidence: str
    source_url: str


ECOMMERCE_PLATFORM_RULES = [
    ("WooCommerce", [
        (re.compile(r"wp-content/plugins/woocommerce", re.I), "WooCommerce plugin asset directory"),
        (re.compile(r"woocommerce-(?:cart|checkout|price)", re.I), "WooCommerce CSS classes"),
        (re.compile(r"wc-ajax=", re.I), "WooCommerce AJAX endpoint"),
    ]),
    ("Shopify", [
        (re.compile(r"cdn\.shopify\.com", re.I), "Shopify CDN asset path"),
        (re.compile(r"Shopify\.Checkout", re.I), "Shopify Checkout object"),
        (re.compile(r"/cart\.js", re.I), "Shopify Cart API"),
    ]),
    ("BigCommerce", [
        (re.compile(r"bigcommerce\.com", re.I), "BigCommerce scripts"),
        (re.compile(r"stencil-", re.I), "BigCommerce Stencil theme framework"),
    ]),
    ("Magento", [
        (re.compile(r"/static/version\d+/frontend/", re.I), "Magento frontend static assets"),
        (re.compile(r"mage/cookies|mage/apply/main", re.I), "Magento requirejs modules"),
    ]),
    ("PrestaShop", [
        (re.compile(r"modules/blockcart", re.I), "PrestaShop cart module"),
        (re.compile(r"prestashop", re.I), "PrestaShop JS object or theme"),
    ]),
]

GENERIC_COMMERCE_PATTERNS = [
    re.compile(r'class=["\'][^"\']*(?:add-to-cart|add_to_cart|cart-btn|btn-checkout)[^"\']*["\']', re.I),
    re.compile(r'href=["\'][^"\']*(?:/cart|/checkout|/basket)[^"\']*["\']', re.I),
    re.compile(r'["\']@type["\']\s*:\s*["\']Product["\']', re.I),
    re.compile(r'["\']@type["\']\s*:\s*["\']Offer["\']', re.I),
]


class EcommerceDetector:
    """Detect e-commerce platform and generic shopping cart signals."""

    def detect(self, pages: List[dict]) -> DetectedEcommerce:
        # 1. Platform-specific signatures
        for page in pages:
            url = page.get("url", "")
            html = page.get("html", "")
            if not html:
                continue

            for platform_name, rules in ECOMMERCE_PLATFORM_RULES:
                for pattern, evidence_desc in rules:
                    match = pattern.search(html)
                    if match:
                        snippet = match.group(0)[:80]
                        return DetectedEcommerce(
                            is_ecommerce="Detected",
                            platform=platform_name,
                            confidence=0.95,
                            evidence=f"{evidence_desc} (matched: {snippet})",
                            source_url=url
                        )

        # 2. Generic e-commerce indicators (cart, checkout, product schema)
        generic_matches = []
        best_url = ""

        for page in pages:
            url = page.get("url", "")
            html = page.get("html", "")
            if not html:
                continue

            for pattern in GENERIC_COMMERCE_PATTERNS:
                match = pattern.search(html)
                if match:
                    if not best_url:
                        best_url = url
                    generic_matches.append(match.group(0)[:60])

        if len(generic_matches) >= 2:
            return DetectedEcommerce(
                is_ecommerce="Detected",
                platform="Custom / Generic Store",
                confidence=0.75,
                evidence=f"Generic commerce signals detected: {', '.join(generic_matches[:2])}",
                source_url=best_url
            )

        return DetectedEcommerce(
            is_ecommerce="Not detected",
            platform="Unknown",
            confidence=0.0,
            evidence="No e-commerce or checkout signals observed",
            source_url=""
        )
