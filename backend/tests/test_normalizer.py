from app.crawler.normalizer import (
    normalize_url,
    extract_domain,
    is_internal_url,
    resolve_link,
    categorize_page_type,
)


def test_normalize_url_basic():
    assert normalize_url("example.com") == "https://example.com/"
    assert normalize_url("http://example.com") == "http://example.com/"
    assert normalize_url("https://EXAMPLE.COM/about") == "https://example.com/about"


def test_normalize_url_strips_fragments_and_tracking_params():
    url = "https://example.com/pricing?utm_source=facebook&utm_campaign=winter&page=2&gclid=xyz#cta"
    normalized = normalize_url(url)
    assert "#cta" not in normalized
    assert "utm_source" not in normalized
    assert "gclid" not in normalized
    assert "page=2" in normalized
    assert normalized == "https://example.com/pricing?page=2"


def test_extract_domain():
    assert extract_domain("https://shop.example.com/items?id=1") == "shop.example.com"
    assert extract_domain("http://example.org:8080/test") == "example.org"


def test_is_internal_url():
    base = "https://example.com"
    assert is_internal_url(base, "https://example.com/about") is True
    assert is_internal_url(base, "https://www.example.com/contact") is True
    assert is_internal_url("https://www.example.com", "https://example.com/services") is True
    assert is_internal_url(base, "https://otherdomain.com/page") is False


def test_resolve_link():
    base = "https://example.com/blog/"
    assert resolve_link(base, "../contact") == "https://example.com/contact"
    assert resolve_link(base, "/pricing") == "https://example.com/pricing"
    assert resolve_link(base, "javascript:void(0)") == ""
    assert resolve_link(base, "mailto:info@example.com") == ""


def test_categorize_page_type():
    assert categorize_page_type("https://example.com/") == "home"
    assert categorize_page_type("https://example.com/contact-us") == "contact"
    assert categorize_page_type("https://example.com/about-our-company") == "about"
    assert categorize_page_type("https://example.com/services/seo") == "services"
    assert categorize_page_type("https://example.com/products/shoes") == "products"
    assert categorize_page_type("https://example.com/pricing-plans") == "pricing"
    assert categorize_page_type("https://example.com/schedule-appointment") == "booking"
    assert categorize_page_type("https://example.com/terms-and-conditions") == "other"
