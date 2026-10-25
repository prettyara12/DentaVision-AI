import base64
import io

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

HEATMAP_SIDE = 256


def image_region(orig_hw: tuple[int, int], input_hw: tuple[int, int]) -> tuple[int, int, int, int]:
    """Where ultralytics LetterBox (centred) put the image in the model input: top, left, h, w."""
    (h, w), (ih, iw) = orig_hw, input_hw
    r = min(ih / h, iw / w)
    nh, nw = round(h * r), round(w * r)
    return round((ih - nh) / 2 - 0.1), round((iw - nw) / 2 - 0.1), nh, nw


def encode_heatmap(cam: np.ndarray, region: tuple[int, int, int, int]) -> str:
    """Crop a CAM (0-1) to the image region, shrink to 256 px longest side, base64 PNG."""
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

    def class_probs(self, x: torch.Tensor) -> torch.Tensor:
        """(classes, anchors) sigmoid scores, the same rows NMS reads in detection."""
        out = self.net(x)[0][0]  # Detect in eval: (boxes 4 + classes, anchors)
        assert out.shape[0] == 4 + len(self.net.names), "unexpected Detect output layout"
        return out[4:]

    def __call__(
        self, x: torch.Tensor, orig_hw: tuple[int, int], class_ids: list[int], conf: float = 0.25
    ) -> dict[str, str]:
        region = image_region(orig_hw, tuple(x.shape[2:]))
        with torch.enable_grad():
            probs = self.class_probs(x)
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
                cam = F.interpolate(cam, size=x.shape[2:], mode="bilinear", align_corners=False)
                cam = cam[0, 0].detach().float().cpu().numpy()
                peak = cam.max()
                heatmaps[str(c)] = encode_heatmap(cam / peak if peak > 0 else cam, region)
        return heatmaps
