import re
from urllib.parse import urlparse, urlunparse, urljoin, parse_qsl, urlencode


TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "gclid", "fbclid", "msclkid", "mc_eid", "yclid", "_ga", "_gl", "dclid"
}

PAGE_PRIORITIES = [
    ("home", re.compile(r"^https?://[^/]+/?$", re.I)),
    ("contact", re.compile(r"/(contact|contact-us|reach-us|get-in-touch|locations|location)/?", re.I)),
    ("about", re.compile(r"/(about|about-us|our-story|who-we-are|team|leadership)/?", re.I)),
    ("services", re.compile(r"/(services|what-we-do|solutions|offerings|capabilities)/?", re.I)),
    ("products", re.compile(r"/(products|shop|store|collection|catalog)/?", re.I)),
    ("pricing", re.compile(r"/(pricing|plans|packages|rates)/?", re.I)),
    ("booking", re.compile(r"/(book|booking|appointment|schedule|reserve|consultation)/?", re.I)),
    ("blog", re.compile(r"/(blog|news|articles|insights)/?", re.I)),
]


def normalize_url(raw_url: str, default_scheme: str = "https") -> str:
    """Normalize and clean URL for consistent crawling and deduplication."""
    url = raw_url.strip()
    if not url:
        return ""

    # Add scheme if missing
    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"{default_scheme}://{url}"

    parsed = urlparse(url)
    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()

    # Strip default ports
    if netloc.endswith(":80") and scheme == "http":
        netloc = netloc[:-3]
    elif netloc.endswith(":443") and scheme == "https":
        netloc = netloc[:-4]

    # Clean path
    path = parsed.path or "/"
    # Clean double slashes in path
    path = re.sub(r"/{2,}", "/", path)

    # Filter out tracking query params
    filtered_query = []
    if parsed.query:
        query_pairs = parse_qsl(parsed.query, keep_blank_values=False)
        for k, v in query_pairs:
            if k.lower() not in TRACKING_PARAMS:
                filtered_query.append((k, v))
        filtered_query.sort()

    clean_query = urlencode(filtered_query)

    # Fragment (#hash) is removed
    return urlunparse((scheme, netloc, path, "", clean_query, ""))


def extract_domain(url: str) -> str:
    """Extract normalized lowercase host domain from URL."""
    norm = normalize_url(url)
    parsed = urlparse(norm)
    netloc = parsed.netloc.lower()
    # Strip port if present
    if ":" in netloc:
        netloc = netloc.split(":")[0]
    return netloc


def is_internal_url(base_url: str, target_url: str) -> bool:
    """Check if target_url belongs to the same domain or subdomain hierarchy."""
    base_domain = extract_domain(base_url)
    target_domain = extract_domain(target_url)

    if not target_domain:
        return False

    # Exact match
    if base_domain == target_domain:
        return True

    # Check www prefix equivalence (e.g. example.com == www.example.com)
    clean_base = base_domain[4:] if base_domain.startswith("www.") else base_domain
    clean_target = target_domain[4:] if target_domain.startswith("www.") else target_domain

    return clean_base == clean_target


def resolve_link(base_url: str, link: str) -> str:
    """Resolve a relative or absolute link against base URL and normalize it."""
    link = link.strip()
    if not link or link.startswith("javascript:") or link.startswith("mailto:") or link.startswith("tel:"):
        return ""
    joined = urljoin(base_url, link)
    return normalize_url(joined)


def categorize_page_type(url: str, title: str = "") -> str:
    """Categorize page type for prioritized crawling."""
    norm = normalize_url(url)
    for category, pattern in PAGE_PRIORITIES:
        if pattern.search(norm):
            return category

    # Check title hints
    title_lower = title.lower()
    if any(k in title_lower for k in ("contact", "get in touch", "reach us")):
        return "contact"
    if any(k in title_lower for k in ("about us", "who we are", "our story")):
        return "about"
    if any(k in title_lower for k in ("services", "solutions")):
        return "services"
    if any(k in title_lower for k in ("shop", "products", "store")):
        return "products"
    if any(k in title_lower for k in ("pricing", "plans")):
        return "pricing"
    if any(k in title_lower for k in ("book", "appointment", "schedule")):
        return "booking"

    return "other"
