import time
import logging
from typing import Optional
from dataclasses import dataclass
from urllib.parse import urlparse
import httpx

from app.config import get_settings
from app.crawler.ssrf import validate_url_safe

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class FetchResult:
    url: str
    final_url: str
    status_code: int
    content: bytes
    text: str
    headers: dict
    load_time_ms: int
    error: Optional[str] = None


class SafeHTTPFetcher:
    def __init__(self, user_agent: Optional[str] = None, timeout_ms: Optional[int] = None):
        self.user_agent = user_agent or settings.USER_AGENT
        self.timeout_sec = (timeout_ms or settings.REQUEST_TIMEOUT) / 1000.0

    async def fetch(self, url: str) -> FetchResult:
        """Fetch URL with SSRF checks, redirect validation, and payload size bounds."""
        start_time = time.perf_counter()

        is_safe, error = validate_url_safe(url)
        if not is_safe:
            return FetchResult(
                url=url,
                final_url=url,
                status_code=0,
                content=b"",
                text="",
                headers={},
                load_time_ms=0,
                error=f"SSRF validation blocked request: {error}"
            )

        headers = {
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

        # Follow redirects manually to validate each step against SSRF
        current_url = url
        max_redirects = 5

        async with httpx.AsyncClient(headers=headers, timeout=self.timeout_sec, verify=False) as client:
            for _ in range(max_redirects):
                try:
                    resp = await client.get(current_url, follow_redirects=False)
                    
                    # Handle redirects
                    if resp.is_redirect:
                        location = resp.headers.get("location")
                        if not location:
                            break
                        from app.crawler.normalizer import resolve_link
                        next_url = resolve_link(current_url, location)
                        is_next_safe, next_err = validate_url_safe(next_url)
                        if not is_next_safe:
                            return FetchResult(
                                url=url,
                                final_url=current_url,
                                status_code=resp.status_code,
                                content=b"",
                                text="",
                                headers=dict(resp.headers),
                                load_time_ms=int((time.perf_counter() - start_time) * 1000),
                                error=f"Redirect to {next_url} blocked by SSRF filter: {next_err}"
                            )
                        current_url = next_url
                        continue

                    # Read limited content size
                    content = resp.content
                    if len(content) > settings.MAX_PAGE_SIZE_BYTES:
                        content = content[:settings.MAX_PAGE_SIZE_BYTES]

                    load_time_ms = int((time.perf_counter() - start_time) * 1000)

                    return FetchResult(
                        url=url,
                        final_url=str(resp.url),
                        status_code=resp.status_code,
                        content=content,
                        text=resp.text,
                        headers=dict(resp.headers),
                        load_time_ms=load_time_ms,
                        error=None
                    )

                except httpx.TimeoutException:
                    return FetchResult(
                        url=url,
                        final_url=current_url,
                        status_code=0,
                        content=b"",
                        text="",
                        headers={},
                        load_time_ms=int((time.perf_counter() - start_time) * 1000),
                        error="Request timed out"
                    )
                except httpx.RequestError as e:
                    return FetchResult(
                        url=url,
                        final_url=current_url,
                        status_code=0,
                        content=b"",
                        text="",
                        headers={},
                        load_time_ms=int((time.perf_counter() - start_time) * 1000),
                        error=f"Network error: {str(e)}"
                    )
                except Exception as e:
                    return FetchResult(
                        url=url,
                        final_url=current_url,
                        status_code=0,
                        content=b"",
                        text="",
                        headers={},
                        load_time_ms=int((time.perf_counter() - start_time) * 1000),
                        error=f"Fetch failed: {str(e)}"
                    )

        return FetchResult(
            url=url,
            final_url=current_url,
            status_code=0,
            content=b"",
            text="",
            headers={},
            load_time_ms=int((time.perf_counter() - start_time) * 1000),
            error="Too many redirects"
        )
