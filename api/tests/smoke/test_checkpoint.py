import numpy as np
import pytest

from app.model import YoloDetector, checkpoint_path

pytestmark = pytest.mark.smoke

# Column `model.names` of docs/class-catalog.md, in id order. A swap anywhere mislabels detections.
EXPECTED_NAMES = [
    "Caries",
    "Crown",
    "Filling",
    "Implant",
    "Malaligned",
    "Mandibular Canal",
    "Missing teeth",
    "Periapical lesion",
    "Retained root",
    "Root Canal Treatment",
    "Root Piece",
    "impacted tooth",
    "maxillary sinus",
    "Bone Loss",
    "Fracture teeth",
    "Permanent Teeth",
    "Supra Eruption",
    "TAD",
    "abutment",
    "attrition",
    "bone defect",
    "gingival former",
    "metal band",
    "orthodontic brackets",
    "permanent retainer",
    "post - core",
    "plating",
    "wire",
    "Cyst",
    "Root resorption",
    "Primary teeth",
]


def test_checkpoint_loads_and_runs_on_cpu() -> None:
    from ultralytics import YOLO

    model = YOLO(str(checkpoint_path()))  # MODEL_PATH or HF_MODEL_REPO
    assert model.task == "detect"
    # model.names is {id: name}; compare the whole mapping, not just its ends.
    assert dict(model.names) == dict(enumerate(EXPECTED_NAMES))

    # Synthetic grayscale image: checks the pipeline runs, not detection quality.
    image = np.full((640, 1280, 3), 90, dtype=np.uint8)
    results = model.predict(image, imgsz=640, conf=0.10, device="cpu", verbose=False)
    assert len(results) == 1

    # Output contract used by /v1/analyze (#6): N boxes with xyxy, conf, cls on the original image.
    result = results[0]
    assert result.orig_shape == (640, 1280)
    boxes = result.boxes
    n = len(boxes)
    assert tuple(boxes.xyxy.shape) == (n, 4)
    assert tuple(boxes.conf.shape) == (n,)
    assert tuple(boxes.cls.shape) == (n,)
    assert all(0 <= int(c) < 31 for c in boxes.cls)


def test_detector_wrapper_returns_normalized_detections() -> None:
    detector = YoloDetector(checkpoint_path())
    assert detector.version.startswith("yolov8m-resnet50@")
    detections = detector.detect(np.full((512, 1024, 3), 90, dtype=np.uint8))
    for d in detections:
        assert set(d) == {"class_id", "confidence", "box"}
        assert 0 <= d["class_id"] < 31 and 0.10 <= d["confidence"] <= 1
        assert len(d["box"]) == 4 and all(0 <= v <= 1 for v in d["box"])


def test_gradcam_returns_one_grayscale_png_per_class() -> None:
    import base64
    import io

    from PIL import Image

    detector = YoloDetector(checkpoint_path())
    image = noise()
    detector.detect(image)  # /v1/analyze order; the predictor's preprocessing is reused
    # Classes without any confident anchor still get a heatmap (strongest-anchor fallback).
    heatmaps = detector.heatmaps(image, [0, 7])
    assert set(heatmaps) == {"0", "7"}
    for b64 in heatmaps.values():
        png = Image.open(io.BytesIO(base64.b64decode(b64)))
        assert png.mode == "L" and png.size == (256, 128)
    # Grad-CAM must not leave the network in grad mode for later predictions.
    assert all(not p.requires_grad for p in detector.model.model.parameters())


def noise() -> np.ndarray:
    return np.random.default_rng(0).integers(40, 160, size=(512, 1024, 3), dtype=np.uint8)


def teeth() -> np.ndarray:
    """Two rows of blurred bright ellipses: synthetic, yet the model finds confident boxes."""
    from PIL import Image, ImageDraw, ImageFilter

    image = Image.new("L", (1024, 512), 30)
    draw = ImageDraw.Draw(image)
    for top, bottom in [(120, 250), (262, 392)]:
        for i in range(14):
            draw.ellipse([150 + i * 52, top, 192 + i * 52, bottom], fill=150)
    gray = np.asarray(image.filter(ImageFilter.GaussianBlur(2)))
    return np.stack([gray] * 3, axis=-1)


def test_gradcam_reads_the_scores_detection_used() -> None:
    import torch

    detector = YoloDetector(checkpoint_path())
    image = teeth()
    detections = detector.detect(image)
    assert detections
    predictor = detector.model.predictor
    x = predictor.preprocess([np.ascontiguousarray(image[:, :, ::-1])])
    assert tuple(x.shape) == (1, 3, 320, 640)  # rect letterbox, not a 640x640 square
    with torch.no_grad():
        probs = detector.gradcam.class_probs(x)
        reference = predictor.inference(x)[0][0, 4:]
    torch.testing.assert_close(probs, reference)  # CPU reductions are not bit-exact run to run
    # Every kept box is one anchor's top class score (NMS without multi-label).
    best = probs.max(0)
    for d in detections:
        anchors = best.indices == d["class_id"]
        assert torch.isclose(best.values[anchors], torch.tensor(d["confidence"]), atol=1e-4).any()


def test_gradcam_hook_does_not_change_detections() -> None:
    from ultralytics import YOLO

    image = teeth()
    plain = (
        YOLO(str(checkpoint_path()))
        .predict(image[:, :, ::-1], imgsz=640, conf=0.10, iou=0.7, device="cpu", verbose=False)[0]
        .boxes
    )
    detector = YoloDetector(checkpoint_path())
    first = detector.detect(image)
    assert first
    detector.heatmaps(image, sorted({d["class_id"] for d in first}))
    for detections in (first, detector.detect(image)):
        assert [d["class_id"] for d in detections] == [int(c) for c in plain.cls.tolist()]
        conf = [d["confidence"] for d in detections]
        assert conf == pytest.approx([float(c) for c in plain.conf.tolist()], abs=1e-4)
