try:
    from tests.fixtures.sample_pages import SAMPLE_ECOMMERCE_HTML, SAMPLE_DENTAL_HTML, SAMPLE_SAAS_HTML
except ImportError:
    from backend.tests.fixtures.sample_pages import SAMPLE_ECOMMERCE_HTML, SAMPLE_DENTAL_HTML, SAMPLE_SAAS_HTML
from app.extractors.contacts import ContactExtractor
from app.extractors.social import SocialExtractor
from app.extractors.company import CompanyExtractor
from app.extractors.location import LocationExtractor
from app.extractors.industry import IndustryClassifier


def test_contact_extractor_ecommerce():
    extractor = ContactExtractor()
    pages = [{"url": "https://modernapparel.com", "html": SAMPLE_ECOMMERCE_HTML}]
    contacts = extractor.extract_from_pages(pages)

    contact_values = {c.value: c for c in contacts}
    
    # Check emails
    assert "sales@modernapparel.com" in contact_values
    assert contact_values["sales@modernapparel.com"].category == "sales"
    assert "orders@modernapparel.com" in contact_values

    # Check phones
    phones = [c.value for c in contacts if c.contact_type == "phone"]
    assert any("800-555-0199" in p for p in phones)

    # Check WhatsApp
    whatsapps = [c.value for c in contacts if c.contact_type == "whatsapp"]
    assert len(whatsapps) > 0
    assert "18005550199" in whatsapps[0]


def test_contact_extractor_dental():
    extractor = ContactExtractor()
    pages = [{"url": "https://austinsmilecenter.com", "html": SAMPLE_DENTAL_HTML}]
    contacts = extractor.extract_from_pages(pages)

    contact_values = {c.value: c for c in contacts}
    assert "contact@austinsmilecenter.com" in contact_values
    assert contact_values["contact@austinsmilecenter.com"].category == "contact"

    phones = [c.value for c in contacts if c.contact_type == "phone"]
    assert any("512" in p for p in phones)


def test_social_extractor():
    extractor = SocialExtractor()
    pages = [{"url": "https://modernapparel.com", "html": SAMPLE_ECOMMERCE_HTML}]
    socials = extractor.extract_from_pages(pages)

    platforms = {s.platform: s.url for s in socials}
    assert "instagram" in platforms
    assert "https://www.instagram.com/modernapparel" in platforms["instagram"]
    assert "facebook" in platforms
    assert "tiktok" in platforms


def test_company_extractor():
    extractor = CompanyExtractor()
    pages = [{"url": "https://modernapparel.com", "html": SAMPLE_ECOMMERCE_HTML}]
    comp = extractor.extract(pages, default_name="modernapparel.com")

    assert comp.company_name == "Modern Apparel"
    assert "Modern Apparel" in comp.website_title
    assert "organic" in comp.description.lower()
    assert comp.confidence >= 0.7


def test_location_extractor():
    extractor = LocationExtractor()
    pages = [{"url": "https://austinsmilecenter.com", "html": SAMPLE_DENTAL_HTML}]
    loc = extractor.extract(pages)

    assert loc.city == "Austin"
    assert loc.state == "TX"
    assert loc.postal_code == "78701"
    assert loc.country in ("United States", "US")


def test_industry_classifier():
    classifier = IndustryClassifier()

    # Dental
    dental_res = classifier.classify([{"url": "https://austinsmilecenter.com", "html": SAMPLE_DENTAL_HTML}])
    assert dental_res.industry == "Dental"
    assert dental_res.confidence >= 0.5

    # E-commerce
    ecom_res = classifier.classify([{"url": "https://modernapparel.com", "html": SAMPLE_ECOMMERCE_HTML}])
    assert ecom_res.industry == "E-commerce"

    # SaaS
    saas_res = classifier.classify([{"url": "https://cloudsync.io", "html": SAMPLE_SAAS_HTML}])
    assert saas_res.industry == "SaaS"
