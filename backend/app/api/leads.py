import json
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_, and_

from app.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.lead import Lead
from app.models.contact import LeadContact
from app.models.social import LeadSocial
from app.models.technology import LeadTechnology
from app.models.opportunity import LeadOpportunity
from app.models.crawl_page import CrawlPage
from app.models.scan_job import ScanJob
from app.models.note import LeadNote
from app.jobs.queue import queue_manager

router = APIRouter(prefix="/leads", tags=["Leads"])


# --- Schemas ---

class NoteCreate(BaseModel):
    content: str
    author: Optional[str] = "Admin"


class NoteResponse(BaseModel):
    id: int
    lead_id: int
    content: str
    author: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class StageUpdate(BaseModel):
    stage: str


class ContactResponse(BaseModel):
    id: int
    contact_type: str
    value: str
    category: str
    source_url: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class SocialResponse(BaseModel):
    id: int
    platform: str
    url: str
    source_url: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class TechResponse(BaseModel):
    id: int
    category: str
    name: str
    status: str
    identifier: Optional[str] = None
    confidence: float
    evidence: Optional[str] = None
    source_url: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class OpportunityResponse(BaseModel):
    id: int
    opportunity_type: str
    title: str
    reason: str
    evidence: Optional[str] = None
    source_url: Optional[str] = None
    confidence: float
    created_at: datetime
    model_config = {"from_attributes": True}


class CrawlPageResponse(BaseModel):
    id: int
    url: str
    status_code: Optional[int] = None
    title: Optional[str] = None
    page_type: str
    load_time_ms: Optional[int] = None
    created_at: datetime
    model_config = {"from_attributes": True}


class LeadSummaryResponse(BaseModel):
    id: int
    domain: str
    website_url: str
    company_name: Optional[str] = None
    website_title: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    cms: Optional[str] = None
    is_ecommerce: str
    lead_score: int
    qualification: str
    pipeline_stage: str = "new"
    ad_platforms: Optional[List[str]] = []
    pages_crawled: int
    created_at: datetime
    updated_at: datetime
    contacts: List[ContactResponse] = []
    socials: List[SocialResponse] = []
    opportunities: List[OpportunityResponse] = []
    technologies: List[TechResponse] = []
    notes: List[NoteResponse] = []

    model_config = {"from_attributes": True}

    @field_validator("ad_platforms", mode="before")
    @classmethod
    def parse_ad_platforms(cls, v):
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                return []
        if isinstance(v, list):
            return v
        return []


class LeadDetailResponse(LeadSummaryResponse):
    description: Optional[str] = None
    industry_confidence: Optional[float] = None
    state: Optional[str] = None
    address: Optional[str] = None
    postal_code: Optional[str] = None
    ecommerce_platform: Optional[str] = None
    score_reasons: Optional[list] = None
    crawl_pages: List[CrawlPageResponse] = []

    @field_validator("score_reasons", mode="before")
    @classmethod
    def parse_score_reasons(cls, v):
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                return []
        if isinstance(v, list):
            return v
        return []



# --- Routes ---

@router.get("", response_model=List[LeadSummaryResponse])
def list_leads(
    q: Optional[str] = Query(None, description="Search query across company, domain, email"),
    qualification: Optional[str] = Query(None),
    stage: Optional[str] = Query(None, description="Filter by pipeline stage (new, contacted, meeting, proposal, won, lost)"),
    ad_platform: Optional[str] = Query(None, description="Filter by ad network (Google Ads, Meta Ads, TikTok Ads, etc.)"),
    industry: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    cms: Optional[str] = Query(None),
    is_ecommerce: Optional[str] = Query(None),
    has_ga4: Optional[bool] = Query(None),
    has_gtm: Optional[bool] = Query(None),
    has_meta: Optional[bool] = Query(None),
    has_google_ads: Optional[bool] = Query(None),
    min_score: Optional[int] = Query(None, ge=0, le=100),
    sort_by: str = Query("score_desc", pattern="^(score_desc|score_asc|date_desc|date_asc)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List leads with multi-faceted filtering, searching, and sorting."""
    query = db.query(Lead).options(
        joinedload(Lead.contacts),
        joinedload(Lead.socials),
        joinedload(Lead.technologies),
        joinedload(Lead.opportunities),
        joinedload(Lead.notes)
    )

    # Search filter
    if q:
        search_term = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                Lead.company_name.ilike(search_term),
                Lead.domain.ilike(search_term),
                Lead.website_title.ilike(search_term),
                Lead.contacts.any(LeadContact.value.ilike(search_term))
            )
        )

    # Pipeline Stage filter
    if stage:
        query = query.filter(Lead.pipeline_stage == stage.lower())

    # Ad Platform filter
    if ad_platform:
        search_ad = f"%{ad_platform.strip().lower()}%"
        query = query.filter(
            or_(
                Lead.technologies.any(and_(LeadTechnology.name.ilike(search_ad), LeadTechnology.status == "Detected")),
                Lead.ad_platforms.contains(ad_platform)
            )
        )

    # Category filters
    if qualification:
        query = query.filter(Lead.qualification == qualification)
    if industry:
        query = query.filter(Lead.industry == industry)
    if country:
        query = query.filter(Lead.country == country)
    if cms:
        query = query.filter(Lead.cms == cms)
    if is_ecommerce:
        query = query.filter(Lead.is_ecommerce == is_ecommerce)
    if min_score is not None:
        query = query.filter(Lead.lead_score >= min_score)

    # Tech filters
    if has_ga4 is not None:
        if has_ga4:
            query = query.filter(Lead.technologies.any(LeadTechnology.name == "Google Analytics 4"))
        else:
            query = query.filter(~Lead.technologies.any(LeadTechnology.name == "Google Analytics 4"))

    if has_gtm is not None:
        if has_gtm:
            query = query.filter(Lead.technologies.any(LeadTechnology.name == "Google Tag Manager"))
        else:
            query = query.filter(~Lead.technologies.any(LeadTechnology.name == "Google Tag Manager"))

    if has_meta is not None:
        if has_meta:
            query = query.filter(Lead.technologies.any(LeadTechnology.name == "Meta Pixel"))
        else:
            query = query.filter(~Lead.technologies.any(LeadTechnology.name == "Meta Pixel"))

    if has_google_ads is not None:
        if has_google_ads:
            query = query.filter(Lead.technologies.any(LeadTechnology.name == "Google Ads"))
        else:
            query = query.filter(~Lead.technologies.any(LeadTechnology.name == "Google Ads"))

    # Sorting
    if sort_by == "score_desc":
        query = query.order_by(desc(Lead.lead_score), desc(Lead.created_at))
    elif sort_by == "score_asc":
        query = query.order_by(Lead.lead_score, desc(Lead.created_at))
    elif sort_by == "date_desc":
        query = query.order_by(desc(Lead.created_at))
    elif sort_by == "date_asc":
        query = query.order_by(Lead.created_at)

    raw_leads = query.offset(skip).limit(limit).all()
    # Deduplicate in memory while preserving order
    seen_ids = set()
    leads = []
    for l in raw_leads:
        if l.id not in seen_ids:
            seen_ids.add(l.id)
            leads.append(l)
    return leads


@router.get("/pipeline/stats")
def get_pipeline_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return count of leads grouped by pipeline stage."""
    stages = ["new", "contacted", "meeting", "proposal", "won", "lost"]
    counts = {s: 0 for s in stages}
    all_leads = db.query(Lead.pipeline_stage).all()
    for (st,) in all_leads:
        stage_key = st if st in counts else "new"
        counts[stage_key] += 1
    return {
        "total": len(all_leads),
        "stages": counts
    }


@router.get("/{id}", response_model=LeadDetailResponse)
def get_lead(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve complete lead details with contacts, socials, stack, notes, and evidence."""
    lead = db.query(Lead).options(
        joinedload(Lead.contacts),
        joinedload(Lead.socials),
        joinedload(Lead.technologies),
        joinedload(Lead.opportunities),
        joinedload(Lead.crawl_pages),
        joinedload(Lead.notes)
    ).filter(Lead.id == id).first()

    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    return lead


@router.patch("/{id}/stage", response_model=LeadSummaryResponse)
def update_lead_stage(
    id: int,
    stage_data: StageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update pipeline stage of a lead (new, contacted, meeting, proposal, won, lost)."""
    valid_stages = {"new", "contacted", "meeting", "proposal", "won", "lost"}
    stage_val = stage_data.stage.lower().strip()
    if stage_val not in valid_stages:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid stage '{stage_data.stage}'. Must be one of: {sorted(list(valid_stages))}"
        )
    lead = db.query(Lead).filter(Lead.id == id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    lead.pipeline_stage = stage_val
    db.commit()
    db.refresh(lead)
    return lead


@router.get("/{id}/notes", response_model=List[NoteResponse])
def get_lead_notes(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve notes for a specific lead."""
    lead = db.query(Lead).filter(Lead.id == id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    notes = db.query(LeadNote).filter(LeadNote.lead_id == id).order_by(desc(LeadNote.created_at)).all()
    return notes


@router.post("/{id}/notes", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
def create_lead_note(
    id: int,
    note_in: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new note on a lead."""
    lead = db.query(Lead).filter(Lead.id == id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")
    if not note_in.content.strip():
        raise HTTPException(status_code=400, detail="Note content cannot be empty.")

    author_name = note_in.author or getattr(current_user, "email", "Admin")
    note = LeadNote(
        lead_id=id,
        content=note_in.content.strip(),
        author=author_name
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead_note(
    id: int,
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a note from a lead."""
    note = db.query(LeadNote).filter(LeadNote.id == note_id, LeadNote.lead_id == id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")
    db.delete(note)
    db.commit()
    return None


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a lead and all associated relations."""
    lead = db.query(Lead).filter(Lead.id == id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")

    db.delete(lead)
    db.commit()
    return None


@router.delete("", status_code=status.HTTP_200_OK)
def delete_leads_batch(
    ids: Optional[str] = Query(None, description="Comma-separated lead IDs to delete"),
    delete_all: bool = Query(False, alias="all", description="Delete all leads if true"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete leads in bulk by IDs or clear all leads."""
    query = db.query(Lead)
    if ids:
        id_list = [int(i.strip()) for i in ids.split(",") if i.strip().isdigit()]
        if id_list:
            query = query.filter(Lead.id.in_(id_list))
    elif not delete_all:
        raise HTTPException(status_code=400, detail="Specify 'ids' or 'all=true' to delete leads.")

    leads_to_delete = query.all()
    count = len(leads_to_delete)
    for l in leads_to_delete:
        db.delete(l)
    db.commit()

    return {"message": f"Successfully deleted {count} leads.", "deleted_count": count}


@router.post("/{id}/rescan", status_code=status.HTTP_201_CREATED)
def rescan_lead(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Trigger a new background crawl and re-analysis for an existing lead."""
    lead = db.query(Lead).filter(Lead.id == id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")

    # Create scan job
    job = ScanJob(
        domain=lead.domain,
        target_url=lead.website_url,
        status="queued",
        progress=0,
        current_step="Rescan queued",
        max_pages=20,
        use_sitemap=True,
        scan_js=True,
        scan_tracking=True,
        lead_id=lead.id
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    queue_manager.enqueue_scan(job.id)
    return {"message": "Rescan job created", "scan_id": job.id}
