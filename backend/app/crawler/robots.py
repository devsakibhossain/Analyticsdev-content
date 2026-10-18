import logging
from urllib.parse import urljoin
import httpx
from urllib.robotparser import RobotFileParser
from typing import List, Tuple
from app.crawler.ssrf import validate_url_safe

logger = logging.getLogger(__name__)


class RobotsManager:
    def __init__(self, user_agent: str = "CRMUltraBot"):
        self.user_agent = user_agent
        self.parsers: dict = {}
        self.sitemaps: dict = {}

    async def fetch_and_parse(self, base_url: str, client: httpx.AsyncClient) -> Tuple[bool, List[str]]:
        """
        Fetch robots.txt for the given site, parse rules, and discover sitemaps.
        Returns (success, list_of_sitemap_urls).
        """
        robots_url = urljoin(base_url, "/robots.txt")
        is_safe, error = validate_url_safe(robots_url)
        if not is_safe:
            logger.warning(f"robots.txt SSRF check failed for {robots_url}: {error}")
            return False, []

        sitemaps = []
        rp = RobotFileParser()

        try:
            resp = await client.get(robots_url, timeout=10.0, follow_redirects=True)
            if resp.status_code == 200:
                lines = resp.text.splitlines()
                rp.parse(lines)
                self.parsers[base_url] = rp

                for line in lines:
                    line_clean = line.strip()
                    if line_clean.lower().startswith("sitemap:"):
                        parts = line_clean.split(":", 1)
                        if len(parts) > 1:
                            smap_url = parts[1].strip()
                            if smap_url:
                                sitemaps.append(smap_url)
                
                self.sitemaps[base_url] = sitemaps
                return True, sitemaps
        except Exception as e:
            logger.debug(f"Could not fetch robots.txt for {robots_url}: {e}")

        # If robots.txt unavailable, allow all by default
        return False, []

    def can_fetch(self, base_url: str, url: str) -> bool:
        """Check if crawling the URL is allowed by robots.txt."""
        rp = self.parsers.get(base_url)
        if not rp:
            return True
        try:
            return rp.can_fetch(self.user_agent, url) or rp.can_fetch("*", url)
        except Exception:
            return True
