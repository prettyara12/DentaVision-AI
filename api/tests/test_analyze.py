import asyncio
import io

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import main

SECRET = "test-secret-0123456789"
TOOTH = {"class_id": 15, "confidence": 0.9, "box": [0.1, 0.2, 0.3, 0.4]}
CARIES = {"class_id": 0, "confidence": 0.71, "box": [0.4, 0.5, 0.45, 0.6]}


class FakeDetector:
    version = "yolov8m-resnet50@fake0000"

    def __init__(self, detections: list[dict]) -> None:
        self.detections = detections
        self.calls = 0

    def detect(self, rgb: np.ndarray) -> list[dict]:
        self.calls += 1
        assert rgb.ndim == 3 and rgb.shape[2] == 3
        return self.detections


def png(width: int = 1024, height: int = 512, color=(90, 90, 90)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color).save(buf, "PNG")
    return buf.getvalue()


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("API_SECRET", SECRET)
    monkeypatch.setattr(
        main, "state", {"status": "loading", "model_version": None, "detector": None}
    )
    # No context manager: lifespan (real model load) does not run in unit tests.
    return TestClient(main.app)


def ready(detections: list[dict]) -> FakeDetector:
    detector = FakeDetector(detections)
    main.state.update(status="ready", model_version=detector.version, detector=detector)
    return detector


def post(client, data: bytes, secret: str = SECRET):
    return client.post(
        "/v1/analyze",
        files={"image": ("x.png", data, "image/png")},
        headers={"X-API-Secret": secret},
    )


def test_health_reports_loading_then_ready(client) -> None:
    assert client.get("/health").json() == {"status": "loading", "model_version": None}
    ready([TOOTH])
    assert client.get("/health").json() == {
        "status": "ready",
        "model_version": "yolov8m-resnet50@fake0000",
    }


def test_failed_model_load_reports_error(client) -> None:
    def boom():
        raise OSError("download failed")

    main.load_detector(boom)
    assert client.get("/health").json()["status"] == "error"


@pytest.mark.parametrize("secret", ["", "wrong"])
def test_rejects_missing_or_wrong_secret(client, secret) -> None:
    ready([TOOTH])
    response = post(client, png(), secret)
    assert (response.status_code, response.json()) == (401, {"code": "unauthorized"})


def test_loading_before_model_ready(client) -> None:
    response = post(client, png())
    assert (response.status_code, response.json()) == (503, {"code": "loading"})


def test_failed_model_load_is_not_reported_as_loading(client) -> None:
    def boom():
        raise OSError("download failed")

    main.load_detector(boom)
    response = post(client, png())
    assert (response.status_code, response.json()) == (503, {"code": "model_unavailable"})


def raw_post(client, body, headers: dict[str, str]):
    return client.post(
        "/v1/analyze",
        content=body,
        headers={"Content-Type": "multipart/form-data; boundary=x", **headers},
    )


def test_oversized_body_is_rejected_before_parsing(client, monkeypatch) -> None:
    detector = ready([TOOTH])
    # Fail loudly if the multipart parser is reached at all.
    monkeypatch.setattr(main, "decode_image", lambda _: pytest.fail("body was parsed"))
    body = b"\0" * (main.MAX_BODY_BYTES + 1)
    response = raw_post(client, body, {"X-API-Secret": SECRET})
    assert (response.status_code, response.json()) == (413, {"code": "too_large"})
    assert detector.calls == 0


def test_secret_is_checked_before_body_size(client) -> None:
    body = b"\0" * (main.MAX_BODY_BYTES + 1)
    response = raw_post(client, body, {"X-API-Secret": "wrong"})
    assert (response.status_code, response.json()) == (401, {"code": "unauthorized"})


def test_body_without_content_length_is_rejected(client) -> None:
    ready([TOOTH])

    def chunks():
        yield b"--x\r\n"

    # A generator body is sent with chunked transfer encoding, i.e. no Content-Length.
    response = raw_post(client, chunks(), {"X-API-Secret": SECRET})
    assert (response.status_code, response.json()) == (411, {"code": "length_required"})


@pytest.mark.parametrize(
    ("data", "status", "code"),
    [
        (b"GIF89a" + b"\0" * 32, 415, "unsupported_type"),
        (b"\x89PNG\r\n\x1a\n" + b"truncated", 415, "unsupported_type"),
        (b"\xff\xd8\xff" + b"\0" * (4 * 1024 * 1024), 413, "too_large"),
    ],
    ids=["gif", "corrupt-png", "over-4mb"],
)
def test_rejects_bad_uploads(client, data, status, code) -> None:
    detector = ready([TOOTH])
    response = post(client, data)
    assert (response.status_code, response.json()) == (status, {"code": code})
    assert detector.calls == 0


def test_colourful_photo_is_not_xray_and_skips_the_model(client) -> None:
    detector = ready([TOOTH])
    response = post(client, png(color=(220, 40, 40)))
    assert (response.status_code, response.json()) == (422, {"code": "not_xray"})
    assert detector.calls == 0


def test_no_detections_is_still_a_result(client) -> None:
    # The model misses teeth classes on real panoramics, so an empty result is not a rejection.
    ready([])
    response = post(client, png())
    assert response.status_code == 200
    assert response.json()["detections"] == []


def test_returns_contract(client) -> None:
    ready([TOOTH, CARIES])
    response = post(client, png(1024, 512))
    assert response.status_code == 200
    body = response.json()
    assert body["model_version"] == "yolov8m-resnet50@fake0000"
    assert body["image"] == {"width": 1024, "height": 512}
    assert body["low_quality"] is False
    assert body["detections"] == [TOOTH, CARIES]
    assert body["heatmaps"] == {}
    assert set(body["timing_ms"]) == {"prefilter", "detect"}


def test_narrow_image_is_low_quality(client) -> None:
    ready([TOOTH])
    assert post(client, png(799, 400)).json()["low_quality"] is True


def test_busy_when_queue_wait_times_out(client, monkeypatch) -> None:
    class StuckLock:
        async def acquire(self) -> None:
            await asyncio.sleep(10)

        def release(self) -> None:
            raise AssertionError("never acquired")

    monkeypatch.setattr(main, "_lock", StuckLock())
    monkeypatch.setattr(main, "QUEUE_TIMEOUT_S", 0.05)
    detector = ready([TOOTH])
    response = post(client, png())
    assert (response.status_code, response.json()) == (503, {"code": "busy"})
    assert detector.calls == 0
