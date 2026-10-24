from fastapi.testclient import TestClient

from app.main import app


def test_health_reports_loading_before_model_is_ready() -> None:
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "loading", "model_version": None}
