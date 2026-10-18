import logging
import asyncio
from typing import Optional, List, Tuple
from dataclasses import dataclass, field

from app.config import get_settings
from app.crawler.ssrf import validate_url_safe

logger = logging.getLogger(__name__)
settings = get_settings()

BLOCKED_RESOURCE_TYPES = {"image", "media", "font"}


@dataclass
class BrowserRenderResult:
    url: str
    html: str
    network_requests: List[str] = field(default_factory=list)
    error: Optional[str] = None


class BrowserManager:
    """Manages headless Chromium instances with resource blocking and request logging."""
    _instance: Optional["BrowserManager"] = None
    _playwright = None
    _browser = None
    _lock = asyncio.Lock()

    @classmethod
    async def get_instance(cls) -> "BrowserManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def get_browser(self):
        async with self._lock:
            if self._browser is None:
                try:
                    from playwright.async_api import async_playwright
                    self._playwright = await async_playwright().start()
                    self._browser = await self._playwright.chromium.launch(
                        headless=True,
                        args=[
                            "--no-sandbox",
                            "--disable-setuid-sandbox",
                            "--disable-dev-shm-usage",
                            "--disable-accelerated-2d-canvas",
                            "--no-first-run",
                            "--no-zygote",
                            "--disable-gpu",
                            "--single-process"
                        ]
                    )
                    logger.info("Chromium browser instance launched successfully.")
                except Exception as e:
                    logger.warning(f"Could not launch Playwright Chromium: {e}. Falling back to HTTP-only mode.")
                    self._browser = None
            return self._browser

    async def render_page(self, url: str, timeout_ms: int = 15000) -> BrowserRenderResult:
        """Render page in Chromium, intercepting network tracking scripts."""
        is_safe, error = validate_url_safe(url)
        if not is_safe:
            return BrowserRenderResult(url=url, html="", error=f"SSRF blocked: {error}")

        browser = await self.get_browser()
        if not browser:
            return BrowserRenderResult(url=url, html="", error="Headless browser unavailable")

        network_requests: List[str] = []
        context = None
        page = None

        try:
            context = await browser.new_context(
                user_agent=settings.USER_AGENT,
                viewport={"width": 1280, "height": 800},
                ignore_https_errors=True
            )
            page = await context.new_page()

            # Resource blocking + SSRF protection for subresources
            async def handle_route(route):
                req = route.request
                if req.resource_type in BLOCKED_RESOURCE_TYPES:
                    await route.abort()
                    return
                # Validate subresource URLs against SSRF
                try:
                    sub_safe, sub_err = validate_url_safe(req.url)
                    if not sub_safe:
                        logger.debug(f"SSRF blocked subresource: {req.url} - {sub_err}")
                        await route.abort()
                        return
                except Exception:
                    await route.abort()
                    return
                await route.continue_()

            await page.route("**/*", handle_route)

            # Record outgoing network requests to detect tracking pixels
            def handle_request(req):
                network_requests.append(req.url)

            page.on("request", handle_request)

            # Navigate to target page
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
            # Give short window for asynchronous tracking scripts to fire
            await asyncio.sleep(1.0)

            html = await page.content()
            return BrowserRenderResult(
                url=url,
                html=html,
                network_requests=network_requests,
                error=None
            )

        except Exception as e:
            logger.debug(f"Playwright render error for {url}: {e}")
            return BrowserRenderResult(
                url=url,
                html="",
                network_requests=network_requests,
                error=str(e)
            )
        finally:
            if page:
                try:
                    await page.close()
                except Exception:
                    pass
            if context:
                try:
                    await context.close()
                except Exception:
                    pass

    async def close(self):
        async with self._lock:
            if self._browser:
                await self._browser.close()
                self._browser = None
            if self._playwright:
                await self._playwright.stop()
                self._playwright = None
