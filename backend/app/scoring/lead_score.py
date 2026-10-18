from typing import List, Dict, Tuple
from dataclasses import dataclass


@dataclass
class LeadScoreResult:
    score: int
    qualification: str  # High Opportunity, Medium Opportunity, Low Opportunity, Unqualified
    score_reasons: List[Dict[str, any]]


def calculate_lead_score(
    has_email: bool,
    has_phone: bool,
    has_location: bool,
    is_ecommerce: bool,
    has_google_ads: bool,
    has_meta_pixel: bool,
    opportunities_count: int,
    marketing_tech_count: int,
    has_lead_or_booking: bool,
    has_ga4_without_gtm: bool,
) -> LeadScoreResult:
    score = 0
    reasons = []

    # Contacts & Presence
    if has_email:
        score += 5
        reasons.append({"points": 5, "reason": "Verified email address discovered"})

    if has_phone:
        score += 5
        reasons.append({"points": 5, "reason": "Direct telephone contact discovered"})

    if has_location:
        score += 5
        reasons.append({"points": 5, "reason": "Physical location / address identified"})

    # Commercial Signals
    if is_ecommerce:
        score += 10
        reasons.append({"points": 10, "reason": "Active e-commerce store / shopping cart detected"})

    if has_lead_or_booking:
        score += 10
        reasons.append({"points": 10, "reason": "Lead capture form or booking scheduling workflow detected"})

    # Paid Advertising Tracking
    if has_google_ads:
        score += 10
        reasons.append({"points": 10, "reason": "Google Ads tracking active (paid advertising budget)"})

    if has_meta_pixel:
        score += 10
        reasons.append({"points": 10, "reason": "Meta Pixel active (paid social advertising budget)"})

    # High-Value Tracking Opportunities
    if opportunities_count > 0:
        score += 20
        reasons.append({"points": 20, "reason": f"{opportunities_count} high-value tracking/analytics audit opportunities detected"})

    # Technology Stack Depth
    if marketing_tech_count >= 3:
        score += 10
        reasons.append({"points": 10, "reason": f"Active marketing stack with {marketing_tech_count} tools identified"})

    # Tag Architecture
    if has_ga4_without_gtm:
        score += 5
        reasons.append({"points": 5, "reason": "Direct GA4 implementation without Google Tag Manager"})

    # Cap score at 100
    final_score = min(100, score)

    # Qualification categorization
    if final_score >= 80:
        qualification = "High Opportunity"
    elif final_score >= 60:
        qualification = "Medium Opportunity"
    elif final_score >= 40:
        qualification = "Low Opportunity"
    else:
        qualification = "Unqualified"

    return LeadScoreResult(
        score=final_score,
        qualification=qualification,
        score_reasons=reasons
    )
