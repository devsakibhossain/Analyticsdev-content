from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db, utc_now
from app.api.auth import get_current_user
from app.models.user import User
from app.models.scan_job import ScanJob
from app.crawler.normalizer import normalize_url, extract_domain
from app.crawler.ssrf import validate_url_safe
from app.jobs.queue import queue_manager
from app.core.rate_limit import rate_limit

router = APIRouter(prefix="/scans", tags=["Scans"])


# --- Schemas ---

class CreateScanRequest(BaseModel):
    url: str
    max_pages: int = 20
    use_sitemap: bool = True
    scan_js: bool = True
    scan_tracking: bool = True


class ScanJobResponse(BaseModel):
    id: int
    domain: str
    target_url: str
    status: str
    progress: int
    current_step: str
    pages_crawled: int
    pages_failed: int
    error_message: Optional[str] = None
    max_pages: int
    use_sitemap: bool
    scan_js: bool
    scan_tracking: bool
    lead_id: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Routes ---

@router.post("", response_model=ScanJobResponse, status_code=status.HTTP_201_CREATED)
def create_scan(
    req: CreateScanRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _rate_limit: bool = Depends(rate_limit(max_requests=10, window_seconds=60.0))
):
    """Validate URL, create scan job record, and dispatch to crawler queue."""
    raw_url = req.url.strip()
    if not raw_url:
        raise HTTPException(status_code=400, detail="Target website URL is required.")

    norm_url = normalize_url(raw_url)
    if not norm_url:
        raise HTTPException(status_code=400, detail="Invalid website URL format.")

    domain = extract_domain(norm_url)
    if not domain:
        raise HTTPException(status_code=400, detail="Invalid hostname or domain.")

    # Strict SSRF check
    is_safe, error_msg = validate_url_safe(norm_url)
    if not is_safe:
        raise HTTPException(status_code=400, detail=f"Target URL is not permitted: {error_msg}")

    # Bound max pages
    max_pages = min(max(req.max_pages, 5), 50)

    # Create job in database
    job = ScanJob(
        domain=domain,
        target_url=norm_url,
        status="queued",
        progress=0,
        current_step="Scan queued",
        max_pages=max_pages,
        use_sitemap=req.use_sitemap,
        scan_js=req.scan_js,
        scan_tracking=req.scan_tracking
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Enqueue to background worker
    queue_manager.enqueue_scan(job.id, background_tasks)

    return job


@router.get("", response_model=List[ScanJobResponse])
def list_scans(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List recent scan jobs ordered by creation date."""
    jobs = db.query(ScanJob).order_by(desc(ScanJob.created_at)).offset(skip).limit(limit).all()
    return jobs


@router.get("/{id}", response_model=ScanJobResponse)
def get_scan(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get scan job status and progress details."""
    job = db.query(ScanJob).filter(ScanJob.id == id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Scan job not found.")
    return job


@router.post("/{id}/cancel", response_model=ScanJobResponse)
def cancel_scan(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Cancel a queued or active scan job."""
    job = db.query(ScanJob).filter(ScanJob.id == id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Scan job not found.")

    if job.status in ("completed", "failed"):
        return job

    job.status = "cancelled"
    job.current_step = "Scan cancelled by user"
    job.completed_at = utc_now()
    db.commit()
    db.refresh(job)
    return job


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scan(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a scan job and its associated crawl pages and errors."""
    job = db.query(ScanJob).filter(ScanJob.id == id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Scan job not found.")

    db.delete(job)
    db.commit()
    return None


@router.delete("", status_code=status.HTTP_200_OK)
def delete_scans_batch(
    ids: Optional[str] = Query(None, description="Comma-separated scan IDs to delete"),
    scan_status: Optional[str] = Query(None, alias="status", description="Filter by status (e.g. failed)"),
    delete_all: bool = Query(False, alias="all", description="Delete all scan jobs if true"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete scan jobs in bulk by IDs, by status (e.g. failed), or clear all."""
    query = db.query(ScanJob)
    if ids:
        id_list = [int(i.strip()) for i in ids.split(",") if i.strip().isdigit()]
        if id_list:
            query = query.filter(ScanJob.id.in_(id_list))
    elif scan_status:
        query = query.filter(ScanJob.status == scan_status)
    elif not delete_all:
        raise HTTPException(status_code=400, detail="Specify 'ids', 'status', or 'all=true' to delete scans.")

    jobs_to_delete = query.all()
    count = len(jobs_to_delete)
    for j in jobs_to_delete:
        db.delete(j)
    db.commit()

    return {"message": f"Successfully deleted {count} scan jobs.", "deleted_count": count}

