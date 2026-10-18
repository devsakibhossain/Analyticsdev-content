import re
from typing import List, Dict, Tuple
from dataclasses import dataclass
from bs4 import BeautifulSoup


INDUSTRY_KEYWORDS: Dict[str, List[str]] = {
    "Dental": [
        "dentist", "dental", "orthodontist", "teeth", "oral surgery", "implants", "invisalign", "cosmetic dentistry"
    ],
    "Healthcare": [
        "clinic", "doctor", "physician", "patient", "medical", "hospital", "pediatric", "therapy", "chiropractic", "wellness"
    ],
    "Legal": [
        "lawyer", "attorney", "law firm", "litigation", "legal counsel", "personal injury", "criminal defense", "court"
    ],
    "Real Estate": [
        "realtor", "real estate", "homes for sale", "properties", "apartments", "mortgage", "brokerage", "listings", "property management"
    ],
    "Restaurant": [
        "restaurant", "menu", "dining", "cafe", "bistro", "catering", "table reservation", "cuisine", "food & drinks"
    ],
    "Fitness": [
        "gym", "fitness", "personal trainer", "crossfit", "yoga", "pilates", "workout", "coaching"
    ],
    "SaaS": [
        "saas", "software as a service", "api", "cloud platform", "free trial", "monthly subscription", "integrations", "dashboard"
    ],
    "Marketing Agency": [
        "marketing agency", "digital marketing", "seo agency", "lead generation", "ppc management", "advertising agency", "growth marketing"
    ],
    "E-commerce": [
        "add to cart", "checkout", "free shipping", "shop now", "collections", "order tracking", "sku", "product catalog",
        "shop", "store", "clothing", "apparel", "products", "shipping", "cart", "catalog"
    ],
    "Finance": [
        "accounting", "tax preparation", "cpa", "bookkeeping", "wealth management", "financial planning", "insurance", "investment"
    ],
    "Travel": [
        "hotel", "resort", "tour", "travel agency", "flights", "vacation rental", "excursions", "itinerary"
    ],
    "Automotive": [
        "auto repair", "dealership", "used cars", "mechanic", "car detailing", "tire service", "brakes"
    ],
    "Education": [
        "tutoring", "academy", "courses", "bootcamp", "training", "curriculum", "admissions", "school"
    ],
    "Technology": [
        "it services", "cybersecurity", "managed it", "cloud solutions", "devops", "software development"
    ],
    "Professional Services": [
        "consulting", "consultancy", "advisory", "management consulting", "compliance"
    ],
    "Local Business": [
        "plumbing", "electrician", "roofing", "hvac", "cleaning services", "landscaping", "locksmith", "handyman"
    ],
}


@dataclass
class ExtractedIndustry:
    industry: str
    confidence: float


class IndustryClassifier:
    """Classify business industry deterministically based on keyword weighting."""

    def classify(self, pages: List[dict]) -> ExtractedIndustry:
        if not pages:
            return ExtractedIndustry(industry="Other", confidence=0.0)

        # Collect text with weights
        weighted_corpus = []

        home_page = pages[0]
        html = home_page.get("html", "")
        if html:
            try:
                soup = BeautifulSoup(html, "lxml")
            except Exception:
                soup = BeautifulSoup(html, "html.parser")

            # Title (Weight 3)
            title_tag = soup.find("title")
            if title_tag and title_tag.string:
                weighted_corpus.append((title_tag.string.lower(), 3.0))

            # Meta description (Weight 2)
            meta_desc = soup.find("meta", attrs={"name": re.compile(r"^description$", re.I)})
            if meta_desc and meta_desc.get("content"):
                weighted_corpus.append((meta_desc["content"].lower(), 2.0))

            # H1 headings (Weight 2)
            for h1 in soup.find_all("h1"):
                text = h1.get_text()
                if text:
                    weighted_corpus.append((text.lower(), 2.0))

            # Navigation text (Weight 1.5)
            nav = soup.find(["nav", "header"])
            if nav:
                weighted_corpus.append((nav.get_text(separator=" ").lower(), 1.5))

            # Body text (Weight 1.0)
            weighted_corpus.append((soup.get_text(separator=" ").lower()[:10000], 1.0))

        # Calculate scores per industry
        scores: Dict[str, float] = {ind: 0.0 for ind in INDUSTRY_KEYWORDS}

        for text_chunk, weight in weighted_corpus:
            for industry, keywords in INDUSTRY_KEYWORDS.items():
                for kw in keywords:
                    pattern = rf"\b{re.escape(kw)}\b"
                    matches = len(re.findall(pattern, text_chunk))
                    if matches > 0:
                        scores[industry] += matches * weight

        # Find maximum scored industry
        sorted_industries = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        top_industry, top_score = sorted_industries[0]

        if top_score < 4.0:
            return ExtractedIndustry(industry="Other", confidence=0.1)

        # Normalize confidence between 0.4 and 0.95
        confidence = min(0.95, 0.40 + (top_score / 50.0))
        return ExtractedIndustry(industry=top_industry, confidence=round(confidence, 2))
