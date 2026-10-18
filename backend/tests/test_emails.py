import pytest
from unittest.mock import AsyncMock, patch
from app.api.auth import create_access_token
from app.models.lead import Lead
from app.models.email import LeadEmail
from app.models.note import LeadNote


def get_auth_headers(user_id: int = 1):
    token = create_access_token({"sub": str(user_id)})
    return {"Authorization": f"Bearer {token}"}


def test_get_email_templates(client, db_session):
    headers = get_auth_headers()
    response = client.get("/api/emails/templates", headers=headers)
    assert response.status_code == 200
    templates = response.json()
    assert len(templates) >= 5
    assert any("GA4" in t["name"] for t in templates)
    assert any("Meta" in t["name"] for t in templates)


@patch("app.api.emails.mail_client.get_mailbox_status", new_callable=AsyncMock)
def test_get_mailbox_status(mock_status, client, db_session):
    mock_status.return_value = {
        "connected": True,
        "address": "hello@sakibhossain.io",
        "display_name": "Sakib Hossain",
        "mailbox_resource_id": "AC587f34bd0f76ba72bc12191c1dd4",
        "order_resource_id": "OR91dd313a556bfabbce19a1db983d",
        "inbox_messages": 5,
        "sent_messages": 2,
        "storage_usage_kb": 513,
        "storage_limit_kb": 20971520,
        "storage_percentage": 0,
    }

    headers = get_auth_headers()
    response = client.get("/api/emails/mailbox-status", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["connected"] is True
    assert data["address"] == "hello@sakibhossain.io"


@patch("app.api.emails.mail_client.send_email", new_callable=AsyncMock)
def test_send_email_and_crm_progression(mock_send, client, db_session):
    mock_send.return_value = {
        "success": True,
        "message_id": "msg_test_12345",
        "to": "client@example.com",
        "subject": "Quick tracking audit"
    }

    # Create a test lead in 'new' stage
    lead = Lead(
        domain="clientbrand.com",
        website_url="https://clientbrand.com",
        company_name="Client Brand",
        pipeline_stage="new"
    )
    db_session.add(lead)
    db_session.commit()
    db_session.refresh(lead)

    headers = get_auth_headers()
    payload = {
        "to_email": "client@example.com",
        "subject": "Quick tracking audit for Client Brand",
        "body_text": "Hi, noticed some tracking gaps on clientbrand.com...",
        "lead_id": lead.id
    }

    response = client.post("/api/emails/send", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["recipient_email"] == "client@example.com"
    assert data["status"] == "sent"
    assert data["provider_message_id"] == "msg_test_12345"

    # Verify CRM stage was updated to 'contacted'
    db_session.refresh(lead)
    assert lead.pipeline_stage == "contacted"

    # Verify timeline note was automatically appended
    notes = db_session.query(LeadNote).filter(LeadNote.lead_id == lead.id).all()
    assert len(notes) == 1
    assert "Outreach Email Sent" in notes[0].content
    assert "client@example.com" in notes[0].content

    # Verify email history endpoint returns this email
    history_resp = client.get("/api/emails/history", headers=headers)
    assert history_resp.status_code == 200
    history = history_resp.json()
    assert len(history) == 1
    assert history[0]["recipient_email"] == "client@example.com"
    assert history[0]["lead_domain"] == "clientbrand.com"
    tracking_token = history[0]["tracking_token"]
    assert tracking_token is not None

    # Test open tracking pixel
    pixel_resp = client.get(f"/api/emails/track/open/{tracking_token}.png")
    assert pixel_resp.status_code == 200
    assert pixel_resp.headers["content-type"] == "image/png"

    # Verify email status updated to opened and open_count increased
    history_resp_after = client.get("/api/emails/history", headers=headers)
    assert history_resp_after.status_code == 200
    history_after = history_resp_after.json()
    assert history_after[0]["open_count"] >= 1
    assert history_after[0]["status"] == "opened"

    # Test funnel stats
    funnel_resp = client.get("/api/emails/funnel-stats", headers=headers)
    assert funnel_resp.status_code == 200
    f_data = funnel_resp.json()
    assert f_data["total_sent"] >= 1
    assert f_data["opened_count"] >= 1
    assert f_data["open_rate_percent"] > 0


@patch("app.api.emails.mail_client.get_messages", new_callable=AsyncMock)
@patch("app.api.emails.mail_client.get_message_detail", new_callable=AsyncMock)
def test_inbox_and_detail(mock_detail, mock_msgs, client, db_session):
    mock_msgs.return_value = {
        "data": [
            {
                "uid": 10,
                "path": "INBOX",
                "date": "2026-09-24T12:00:00Z",
                "subject": "Interested in GA4 audit",
                "from": {"name": "John Doe", "address": "john@brand.com"},
                "to": [{"name": "Sakib", "address": "hello@sakibhossain.io"}],
                "unseen": True,
                "flags": [],
                "size": 2048,
                "messageId": "<msg10@brand.com>",
                "inReplyTo": None
            }
        ],
        "pagination": {"page": 1, "perPage": 25, "total": 1}
    }

    mock_detail.return_value = {
        "uid": 10,
        "folder": "INBOX",
        "subject": "Interested in GA4 audit",
        "from": "John Doe <john@brand.com>",
        "to": "hello@sakibhossain.io",
        "date": "2026-09-24T12:00:00Z",
        "message_id": "<msg10@brand.com>",
        "in_reply_to": None,
        "body_text": "Hey Sakib, we would love to review the tracking audit video.",
        "body_html": "<p>Hey Sakib, we would love to review the tracking audit video.</p>"
    }

    headers = get_auth_headers()
    inbox_resp = client.get("/api/emails/inbox", headers=headers)
    assert inbox_resp.status_code == 200
    inbox_data = inbox_resp.json()
    assert len(inbox_data["messages"]) == 1
    assert inbox_data["messages"][0]["subject"] == "Interested in GA4 audit"

    detail_resp = client.get("/api/emails/inbox/10", headers=headers)
    assert detail_resp.status_code == 200
    d_data = detail_resp.json()
    assert "review the tracking audit" in d_data["body_text"]
