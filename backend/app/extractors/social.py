import re
from typing import List, Set, Dict, Optional
from dataclasses import dataclass
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urlunparse

PLATFORM_PATTERNS = [
    ("linkedin", re.compile(r"^(?:https?://)?(?:[a-z]{2,3}\.)?linkedin\.com/(?:company|in|school)/([^/?#]+)", re.I)),
    ("facebook", re.compile(r"^(?:https?://)?(?:www\.)?(?:facebook\.com|fb\.com)/(?!sharer)([^/?#]+)", re.I)),
    ("instagram", re.compile(r"^(?:https?://)?(?:www\.)?instagram\.com/([^/?#]+)", re.I)),
    ("youtube", re.compile(r"^(?:https?://)?(?:www\.)?youtube\.com/(?:@|c/|channel/|user/)?([^/?#]+)", re.I)),
    ("twitter", re.compile(r"^(?:https?://)?(?:www\.)?(?:twitter\.com|x\.com)/(?!intent|share)([^/?#]+)", re.I)),
    ("tiktok", re.compile(r"^(?:https?://)?(?:www\.)?tiktok\.com/@?([^/?#]+)", re.I)),
    ("pinterest", re.compile(r"^(?:https?://)?(?:www\.)?pinterest\.(?:com|[a-z]{2})/(?!pin/create)([^/?#]+)", re.I)),
]

IGNORED_PATHS = {"sharer", "sharer.php", "intent", "share", "tr", "plugins", "dialog"}


@dataclass
class ExtractedSocial:
    platform: str
    url: str
    source_url: str


def clean_social_url(url: str) -> str:
    """Normalize social URL by stripping query and fragment."""
    parsed = urlparse(url)
    scheme = parsed.scheme.lower() or "https"
    netloc = parsed.netloc.lower()
    path = parsed.path.rstrip("/")
    return urlunparse((scheme, netloc, path, "", "", ""))


class SocialExtractor:
    """Extract public social media profile links from crawled pages."""

    def extract_from_pages(self, pages: List[dict]) -> List[ExtractedSocial]:
        socials: List[ExtractedSocial] = []
        seen_urls: Set[str] = set()

        for page in pages:
            url = page.get("url", "")
            html = page.get("html", "")
            if not html:
                continue

            try:
                soup = BeautifulSoup(html, "lxml")
            except Exception:
                soup = BeautifulSoup(html, "html.parser")

            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if not href or href.startswith("#") or href.startswith("javascript:"):
                    continue

                for platform, regex in PLATFORM_PATTERNS:
                    match = regex.search(href)
                    if match:
                        handle = match.group(1).lower()
                        if handle in IGNORED_PATHS or len(handle) < 2:
                            continue

                        cleaned = clean_social_url(href)
                        if cleaned not in seen_urls:
                            seen_urls.add(cleaned)
                            socials.append(ExtractedSocial(
                                platform=platform,
                                url=cleaned,
                                source_url=url
                            ))
                        break

        return socials
