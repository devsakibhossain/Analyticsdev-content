import logging
from sqlalchemy.orm import Session
from bs4 import BeautifulSoup

from app.models.lead import Lead
from app.models.contact import LeadContact
from app.models.social import LeadSocial
from app.models.technology import LeadTechnology
from app.models.opportunity import LeadOpportunity
from app.crawler.crawler import CrawlReport

from app.extractors.contacts import ContactExtractor
from app.extractors.social import SocialExtractor
from app.extractors.company import CompanyExtractor
from app.extractors.location import LocationExtractor
from app.extractors.industry import IndustryClassifier

from app.detectors.cms import CMSDetector
from app.detectors.ecommerce import EcommerceDetector
from app.detectors.analytics import AnalyticsDetector
from app.detectors.advertising import AdvertisingDetector
from app.detectors.social_pixels import SocialPixelDetector
from app.detectors.tracking import OtherToolsDetector

from app.scoring.opportunities import OpportunityEngine
from app.scoring.lead_score import calculate_lead_score

logger = logging.getLogger(__name__)


def process_lead_pipeline(db: Session, lead: Lead, report: CrawlReport):
    """Run full deterministic extraction, technology detection, opportunity evaluation, and scoring."""
    pages_dicts = [
        {
            "url": p.url,
            "html": p.html,
            "title": p.title,
            "page_type": p.page_type,
            "network_requests": p.network_requests
        }
        for p in report.pages
    ]

    # Clear prior child relations on rescan
    db.query(LeadContact).filter(LeadContact.lead_id == lead.id).delete()
    db.query(LeadSocial).filter(LeadSocial.lead_id == lead.id).delete()
    db.query(LeadTechnology).filter(LeadTechnology.lead_id == lead.id).delete()
    db.query(LeadOpportunity).filter(LeadOpportunity.lead_id == lead.id).delete()

    # 1. Contacts
    contact_extractor = ContactExtractor()
    contacts = contact_extractor.extract_from_pages(pages_dicts)
    for c in contacts:
        db.add(LeadContact(
            lead_id=lead.id,
            contact_type=c.contact_type,
            value=c.value,
            category=c.category,
            source_url=c.source_url
        ))

    # 2. Socials
    social_extractor = SocialExtractor()
    socials = social_extractor.extract_from_pages(pages_dicts)
    for s in socials:
        db.add(LeadSocial(
            lead_id=lead.id,
            platform=s.platform,
            url=s.url,
            source_url=s.source_url
        ))

    # 3. Company Info
    company_extractor = CompanyExtractor()
    comp_info = company_extractor.extract(pages_dicts, default_name=lead.domain)
    lead.company_name = comp_info.company_name
    lead.website_title = comp_info.website_title
    lead.description = comp_info.description

    # 4. Location
    location_extractor = LocationExtractor()
    loc = location_extractor.extract(pages_dicts)
    lead.country = loc.country
    lead.state = loc.state
    lead.city = loc.city
    lead.address = loc.address
    lead.postal_code = loc.postal_code

    # 5. Industry
    industry_classifier = IndustryClassifier()
    ind = industry_classifier.classify(pages_dicts)
    lead.industry = ind.industry
    lead.industry_confidence = ind.confidence

    # 6. CMS
    cms_detector = CMSDetector()
    cms_res = cms_detector.detect(pages_dicts)
    lead.cms = cms_res.name
    if cms_res.name != "Unknown":
        db.add(LeadTechnology(
            lead_id=lead.id,
            category="cms",
            name=cms_res.name,
            status="Detected",
            identifier=None,
            confidence=cms_res.confidence,
            evidence=cms_res.evidence,
            source_url=cms_res.source_url
        ))

    # 7. E-commerce
    ecommerce_detector = EcommerceDetector()
    ecom_res = ecommerce_detector.detect(pages_dicts)
    lead.is_ecommerce = ecom_res.is_ecommerce
    lead.ecommerce_platform = ecom_res.platform
    if ecom_res.is_ecommerce == "Detected":
        db.add(LeadTechnology(
            lead_id=lead.id,
            category="ecommerce",
            name=ecom_res.platform,
            status="Detected",
            identifier=None,
            confidence=ecom_res.confidence,
            evidence=ecom_res.evidence,
            source_url=ecom_res.source_url
        ))

    # 8. Analytics (GA4, GTM, Clarity, Matomo)
    analytics_detector = AnalyticsDetector()
    analytics_items = analytics_detector.detect(pages_dicts)
    for a in analytics_items:
        db.add(LeadTechnology(
            lead_id=lead.id,
            category=a.category,
            name=a.name,
            status=a.status,
            identifier=a.identifier,
            confidence=a.confidence,
            evidence=a.evidence,
            source_url=a.source_url
        ))

    # 9. Advertising (Google Ads)
    ads_detector = AdvertisingDetector()
    ads_res = ads_detector.detect(pages_dicts)
    if ads_res.status == "Detected":
        db.add(LeadTechnology(
            lead_id=lead.id,
            category="advertising",
            name="Google Ads",
            status="Detected",
            identifier=ads_res.identifier,
            confidence=ads_res.confidence,
            evidence=ads_res.evidence,
            source_url=ads_res.source_url
        ))

    # 10. Social Pixels (Meta, TikTok, LinkedIn, Pinterest, etc.)
    pixel_detector = SocialPixelDetector()
    pixel_items = pixel_detector.detect(pages_dicts)
    for px in pixel_items:
        evidence_text = px.evidence
        if px.server_side_note:
            evidence_text += f" | {px.server_side_note}"
        db.add(LeadTechnology(
            lead_id=lead.id,
            category=px.category,
            name=px.name,
            status=px.status,
            identifier=px.identifier,
            confidence=px.confidence,
            evidence=evidence_text,
            source_url=px.source_url
        ))

    # 11. Other Tools (Hotjar, HubSpot, Calendly, Stripe, PayPal, etc.)
    tools_detector = OtherToolsDetector()
    tools_items = tools_detector.detect(pages_dicts)
    for t in tools_items:
        db.add(LeadTechnology(
            lead_id=lead.id,
            category=t.category,
            name=t.name,
            status=t.status,
            identifier=t.identifier,
            confidence=t.confidence,
            evidence=t.evidence,
            source_url=t.source_url
        ))

    # Detect form/booking signals
    has_booking = any(t.name == "Calendly" for t in tools_items)
    has_lead_forms = any(t.name in ("HubSpot", "Intercom") for t in tools_items)
    if not has_lead_forms:
        for p in pages_dicts:
            html = p.get("html", "")
            if "<form" in html.lower() and any(k in html.lower() for k in ("input", "textarea")):
                has_lead_forms = True
                break

    # 12. Evaluate Opportunities
    all_technologies_dicts = [
        {"name": t.name, "category": t.category, "status": t.status, "evidence": t.evidence, "source_url": t.source_url}
        for t in analytics_items + pixel_items + tools_items
    ]
    if ads_res.status == "Detected":
        all_technologies_dicts.append({
            "name": "Google Ads",
            "category": "advertising",
            "status": "Detected",
            "evidence": ads_res.evidence,
            "source_url": ads_res.source_url
        })

    opp_engine = OpportunityEngine()
    opportunities = opp_engine.evaluate(
        technologies=all_technologies_dicts,
        is_ecommerce=(lead.is_ecommerce == "Detected"),
        has_lead_forms=has_lead_forms,
        has_booking=has_booking,
        pages=pages_dicts
    )

    for opp in opportunities:
        db.add(LeadOpportunity(
            lead_id=lead.id,
            opportunity_type=opp.opportunity_type,
            title=opp.title,
            reason=opp.reason,
            evidence=opp.evidence,
            source_url=opp.source_url,
            confidence=opp.confidence
        ))

    # 13. Calculate Lead Score
    has_email = any(c.contact_type == "email" for c in contacts)
    has_phone = any(c.contact_type == "phone" for c in contacts)
    has_location = (lead.country != "Unknown" or lead.city != "Unknown")
    is_ecom = (lead.is_ecommerce == "Detected")
    has_gads = (ads_res.status == "Detected")
    has_meta = any(px.name == "Meta Pixel" for px in pixel_items)
    tech_names = {t["name"] for t in all_technologies_dicts}
    has_ga4_no_gtm = ("Google Analytics 4" in tech_names and "Google Tag Manager" not in tech_names)

    score_result = calculate_lead_score(
        has_email=has_email,
        has_phone=has_phone,
        has_location=has_location,
        is_ecommerce=is_ecom,
        has_google_ads=has_gads,
        has_meta_pixel=has_meta,
        opportunities_count=len(opportunities),
        marketing_tech_count=len(all_technologies_dicts),
        has_lead_or_booking=(has_lead_forms or has_booking),
        has_ga4_without_gtm=has_ga4_no_gtm
    )

    lead.lead_score = score_result.score
    lead.qualification = score_result.qualification
    lead.score_reasons = score_result.score_reasons

    # Aggregate active Ad Platforms
    detected_ad_platforms = []
    if ads_res.status == "Detected":
        detected_ad_platforms.append("Google Ads")
    for px in pixel_items:
        if px.status == "Detected" and px.name not in detected_ad_platforms:
            detected_ad_platforms.append(px.name)
    lead.ad_platforms = detected_ad_platforms
    if not lead.pipeline_stage:
        lead.pipeline_stage = "new"

    db.commit()
    logger.info(f"Pipeline processed lead {lead.domain}: score={lead.lead_score}, qualification={lead.qualification}, ad_platforms={detected_ad_platforms}")

