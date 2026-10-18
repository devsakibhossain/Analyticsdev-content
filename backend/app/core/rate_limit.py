import time
import threading
from typing import Dict, List, Tuple, Optional
from fastapi import Request, HTTPException, status

from app.core.security import get_trusted_client_ip


class SlidingWindowRateLimiter:
    """Thread-safe in-memory sliding window rate limiter with auto-cleanup."""

    def __init__(self):
        self._lock = threading.Lock()
        self._records: Dict[str, List[float]] = {}
        self._last_cleanup = time.time()
        self._cleanup_interval = 300  # Cleanup every 5 minutes

    def is_allowed(self, key: str, max_requests: int, window_seconds: float) -> Tuple[bool, int]:
        """Check if an action is allowed under the rate limit."""
        now = time.time()
        cutoff = now - window_seconds

        with self._lock:
            # Periodic cleanup of stale entries to prevent memory leak
            if now - self._last_cleanup > self._cleanup_interval:
                self._cleanup_stale(cutoff)
                self._last_cleanup = now

            timestamps = self._records.get(key, [])
            valid_timestamps = [t for t in timestamps if t > cutoff]

            if len(valid_timestamps) >= max_requests:
                oldest = valid_timestamps[0]
                retry_after = max(1, int(oldest + window_seconds - now))
                self._records[key] = valid_timestamps
                return False, retry_after

            valid_timestamps.append(now)
            self._records[key] = valid_timestamps
            return True, 0

    def _cleanup_stale(self, cutoff: float):
        """Remove expired entries to prevent unbounded memory growth."""
        stale_keys = [
            key for key, timestamps in self._records.items()
            if not timestamps or all(t <= cutoff for t in timestamps)
        ]
        for key in stale_keys:
            del self._records[key]

    def reset(self, key: Optional[str] = None):
        """Reset records for testing or specific key."""
        with self._lock:
            if key:
                self._records.pop(key, None)
            else:
                self._records.clear()


# Global limiter instance
limiter = SlidingWindowRateLimiter()


def rate_limit(max_requests: int = 5, window_seconds: float = 60.0):
    """FastAPI dependency for rate limiting by trusted client IP."""
    def dependency(request: Request):
        client_ip = get_trusted_client_ip(request)
        key = f"{request.url.path}:{client_ip}"
        allowed, retry_after = limiter.is_allowed(key, max_requests, window_seconds)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests. Please try again in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)},
            )
        return True

    return dependency
