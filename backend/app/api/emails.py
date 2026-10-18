import logging
import secrets
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc

from app.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.lead import Lead
from app.models.contact import LeadContact
from app.models.email import LeadEmail
from app.models.note import LeadNote
from app.services.mail_client import mail_client
from app.config import settings
from app.core.security import sanitize_html_input, sanitize_url
from app.core.rate_limit import rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/emails", tags=["Emails & Outreach"])

# 1x1 Transparent PNG byte string for open tracking
TRANSPARENT_1PX_PNG = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"


# --- Schemas ---

class SendEmailRequest(BaseModel):
    to_email: str = Field(..., description="Recipient email address")
    subject: str = Field(..., min_length=1, max_length=512, description="Email subject line")
    body_text: str = Field(..., min_length=1, description="Plaintext email content")
    body_html: Optional[str] = Field(None, description="Optional custom HTML markup")
    lead_id: Optional[int] = Field(None, description="Optional linked Lead ID")
    display_name: Optional[str] = Field(None, description="Sender display name")
    in_reply_to: Optional[str] = Field(None, description="Message ID being replied to")
    track_opens: bool = Field(True, description="Enable read/seen tracking pixel")


class ReplyEmailRequest(BaseModel):
    to_email: str = Field(..., description="Recipient email address")
    subject: str = Field(..., min_length=1, max_length=512, description="Email subject line")
    body_text: str = Field(..., min_length=1, description="Plaintext reply content")
    body_html: Optional[str] = Field(None, description="Optional custom HTML markup")
    in_reply_to: Optional[Any] = Field(None, description="Original message ID")
    in_reply_to_uid: Optional[int] = Field(None, description="Original message UID")
    in_reply_to_folder: Optional[str] = Field("INBOX", description="Original message folder")
    lead_id: Optional[int] = Field(None, description="Optional linked Lead ID")


class EmailResponse(BaseModel):
    id: int
    lead_id: Optional[int] = None
    recipient_email: str
    sender_email: str
    subject: str
    body_text: str
    body_html: Optional[str] = None
    status: str
    direction: str = "outgoing"
    provider_message_id: Optional[str] = None
    in_reply_to: Optional[str] = None
    thread_id: Optional[str] = None
    error_message: Optional[str] = None
    tracking_token: Optional[str] = None
    opened_at: Optional[datetime] = None
    last_opened_at: Optional[datetime] = None
    open_count: int = 0
    sent_at: datetime
    created_at: datetime
    lead_domain: Optional[str] = None
    lead_company_name: Optional[str] = None

    model_config = {"from_attributes": True}


class EmailTemplate(BaseModel):
    id: str
    name: str
    category: str
    subject: str
    body: str
    description: str


class HotLeadFunnel(BaseModel):
    lead_id: Optional[int] = None
    domain: Optional[str] = None
    company_name: Optional[str] = None
    recipient_email: str
    subject: str
    open_count: int
    last_opened_at: Optional[datetime] = None
    suggested_action: str


class FunnelStatsResponse(BaseModel):
    total_leads: int
    total_sent: int
    contacted_leads: int
    opened_count: int
    open_rate_percent: float
    replied_count: int
    reply_rate_percent: float
    meeting_leads: int
    proposal_leads: int
    won_leads: int
    hot_leads: List[HotLeadFunnel] = []


class OutreachNoteRequest(BaseModel):
    lead_id: Optional[int] = None
    recipient_email: Optional[str] = None
    content: str = Field(..., min_length=1)
    author: Optional[str] = "Sakib"


class BookCallRequest(BaseModel):
    lead_id: Optional[int] = None
    recipient_email: str
    meeting_date: str
    meeting_type: str = "Discovery Call"
    meeting_link: Optional[str] = None
    notes: Optional[str] = None
    send_email: bool = True


class UpdateOutreachStageRequest(BaseModel):
    lead_id: Optional[int] = None
    recipient_email: Optional[str] = None
    stage: str


class OutreachEmailSummary(BaseModel):
    id: int
    subject: str
    sent_at: datetime
    open_count: int = 0
    opened_at: Optional[datetime] = None
    last_opened_at: Optional[datetime] = None


class OutreachNoteItem(BaseModel):
    id: int
    content: str
    author: str
    created_at: datetime


class OutreachCard(BaseModel):
    id: str
    lead_id: Optional[int] = None
    recipient_email: str
    domain: str
    company_name: str
    stage: str  # pitch_sent, seen, followup_1, followup_2, replied, meeting, won, lost
    open_count: int = 0
    opened_at: Optional[datetime] = None
    last_opened_at: Optional[datetime] = None
    is_hot: bool = False
    total_emails_sent: int = 0
    followup_count: int = 0
    last_sent_at: datetime
    last_subject: str
    notes_count: int = 0
    latest_note: Optional[str] = None
    notes: List[OutreachNoteItem] = []
    meeting_info: Optional[Dict[str, Any]] = None
    suggested_action: str
    emails_history: List[OutreachEmailSummary] = []


class OutreachBoardResponse(BaseModel):
    total_leads_pitched: int
    total_emails_sent: int
    total_followups_sent: int
    opened_leads_count: int
    open_rate_percent: float
    calls_booked_count: int
    won_deals_count: int
    cards: List[OutreachCard] = []


# --- Outreach Email Templates ---

OUTREACH_TEMPLATES: List[EmailTemplate] = [
    EmailTemplate(
        id="ga4-tracking-audit",
        name="GA4 & GTM Tracking Gap Audit",
        category="Analytics & Tracking",
        subject="Quick tracking question for {company_name}",
        body="""Hi there,

I was looking at {domain} and noticed a few tracking opportunities in your current analytics setup.

Specifically, it looks like some key conversion events and server-side tracking tags could be optimized to capture customer journey data that currently gets dropped by modern ad-blockers and Safari ITP.

I put together a quick, no-strings-attached 3-minute video breakdown showing what's missing and how fixing it could immediately improve your attribution data.

Would you be open to me sending that over?

Best regards,
Sakib Hossain
Tracking & Analytics Specialist • sakibhossain.io""",
        description="Best for e-commerce and lead-gen sites with missing or partial GA4/GTM implementation."
    ),
    EmailTemplate(
        id="meta-conversions-api",
        name="Meta Ads & iOS 14+ CAPI Fix",
        category="Paid Advertising",
        subject="Fixing Meta Pixel signal loss for {company_name}",
        body="""Hi {company_name} team,

I noticed you're actively running ad campaigns for {domain}.

With browser privacy changes and iOS updates, standard client-side browser pixels now lose between 20% to 35% of purchase/lead event signals before they reach Meta Ads Manager.

Setting up Meta Conversions API (CAPI) with server-side event deduplication typically recovers lost attribution, lowers Cost Per Acquisition (CPA), and helps Meta's algorithm optimize for higher quality buyers.

I have a checklist detailing how we implement this without touching your core theme code. Would you like me to share it?

Cheers,
Sakib Hossain
Conversion Tracking Specialist • sakibhossain.io""",
        description="Tailored for brands actively running Meta/Facebook advertising campaigns."
    ),
    EmailTemplate(
        id="ecommerce-cart-recovery",
        name="E-Commerce Conversion Tracking Audit",
        category="E-Commerce",
        subject="{company_name} checkout tracking & cart data",
        body="""Hi,

While reviewing {domain}, I noticed an opportunity in your e-commerce event tracking pipeline.

Ensuring your ViewItem, AddToCart, BeginCheckout, and Purchase events are accurately firing with full product currency and item parameters is crucial for accurate ROAS reporting across Google Ads and Meta Ads.

I specialize in full-funnel e-commerce tracking and conversion optimization. If you have 5 minutes this week, I'd love to share an audit of your checkout tracking signals.

Let me know if you'd like a free review!

Warmly,
Sakib Hossain
E-Commerce Tracking Engineer • sakibhossain.io""",
        description="Great for Shopify, WooCommerce, and custom e-commerce stores."
    ),
    EmailTemplate(
        id="tag-performance-optimization",
        name="Tag Manager & Site Speed Cleanup",
        category="Technical Performance",
        subject="Site speed & tag optimization for {domain}",
        body="""Hello {company_name} team,

I recently audited the tracking scripts loading on {domain}. 

Multiple third-party marketing and analytics tags appear to be executing simultaneously in the main thread, which can slow down first page load time and hurt conversion rates on mobile devices.

By migrating these tags into a structured server-side container, you can keep 100% of your tracking accuracy while accelerating page load speeds by up to 25%.

Would you be interested in seeing the performance audit I prepared for {domain}?

Best,
Sakib Hossain
Web Performance & Tracking Consultant • sakibhossain.io""",
        description="Ideal for sites loaded with heavy tracking scripts and multiple marketing tags."
    ),
    EmailTemplate(
        id="free-video-audit",
        name="Free 5-Minute Video Audit Offer",
        category="General Outreach",
        subject="Made a quick video audit for {domain}",
        body="""Hey,

I recorded a short 5-minute video walking through {domain}'s tracking setup and identified 3 quick-win opportunities to capture more leads and improve ad tracking accuracy.

No pitch or commitment—just useful technical findings you can hand over to your development team right away.

Can I send the video link over to you?

Best,
Sakib Hossain
Growth & Tracking Consultant
hello@sakibhossain.io • sakibhossain.io""",
        description="High reply-rate general outreach offering a personalized Loom audit."
    )
]


# --- Endpoints ---

@router.get("/track/open/{token}.png")
@router.head("/track/open/{token}.png")
def track_email_open(
    token: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """Public pixel endpoint for real-time email open tracking."""
    email_record = db.query(LeadEmail).filter(LeadEmail.tracking_token == token).first()
    if email_record:
        now = datetime.now(timezone.utc)
        is_first_open = email_record.opened_at is None
        
        if is_first_open:
            email_record.opened_at = now
            if email_record.status == "sent":
                email_record.status = "opened"

            # Log audit note to lead timeline on first read
            if email_record.lead_id:
                lead = db.query(Lead).filter(Lead.id == email_record.lead_id).first()
                if lead:
                    note_content = f"🔥 Email Opened by {email_record.recipient_email}\nSubject: \"{email_record.subject}\""
                    db.add(LeadNote(
                        lead_id=lead.id,
                        content=note_content,
                        author="CRM Ultra Tracker"
                    ))

        email_record.last_opened_at = now
        email_record.open_count = (email_record.open_count or 0) + 1
        
        # Capture client details
        if request.headers.get("user-agent"):
            email_record.user_agent = request.headers.get("user-agent", "")[:500]
        if request.client:
            email_record.ip_address = request.client.host

        try:
            db.commit()
        except Exception as e:
            logger.error(f"Error updating email tracking record: {e}")
            db.rollback()

    return Response(
        content=TRANSPARENT_1PX_PNG,
        media_type="image/png",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate, private, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


@router.get("/mailbox-status")
async def get_mailbox_status(
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Check Hostinger Agentic Mail API connectivity and storage quota."""
    status_data = await mail_client.get_mailbox_status()
    return status_data


@router.get("/templates", response_model=List[EmailTemplate])
def get_email_templates(
    current_user: User = Depends(get_current_user)
) -> List[EmailTemplate]:
    """Retrieve pre-built, battle-tested cold outreach pitch templates."""
    return OUTREACH_TEMPLATES


@router.get("/inbox")
async def get_inbox_messages(
    folder: str = Query("INBOX", description="Folder name, e.g. INBOX, INBOX.Sent"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    q: Optional[str] = Query(None, description="Search term in subject or sender"),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Retrieve live incoming messages from Hostinger mailbox."""
    result = await mail_client.get_messages(folder=folder, limit=limit, page=page)
    raw_list = result.get("data", [])
    pagination = result.get("pagination", {})
    
    parsed = []
    for item in raw_list:
        from_dict = item.get("from", {}) or {}
        to_list = item.get("to", []) or []
        to_first = to_list[0] if to_list else {}
        from_name = from_dict.get("name") or from_dict.get("address", "")
        from_address = from_dict.get("address", "")
        subject = item.get("subject", "(No Subject)")
        
        # Apply search filter if provided
        if q:
            ql = q.lower()
            if ql not in subject.lower() and ql not in from_name.lower() and ql not in from_address.lower():
                continue

        parsed.append({
            "uid": item.get("uid"),
            "path": item.get("path", folder),
            "date": item.get("date"),
            "subject": subject,
            "from_name": from_name,
            "from_address": from_address,
            "to_address": to_first.get("address", ""),
            "unseen": item.get("unseen", False),
            "flags": item.get("flags", []),
            "size": item.get("size", 0),
            "message_id": item.get("messageId"),
            "in_reply_to": item.get("inReplyTo")
        })

    return {
        "messages": parsed,
        "pagination": pagination,
        "folder": folder
    }


@router.get("/inbox/{uid}")
async def get_inbox_message_detail(
    uid: int,
    folder: str = Query("INBOX"),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Retrieve full content and parsed body of an incoming or sent message."""
    detail = await mail_client.get_message_detail(uid=uid, folder=folder)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Message with UID {uid} not found in folder {folder}."
        )
    return detail


def get_or_create_lead_for_email(db: Session, email_str: str, lead_id: Optional[int] = None) -> Lead:
    """Helper to ensure every outreach recipient is associated with a Lead record for CRM tracking."""
    if lead_id:
        lead = db.query(Lead).filter(Lead.id == lead_id).first()
        if lead:
            return lead
    # Match by existing contact
    lead = db.query(Lead).join(Lead.contacts).filter(LeadContact.value == email_str).first()
    if lead:
        return lead
    # Match by domain
    clean_email = email_str.strip().lower()
    domain_part = clean_email.split("@")[-1] if "@" in clean_email else clean_email
    company_part = clean_email.split("@")[0].replace(".", " ").replace("-", " ").title() if "@" in clean_email else domain_part
    lead = db.query(Lead).filter(Lead.domain == domain_part).first()
    if not lead:
        lead = Lead(
            domain=domain_part,
            website_url=f"https://{domain_part}",
            company_name=company_part,
            pipeline_stage="contacted",
            lead_score=50,
            qualification="Medium Opportunity"
        )
        db.add(lead)
        db.flush()
        db.add(LeadContact(
            lead_id=lead.id,
            contact_type="email",
            value=email_str,
            source_url="outreach"
        ))
        db.commit()
        db.refresh(lead)
    return lead


@router.post("/send", response_model=EmailResponse)
async def send_email(
    payload: SendEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _rate_limit: bool = Depends(rate_limit(max_requests=10, window_seconds=60.0))
):
    """Send an outreach email through Hostinger Agentic Mail API, auto-log note, and advance pipeline stage."""
    to_email = payload.to_email.strip()
    if "@" not in to_email or "." not in to_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid recipient email address"
        )

    # Ensure linked to an existing lead or auto-match/create lead
    lead: Lead = get_or_create_lead_for_email(db, to_email, payload.lead_id)

    # Generate open tracking token if enabled
    tracking_token = secrets.token_hex(16) if payload.track_opens else None

    # Dispatch email via Hostinger Agentic Mail
    result = await mail_client.send_email(
        to_email=to_email,
        subject=payload.subject,
        text_body=payload.body_text,
        html_body=payload.body_html,
        display_name=payload.display_name,
        in_reply_to=payload.in_reply_to,
        tracking_token=tracking_token,
        tracking_base_url=settings.FRONTEND_URL
    )

    is_success = result.get("success", False)
    message_id = result.get("message_id")
    error_msg = result.get("error") if not is_success else None

    # Record email in database
    now = datetime.now(timezone.utc)
    email_record = LeadEmail(
        lead_id=lead.id if lead else None,
        recipient_email=to_email,
        sender_email=settings.HOSTINGER_MAIL_FROM_EMAIL,
        subject=payload.subject,
        body_text=payload.body_text,
        body_html=payload.body_html,
        status="sent" if is_success else "failed",
        direction="outgoing",
        provider_message_id=message_id,
        in_reply_to=payload.in_reply_to,
        tracking_token=tracking_token,
        error_message=error_msg,
        sent_at=now,
        created_at=now
    )
    db.add(email_record)

    # If linked to a lead, update CRM pipeline stage and append note
    if lead and is_success:
        note_content = f"📧 Outreach Email Sent\nSubject: {payload.subject}\nRecipient: {to_email}"
        db.add(LeadNote(
            lead_id=lead.id,
            content=note_content,
            author="Sakib (Hostinger Mail)"
        ))

        if lead.pipeline_stage == "new":
            lead.pipeline_stage = "contacted"
            logger.info(f"Advanced lead {lead.id} ({lead.domain}) pipeline stage to 'contacted'")

    db.commit()
    db.refresh(email_record)

    if not is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to send email via Hostinger Mail API: {error_msg}"
        )

    resp = EmailResponse.model_validate(email_record)
    if lead:
        resp.lead_domain = lead.domain
        resp.lead_company_name = lead.company_name
    return resp


@router.post("/reply", response_model=EmailResponse)
async def reply_email(
    payload: ReplyEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _rate_limit: bool = Depends(rate_limit(max_requests=10, window_seconds=60.0))
):
    """Reply to an email thread directly from the inbox."""
    to_email = payload.to_email.strip()
    if "@" not in to_email or "." not in to_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid recipient email address"
        )

    # Ensure linked to an existing lead or auto-match/create lead
    lead: Lead = get_or_create_lead_for_email(db, to_email, payload.lead_id)

    tracking_token = secrets.token_hex(16)
    formatted_subject = payload.subject if payload.subject.lower().startswith("re:") else f"Re: {payload.subject}"

    # Build valid Hostinger MessageRef: {"folder": str, "uid": int}
    in_reply_ref = None
    if payload.in_reply_to_uid:
        in_reply_ref = {
            "folder": payload.in_reply_to_folder or "INBOX",
            "uid": int(payload.in_reply_to_uid)
        }
    elif isinstance(payload.in_reply_to, dict) and "uid" in payload.in_reply_to:
        in_reply_ref = {
            "folder": str(payload.in_reply_to.get("folder", "INBOX")),
            "uid": int(payload.in_reply_to["uid"])
        }
    elif isinstance(payload.in_reply_to, int) or (isinstance(payload.in_reply_to, str) and payload.in_reply_to.isdigit()):
        in_reply_ref = {
            "folder": "INBOX",
            "uid": int(payload.in_reply_to)
        }

    result = await mail_client.send_email(
        to_email=to_email,
        subject=formatted_subject,
        text_body=payload.body_text,
        html_body=payload.body_html,
        in_reply_to=in_reply_ref,
        tracking_token=tracking_token,
        tracking_base_url=settings.FRONTEND_URL
    )

    is_success = result.get("success", False)
    message_id = result.get("message_id")
    error_msg = result.get("error") if not is_success else None

    # Store in_reply_to identifier as string in db
    db_in_reply_to = str(payload.in_reply_to or payload.in_reply_to_uid or "")

    now = datetime.now(timezone.utc)
    email_record = LeadEmail(
        lead_id=lead.id if lead else None,
        recipient_email=to_email,
        sender_email=settings.HOSTINGER_MAIL_FROM_EMAIL,
        subject=formatted_subject,
        body_text=payload.body_text,
        body_html=payload.body_html,
        status="sent" if is_success else "failed",
        direction="outgoing",
        provider_message_id=message_id,
        in_reply_to=db_in_reply_to if db_in_reply_to else None,
        tracking_token=tracking_token,
        error_message=error_msg,
        sent_at=now,
        created_at=now
    )
    db.add(email_record)

    if lead and is_success:
        db.add(LeadNote(
            lead_id=lead.id,
            content=f"↩️ Reply Sent to {to_email}\nSubject: {formatted_subject}",
            author="Sakib (Hostinger Mail)"
        ))
        if lead.pipeline_stage in ["new", "contacted"]:
            lead.pipeline_stage = "meeting"

    db.commit()
    db.refresh(email_record)

    if not is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to send reply: {error_msg}"
        )

    resp = EmailResponse.model_validate(email_record)
    if lead:
        resp.lead_domain = lead.domain
        resp.lead_company_name = lead.company_name
    return resp


@router.get("/funnel-stats", response_model=FunnelStatsResponse)
def get_funnel_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> FunnelStatsResponse:
    """Calculate cold email outreach funnel analytics, conversion rates, and hot leads."""
    total_leads = db.query(Lead).count()
    
    # Sent emails stats
    all_sent = db.query(LeadEmail).filter(LeadEmail.direction == "outgoing").all()
    total_sent = len(all_sent)
    opened_emails = [e for e in all_sent if (e.open_count or 0) > 0 or e.opened_at is not None]
    opened_count = len(opened_emails)
    open_rate = round((opened_count / total_sent * 100), 1) if total_sent > 0 else 0.0

    # Leads progression stats
    contacted_leads = db.query(Lead).filter(Lead.pipeline_stage.in_(["contacted", "meeting", "proposal", "won"])).count()
    meeting_leads = db.query(Lead).filter(Lead.pipeline_stage == "meeting").count()
    proposal_leads = db.query(Lead).filter(Lead.pipeline_stage == "proposal").count()
    won_leads = db.query(Lead).filter(Lead.pipeline_stage == "won").count()
    
    replied_count = meeting_leads + proposal_leads + won_leads
    reply_rate = round((replied_count / opened_count * 100), 1) if opened_count > 0 else 0.0

    # Identify Hot Leads (opened multiple times or opened recently)
    hot_leads = []
    seen_recipients = set()
    for em in sorted(opened_emails, key=lambda x: (x.open_count or 0, x.last_opened_at or x.sent_at), reverse=True):
        if em.recipient_email in seen_recipients:
            continue
        seen_recipients.add(em.recipient_email)
        lead = em.lead
        count = em.open_count or 1
        action = "High intent! Send Follow-up #1 offering custom loom audit" if count >= 2 else "Email opened. Prepare personalized follow-up."
        hot_leads.append(HotLeadFunnel(
            lead_id=lead.id if lead else None,
            domain=lead.domain if lead else em.recipient_email.split("@")[-1],
            company_name=(lead.company_name if lead else None) or em.recipient_email,
            recipient_email=em.recipient_email,
            subject=em.subject,
            open_count=count,
            last_opened_at=em.last_opened_at or em.opened_at,
            suggested_action=action
        ))
        if len(hot_leads) >= 10:
            break

    return FunnelStatsResponse(
        total_leads=total_leads,
        total_sent=total_sent,
        contacted_leads=contacted_leads,
        opened_count=opened_count,
        open_rate_percent=open_rate,
        replied_count=replied_count,
        reply_rate_percent=reply_rate,
        meeting_leads=meeting_leads,
        proposal_leads=proposal_leads,
        won_leads=won_leads,
        hot_leads=hot_leads
    )


@router.get("/history", response_model=List[EmailResponse])
def get_email_history(
    q: Optional[str] = Query(None, description="Search recipient or subject"),
    lead_id: Optional[int] = Query(None, description="Filter by lead"),
    status: Optional[str] = Query(None, description="Filter by status (sent, failed, opened)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[EmailResponse]:
    """Retrieve full sent emails history with open tracking metadata and linked lead information."""
    query = db.query(LeadEmail).options(joinedload(LeadEmail.lead))

    if lead_id:
        query = query.filter(LeadEmail.lead_id == lead_id)
    if status:
        if status == "opened":
            query = query.filter(LeadEmail.open_count > 0)
        else:
            query = query.filter(LeadEmail.status == status)
    if q:
        query = query.filter(
            (LeadEmail.recipient_email.ilike(f"%{q}%")) |
            (LeadEmail.subject.ilike(f"%{q}%"))
        )

    emails = query.order_by(desc(LeadEmail.sent_at)).offset(skip).limit(limit).all()

    results = []
    for em in emails:
        item = EmailResponse.model_validate(em)
        if em.lead:
            item.lead_domain = em.lead.domain
            item.lead_company_name = em.lead.company_name
        results.append(item)

    return results


@router.get("/lead/{lead_id}", response_model=List[EmailResponse])
def get_lead_emails(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[EmailResponse]:
    """Retrieve all emails sent to a specific lead."""
    emails = db.query(LeadEmail).filter(LeadEmail.lead_id == lead_id).order_by(desc(LeadEmail.sent_at)).all()
    return [EmailResponse.model_validate(e) for e in emails]


@router.get("/outreach-board", response_model=OutreachBoardResponse)
def get_outreach_board(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> OutreachBoardResponse:
    """Retrieve full outreach pipeline board with enriched cards, follow-up tracking, notes, and call booking info."""
    # 1. Backfill any unlinked LeadEmail
    unlinked_emails = db.query(LeadEmail).filter(LeadEmail.lead_id == None).all()
    if unlinked_emails:
        for em in unlinked_emails:
            lead = get_or_create_lead_for_email(db, em.recipient_email)
            em.lead_id = lead.id
        db.commit()

    # 2. Fetch all outgoing emails joined with lead and notes
    emails = db.query(LeadEmail).options(
        joinedload(LeadEmail.lead).joinedload(Lead.notes)
    ).filter(LeadEmail.direction == "outgoing").order_by(desc(LeadEmail.sent_at)).all()

    # Group emails by recipient_email
    grouped: Dict[str, List[LeadEmail]] = {}
    for em in emails:
        key = em.recipient_email.lower().strip()
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(em)

    cards: List[OutreachCard] = []

    for recipient, em_list in grouped.items():
        # em_list is sorted by sent_at desc
        latest_em = em_list[0]
        lead = latest_em.lead
        total_sent = len(em_list)
        followup_count = max(0, total_sent - 1)
        open_count = sum(e.open_count or 0 for e in em_list)
        opened_dates = [e.opened_at for e in em_list if e.opened_at]
        last_opened_dates = [e.last_opened_at for e in em_list if e.last_opened_at]
        first_open = min(opened_dates) if opened_dates else None
        last_open = max(last_opened_dates) if last_opened_dates else (max(opened_dates) if opened_dates else None)

        # Notes extraction
        notes_list: List[OutreachNoteItem] = []
        meeting_info: Optional[Dict[str, Any]] = None
        if lead and lead.notes:
            for n in sorted(lead.notes, key=lambda x: x.created_at, reverse=True):
                notes_list.append(OutreachNoteItem(
                    id=n.id,
                    content=n.content,
                    author=n.author,
                    created_at=n.created_at
                ))
                # Check for meeting info in note
                if ("Call Booked" in n.content or "CALL BOOKED" in n.content) and not meeting_info:
                    meeting_info = {
                        "date": "",
                        "type": "Discovery Call",
                        "link": "",
                        "notes": n.content
                    }
                    for line in n.content.split("\n"):
                        line_strip = line.strip()
                        if "Call Booked:" in line_strip:
                            meeting_info["type"] = line_strip.replace("📅 Call Booked:", "").replace("Call Booked:", "").strip()
                        elif "Date:" in line_strip or "Scheduled Date:" in line_strip:
                            meeting_info["date"] = line_strip.split(":", 1)[-1].strip()
                        elif "Link:" in line_strip:
                            meeting_info["link"] = line_strip.split(":", 1)[-1].strip()

        # Determine stage
        stage = "pitch_sent"
        if lead and lead.pipeline_stage in ["meeting", "won", "lost"]:
            stage = lead.pipeline_stage
        elif meeting_info or (lead and lead.pipeline_stage == "meeting"):
            stage = "meeting"
        elif lead and lead.pipeline_stage in ["proposal", "replied"]:
            stage = "replied"
        elif lead and lead.pipeline_stage in ["followup_1", "followup_2", "seen", "pitch_sent"]:
            stage = lead.pipeline_stage
        else:
            # Automatic heuristic based on outreach progression
            if followup_count >= 2:
                stage = "followup_2"
            elif followup_count == 1:
                stage = "followup_1"
            elif open_count > 0:
                stage = "seen"
            else:
                stage = "pitch_sent"

        # Suggested Action
        is_hot = open_count >= 2
        if stage == "meeting":
            suggested_action = "📅 Call scheduled! Prepare customized tracking audit."
        elif stage == "won":
            suggested_action = "🏆 Client converted! Onboarding in progress."
        elif is_hot:
            suggested_action = "🔥 High buying intent (opened multiple times)! Send 1-on-1 Loom audit now."
        elif open_count > 0 and followup_count == 0:
            suggested_action = "Seen! Follow-up #1 recommended to secure meeting."
        elif followup_count == 1:
            suggested_action = "Follow-up #1 delivered. Monitor for reply or prepare Follow-up #2."
        elif followup_count >= 2:
            suggested_action = "Follow-up #2 delivered. Reach out via LinkedIn or multi-channel."
        else:
            suggested_action = "Pitch delivered. Tracking pixel active."

        email_history = [
            OutreachEmailSummary(
                id=e.id,
                subject=e.subject,
                sent_at=e.sent_at,
                open_count=e.open_count or 0,
                opened_at=e.opened_at,
                last_opened_at=e.last_opened_at
            ) for e in em_list
        ]

        card = OutreachCard(
            id=f"lead-{lead.id}" if lead else f"email-{recipient}",
            lead_id=lead.id if lead else None,
            recipient_email=recipient,
            domain=lead.domain if lead else recipient.split("@")[-1],
            company_name=(lead.company_name if lead else None) or recipient.split("@")[0].title(),
            stage=stage,
            open_count=open_count,
            opened_at=first_open,
            last_opened_at=last_open,
            is_hot=is_hot,
            total_emails_sent=total_sent,
            followup_count=followup_count,
            last_sent_at=latest_em.sent_at,
            last_subject=latest_em.subject,
            notes_count=len(notes_list),
            latest_note=notes_list[0].content if notes_list else None,
            notes=notes_list,
            meeting_info=meeting_info,
            suggested_action=suggested_action,
            emails_history=email_history
        )
        cards.append(card)

    total_leads_pitched = len(cards)
    total_emails_sent = sum(c.total_emails_sent for c in cards)
    total_followups_sent = sum(c.followup_count for c in cards)
    opened_leads_count = sum(1 for c in cards if c.open_count > 0)
    open_rate_percent = round(opened_leads_count / total_leads_pitched * 100, 1) if total_leads_pitched else 0.0
    calls_booked_count = sum(1 for c in cards if c.stage == "meeting")
    won_deals_count = sum(1 for c in cards if c.stage == "won")

    return OutreachBoardResponse(
        total_leads_pitched=total_leads_pitched,
        total_emails_sent=total_emails_sent,
        total_followups_sent=total_followups_sent,
        opened_leads_count=opened_leads_count,
        open_rate_percent=open_rate_percent,
        calls_booked_count=calls_booked_count,
        won_deals_count=won_deals_count,
        cards=cards
    )


@router.post("/outreach-note", response_model=OutreachNoteItem)
def create_outreach_note(
    payload: OutreachNoteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> OutreachNoteItem:
    """Add a quick note or outreach activity update directly to an outreach card."""
    lead = None
    if payload.lead_id:
        lead = db.query(Lead).filter(Lead.id == payload.lead_id).first()
    if not lead and payload.recipient_email:
        lead = get_or_create_lead_for_email(db, payload.recipient_email)

    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    note = LeadNote(
        lead_id=lead.id,
        content=payload.content.strip(),
        author=payload.author or "Sakib"
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return OutreachNoteItem(
        id=note.id,
        content=note.content,
        author=note.author,
        created_at=note.created_at
    )


@router.post("/book-call")
async def book_outreach_call(
    payload: BookCallRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _rate_limit: bool = Depends(rate_limit(max_requests=5, window_seconds=60.0))
) -> Dict[str, Any]:
    """Book a discovery, demo, or audit call with an outreach prospect and dispatch confirmation email."""
    to_email = payload.recipient_email.strip()
    if "@" not in to_email or "." not in to_email:
        raise HTTPException(status_code=400, detail="Invalid recipient email address")

    lead = get_or_create_lead_for_email(db, to_email, payload.lead_id)
    lead.pipeline_stage = "meeting"

    # Format human-friendly meeting date
    formatted_date = payload.meeting_date
    try:
        dt = datetime.fromisoformat(payload.meeting_date.replace("Z", "+00:00"))
        formatted_date = dt.strftime("%A, %B %d, %Y at %I:%M %p")
    except Exception:
        pass

    meeting_url = sanitize_url((payload.meeting_link or "").strip())
    notes_clean = sanitize_html_input((payload.notes or "").strip())

    subject = f"Confirmed: {payload.meeting_type} with Sakib Hossain"

    body_text = f"""Hi,

Your meeting has been confirmed! Here are the details for our upcoming session:

📌 Meeting Topic: {payload.meeting_type}
📆 Scheduled Date & Time: {formatted_date}
🔗 Video Call Link: {meeting_url or "Link will be shared prior to the call"}

Agenda & Preparation:
{notes_clean or "We will review your tracking setup, GA4/GTM opportunities, and analytics attribution."}

If you need to reschedule or have any questions ahead of time, simply reply directly to this email.

Looking forward to speaking with you!

Best regards,
Sakib Hossain
Web Analytics & Tracking Specialist • sakibhossain.io
hello@sakibhossain.io
"""

    html_body = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #e2e8f0; margin: 0; padding: 24px; }}
    .card {{ max-width: 580px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }}
    .header {{ background: linear-gradient(135deg, #1e3a8a, #3b82f6); padding: 28px 24px; text-align: center; color: #ffffff; }}
    .badge {{ display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }}
    .title {{ margin: 0; font-size: 20px; font-weight: 800; }}
    .content {{ padding: 28px 24px; color: #cbd5e1; font-size: 14px; line-height: 1.6; }}
    .details-box {{ background: #0b1120; border: 1px solid #1e293b; border-radius: 12px; padding: 18px; margin: 20px 0; }}
    .detail-row {{ margin-bottom: 12px; }}
    .detail-row:last-child {{ margin-bottom: 0; }}
    .label {{ font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }}
    .val {{ font-size: 14px; color: #f8fafc; font-weight: 600; margin-top: 2px; }}
    .btn {{ display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; font-size: 13px; text-align: center; margin-top: 8px; }}
    .footer {{ padding: 20px 24px; border-top: 1px solid #1e293b; font-size: 12px; color: #64748b; text-align: center; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="badge">📅 Discovery Call Confirmed</div>
      <h1 class="title">{payload.meeting_type}</h1>
    </div>
    <div class="content">
      <p style="margin-top:0;">Hi there,</p>
      <p>Your consultation session has been scheduled successfully. Here are your meeting details:</p>

      <div class="details-box">
        <div class="detail-row">
          <div class="label">Scheduled Date & Time</div>
          <div class="val" style="color: #60a5fa;">{formatted_date}</div>
        </div>

        <div class="detail-row">
          <div class="label">Video Call Link</div>
          <div class="val">
            {f'<a href="{meeting_url}" class="btn" style="color:#ffffff;">Join Video Call</a><div style="font-size:11px; color:#94a3b8; margin-top:6px; font-family:monospace;">{meeting_url}</div>' if meeting_url else '<span style="color:#94a3b8;">Meeting link will be shared prior to the call</span>'}
          </div>
        </div>

        {f'<div class="detail-row"><div class="label">Agenda & Notes</div><div class="val" style="font-weight:400; color:#e2e8f0;">{notes_clean}</div></div>' if notes_clean else ''}
      </div>

      <p style="font-size:13px; color:#94a3b8;">Need to change time or add teammates? Simply reply to this email.</p>
    </div>
    <div class="footer">
      <strong>Sakib Hossain</strong> • Tracking & Analytics Consultant<br>
      <a href="https://sakibhossain.io" style="color:#3b82f6; text-decoration:none;">sakibhossain.io</a> • hello@sakibhossain.io
    </div>
  </div>
</body>
</html>
"""

    tracking_token = secrets.token_hex(16)
    email_sent_successfully = False

    if payload.send_email:
        # Dispatch confirmation email via Hostinger Agentic Mail API
        result = await mail_client.send_email(
            to_email=to_email,
            subject=subject,
            text_body=body_text,
            html_body=html_body,
            display_name="Sakib Hossain",
            tracking_token=tracking_token,
            tracking_base_url=settings.FRONTEND_URL
        )

        email_sent_successfully = result.get("success", False)
        message_id = result.get("message_id")
        error_msg = result.get("error") if not email_sent_successfully else None

        now = datetime.now(timezone.utc)
        email_record = LeadEmail(
            lead_id=lead.id,
            recipient_email=to_email,
            sender_email=settings.HOSTINGER_MAIL_FROM_EMAIL,
            subject=subject,
            body_text=body_text,
            body_html=html_body,
            status="sent" if email_sent_successfully else "failed",
            direction="outgoing",
            provider_message_id=message_id,
            tracking_token=tracking_token,
            error_message=error_msg,
            sent_at=now,
            created_at=now
        )
        db.add(email_record)

    call_note_text = (
        f"📅 Call Booked: {payload.meeting_type}\n"
        f"📆 Scheduled Date: {formatted_date}\n"
        f"🔗 Link: {meeting_url or 'N/A'}\n"
        f"✉️ Email Invitation: {'Delivered to ' + to_email if email_sent_successfully else ('Attempted but skipped/failed' if payload.send_email else 'Skipped')}\n"
        f"📝 Notes: {notes_clean or 'Discovery meeting booked via outreach.'}"
    )

    note = LeadNote(
        lead_id=lead.id,
        content=call_note_text,
        author="Sakib"
    )
    db.add(note)
    db.commit()

    return {
        "success": True,
        "lead_id": lead.id,
        "stage": "meeting",
        "meeting_type": payload.meeting_type,
        "meeting_date": formatted_date,
        "meeting_link": meeting_url,
        "notes": notes_clean,
        "email_sent": email_sent_successfully
    }


@router.patch("/outreach-stage")
def update_outreach_stage(
    payload: UpdateOutreachStageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Update pipeline stage for an outreach prospect."""
    lead = None
    if payload.lead_id:
        lead = db.query(Lead).filter(Lead.id == payload.lead_id).first()
    if not lead and payload.recipient_email:
        lead = get_or_create_lead_for_email(db, payload.recipient_email)

    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    old_stage = lead.pipeline_stage
    lead.pipeline_stage = payload.stage
    db.add(LeadNote(
        lead_id=lead.id,
        content=f"📌 Outreach Stage updated: {old_stage} ➔ {payload.stage}",
        author="Sakib"
    ))
    db.commit()

    return {"success": True, "lead_id": lead.id, "stage": payload.stage}
