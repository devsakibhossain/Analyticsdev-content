import logging
from typing import List, Dict, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class EvaluatedOpportunity:
    opportunity_type: str
    title: str
    reason: str
    evidence: str
    source_url: str
    confidence: float


class OpportunityEngine:
    """Evaluate deterministic tracking and analytics audit opportunities."""

    def evaluate(
        self,
        technologies: List[dict],
        is_ecommerce: bool,
        has_lead_forms: bool,
        has_booking: bool,
        pages: List[dict]
    ) -> List[EvaluatedOpportunity]:
        opportunities: List[EvaluatedOpportunity] = []
        tech_names = {t.get("name") for t in technologies if t.get("status") == "Detected"}
        root_url = pages[0].get("url", "") if pages else ""

        # Tech lookup helper
        def get_tech(name: str) -> Optional[dict]:
            for t in technologies:
                if t.get("name") == name and t.get("status") == "Detected":
                    return t
            return None

        has_ga4 = "Google Analytics 4" in tech_names
        has_gtm = "Google Tag Manager" in tech_names
        has_meta = "Meta Pixel" in tech_names
        has_gads = "Google Ads" in tech_names
        gads_info = get_tech("Google Ads")

        # 1. GA4 without GTM Audit
        if has_ga4 and not has_gtm:
            ga4_tech = get_tech("Google Analytics 4")
            opportunities.append(EvaluatedOpportunity(
                opportunity_type="ga4_audit",
                title="GA4 / Tag Management Audit",
                reason="Google Analytics 4 is hardcoded directly on the site without Google Tag Manager. Implementing GTM will provide server-side capability, clean consent mode, and agile event management.",
                evidence=ga4_tech.get("evidence", "GA4 detected without GTM") if ga4_tech else "GA4 without GTM",
                source_url=ga4_tech.get("source_url", root_url) if ga4_tech else root_url,
                confidence=0.95
            ))

        # 2. Meta Pixel & Server-Side Tracking Audit
        if has_meta:
            meta_tech = get_tech("Meta Pixel")
            opportunities.append(EvaluatedOpportunity(
                opportunity_type="meta_audit",
                title="Meta Tracking Audit",
                reason="Meta Pixel is active on the browser. Server-side Meta CAPI cannot be confirmed from browser-side inspection. Auditing deduplication, EMQ (Event Match Quality), and server-side tracking architecture is recommended.",
                evidence=meta_tech.get("evidence", "Meta Pixel detected") if meta_tech else "Meta Pixel active",
                source_url=meta_tech.get("source_url", root_url) if meta_tech else root_url,
                confidence=0.90
            ))

        # 3. Google Ads Conversion Tracking Audit
        if has_gads:
            # Check if explicit conversion configuration was detected
            has_conv = gads_info and "conversion event" in gads_info.get("evidence", "").lower()
            if not has_conv:
                opportunities.append(EvaluatedOpportunity(
                    opportunity_type="gads_audit",
                    title="Google Ads Conversion Tracking Audit",
                    reason="Google Ads remarketing or tag scripts are detected, but explicit conversion action events were not observed on landing pages. Conversion tracking may be missing or unverified.",
                    evidence=gads_info.get("evidence", "Google Ads active without observed conversions") if gads_info else "Google Ads active",
                    source_url=gads_info.get("source_url", root_url) if gads_info else root_url,
                    confidence=0.85
                ))

        # 4. E-commerce Measurement Audit
        if is_ecommerce and (has_ga4 or has_gtm):
            opportunities.append(EvaluatedOpportunity(
                opportunity_type="ecommerce_audit",
                title="E-commerce Measurement Audit",
                reason="Active e-commerce signals detected alongside web analytics. E-commerce businesses benefit greatly from standard GA4 purchase event tracking, cart abandonment analytics, and product performance funnels.",
                evidence="E-commerce store detected with analytics active",
                source_url=root_url,
                confidence=0.85
            ))

        # 5. Lead Generation / Booking Conversion Audit
        if (has_lead_forms or has_booking) and (has_ga4 or has_meta or has_gads):
            source_page = ""
            for p in pages:
                if p.get("page_type") in ("contact", "booking"):
                    source_page = p.get("url", "")
                    break
            if not source_page:
                source_page = root_url

            opportunities.append(EvaluatedOpportunity(
                opportunity_type="lead_audit",
                title="Lead Conversion Tracking Audit",
                reason="Lead generation forms or appointment booking workflows were discovered on this site. Ensuring accurate submission events are pushed to GA4 and ad platforms ensures higher ROAS and accurate attribution.",
                evidence="Contact lead forms or booking widgets detected with advertising/analytics stack",
                source_url=source_page,
                confidence=0.80
            ))

        return opportunities
