from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base, utc_now


class ScanError(Base):
    __tablename__ = "scan_errors"

    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(Integer, ForeignKey("scan_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(String(1024), nullable=True)
    error_type = Column(String(100), nullable=False)  # Timeout, HTTPError, SSRFBlocked, ParseError, ConnectionRefused
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    scan_job = relationship("ScanJob", back_populates="scan_errors")
