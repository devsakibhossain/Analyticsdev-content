from app.config import get_settings
from app.models.lead import Lead
from app.models.contact import LeadContact
from app.models.social import LeadSocial
from app.models.technology import LeadTechnology
from app.models.opportunity import LeadOpportunity

settings = get_settings()


def get_auth_token(client):
    res = client.post(
        "/api/auth/login",
        json={"email": settings.ADMIN_EMAIL, "password": settings.ADMIN_PASSWORD}
    )
    return res.json()["access_token"]


def seed_test_lead(db_session):
    lead = Lead(
        domain="shoptest.com",
        website_url="https://shoptest.com",
        company_name="Shop Test LLC",
        website_title="Shop Test - Best Gadgets",
        industry="E-commerce",
        country="United States",
        city="New York",
        cms="Shopify",
        is_ecommerce="Detected",
        ecommerce_platform="Shopify",
        lead_score=85,
        qualification="High Opportunity",
        score_reasons=[{"points": 10, "reason": "E-commerce detected"}]
    )
    db_session.add(lead)
    db_session.commit()
    db_session.refresh(lead)

    contact = LeadContact(
        lead_id=lead.id,
        contact_type="email",
        value="support@shoptest.com",
        category="support"
    )
    social = LeadSocial(
        lead_id=lead.id,
        platform="instagram",
        url="https://instagram.com/shoptest"
    )
    tech = LeadTechnology(
        lead_id=lead.id,
        category="analytics",
        name="Google Analytics 4",
        status="Detected",
        identifier="G-TEST12345"
    )
    opp = LeadOpportunity(
        lead_id=lead.id,
        opportunity_type="ga4_audit",
        title="GA4 / Tag Management Audit",
        reason="Direct GA4 implementation without GTM",
        confidence=0.95
    )
    db_session.add_all([contact, social, tech, opp])
    db_session.commit()
    return lead


def test_list_and_filter_leads(client, db_session):
    token = get_auth_token(client)
    lead = seed_test_lead(db_session)

    # List all
    res = client.get("/api/leads", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    leads = res.json()
    assert len(leads) >= 1
    assert leads[0]["domain"] == "shoptest.com"
    assert leads[0]["qualification"] == "High Opportunity"

    # Filter by qualification
    res_high = client.get("/api/leads?qualification=High%20Opportunity", headers={"Authorization": f"Bearer {token}"})
    assert len(res_high.json()) >= 1

    # Filter by non-matching industry
    res_other = client.get("/api/leads?industry=Dental", headers={"Authorization": f"Bearer {token}"})
    assert len(res_other.json()) == 0

    # Search query
    res_search = client.get("/api/leads?q=shoptest", headers={"Authorization": f"Bearer {token}"})
    assert len(res_search.json()) >= 1


def test_get_lead_details(client, db_session):
    token = get_auth_token(client)
    lead = seed_test_lead(db_session)

    res = client.get(f"/api/leads/{lead.id}", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["company_name"] == "Shop Test LLC"
    assert len(data["contacts"]) >= 1
    assert data["contacts"][0]["value"] == "support@shoptest.com"
    assert len(data["socials"]) >= 1
    assert len(data["technologies"]) >= 1
    assert len(data["opportunities"]) >= 1


def test_dashboard_stats(client, db_session):
    token = get_auth_token(client)
    seed_test_lead(db_session)

    res = client.get("/api/stats", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    stats = res.json()
    assert stats["total_leads"] >= 1
    assert stats["high_opportunity"] >= 1
    assert stats["ecommerce_count"] >= 1
    assert stats["ga4_count"] >= 1
    assert stats["opportunities"]["ga4_audit"] >= 1


def test_opportunities_overview(client, db_session):
    token = get_auth_token(client)
    seed_test_lead(db_session)

    res = client.get("/api/opportunities", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["total_leads_affected"] >= 1
    assert len(data["opportunities"]) >= 1


def test_csv_export(client, db_session):
    token = get_auth_token(client)
    seed_test_lead(db_session)

    res = client.get("/api/export/csv", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "attachment; filename=" in res.headers["content-disposition"]
    
    csv_text = res.text
    assert "Company,Website,Industry" in csv_text
    assert "Shop Test LLC" in csv_text
    assert "shoptest.com" in csv_text
    assert "support@shoptest.com" in csv_text


def test_delete_leads_and_batch(client, db_session):
    token = get_auth_token(client)
    lead = seed_test_lead(db_session)

    # Delete single lead
    del_res = client.delete(f"/api/leads/{lead.id}", headers={"Authorization": f"Bearer {token}"})
    assert del_res.status_code == 204

    # Seed again and batch delete
    seed_test_lead(db_session)
    batch_del = client.delete("/api/leads?all=true", headers={"Authorization": f"Bearer {token}"})
    assert batch_del.status_code == 200
    assert batch_del.json()["deleted_count"] >= 1


def test_pipeline_stages_and_stats(client, db_session):
    token = get_auth_token(client)
    lead = seed_test_lead(db_session)

    # Check default stage
    res = client.get(f"/api/leads/{lead.id}", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["pipeline_stage"] == "new"

    # Update stage to contacted
    patch_res = client.patch(
        f"/api/leads/{lead.id}/stage",
        json={"stage": "contacted"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["pipeline_stage"] == "contacted"

    # Invalid stage rejected
    bad_res = client.patch(
        f"/api/leads/{lead.id}/stage",
        json={"stage": "invalid_stage"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert bad_res.status_code == 400

    # Pipeline stats
    stats_res = client.get("/api/leads/pipeline/stats", headers={"Authorization": f"Bearer {token}"})
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["stages"]["contacted"] >= 1


def test_lead_notes_crud(client, db_session):
    token = get_auth_token(client)
    lead = seed_test_lead(db_session)

    # Create note
    create_res = client.post(
        f"/api/leads/{lead.id}/notes",
        json={"content": "Sent WhatsApp message to founder about GA4 audit", "author": "Admin"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert create_res.status_code == 201
    note_data = create_res.json()
    assert note_data["content"] == "Sent WhatsApp message to founder about GA4 audit"
    note_id = note_data["id"]

    # List notes
    list_res = client.get(f"/api/leads/{lead.id}/notes", headers={"Authorization": f"Bearer {token}"})
    assert list_res.status_code == 200
    notes = list_res.json()
    assert len(notes) == 1
    assert notes[0]["id"] == note_id

    # Check lead detail includes notes
    detail_res = client.get(f"/api/leads/{lead.id}", headers={"Authorization": f"Bearer {token}"})
    assert len(detail_res.json()["notes"]) == 1

    # Delete note
    del_res = client.delete(f"/api/leads/{lead.id}/notes/{note_id}", headers={"Authorization": f"Bearer {token}"})
    assert del_res.status_code == 204

    # Verify deleted
    list_after = client.get(f"/api/leads/{lead.id}/notes", headers={"Authorization": f"Bearer {token}"})
    assert len(list_after.json()) == 0


