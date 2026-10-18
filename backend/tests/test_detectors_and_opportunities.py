try:
    from tests.fixtures.sample_pages import SAMPLE_ECOMMERCE_HTML, SAMPLE_DENTAL_HTML, SAMPLE_SAAS_HTML
except ImportError:
    from backend.tests.fixtures.sample_pages import SAMPLE_ECOMMERCE_HTML, SAMPLE_DENTAL_HTML, SAMPLE_SAAS_HTML
from app.detectors.cms import CMSDetector
from app.detectors.ecommerce import EcommerceDetector
from app.detectors.analytics import AnalyticsDetector
from app.detectors.advertising import AdvertisingDetector
from app.detectors.social_pixels import SocialPixelDetector
from app.detectors.tracking import OtherToolsDetector
from app.scoring.opportunities import OpportunityEngine
from app.scoring.lead_score import calculate_lead_score


def test_cms_detector():
    detector = CMSDetector()

    # Shopify
    shopify_res = detector.detect([{"url": "https://modernapparel.com", "html": SAMPLE_ECOMMERCE_HTML}])
    assert shopify_res.name == "Shopify"

    # WordPress
    wp_res = detector.detect([{"url": "https://austinsmilecenter.com", "html": SAMPLE_DENTAL_HTML}])
    assert wp_res.name == "WordPress"

    # Webflow
    wf_res = detector.detect([{"url": "https://cloudsync.io", "html": SAMPLE_SAAS_HTML}])
    assert wf_res.name == "Webflow"


def test_ecommerce_detector():
    detector = EcommerceDetector()

    # Store
    store_res = detector.detect([{"url": "https://modernapparel.com", "html": SAMPLE_ECOMMERCE_HTML}])
    assert store_res.is_ecommerce == "Detected"
    assert store_res.platform == "Shopify"

    # Non-store
    dental_res = detector.detect([{"url": "https://austinsmilecenter.com", "html": SAMPLE_DENTAL_HTML}])
    assert dental_res.is_ecommerce == "Not detected"


def test_analytics_and_pixels_detection():
    analytics_det = AnalyticsDetector()
    ads_det = AdvertisingDetector()
    pixel_det = SocialPixelDetector()

    pages = [{"url": "https://modernapparel.com", "html": SAMPLE_ECOMMERCE_HTML}]
    analytics = analytics_det.detect(pages)
    ads = ads_det.detect(pages)
    pixels = pixel_det.detect(pages)

    tech_names = {a.name: a for a in analytics}
    pixel_names = {p.name: p for p in pixels}

    # GA4
    assert "Google Analytics 4" in tech_names
    assert tech_names["Google Analytics 4"].identifier == "G-1122334455"

    # Clarity
    assert "Microsoft Clarity" in tech_names
    assert tech_names["Microsoft Clarity"].identifier == "claritytest123"

    # Google Ads
    assert ads.status == "Detected"
    assert ads.identifier == "AW-9988776655"

    # Meta Pixel
    assert "Meta Pixel" in pixel_names
    assert pixel_names["Meta Pixel"].identifier == "123456789012345"
    assert "Server-side Meta CAPI cannot be confirmed" in pixel_names["Meta Pixel"].server_side_note


def test_opportunity_engine_ga4_without_gtm():
    opp_engine = OpportunityEngine()
    technologies = [
        {"name": "Google Analytics 4", "category": "analytics", "status": "Detected", "evidence": "GA4 direct"}
    ]
    opportunities = opp_engine.evaluate(
        technologies=technologies,
        is_ecommerce=False,
        has_lead_forms=False,
        has_booking=False,
        pages=[{"url": "https://example.com", "html": "test"}]
    )

    opp_types = [o.opportunity_type for o in opportunities]
    assert "ga4_audit" in opp_types
    assert any("Tag Management" in o.title for o in opportunities)


def test_opportunity_engine_meta_tracking_audit():
    opp_engine = OpportunityEngine()
    technologies = [
        {"name": "Meta Pixel", "category": "pixel", "status": "Detected", "evidence": "fbq init"}
    ]
    opportunities = opp_engine.evaluate(
        technologies=technologies,
        is_ecommerce=False,
        has_lead_forms=False,
        has_booking=False,
        pages=[{"url": "https://example.com", "html": "test"}]
    )

    opp_types = [o.opportunity_type for o in opportunities]
    assert "meta_audit" in opp_types
    assert any("Server-side Meta CAPI cannot be confirmed" in o.reason for o in opportunities)


def test_lead_score_calculation():
    # E-commerce store with email, phone, location, GA4, Meta, Google Ads, opportunities
    res = calculate_lead_score(
        has_email=True,              # +5
        has_phone=True,              # +5
        has_location=True,           # +5
        is_ecommerce=True,           # +10
        has_google_ads=True,         # +10
        has_meta_pixel=True,         # +10
        opportunities_count=2,       # +20
        marketing_tech_count=4,      # +10
        has_lead_or_booking=True,    # +10
        has_ga4_without_gtm=True     # +5
    )

    assert res.score >= 80
    assert res.qualification == "High Opportunity"
    assert len(res.score_reasons) >= 7
