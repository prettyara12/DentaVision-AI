import hashlib
import os
from pathlib import Path
from typing import Protocol

import numpy as np

from app.gradcam import GradCam


class Detector(Protocol):
    version: str

    def detect(self, rgb: np.ndarray) -> list[dict]: ...

    def heatmaps(self, rgb: np.ndarray, class_ids: list[int]) -> dict[str, str]: ...


def checkpoint_path() -> Path:
    local = os.environ.get("MODEL_PATH")
    if local:
        return Path(local)
    repo = os.environ.get("HF_MODEL_REPO")
    if not repo:
        raise RuntimeError("Set MODEL_PATH or HF_MODEL_REPO")
    from huggingface_hub import hf_hub_download

    # hf_hub_download reads the HF_TOKEN env var itself, so private repos need no token arg.
    return Path(hf_hub_download(repo, os.environ.get("HF_MODEL_FILE", "best_resnet50.pt")))


class YoloDetector:
    def __init__(self, path: Path) -> None:
        import torch
        from ultralytics import YOLO

        self.model = YOLO(str(path))
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        digest = hashlib.sha256(path.read_bytes()).hexdigest()[:8]
        self.version = f"yolov8m-resnet50@{digest}"
        net = self.model.model
        # P3 (first Detect input, stride 8) localises far better than SPPF; see architecture §3.3.
        self.gradcam = GradCam(net, net.model[-1].f[0])

    def detect(self, rgb: np.ndarray) -> list[dict]:
        # Ultralytics treats numpy input as BGR.
        result = self.model.predict(
            rgb[:, :, ::-1], imgsz=640, conf=0.10, iou=0.7, device=self.device, verbose=False
        )[0]
        boxes = result.boxes
        xyxyn = boxes.xyxyn.tolist()
        return [
            {
                "class_id": int(c),
                "confidence": round(float(p), 4),
                "box": [round(v, 4) for v in xyxyn[i]],
            }
            for i, (c, p) in enumerate(zip(boxes.cls.tolist(), boxes.conf.tolist(), strict=True))
        ]

    def heatmaps(self, rgb: np.ndarray, class_ids: list[int]) -> dict[str, str]:
        return self.gradcam(rgb, class_ids)
