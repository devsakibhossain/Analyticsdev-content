from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.orm import relationship
from app.database import Base, utc_now


class ScanJob(Base):
    __tablename__ = "scan_jobs"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String(255), nullable=False, index=True)
    target_url = Column(String(1024), nullable=False)
    status = Column(String(50), default="queued", index=True)  # queued, running, completed, failed, cancelled
    progress = Column(Integer, default=0)  # 0 to 100
    current_step = Column(String(255), default="Initializing")
    pages_crawled = Column(Integer, default=0)
    pages_failed = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    
    # Options
    max_pages = Column(Integer, default=20)
    use_sitemap = Column(Boolean, default=True)
    scan_js = Column(Boolean, default=True)
    scan_tracking = Column(Boolean, default=True)
    
    # Result reference
    lead_id = Column(Integer, nullable=True, index=True)
    
    # Timestamps
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False, index=True)

    crawl_pages = relationship("CrawlPage", back_populates="scan_job", cascade="all, delete-orphan")
    scan_errors = relationship("ScanError", back_populates="scan_job", cascade="all, delete-orphan")
