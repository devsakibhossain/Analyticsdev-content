from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.opportunity import LeadOpportunity
from app.models.lead import Lead

router = APIRouter(prefix="/opportunities", tags=["Opportunities"])


@router.get("")
def get_opportunities_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Retrieve aggregated breakdown of tracking opportunities across all crawled leads."""
    opps = db.query(LeadOpportunity).join(Lead).all()

    grouped: Dict[str, Dict[str, Any]] = {
        "ga4_audit": {
            "title": "GA4 / Tag Management Audit",
            "description": "Direct GA4 setups lacking Google Tag Manager container integration.",
            "leads": []
        },
        "meta_audit": {
            "title": "Meta Tracking & Server-Side Audit",
            "description": "Meta Pixel active on frontend; verify CAPI, deduplication, and event match quality.",
            "leads": []
        },
        "gads_audit": {
            "title": "Google Ads Conversion Tracking Audit",
            "description": "Google Ads remarketing observed without verified purchase/lead conversion tags.",
            "leads": []
        },
        "ecommerce_audit": {
            "title": "E-commerce Measurement Audit",
            "description": "Stores needing GA4 enhanced e-commerce purchase and funnel tracking.",
            "leads": []
        },
        "lead_audit": {
            "title": "Lead Conversion Tracking Audit",
            "description": "Lead generation or booking workflows lacking reliable event tracking.",
            "leads": []
        },
    }

    for opp in opps:
        cat = opp.opportunity_type
        if cat not in grouped:
            grouped[cat] = {
                "title": opp.title,
                "description": opp.reason[:100],
                "leads": []
            }
        
        lead_summary = {
            "lead_id": opp.lead_id,
            "company_name": opp.lead.company_name or opp.lead.domain,
            "domain": opp.lead.domain,
            "lead_score": opp.lead.lead_score,
            "qualification": opp.lead.qualification,
            "evidence": opp.evidence,
            "source_url": opp.source_url
        }
        grouped[cat]["leads"].append(lead_summary)

    # Format result with counts
    result = []
    for cat, data in grouped.items():
        result.append({
            "opportunity_type": cat,
            "title": data["title"],
            "description": data["description"],
            "total_count": len(data["leads"]),
            "leads": data["leads"]
        })

    return {"opportunities": result, "total_leads_affected": len(set(opp.lead_id for opp in opps))}
