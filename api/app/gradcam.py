import base64
import io

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

IMGSZ = 640
HEATMAP_SIDE = 256


def letterbox(rgb: np.ndarray) -> tuple[np.ndarray, tuple[int, int, int, int]]:
    """Fit into 640x640 with centred padding (as ultralytics). Returns image, (top, left, h, w)."""
    h, w = rgb.shape[:2]
    r = IMGSZ / max(h, w)
    nh, nw = round(h * r), round(w * r)
    top, left = (IMGSZ - nh) // 2, (IMGSZ - nw) // 2
    canvas = np.full((IMGSZ, IMGSZ, 3), 114, dtype=np.uint8)
    canvas[top : top + nh, left : left + nw] = np.asarray(Image.fromarray(rgb).resize((nw, nh)))
    return canvas, (top, left, nh, nw)


def encode_heatmap(cam: np.ndarray, region: tuple[int, int, int, int]) -> str:
    """Crop a 640x640 CAM (0-1) to the image region, shrink to 256 px longest side, base64 PNG."""
    top, left, nh, nw = region
    crop = (np.clip(cam[top : top + nh, left : left + nw], 0, 1) * 255).astype(np.uint8)
    r = HEATMAP_SIDE / max(nh, nw)
    small = Image.fromarray(crop).resize((max(1, round(nw * r)), max(1, round(nh * r))))
    buf = io.BytesIO()
    small.save(buf, "PNG")
    return base64.b64encode(buf.getvalue()).decode()


class GradCam:
    """Class-specific Grad-CAM on one DetectionModel layer (docs/architecture.md §3.3)."""

    def __init__(self, net, layer_index: int) -> None:
        self.net = net
        self._activation = None
        net.model[layer_index].register_forward_hook(self._keep)

    def _keep(self, _module, _inputs, output):
        # Graph starts here: the backbone below runs without autograd bookkeeping.
        self._activation = output.detach().requires_grad_(torch.is_grad_enabled())
        return self._activation

    def __call__(self, rgb: np.ndarray, class_ids: list[int], conf: float = 0.25) -> dict[str, str]:
        image, region = letterbox(rgb)
        param = next(self.net.parameters())
        x = torch.from_numpy(image).permute(2, 0, 1)[None].to(param.device, param.dtype) / 255
        with torch.enable_grad():
            probs = self.net(x)[0][0, 4:]  # (classes, anchors), already sigmoid
            activation = self._activation
            best = probs.argmax(0)
            heatmaps = {}
            for c in class_ids:
                # Anchors that would become class-c detections; fall back to the strongest one.
                mask = (probs[c] >= conf) & (best == c)
                score = probs[c][mask].sum() if mask.any() else probs[c].max()
                (grad,) = torch.autograd.grad(score, activation, retain_graph=True)
                weights = grad.mean(dim=(2, 3), keepdim=True)
                cam = F.relu((weights * activation).sum(dim=1, keepdim=True))
                cam = F.interpolate(cam, size=(IMGSZ, IMGSZ), mode="bilinear", align_corners=False)
                cam = cam[0, 0].detach().float().cpu().numpy()
                peak = cam.max()
                heatmaps[str(c)] = encode_heatmap(cam / peak if peak > 0 else cam, region)
        return heatmaps
