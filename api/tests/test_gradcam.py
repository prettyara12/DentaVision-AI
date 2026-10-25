import base64
import io

import numpy as np
import pytest
from PIL import Image
from ultralytics.data.augment import LetterBox

from app.gradcam import HEATMAP_SIDE, encode_heatmap, image_region


def decode(b64: str) -> Image.Image:
    return Image.open(io.BytesIO(base64.b64decode(b64)))


@pytest.mark.parametrize("hw", [(512, 1024), (500, 1000), (1476, 2944), (333, 1000), (1000, 333)])
def test_region_matches_ultralytics_letterbox(hw) -> None:
    # Same settings predict() uses: rect (auto) padding to a stride-32 multiple, centred.
    image = np.full((*hw, 3), 255, dtype=np.uint8)
    boxed = LetterBox(640, auto=True, stride=32)(image=image)
    top, left, nh, nw = image_region(hw, boxed.shape[:2])
    inside = boxed[top : top + nh, left : left + nw]
    assert (inside == 255).all()
    assert (boxed != 255).any(axis=2).sum() == boxed.shape[0] * boxed.shape[1] - nh * nw


def test_heatmap_drops_padding_and_keeps_aspect_ratio() -> None:
    region = image_region((500, 1000), (320, 640))
    assert region == (0, 0, 320, 640)
    region = image_region((500, 1000), (352, 640))
    cam = np.zeros((352, 640), dtype=np.float32)
    top, left, nh, nw = region
    cam[top : top + nh, left : left + nw] = 0.5  # padding stays 0; only the image region is lit
    image = decode(encode_heatmap(cam, region))
    assert image.mode == "L"
    assert image.size == (HEATMAP_SIDE, HEATMAP_SIDE // 2)
    assert np.asarray(image).min() == 127  # no zero rows left over from the padding


def test_heatmap_values_are_clipped() -> None:
    region = (0, 0, 320, 640)
    cam = np.full((320, 640), 3.0, dtype=np.float32)
    cam[:, :320] = -1.0
    pixels = np.asarray(decode(encode_heatmap(cam, region)))
    assert pixels.min() == 0 and pixels.max() == 255
