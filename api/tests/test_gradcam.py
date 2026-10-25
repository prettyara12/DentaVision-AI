import base64
import io

import numpy as np
from PIL import Image

from app.gradcam import HEATMAP_SIDE, IMGSZ, encode_heatmap, letterbox


def decode(b64: str) -> Image.Image:
    return Image.open(io.BytesIO(base64.b64decode(b64)))


def test_letterbox_centres_wide_image_with_grey_padding() -> None:
    canvas, (top, left, nh, nw) = letterbox(np.zeros((500, 1000, 3), dtype=np.uint8))
    assert canvas.shape == (IMGSZ, IMGSZ, 3)
    assert (top, left, nh, nw) == (160, 0, 320, 640)
    assert (canvas[:top] == 114).all() and (canvas[top + nh :] == 114).all()
    assert (canvas[top : top + nh] == 0).all()


def test_heatmap_drops_padding_and_keeps_aspect_ratio() -> None:
    _, region = letterbox(np.zeros((500, 1000, 3), dtype=np.uint8))
    cam = np.zeros((IMGSZ, IMGSZ), dtype=np.float32)
    top, left, nh, nw = region
    cam[top : top + nh, left : left + nw] = 0.5  # padding stays 0; only the image region is lit
    image = decode(encode_heatmap(cam, region))
    assert image.mode == "L"
    assert image.size == (HEATMAP_SIDE, HEATMAP_SIDE // 2)
    assert np.asarray(image).min() == 127  # no zero rows left over from the padding


def test_heatmap_values_are_clipped() -> None:
    region = (0, 0, IMGSZ, IMGSZ)
    cam = np.full((IMGSZ, IMGSZ), 3.0, dtype=np.float32)
    cam[:, : IMGSZ // 2] = -1.0
    pixels = np.asarray(decode(encode_heatmap(cam, region)))
    assert pixels.min() == 0 and pixels.max() == 255
