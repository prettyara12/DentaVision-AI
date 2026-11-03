FROM python:3.13-slim

# opencv-python (pulled in by ultralytics) needs libGL and glib at import time.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# HF Spaces runs the container as UID 1000; HOME must be writable for the HF Hub and Ultralytics caches.
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    HF_MODEL_REPO=adrielwalintukan/dentavision-yolov8m-resnet50 \
    HF_MODEL_FILE=best_resnet50.pt
WORKDIR $HOME/app

COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

COPY --chown=user app app

EXPOSE 7860
# One worker: the inference queue (asyncio.Lock) is per process, see docs/architecture.md §3.2.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860", "--workers", "1"]
