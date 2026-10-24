import asyncio
import hmac
import logging
import os
import threading
import time
from collections.abc import Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from app.model import Detector, YoloDetector, checkpoint_path
from app.prefilter import MAX_BYTES, InputError, decode_image, looks_like_photo

log = logging.getLogger("dentavision.api")

QUEUE_TIMEOUT_S = 60
LOW_QUALITY_WIDTH = 800

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


@app.post("/v1/analyze")
async def analyze(image: UploadFile, x_api_secret: str = Header(default="")):
    secret = os.environ.get("API_SECRET", "")
    if not secret or not hmac.compare_digest(x_api_secret.encode(), secret.encode()):
        return error(401, "unauthorized")
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
    finally:
        _lock.release()

    height, width = rgb.shape[:2]
    return {
        "model_version": detector.version,
        "image": {"width": width, "height": height},
        "low_quality": width < LOW_QUALITY_WIDTH,
        "detections": detections,
        "heatmaps": {},  # Grad-CAM per class lands in #7.
        "timing_ms": {"prefilter": prefilter_ms, "detect": detect_ms},
    }
