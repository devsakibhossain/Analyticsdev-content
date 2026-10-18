from typing import Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.lead import Lead
from app.models.contact import LeadContact
from app.models.technology import LeadTechnology
from app.models.opportunity import LeadOpportunity

router = APIRouter(prefix="/stats", tags=["Stats"])


@router.get("")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Retrieve high-level dashboard metrics for lead prospecting and tech adoption."""
    total_leads = db.query(Lead).count()

    high_opp = db.query(Lead).filter(Lead.qualification == "High Opportunity").count()
    med_opp = db.query(Lead).filter(Lead.qualification == "Medium Opportunity").count()
    low_opp = db.query(Lead).filter(Lead.qualification == "Low Opportunity").count()
    unqualified = db.query(Lead).filter(Lead.qualification == "Unqualified").count()

    emails_found = db.query(LeadContact).filter(LeadContact.contact_type == "email").count()
    phones_found = db.query(LeadContact).filter(LeadContact.contact_type == "phone").count()

    ecom_count = db.query(Lead).filter(Lead.is_ecommerce == "Detected").count()

    ga4_count = db.query(func.count(func.distinct(LeadTechnology.lead_id))).filter(
        LeadTechnology.name == "Google Analytics 4",
        LeadTechnology.status == "Detected"
    ).scalar() or 0

    gtm_count = db.query(func.count(func.distinct(LeadTechnology.lead_id))).filter(
        LeadTechnology.name == "Google Tag Manager",
        LeadTechnology.status == "Detected"
    ).scalar() or 0

    meta_count = db.query(func.count(func.distinct(LeadTechnology.lead_id))).filter(
        LeadTechnology.name == "Meta Pixel",
        LeadTechnology.status == "Detected"
    ).scalar() or 0

    gads_count = db.query(func.count(func.distinct(LeadTechnology.lead_id))).filter(
        LeadTechnology.name == "Google Ads",
        LeadTechnology.status == "Detected"
    ).scalar() or 0

    # Opportunities counts
    ga4_opps = db.query(LeadOpportunity).filter(LeadOpportunity.opportunity_type == "ga4_audit").count()
    gtm_opps = db.query(LeadOpportunity).filter(LeadOpportunity.opportunity_type == "gtm_audit").count()
    meta_opps = db.query(LeadOpportunity).filter(LeadOpportunity.opportunity_type == "meta_audit").count()
    gads_opps = db.query(LeadOpportunity).filter(LeadOpportunity.opportunity_type == "gads_audit").count()
    ecom_opps = db.query(LeadOpportunity).filter(LeadOpportunity.opportunity_type == "ecommerce_audit").count()
    lead_opps = db.query(LeadOpportunity).filter(LeadOpportunity.opportunity_type == "lead_audit").count()

    return {
        "total_leads": total_leads,
        "high_opportunity": high_opp,
        "medium_opportunity": med_opp,
        "low_opportunity": low_opp,
        "unqualified": unqualified,
        "emails_found": emails_found,
        "phones_found": phones_found,
        "ecommerce_count": ecom_count,
        "ga4_count": ga4_count,
        "gtm_count": gtm_count,
        "meta_pixel_count": meta_count,
        "google_ads_count": gads_count,
        "opportunities": {
            "ga4_audit": ga4_opps,
            "gtm_audit": gtm_opps,
            "meta_audit": meta_opps,
            "gads_audit": gads_opps,
            "ecommerce_audit": ecom_opps,
            "lead_audit": lead_opps,
        }
    }
