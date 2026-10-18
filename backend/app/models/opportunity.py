from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from app.database import Base, utc_now


class LeadOpportunity(Base):
    __tablename__ = "lead_opportunities"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    opportunity_type = Column(String(100), nullable=False)  # ga4_audit, gtm_audit, meta_audit, gads_audit, ecommerce_audit, lead_audit
    title = Column(String(255), nullable=False)
    reason = Column(Text, nullable=False)
    evidence = Column(Text, nullable=True)
    source_url = Column(String(1024), nullable=True)
    confidence = Column(Float, default=1.0)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    lead = relationship("Lead", back_populates="opportunities")
