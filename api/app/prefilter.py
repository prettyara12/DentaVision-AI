import io

import numpy as np
from PIL import Image

MAX_BYTES = 4 * 1024 * 1024
# Guard against decompression bombs; a 2048 px panoramic is ~2M px.
MAX_PIXELS = 25_000_000
MAGIC = (b"\xff\xd8\xff", b"\x89PNG\r\n\x1a\n")


class InputError(Exception):
    def __init__(self, status: int, code: str) -> None:
        super().__init__(code)
        self.status = status
        self.code = code


def decode_image(data: bytes) -> np.ndarray:
    """Validate and decode an upload into an RGB array (H, W, 3)."""
    if len(data) > MAX_BYTES:
        raise InputError(413, "too_large")
    if not data.startswith(MAGIC):
        raise InputError(415, "unsupported_type")
    try:
        with Image.open(io.BytesIO(data)) as img:
            if img.width * img.height > MAX_PIXELS:
                raise InputError(413, "too_large")
            return np.asarray(img.convert("RGB"))
    except InputError:
        raise
    except Exception as exc:  # corrupt or truncated file behind valid magic bytes
        raise InputError(415, "unsupported_type") from exc


def looks_like_photo(rgb: np.ndarray) -> bool:
    """Radiographs are monochrome; natural colour means it is not an X-ray."""
    saturation = np.asarray(Image.fromarray(rgb).convert("HSV"))[:, :, 1]
    return float((saturation > 40).mean()) > 0.15 and float(saturation.mean()) > 20.0
