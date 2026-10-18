import asyncio
import logging
import time
from typing import List, Dict, Set, Optional, Callable, Awaitable
from dataclasses import dataclass, field
from bs4 import BeautifulSoup

from app.config import get_settings
from app.crawler.normalizer import (
    normalize_url,
    extract_domain,
    is_internal_url,
    resolve_link,
    categorize_page_type,
)
from app.crawler.ssrf import validate_url_safe
from app.crawler.robots import RobotsManager
from app.crawler.sitemap import SitemapParser
from app.crawler.http_fetcher import SafeHTTPFetcher, FetchResult
from app.crawler.browser import BrowserManager

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class CrawledPageData:
    url: str
    status_code: int
    html: str
    title: str
    page_type: str
    load_time_ms: int
    network_requests: List[str] = field(default_factory=list)


@dataclass
class CrawlErrorData:
    url: str
    error_type: str
    error_message: str


@dataclass
class CrawlReport:
    domain: str
    root_url: str
    pages: List[CrawledPageData]
    errors: List[CrawlErrorData]
    pages_crawled: int
    pages_failed: int
    duration_sec: float


# Callback signature for reporting live progress
ProgressCallback = Callable[[int, str], Awaitable[None]]


class WebsiteCrawler:
    def __init__(
        self,
        max_pages: int = 20,
        use_sitemap: bool = True,
        scan_js: bool = True,
        crawl_delay: float = 1.0,
        progress_callback: Optional[ProgressCallback] = None,
    ):
        self.max_pages = max_pages
        self.use_sitemap = use_sitemap
        self.scan_js = scan_js
        self.crawl_delay = crawl_delay
        self.progress_callback = progress_callback
        self.fetcher = SafeHTTPFetcher()
        self.robots_manager = RobotsManager()

    async def _report_progress(self, percent: int, step_desc: str):
        if self.progress_callback:
            try:
                await self.progress_callback(percent, step_desc)
            except Exception as e:
                logger.debug(f"Progress callback failed: {e}")

    async def crawl(self, start_url: str) -> CrawlReport:
        start_time = time.perf_counter()
        normalized_root = normalize_url(start_url)
        domain = extract_domain(normalized_root)

        await self._report_progress(5, f"Validating {domain} and verifying SSRF security rules")

        is_safe, error = validate_url_safe(normalized_root)
        if not is_safe:
            return CrawlReport(
                domain=domain,
                root_url=normalized_root,
                pages=[],
                errors=[CrawlErrorData(url=normalized_root, error_type="SSRFBlocked", error_message=error or "SSRF check failed")],
                pages_crawled=0,
                pages_failed=1,
                duration_sec=time.perf_counter() - start_time
            )

        # Check robots.txt and sitemap
        await self._report_progress(10, "Checking robots.txt directives")
        import httpx
        sitemaps_declared = []
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            _, sitemaps_declared = await self.robots_manager.fetch_and_parse(normalized_root, client)

        discovered_sitemap_urls = []
        if self.use_sitemap:
            await self._report_progress(15, "Discovering XML sitemap pages")
            async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
                sitemap_parser = SitemapParser(client)
                discovered_sitemap_urls = await sitemap_parser.discover_urls(
                    normalized_root, declared_sitemaps=sitemaps_declared, max_urls=self.max_pages
                )

        # Build prioritized URL queue
        # Priority order: root (home), contact, about, services, products, pricing, booking, sitemaps, others
        url_queue: List[str] = [normalized_root]
        for u in discovered_sitemap_urls:
            if u not in url_queue and is_internal_url(normalized_root, u):
                url_queue.append(u)

        visited: Set[str] = set()
        crawled_pages: List[CrawledPageData] = []
        crawl_errors: List[CrawlErrorData] = []

        browser_manager = await BrowserManager.get_instance() if self.scan_js else None

        while url_queue and len(crawled_pages) < self.max_pages:
            current_url = url_queue.pop(0)
            if current_url in visited:
                continue

            visited.add(current_url)

            # Check robots permission
            if not self.robots_manager.can_fetch(normalized_root, current_url):
                logger.info(f"Skipping {current_url} due to robots.txt rules")
                continue

            current_count = len(crawled_pages) + 1
            progress_pct = 20 + int((current_count / self.max_pages) * 45)  # 20% to 65% during crawling
            await self._report_progress(
                min(progress_pct, 65),
                f"Crawling page {current_count}/{self.max_pages}: {current_url}"
            )

            # Fast fetch first
            res: FetchResult = await self.fetcher.fetch(current_url)

            if res.error or res.status_code >= 400:
                crawl_errors.append(CrawlErrorData(
                    url=current_url,
                    error_type="FetchFailed" if not res.error else "NetworkError",
                    error_message=res.error or f"HTTP {res.status_code}"
                ))
                continue

            html_text = res.text
            network_requests: List[str] = []

            # If JS scanning enabled and this is the root or high priority page, render with Playwright
            page_type = categorize_page_type(current_url)
            if self.scan_js and browser_manager and (page_type in ("home", "contact") or len(crawled_pages) == 0):
                try:
                    render_res = await browser_manager.render_page(current_url)
                    if render_res.html:
                        html_text = render_res.html
                    if render_res.network_requests:
                        network_requests = render_res.network_requests
                except Exception as e:
                    logger.debug(f"Browser rendering fallback for {current_url}: {e}")

            # Parse page title and discover internal links
            title = ""
            try:
                soup = BeautifulSoup(html_text, "lxml")
                title_tag = soup.find("title")
                if title_tag and title_tag.string:
                    title = title_tag.string.strip()

                # Extract internal links
                if len(crawled_pages) + len(url_queue) < self.max_pages * 2:
                    for a_tag in soup.find_all("a", href=True):
                        href = a_tag["href"]
                        resolved = resolve_link(current_url, href)
                        if resolved and is_internal_url(normalized_root, resolved):
                            if resolved not in visited and resolved not in url_queue:
                                # Categorize and insert by priority
                                p_type = categorize_page_type(resolved)
                                if p_type in ("contact", "about", "services", "products", "pricing", "booking"):
                                    # Insert priority pages towards front
                                    url_queue.insert(0, resolved)
                                else:
                                    url_queue.append(resolved)
            except Exception as e:
                logger.debug(f"Error parsing HTML on {current_url}: {e}")

            crawled_pages.append(CrawledPageData(
                url=current_url,
                status_code=res.status_code,
                html=html_text,
                title=title,
                page_type=page_type,
                load_time_ms=res.load_time_ms,
                network_requests=network_requests
            ))

            # Respect crawl delay between requests
            if self.crawl_delay > 0 and url_queue and len(crawled_pages) < self.max_pages:
                await asyncio.sleep(self.crawl_delay)

        total_duration = time.perf_counter() - start_time
        return CrawlReport(
            domain=domain,
            root_url=normalized_root,
            pages=crawled_pages,
            errors=crawl_errors,
            pages_crawled=len(crawled_pages),
            pages_failed=len(crawl_errors),
            duration_sec=total_duration
        )
