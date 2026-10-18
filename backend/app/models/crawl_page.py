from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base, utc_now


class CrawlPage(Base):
    __tablename__ = "crawl_pages"

    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(Integer, ForeignKey("scan_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), nullable=True, index=True)
    url = Column(String(1024), nullable=False)
    status_code = Column(Integer, nullable=True)
    title = Column(String(512), nullable=True)
    page_type = Column(String(50), default="other")  # home, contact, about, services, products, pricing, booking, blog, other
    load_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    scan_job = relationship("ScanJob", back_populates="crawl_pages")
    lead = relationship("Lead", back_populates="crawl_pages")
