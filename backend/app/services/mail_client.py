import logging
import httpx
from typing import Dict, Any, Optional, List
from app.config import settings

logger = logging.getLogger(__name__)


class HostingerMailClient:
    """Client for Hostinger Agentic Mail API."""

    def __init__(self):
        self.base_url = settings.HOSTINGER_MAIL_API_URL.rstrip("/")
        self.api_token = settings.HOSTINGER_MAIL_API_TOKEN
        self.resource_id = settings.HOSTINGER_MAIL_RESOURCE_ID
        self.from_email = settings.HOSTINGER_MAIL_FROM_EMAIL
        self.display_name = settings.HOSTINGER_MAIL_DISPLAY_NAME

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    async def get_mailbox_status(self) -> Dict[str, Any]:
        """Fetch account overview, mailbox resource details, and storage quota."""
        if not self.api_token or not self.resource_id:
            return {
                "connected": False,
                "error": "Hostinger Mail API credentials not configured."
            }

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                # 1. Check account info (/api/v1/me)
                me_resp = await client.get(f"{self.base_url}/api/v1/me", headers=self._headers())
                if me_resp.status_code != 200:
                    return {
                        "connected": False,
                        "status_code": me_resp.status_code,
                        "error": me_resp.text
                    }
                me_data = me_resp.json().get("data", {})
                
                # 2. Check quota (/api/v1/mailboxes/{resourceId}/quota)
                quota_resp = await client.get(
                    f"{self.base_url}/api/v1/mailboxes/{self.resource_id}/quota",
                    headers=self._headers()
                )
                quota_data = quota_resp.json().get("data", {}) if quota_resp.status_code == 200 else {}

                # 3. Check folders (/api/v1/mailboxes/{resourceId}/folders)
                folders_resp = await client.get(
                    f"{self.base_url}/api/v1/mailboxes/{self.resource_id}/folders",
                    headers=self._headers()
                )
                folders = folders_resp.json().get("data", []) if folders_resp.status_code == 200 else []
                
                inbox_folder = next((f for f in folders if "inbox" in f.get("name", "").lower()), {})
                sent_folder = next((f for f in folders if "sent" in f.get("name", "").lower()), {})

                return {
                    "connected": True,
                    "address": self.from_email,
                    "display_name": self.display_name,
                    "mailbox_resource_id": self.resource_id,
                    "order_resource_id": me_data.get("orderResourceId"),
                    "inbox_messages": inbox_folder.get("messageCount", 0),
                    "sent_messages": sent_folder.get("messageCount", 0),
                    "storage_usage_kb": quota_data.get("totalUsage", 0),
                    "storage_limit_kb": quota_data.get("totalLimit", 0),
                    "storage_percentage": quota_data.get("totalPercentage", 0),
                }
            except Exception as e:
                logger.error(f"Error checking Hostinger Mail status: {e}")
                return {
                    "connected": False,
                    "error": str(e)
                }

    async def get_messages(self, folder: str = "INBOX", limit: int = 50, page: int = 1) -> Dict[str, Any]:
        """Fetch message headers/list for a specific mailbox folder."""
        if not self.api_token or not self.resource_id:
            return {"data": [], "pagination": {}}

        url = f"{self.base_url}/api/v1/mailboxes/{self.resource_id}/folders/{folder}/messages"
        params = {"perPage": limit, "page": page}

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                resp = await client.get(url, params=params, headers=self._headers())
                if resp.status_code == 200:
                    return resp.json()
                logger.warning(f"Failed to fetch {folder} messages: {resp.status_code} {resp.text}")
                return {"data": [], "pagination": {}}
            except Exception as e:
                logger.error(f"Error fetching messages from {folder}: {e}")
                return {"data": [], "pagination": {}}

    async def get_message_detail(self, uid: int, folder: str = "INBOX") -> Optional[Dict[str, Any]]:
        """Fetch and parse raw MIME source for a message."""
        import email
        from email import policy

        if not self.api_token or not self.resource_id:
            return None

        url = f"{self.base_url}/api/v1/mailboxes/{self.resource_id}/folders/{folder}/messages/{uid}/source"

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                resp = await client.get(url, headers=self._headers())
                if resp.status_code != 200:
                    return None

                msg = email.message_from_string(resp.text, policy=policy.default)
                subject = str(msg.get("subject", "") or "")
                from_header = str(msg.get("from", "") or "")
                to_header = str(msg.get("to", "") or "")
                date_header = str(msg.get("date", "") or "")
                message_id = str(msg.get("message-id", "") or "")
                in_reply_to = str(msg.get("in-reply-to", "") or "")

                # Extract body text and html
                body_text = ""
                body_html = ""
                if msg.is_multipart():
                    for part in msg.walk():
                        ctype = part.get_content_type()
                        cdisp = str(part.get("Content-Disposition") or "")
                        if "attachment" not in cdisp:
                            if ctype == "text/plain" and not body_text:
                                try:
                                    body_text = part.get_content()
                                except Exception:
                                    payload = part.get_payload(decode=True)
                                    if payload:
                                        body_text = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
                            elif ctype == "text/html" and not body_html:
                                try:
                                    body_html = part.get_content()
                                except Exception:
                                    payload = part.get_payload(decode=True)
                                    if payload:
                                        body_html = payload.decode(part.get_content_charset() or "utf-8", errors="replace")
                else:
                    ctype = msg.get_content_type()
                    if ctype == "text/html":
                        try:
                            body_html = msg.get_content()
                        except Exception:
                            payload = msg.get_payload(decode=True)
                            if payload:
                                body_html = payload.decode(msg.get_content_charset() or "utf-8", errors="replace")
                    else:
                        try:
                            body_text = msg.get_content()
                        except Exception:
                            payload = msg.get_payload(decode=True)
                            if payload:
                                body_text = payload.decode(msg.get_content_charset() or "utf-8", errors="replace")

                return {
                    "uid": uid,
                    "folder": folder,
                    "subject": subject,
                    "from": from_header,
                    "to": to_header,
                    "date": date_header,
                    "message_id": message_id,
                    "in_reply_to": in_reply_to,
                    "body_text": (body_text or "").strip(),
                    "body_html": (body_html or "").strip()
                }
            except Exception as e:
                logger.error(f"Error fetching message {uid} detail: {e}")
                return None

    async def send_email(
        self,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: Optional[str] = None,
        display_name: Optional[str] = None,
        in_reply_to: Optional[str] = None,
        tracking_token: Optional[str] = None,
        tracking_base_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send an email using Hostinger Agentic Mail API with optional open tracking."""
        if not self.api_token or not self.resource_id:
            raise ValueError("Hostinger Mail API credentials not configured.")

        url = f"{self.base_url}/api/v1/mailboxes/{self.resource_id}/send"
        
        # Wrap text in clean modern HTML if html_body is not explicitly provided
        if not html_body:
            import html as html_module
            escaped_text = html_module.escape(text_body, quote=True).replace("\n", "<br/>")
            html_body = f"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #222;">
                <div>{escaped_text}</div>
                <br/>
                <div style="font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 8px;">
                    Sent by {display_name or self.display_name} • <a href="https://sakibhossain.io" style="color: #2563eb; text-decoration: none;">sakibhossain.io</a>
                </div>
            </div>
            """

        # Inject 1x1 invisible open tracking pixel if tracking token is provided
        if tracking_token and tracking_base_url:
            pixel_url = f"{tracking_base_url.rstrip('/')}/api/emails/track/open/{tracking_token}.png"
            pixel_html = f'<img src="{pixel_url}" width="1" height="1" alt="" style="display:none!important;width:1px;height:1px;border:0;opacity:0;" />'
            html_body = f"{html_body}\n{pixel_html}"

        payload: Dict[str, Any] = {
            "to": [to_email.strip()],
            "displayName": display_name or self.display_name,
            "subject": subject.strip(),
            "text": text_body.strip(),
            "html": html_body.strip()
        }

        if in_reply_to:
            if isinstance(in_reply_to, dict) and "folder" in in_reply_to and "uid" in in_reply_to:
                try:
                    payload["inReplyTo"] = {
                        "folder": str(in_reply_to["folder"]),
                        "uid": int(in_reply_to["uid"])
                    }
                except (ValueError, TypeError):
                    pass
            elif isinstance(in_reply_to, int) or (isinstance(in_reply_to, str) and in_reply_to.isdigit()):
                payload["inReplyTo"] = {
                    "folder": "INBOX",
                    "uid": int(in_reply_to)
                }

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                resp = await client.post(url, json=payload, headers=self._headers())
                if resp.status_code in [200, 201, 202, 204]:
                    data = resp.json() if resp.text else {}
                    message_id = data.get("data", {}).get("messageId", "sent")
                    logger.info(f"Email sent successfully to {to_email}. MessageId: {message_id}")
                    return {
                        "success": True,
                        "message_id": message_id,
                        "to": to_email,
                        "subject": subject
                    }
                else:
                    error_msg = f"Hostinger API returned HTTP {resp.status_code}: {resp.text}"
                    logger.error(error_msg)
                    return {
                        "success": False,
                        "error": error_msg,
                        "status_code": resp.status_code
                    }
            except Exception as e:
                logger.error(f"Failed to send email to {to_email}: {e}")
                return {
                    "success": False,
                    "error": str(e)
                }



mail_client = HostingerMailClient()
