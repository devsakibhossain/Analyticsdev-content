from app.crawler.ssrf import validate_url_safe


def test_ssrf_blocks_loopback_ipv4():
    is_safe, error = validate_url_safe("http://127.0.0.1:8000/secret")
    assert is_safe is False
    assert "private/internal" in error or "blocked" in error


def test_ssrf_blocks_localhost():
    is_safe, error = validate_url_safe("http://localhost:3000")
    assert is_safe is False
    assert "Access to 'localhost' is blocked" in error


def test_ssrf_blocks_rfc1918_private_ips():
    # 10.0.0.0/8
    safe_10, _ = validate_url_safe("http://10.0.1.5/admin")
    assert safe_10 is False

    # 172.16.0.0/12
    safe_172, _ = validate_url_safe("http://172.20.10.1/")
    assert safe_172 is False

    # 192.168.0.0/16
    safe_192, _ = validate_url_safe("http://192.168.1.1/router")
    assert safe_192 is False


def test_ssrf_blocks_link_local_cloud_metadata():
    # AWS/GCP metadata IP
    is_safe, error = validate_url_safe("http://169.254.169.254/latest/meta-data/")
    assert is_safe is False


def test_ssrf_blocks_ipv6_loopback():
    is_safe, _ = validate_url_safe("http://[::1]/")
    assert is_safe is False


def test_ssrf_blocks_non_http_schemes():
    safe_ftp, error = validate_url_safe("ftp://example.com/file.txt")
    assert safe_ftp is False
    assert "Unsupported scheme" in error

    safe_file, _ = validate_url_safe("file:///etc/passwd")
    assert safe_file is False


def test_ssrf_blocks_internal_tlds():
    safe_local, _ = validate_url_safe("http://myserver.local/")
    assert safe_local is False

    safe_internal, _ = validate_url_safe("http://database.internal/")
    assert safe_internal is False
