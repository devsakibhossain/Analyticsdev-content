from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base, utc_now


class LeadEmail(Base):
    __tablename__ = "lead_emails"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)
    recipient_email = Column(String(255), nullable=False, index=True)
    sender_email = Column(String(255), default="hello@sakibhossain.io", nullable=False)
    subject = Column(String(512), nullable=False)
    body_text = Column(Text, nullable=False)
    body_html = Column(Text, nullable=True)
    status = Column(String(50), default="sent", nullable=False, index=True)  # sent, failed, draft, opened, replied
    direction = Column(String(20), default="outgoing", nullable=False, index=True)  # outgoing, incoming
    provider_message_id = Column(String(255), nullable=True)
    in_reply_to = Column(String(255), nullable=True)
    thread_id = Column(String(255), nullable=True, index=True)
    error_message = Column(Text, nullable=True)

    # Real-time Open & Seen Tracking
    tracking_token = Column(String(64), unique=True, index=True, nullable=True)
    opened_at = Column(DateTime, nullable=True, index=True)
    last_opened_at = Column(DateTime, nullable=True)
    open_count = Column(Integer, default=0, nullable=False)
    user_agent = Column(String(512), nullable=True)
    ip_address = Column(String(64), nullable=True)

    sent_at = Column(DateTime, default=utc_now, nullable=False, index=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    lead = relationship("Lead", back_populates="emails")
