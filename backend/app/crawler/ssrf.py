import ipaddress
import socket
from urllib.parse import urlparse
from typing import Tuple, Optional


# Disallowed IP networks
BLOCKED_NETWORKS = [
    ipaddress.ip_network("0.0.0.0/8"),          # Current network
    ipaddress.ip_network("10.0.0.0/8"),         # RFC 1918 Private
    ipaddress.ip_network("127.0.0.0/8"),        # Loopback
    ipaddress.ip_network("169.254.0.0/16"),     # Link-Local (APIPA / AWS metadata)
    ipaddress.ip_network("172.16.0.0/12"),      # RFC 1918 Private
    ipaddress.ip_network("192.168.0.0/16"),     # RFC 1918 Private
    ipaddress.ip_network("224.0.0.0/4"),        # Multicast
    ipaddress.ip_network("240.0.0.0/4"),        # Reserved
    ipaddress.ip_network("255.255.255.255/32"), # Broadcast
    ipaddress.ip_network("::1/128"),            # IPv6 Loopback
    ipaddress.ip_network("fc00::/7"),           # IPv6 Unique Local Address (ULA)
    ipaddress.ip_network("fe80::/10"),          # IPv6 Link-Local
    ipaddress.ip_network("ff00::/8"),           # IPv6 Multicast
]

BLOCKED_HOSTNAMES = {
    "localhost",
    "ip6-localhost",
    "ip6-loopback",
    "metadata.google.internal",
    "instance-data",
}


def is_ip_blocked(ip_obj: ipaddress._BaseAddress) -> bool:
    """Check if an IP address belongs to any blocked or private network."""
    if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved or ip_obj.is_multicast:
        return True
    for net in BLOCKED_NETWORKS:
        if ip_obj in net:
            return True
    return False


def validate_url_safe(url: str) -> Tuple[bool, Optional[str]]:
    """
    Validate a URL for SSRF vulnerabilities.
    Returns (is_safe, error_reason).
    """
    try:
        parsed = urlparse(url)
    except Exception as e:
        return False, f"Invalid URL parsing: {str(e)}"

    # Scheme check: HTTP/HTTPS only
    if parsed.scheme.lower() not in ("http", "https"):
        return False, f"Unsupported scheme: {parsed.scheme}. Only HTTP/HTTPS permitted."

    hostname = parsed.hostname
    if not hostname:
        return False, "Missing hostname in URL."

    hostname_lower = hostname.lower()

    # Blocked known internal hostnames
    if hostname_lower in BLOCKED_HOSTNAMES:
        return False, f"Access to '{hostname}' is blocked."

    if hostname_lower.endswith(".local") or hostname_lower.endswith(".internal") or hostname_lower.endswith(".localhost"):
        return False, f"Access to internal domain '{hostname}' is blocked."

    # Check if hostname is direct IP literal
    try:
        ip_obj = ipaddress.ip_address(hostname_lower)
        if is_ip_blocked(ip_obj):
            return False, f"Access to private/internal IP '{ip_obj}' is forbidden."
        return True, None
    except ValueError:
        # Hostname is a domain name, proceed to DNS resolution check
        pass

    # Resolve hostname via DNS and check all resolved IPs
    try:
        addr_info = socket.getaddrinfo(hostname, None)
        if not addr_info:
            return False, f"Hostname '{hostname}' could not be resolved."

        for entry in addr_info:
            ip_str = entry[4][0]
            try:
                ip_obj = ipaddress.ip_address(ip_str)
                if is_ip_blocked(ip_obj):
                    return False, f"Resolved IP '{ip_str}' for host '{hostname}' is in a private/blocked subnet."
            except ValueError:
                continue

    except socket.gaierror as e:
        return False, f"DNS resolution failed for '{hostname}': {str(e)}"
    except Exception as e:
        return False, f"Error validating host '{hostname}': {str(e)}"

    return True, None
