from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base, utc_now


class LeadContact(Base):
    __tablename__ = "lead_contacts"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_type = Column(String(50), nullable=False)  # email, phone, whatsapp
    value = Column(String(255), nullable=False, index=True)
    category = Column(String(50), default="unknown")  # general, sales, support, contact, unknown
    source_url = Column(String(1024), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    lead = relationship("Lead", back_populates="contacts")
