import asyncio
import hmac
import logging
import os
import threading
import time
from collections.abc import Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from app.model import Detector, YoloDetector, checkpoint_path
from app.prefilter import MAX_BYTES, InputError, decode_image, looks_like_photo

log = logging.getLogger("dentavision.api")

QUEUE_TIMEOUT_S = 60
# Image limit plus room for multipart boundaries and headers.
MAX_BODY_BYTES = MAX_BYTES + 64 * 1024
LOW_QUALITY_WIDTH = 800
HEATMAP_MIN_CONF = 0.25  # same default threshold the UI filters on (PRD §7)

state: dict = {"status": "loading", "model_version": None, "detector": None}
_lock = asyncio.Lock()


def load_detector(factory: Callable[[], Detector]) -> None:
    try:
        detector = factory()
    except Exception:
        log.exception("model load failed")
        state["status"] = "error"
        return
    state.update(status="ready", model_version=detector.version, detector=detector)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not os.environ.get("API_SECRET"):
        raise RuntimeError("API_SECRET is not set")
    # Load in the background so /health answers "loading" during the ~10 s model load.
    threading.Thread(
        target=load_detector, args=(lambda: YoloDetector(checkpoint_path()),), daemon=True
    ).start()
    yield


app = FastAPI(title="DentaVision inference API", docs_url=None, redoc_url=None, lifespan=lifespan)


def error(status: int, code: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"code": code})


@app.get("/health")
def health() -> dict:
    return {"status": state["status"], "model_version": state["model_version"]}


@app.middleware("http")
async def guard_analyze(request: Request, call_next):
    # Starlette parses (and spools to disk) the whole multipart body before the handler runs,
    # so the secret and the size limit must be enforced here, before the body is read.
    if request.url.path != "/v1/analyze":
        return await call_next(request)
    secret = os.environ.get("API_SECRET", "")
    given = request.headers.get("x-api-secret", "")
    if not secret or not hmac.compare_digest(given.encode(), secret.encode()):
        return error(401, "unauthorized")
    length = request.headers.get("content-length")
    if length is None or not length.isdigit():
        return error(411, "length_required")
    if int(length) > MAX_BODY_BYTES:
        return error(413, "too_large")
    return await call_next(request)


@app.post("/v1/analyze")
async def analyze(image: UploadFile):
    if state["status"] == "error":
        return error(503, "model_unavailable")
    detector: Detector | None = state["detector"]
    if detector is None:
        return error(503, "loading")

    data = await image.read(MAX_BYTES + 1)
    started = time.perf_counter()
    try:
        rgb = decode_image(data)
    except InputError as exc:
        return error(exc.status, exc.code)
    if looks_like_photo(rgb):
        return error(422, "not_xray")
    prefilter_ms = round((time.perf_counter() - started) * 1000)

    try:
        await asyncio.wait_for(_lock.acquire(), QUEUE_TIMEOUT_S)
    except TimeoutError:
        return error(503, "busy")
    try:
        started = time.perf_counter()
        detections = await run_in_threadpool(detector.detect, rgb)
        detect_ms = round((time.perf_counter() - started) * 1000)
        class_ids = sorted(
            {d["class_id"] for d in detections if d["confidence"] >= HEATMAP_MIN_CONF}
        )
        started = time.perf_counter()
        heatmaps = await run_in_threadpool(detector.heatmaps, rgb, class_ids) if class_ids else {}
        gradcam_ms = round((time.perf_counter() - started) * 1000)
    finally:
        _lock.release()

    height, width = rgb.shape[:2]
    return {
        "model_version": detector.version,
        "image": {"width": width, "height": height},
        "low_quality": width < LOW_QUALITY_WIDTH,
        "detections": detections,
        "heatmaps": heatmaps,
        "timing_ms": {"prefilter": prefilter_ms, "detect": detect_ms, "gradcam": gradcam_ms},
    }
