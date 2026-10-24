import os
from pathlib import Path

import numpy as np
import pytest

pytestmark = pytest.mark.smoke

# docs/class-catalog.md: id order must match the checkpoint.
EXPECTED_FIRST_LAST = ("Caries", "Primary teeth")


def checkpoint_path() -> Path:
    local = os.environ.get("MODEL_PATH")
    if local:
        return Path(local)
    repo = os.environ.get("HF_MODEL_REPO")
    if not repo:
        pytest.fail("Set MODEL_PATH or HF_MODEL_REPO (see issue #5)")
    from huggingface_hub import hf_hub_download

    return Path(hf_hub_download(repo, os.environ.get("HF_MODEL_FILE", "best_resnet50.pt")))


def test_checkpoint_loads_and_runs_on_cpu() -> None:
    from ultralytics import YOLO

    model = YOLO(str(checkpoint_path()))
    assert model.task == "detect"
    assert len(model.names) == 31
    assert (model.names[0], model.names[30]) == EXPECTED_FIRST_LAST

    # Synthetic grayscale image: checks the pipeline runs, not detection quality.
    image = np.full((640, 1280, 3), 90, dtype=np.uint8)
    results = model.predict(image, imgsz=640, conf=0.10, device="cpu", verbose=False)
    assert len(results) == 1
