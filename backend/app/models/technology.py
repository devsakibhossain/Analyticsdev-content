from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from app.database import Base, utc_now


class LeadTechnology(Base):
    __tablename__ = "lead_technologies"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(50), nullable=False)  # analytics, tag_manager, advertising, pixel, cms, ecommerce, tracking, crm, payment, other
    name = Column(String(100), nullable=False, index=True)  # e.g. "Google Analytics 4", "Google Tag Manager", "Meta Pixel"
    status = Column(String(50), nullable=False, default="Detected")  # Detected, Not detected, Unknown, Cannot verify
    identifier = Column(String(255), nullable=True)  # e.g. "G-XXXXXXX", "GTM-XXXXXXX", "AW-XXXXXXX", "1234567890"
    confidence = Column(Float, default=1.0)
    evidence = Column(Text, nullable=True)  # raw matching script tag, snippet, meta tag
    source_url = Column(String(1024), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    lead = relationship("Lead", back_populates="technologies")
