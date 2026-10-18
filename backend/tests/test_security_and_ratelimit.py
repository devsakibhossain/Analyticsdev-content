import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.rate_limit import SlidingWindowRateLimiter, limiter


def test_sliding_window_rate_limiter_unit():
    test_limiter = SlidingWindowRateLimiter()
    key = "test_client_ip"

    # Allow 3 requests in 10 seconds
    for _ in range(3):
        allowed, retry_after = test_limiter.is_allowed(key, max_requests=3, window_seconds=10.0)
        assert allowed is True
        assert retry_after == 0

    # 4th request must be denied
    allowed, retry_after = test_limiter.is_allowed(key, max_requests=3, window_seconds=10.0)
    assert allowed is False
    assert retry_after > 0

    # Reset allows again
    test_limiter.reset(key)
    allowed, retry_after = test_limiter.is_allowed(key, max_requests=3, window_seconds=10.0)
    assert allowed is True


def test_login_rate_limiting(client: TestClient):
    # Reset global limiter for login endpoint
    limiter.reset()

    # Attempt 5 incorrect logins - should return 401
    for _ in range(5):
        resp = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "wrongpassword"})
        assert resp.status_code == 401

    # 6th attempt should return 429 Too Many Requests
    resp = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "wrongpassword"})
    assert resp.status_code == 429
    assert "Retry-After" in resp.headers
    assert "Too many requests" in resp.json()["detail"]

    # Clean up limiter for subsequent tests
    limiter.reset()


def test_security_headers_present(client: TestClient):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert resp.headers.get("X-XSS-Protection") == "1; mode=block"
    assert "strict-origin" in resp.headers.get("Referrer-Policy")


def test_payload_too_large_rejection(client: TestClient):
    # Send request with simulated Content-Length exceeding 5MB
    large_header = {"content-length": str(6 * 1024 * 1024)}
    resp = client.post("/api/auth/login", headers=large_header, json={"email": "a@b.com", "password": "x"})
    assert resp.status_code == 413
    assert "Payload too large" in resp.json()["detail"]
