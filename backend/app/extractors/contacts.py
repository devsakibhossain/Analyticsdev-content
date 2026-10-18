import re
import json
import logging
from typing import List, Set, Dict, Optional
from dataclasses import dataclass
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# Excluded email extensions and placeholders
IGNORED_EMAIL_DOMAINS = {"example.com", "domain.com", "yourdomain.com", "email.com", "sentry.io", "wixpress.com"}
IGNORED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js", ".woff", ".woff2", ".ttf"}

EMAIL_REGEX = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"
)

# Standard international and domestic phone regexes
PHONE_REGEX = re.compile(
    r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b"
)

WHATSAPP_LINK_REGEX = re.compile(
    r"(?:https?://)?(?:wa\.me/|api\.whatsapp\.com/send\?(?:.*&)?phone=)(\+?\d+)",
    re.I
)


@dataclass
class ExtractedContact:
    contact_type: str  # 'email', 'phone', 'whatsapp'
    value: str
    category: str      # 'general', 'sales', 'support', 'contact', 'unknown'
    source_url: str


def categorize_email(email: str) -> str:
    local_part = email.split("@")[0].lower()
    if any(k in local_part for k in ("sales", "pricing", "deals", "revenue", "business")):
        return "sales"
    if any(k in local_part for k in ("support", "help", "billing", "service", "care")):
        return "support"
    if any(k in local_part for k in ("contact", "touch")):
        return "contact"
    if any(k in local_part for k in ("info", "hello", "hi", "office", "team", "admin", "inquiry", "enquiries", "inquiries")):
        return "general"
    return "unknown"


def clean_phone(phone_str: str) -> Optional[str]:
    """Clean and validate phone number string."""
    cleaned = re.sub(r"[^\d+]", "", phone_str)
    digits = re.sub(r"[^\d]", "", cleaned)
    # Valid phone numbers usually have between 7 and 15 digits
    if len(digits) < 7 or len(digits) > 15:
        return None
    # Reject strings with all identical digits e.g. 0000000000
    if len(set(digits)) <= 1:
        return None
    return phone_str.strip()


class ContactExtractor:
    """Extract and categorize emails, phones, and WhatsApp links from crawled pages."""

    def extract_from_pages(self, pages: List[dict]) -> List[ExtractedContact]:
        contacts: List[ExtractedContact] = []
        seen_emails: Set[str] = set()
        seen_phones: Set[str] = set()
        seen_whatsapps: Set[str] = set()

        for page in pages:
            url = page.get("url", "")
            html = page.get("html", "")
            if not html:
                continue

            try:
                soup = BeautifulSoup(html, "lxml")
            except Exception:
                soup = BeautifulSoup(html, "html.parser")

            # 1. Extract from mailto: links
            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if href.lower().startswith("mailto:"):
                    raw_email = href[7:].split("?")[0].strip()
                    if raw_email and self._is_valid_email(raw_email):
                        clean_mail = raw_email.lower()
                        if clean_mail not in seen_emails:
                            seen_emails.add(clean_mail)
                            contacts.append(ExtractedContact(
                                contact_type="email",
                                value=clean_mail,
                                category=categorize_email(clean_mail),
                                source_url=url
                            ))

                # 2. Extract from tel: links
                elif href.lower().startswith("tel:"):
                    raw_phone = href[4:].split("?")[0].strip()
                    validated = clean_phone(raw_phone)
                    if validated and validated not in seen_phones:
                        seen_phones.add(validated)
                        contacts.append(ExtractedContact(
                            contact_type="phone",
                            value=validated,
                            category="general",
                            source_url=url
                        ))

                # 3. Extract WhatsApp links
                wa_match = WHATSAPP_LINK_REGEX.search(href)
                if wa_match:
                    wa_number = wa_match.group(1).lstrip("+")
                    if wa_number and wa_number not in seen_whatsapps:
                        seen_whatsapps.add(wa_number)
                        contacts.append(ExtractedContact(
                            contact_type="whatsapp",
                            value=f"+{wa_number}",
                            category="general",
                            source_url=url
                        ))

            # 4. Extract from JSON-LD schema
            for script in soup.find_all("script", type="application/ld+json"):
                if script.string:
                    try:
                        data = json.loads(script.string)
                        self._extract_from_jsonld(data, url, seen_emails, seen_phones, contacts)
                    except Exception:
                        pass

            # 5. Extract emails and phones from page visible text & footer
            page_text = soup.get_text(separator=" ")

            for match in EMAIL_REGEX.finditer(page_text):
                email = match.group(0).lower().strip()
                if self._is_valid_email(email) and email not in seen_emails:
                    seen_emails.add(email)
                    contacts.append(ExtractedContact(
                        contact_type="email",
                        value=email,
                        category=categorize_email(email),
                        source_url=url
                    ))

            # Search specifically in footer or contact areas for phone patterns
            footer_or_contact = soup.find(["footer", "address"]) or soup.find(class_=re.compile(r"contact|footer|header", re.I))
            search_area = footer_or_contact.get_text(separator=" ") if footer_or_contact else page_text

            for match in PHONE_REGEX.finditer(search_area):
                raw_phone = match.group(0).strip()
                validated = clean_phone(raw_phone)
                if validated and validated not in seen_phones:
                    # Guard against capturing dates, sizes, or IDs
                    if not re.match(r"^\d{4}[-.]\d{2}[-.]\d{2}$", raw_phone):
                        seen_phones.add(validated)
                        contacts.append(ExtractedContact(
                            contact_type="phone",
                            value=validated,
                            category="general",
                            source_url=url
                        ))

        return contacts

    def _is_valid_email(self, email: str) -> bool:
        if "@" not in email:
            return False
        for ext in IGNORED_EXTENSIONS:
            if email.endswith(ext):
                return False
        domain = email.split("@")[1].lower()
        if domain in IGNORED_EMAIL_DOMAINS:
            return False
        if len(email) < 6 or len(email) > 100:
            return False
        return bool(EMAIL_REGEX.match(email))

    def _extract_from_jsonld(self, data, url: str, seen_emails: Set[str], seen_phones: Set[str], contacts: List[ExtractedContact]):
        if isinstance(data, list):
            for item in data:
                self._extract_from_jsonld(item, url, seen_emails, seen_phones, contacts)
            return

        if isinstance(data, dict):
            # Check email
            if "email" in data and isinstance(data["email"], str):
                em = data["email"].strip().lower()
                if self._is_valid_email(em) and em not in seen_emails:
                    seen_emails.add(em)
                    contacts.append(ExtractedContact(
                        contact_type="email",
                        value=em,
                        category=categorize_email(em),
                        source_url=url
                    ))

            # Check telephone
            if "telephone" in data and isinstance(data["telephone"], str):
                ph = clean_phone(data["telephone"])
                if ph and ph not in seen_phones:
                    seen_phones.add(ph)
                    contacts.append(ExtractedContact(
                        contact_type="phone",
                        value=ph,
                        category="general",
                        source_url=url
                    ))

            # Recurse child objects
            for val in data.values():
                if isinstance(val, (dict, list)):
                    self._extract_from_jsonld(val, url, seen_emails, seen_phones, contacts)
