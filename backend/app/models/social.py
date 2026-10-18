from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base, utc_now


class LeadSocial(Base):
    __tablename__ = "lead_socials"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    platform = Column(String(50), nullable=False)  # linkedin, facebook, instagram, youtube, twitter, tiktok, pinterest
    url = Column(String(1024), nullable=False)
    source_url = Column(String(1024), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    lead = relationship("Lead", back_populates="socials")
