from sqlalchemy import Column, Integer, String, Text, DateTime, Float, JSON
from sqlalchemy.orm import relationship
from app.database import Base, utc_now


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String(255), unique=True, index=True, nullable=False)
    website_url = Column(String(1024), nullable=False)
    company_name = Column(String(255), nullable=True, index=True)
    website_title = Column(String(512), nullable=True)
    description = Column(Text, nullable=True)
    
    # Industry & Classification
    industry = Column(String(100), nullable=True, index=True, default="Unknown")
    industry_confidence = Column(Float, nullable=True, default=0.0)
    
    # Location
    country = Column(String(100), nullable=True, index=True, default="Unknown")
    state = Column(String(100), nullable=True, default="Unknown")
    city = Column(String(100), nullable=True, default="Unknown")
    address = Column(Text, nullable=True, default="Unknown")
    postal_code = Column(String(50), nullable=True, default="Unknown")
    
    # CMS & Platform
    cms = Column(String(100), nullable=True, default="Unknown")
    ecommerce_platform = Column(String(100), nullable=True, default="Unknown")
    is_ecommerce = Column(String(50), nullable=False, default="Not detected")
    
    # Lead Score & Qualification
    lead_score = Column(Integer, nullable=False, default=0, index=True)
    qualification = Column(String(50), nullable=False, default="Unqualified")  # High Opportunity, Medium, Low, Unqualified
    score_reasons = Column(JSON, nullable=True, default=list)  # list of reasons e.g. [{"points": 10, "reason": "Google Ads detected"}]
    
    # CRM Pipeline & Advertising Tracking
    pipeline_stage = Column(String(50), nullable=False, default="new", index=True)  # new, contacted, meeting, proposal, won, lost
    ad_platforms = Column(JSON, nullable=True, default=list)  # e.g. ["Google Ads", "Meta Ads", "TikTok Ads"]
    
    # Metadata
    pages_crawled = Column(Integer, default=0)
    created_at = Column(DateTime, default=utc_now, nullable=False, index=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    contacts = relationship("LeadContact", back_populates="lead", cascade="all, delete-orphan")
    socials = relationship("LeadSocial", back_populates="lead", cascade="all, delete-orphan")
    technologies = relationship("LeadTechnology", back_populates="lead", cascade="all, delete-orphan")
    opportunities = relationship("LeadOpportunity", back_populates="lead", cascade="all, delete-orphan")
    crawl_pages = relationship("CrawlPage", back_populates="lead", cascade="all, delete-orphan")
    notes = relationship("LeadNote", back_populates="lead", cascade="all, delete-orphan", order_by="desc(LeadNote.created_at)")
    emails = relationship("LeadEmail", back_populates="lead", cascade="all, delete-orphan", order_by="desc(LeadEmail.sent_at)")
