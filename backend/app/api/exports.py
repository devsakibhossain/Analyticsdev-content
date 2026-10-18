import io
import csv
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, or_

from app.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.lead import Lead
from app.models.contact import LeadContact
from app.models.social import LeadSocial
from app.models.technology import LeadTechnology
from app.models.opportunity import LeadOpportunity
from app.core.security import sanitize_csv_value

router = APIRouter(prefix="/export", tags=["Export"])


@router.get("/csv")
def export_leads_csv(
    lead_ids: Optional[str] = Query(None, description="Comma-separated lead IDs for selective export"),
    q: Optional[str] = Query(None),
    qualification: Optional[str] = Query(None),
    industry: Optional[str] = Query(None),
    country: Optional[str] = Query(None),
    is_ecommerce: Optional[str] = Query(None),
    min_score: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate and download formatted CSV export of leads."""
    query = db.query(Lead).options(
        joinedload(Lead.contacts),
        joinedload(Lead.socials),
        joinedload(Lead.technologies),
        joinedload(Lead.opportunities)
    )

    if lead_ids:
        try:
            ids = [int(i.strip()) for i in lead_ids.split(",") if i.strip()]
            query = query.filter(Lead.id.in_(ids))
        except ValueError:
            pass
    else:
        if q:
            search_term = f"%{q.strip().lower()}%"
            query = query.filter(
                or_(
                    Lead.company_name.ilike(search_term),
                    Lead.domain.ilike(search_term),
                    Lead.website_title.ilike(search_term)
                )
            )
        if qualification:
            query = query.filter(Lead.qualification == qualification)
        if industry:
            query = query.filter(Lead.industry == industry)
        if country:
            query = query.filter(Lead.country == country)
        if is_ecommerce:
            query = query.filter(Lead.is_ecommerce == is_ecommerce)
        if min_score is not None:
            query = query.filter(Lead.lead_score >= min_score)

    raw_leads = query.order_by(desc(Lead.lead_score)).all()
    seen_ids = set()
    leads = []
    for l in raw_leads:
        if l.id not in seen_ids:
            seen_ids.add(l.id)
            leads.append(l)

    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)

    # Headers
    headers = [
        "Company", "Website", "Industry", "Country", "City", "Address",
        "Email", "Phone", "WhatsApp",
        "LinkedIn", "Facebook", "Instagram", "YouTube", "TikTok",
        "CMS", "E-commerce",
        "GA4", "GTM", "Meta Pixel", "Google Ads", "Clarity",
        "Opportunities", "Lead Score", "Qualification", "Score Reasons", "Scan Date"
    ]
    writer.writerow(headers)

    for lead in leads:
        # Collect contacts
        emails = "; ".join([c.value for c in lead.contacts if c.contact_type == "email"])
        phones = "; ".join([c.value for c in lead.contacts if c.contact_type == "phone"])
        whatsapps = "; ".join([c.value for c in lead.contacts if c.contact_type == "whatsapp"])

        # Collect socials
        social_map = {s.platform: s.url for s in lead.socials}

        # Collect technologies
        tech_map = {t.name: (t.identifier or "Detected") for t in lead.technologies if t.status == "Detected"}

        ga4_val = tech_map.get("Google Analytics 4", "Not detected")
        gtm_val = tech_map.get("Google Tag Manager", "Not detected")
        meta_val = tech_map.get("Meta Pixel", "Not detected")
        gads_val = tech_map.get("Google Ads", "Not detected")
        clarity_val = tech_map.get("Microsoft Clarity", "Not detected")

        # Opportunities summary
        opp_list = "; ".join([f"{o.title} ({o.reason})" for o in lead.opportunities])

        # Score reasons
        reasons_list = ""
        if lead.score_reasons:
            reasons_list = "; ".join([f"+{r.get('points', 0)} {r.get('reason', '')}" for r in lead.score_reasons])

        scan_date = lead.created_at.strftime("%Y-%m-%d %H:%M:%S")

        row = [
            sanitize_csv_value(lead.company_name or lead.domain),
            sanitize_csv_value(lead.website_url),
            sanitize_csv_value(lead.industry or "Unknown"),
            sanitize_csv_value(lead.country or "Unknown"),
            sanitize_csv_value(lead.city or "Unknown"),
            sanitize_csv_value(lead.address or "Unknown"),
            sanitize_csv_value(emails),
            sanitize_csv_value(phones),
            sanitize_csv_value(whatsapps),
            sanitize_csv_value(social_map.get("linkedin", "")),
            sanitize_csv_value(social_map.get("facebook", "")),
            sanitize_csv_value(social_map.get("instagram", "")),
            sanitize_csv_value(social_map.get("youtube", "")),
            sanitize_csv_value(social_map.get("tiktok", "")),
            sanitize_csv_value(lead.cms or "Unknown"),
            sanitize_csv_value(f"{lead.is_ecommerce} ({lead.ecommerce_platform or 'N/A'})" if lead.is_ecommerce == "Detected" else "Not detected"),
            sanitize_csv_value(ga4_val),
            sanitize_csv_value(gtm_val),
            sanitize_csv_value(meta_val),
            sanitize_csv_value(gads_val),
            sanitize_csv_value(clarity_val),
            sanitize_csv_value(opp_list),
            sanitize_csv_value(lead.lead_score),
            sanitize_csv_value(lead.qualification),
            sanitize_csv_value(reasons_list),
            sanitize_csv_value(scan_date)
        ]
        writer.writerow(row)

    csv_data = output.getvalue()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"leads_export_{timestamp}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
