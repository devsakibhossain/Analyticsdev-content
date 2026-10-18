import logging
import re
from urllib.parse import urljoin
from typing import List, Set
import httpx
from bs4 import BeautifulSoup
from app.crawler.ssrf import validate_url_safe
from app.crawler.normalizer import normalize_url, is_internal_url

logger = logging.getLogger(__name__)

COMMON_SITEMAP_PATHS = [
    "/sitemap.xml",
    "/sitemap_index.xml",
    "/wp-sitemap.xml",
]


class SitemapParser:
    def __init__(self, client: httpx.AsyncClient):
        self.client = client

    async def discover_urls(self, base_url: str, declared_sitemaps: List[str] = None, max_urls: int = 50) -> List[str]:
        """Discover and extract URLs from sitemaps up to max_urls."""
        sitemap_candidates: List[str] = []
        if declared_sitemaps:
            sitemap_candidates.extend(declared_sitemaps)

        for path in COMMON_SITEMAP_PATHS:
            candidate = urljoin(base_url, path)
            if candidate not in sitemap_candidates:
                sitemap_candidates.append(candidate)

        discovered_urls: Set[str] = set()

        for sitemap_url in sitemap_candidates:
            if len(discovered_urls) >= max_urls:
                break

            is_safe, error = validate_url_safe(sitemap_url)
            if not is_safe:
                continue

            try:
                resp = await self.client.get(sitemap_url, timeout=10.0, follow_redirects=True)
                if resp.status_code != 200 or not resp.text:
                    continue

                # Parse XML or HTML
                soup = BeautifulSoup(resp.content, "xml")
                
                # Check for sitemapindex
                sitemaps = soup.find_all("sitemap")
                if sitemaps:
                    for sm in sitemaps[:3]:  # Follow at most 3 child sitemaps to prevent crawling explosions
                        loc = sm.find("loc")
                        if loc and loc.text:
                            child_url = loc.text.strip()
                            child_safe, _ = validate_url_safe(child_url)
                            if child_safe:
                                try:
                                    child_resp = await self.client.get(child_url, timeout=10.0, follow_redirects=True)
                                    if child_resp.status_code == 200:
                                        child_soup = BeautifulSoup(child_resp.content, "xml")
                                        for url_tag in child_soup.find_all("url"):
                                            u_loc = url_tag.find("loc")
                                            if u_loc and u_loc.text:
                                                clean = normalize_url(u_loc.text.strip())
                                                if is_internal_url(base_url, clean):
                                                    discovered_urls.add(clean)
                                                    if len(discovered_urls) >= max_urls:
                                                        break
                                except Exception:
                                    pass

                # Standard urlset
                for url_tag in soup.find_all("url"):
                    loc = url_tag.find("loc")
                    if loc and loc.text:
                        clean = normalize_url(loc.text.strip())
                        if is_internal_url(base_url, clean):
                            discovered_urls.add(clean)
                            if len(discovered_urls) >= max_urls:
                                break

            except Exception as e:
                logger.debug(f"Error parsing sitemap {sitemap_url}: {e}")

        return list(discovered_urls)
