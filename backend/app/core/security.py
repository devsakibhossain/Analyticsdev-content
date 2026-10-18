import html
import re
import secrets
import ipaddress
import logging
from datetime import datetime, timezone
from typing import Optional, Tuple
from fastapi import Request

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# --- Password Policy ---

def validate_password_strength(password: str) -> Tuple[bool, str]:
    """Enforce strong password policy."""
    min_len = settings.PASSWORD_MIN_LENGTH
    if len(password) < min_len:
        return False, f"Password must be at least {min_len} characters long."
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r'[0-9]', password):
        return False, "Password must contain at least one digit."
    if not re.search(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]', password):
        return False, "Password must contain at least one special character."
    # Check common weak passwords
    common_passwords = {
        'password', 'password1', '12345678', 'qwerty123', 'admin123',
        'letmein', 'welcome', 'monkey123', 'dragon', 'master',
        'admin123456', 'password123', 'abc12345'
    }
    if password.lower() in common_passwords:
        return False, "This password is too common. Please choose a stronger one."
    return True, "Password meets requirements."


# --- HTML Sanitization ---

def sanitize_html_input(text: str) -> str:
    """Escape HTML special characters to prevent XSS."""
    return html.escape(text, quote=True)


def sanitize_url(url: str) -> str:
    """Sanitize URL to prevent javascript: and data: URI injection."""
    url = url.strip()
    lower = url.lower()
    if lower.startswith(('javascript:', 'data:', 'vbscript:')):
        return ''
    return sanitize_html_input(url)


# --- CSV Formula Injection Prevention ---

def sanitize_csv_value(value) -> str:
    """Prevent CSV formula injection (CWE-1236)."""
    if value is None:
        return ''
    s = str(value)
    if s and s[0] in ('=', '+', '-', '@', '\t', '\r', '\n'):
        return "'" + s
    return s


# --- Trusted Proxy IP Resolution ---

def get_trusted_client_ip(request: Request) -> str:
    """Extract real client IP, only trusting X-Forwarded-For from known proxies."""
    client_ip = request.client.host if request.client else "unknown"
    
    # Parse trusted proxy CIDR ranges
    trusted_ranges = []
    for cidr in settings.TRUSTED_PROXY_IPS.split(','):
        cidr = cidr.strip()
        if cidr:
            try:
                trusted_ranges.append(ipaddress.ip_network(cidr, strict=False))
            except ValueError:
                continue
    
    # Only trust X-Forwarded-For if request comes from a trusted proxy
    is_trusted = False
    try:
        client_addr = ipaddress.ip_address(client_ip)
        is_trusted = any(client_addr in net for net in trusted_ranges)
    except ValueError:
        pass
    
    if is_trusted:
        xff = request.headers.get('X-Forwarded-For')
        if xff:
            # Take the rightmost non-trusted IP (closest to client)
            parts = [p.strip() for p in xff.split(',')]
            for ip_str in parts:
                try:
                    ip_obj = ipaddress.ip_address(ip_str)
                    if not any(ip_obj in net for net in trusted_ranges):
                        return ip_str
                except ValueError:
                    continue
        x_real = request.headers.get('X-Real-IP')
        if x_real:
            return x_real.strip()
    
    return client_ip


# --- Login Audit Logger ---

def log_login_attempt(email: str, ip: str, user_agent: str, success: bool, reason: str = ""):
    """Log authentication attempt for security audit trail."""
    status = "SUCCESS" if success else "FAILED"
    logger.warning(
        f"AUTH_AUDIT | {status} | email={email} | ip={ip} | "
        f"ua={user_agent[:100]} | reason={reason}"
    )


# --- Generate Secure Token ---

def generate_secure_token(nbytes: int = 32) -> str:
    """Generate a cryptographically secure token."""
    return secrets.token_urlsafe(nbytes)
