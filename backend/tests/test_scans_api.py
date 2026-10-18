from app.config import get_settings

settings = get_settings()


def get_auth_token(client):
    res = client.post(
        "/api/auth/login",
        json={"email": settings.ADMIN_EMAIL, "password": settings.ADMIN_PASSWORD}
    )
    return res.json()["access_token"]


def test_create_scan_blocks_ssrf(client):
    token = get_auth_token(client)
    res = client.post(
        "/api/scans",
        json={"url": "http://127.0.0.1:8000/internal"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 400
    assert "not permitted" in res.json()["detail"]


def test_create_scan_success(client):
    token = get_auth_token(client)
    res = client.post(
        "/api/scans",
        json={"url": "https://example.com", "max_pages": 15},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 201
    data = res.json()
    assert data["domain"] == "example.com"
    assert data["status"] in ("queued", "running")
    assert data["max_pages"] == 15
    assert data["progress"] >= 0

    scan_id = data["id"]

    # Retrieve scan by id
    get_res = client.get(
        f"/api/scans/{scan_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert get_res.status_code == 200
    assert get_res.json()["id"] == scan_id

    # List scans
    list_res = client.get(
        "/api/scans",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # Cancel scan
    cancel_res = client.post(
        f"/api/scans/{scan_id}/cancel",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"

    # Delete single scan
    del_res = client.delete(
        f"/api/scans/{scan_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert del_res.status_code == 204

    # Verify scan deleted
    get_del = client.get(
        f"/api/scans/{scan_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert get_del.status_code == 404


def test_batch_delete_scans(client):
    token = get_auth_token(client)
    # Create two scans
    res1 = client.post("/api/scans", json={"url": "https://site1.com"}, headers={"Authorization": f"Bearer {token}"})
    res2 = client.post("/api/scans", json={"url": "https://site2.com"}, headers={"Authorization": f"Bearer {token}"})
    assert res1.status_code == 201
    assert res2.status_code == 201

    # Batch delete all
    del_all = client.delete("/api/scans?all=true", headers={"Authorization": f"Bearer {token}"})
    assert del_all.status_code == 200
    assert del_all.json()["deleted_count"] >= 2

    # Scans list should now be empty
    list_res = client.get("/api/scans", headers={"Authorization": f"Bearer {token}"})
    assert len(list_res.json()) == 0

