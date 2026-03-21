"""Bloom — fast GPU glow via downsample-blur-upsample. No conv2d."""

import torch
import torch.nn.functional as F
from ..interface import Pipeline, Requirements
from .schema import BloomConfig


class BloomPipeline(Pipeline):

    @classmethod
    def get_config_class(cls):
        return BloomConfig

    def __init__(self, **kwargs):
        device = kwargs.get("device")
        if device is not None and isinstance(device, torch.device):
            self.device = device
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            self.device = torch.device("mps")
        elif torch.cuda.is_available():
            self.device = torch.device("cuda")
        else:
            self.device = torch.device("cpu")

    def prepare(self, **kwargs):
        return Requirements(input_size=1)

    def get_output_fps_hint(self):
        """Pass through — bloom doesn't change frame rate."""
        return 0.0  # 0 = use upstream hint or measured FPS

    @torch.no_grad()
    def __call__(self, **kwargs):
        video = kwargs.get("video")
        if video is None:
            raise ValueError("No video")

        amount = float(kwargs.get("amount", 0.3))
        radius = max(1, min(8, int(kwargs.get("radius", 4))))
        threshold = float(kwargs.get("threshold", 0.7))

        if isinstance(video, list):
            video = torch.cat(video, dim=0)

        x = video.to(device=self.device)
        if x.dtype == torch.uint8:
            x = x.to(torch.float16) / 255.0
        else:
            x = x.to(torch.float16)

        if x.dim() == 3:
            x = x.unsqueeze(0)

        T, H, W, C = x.shape
        x = x.permute(0, 3, 1, 2)  # NCHW

        # Extract bright areas
        bright = (x - threshold).clamp(0, 1)

        # Fast bloom: downsample → upsample = implicit blur via bilinear filtering
        # Radius controls downsample factor (1=2x, 2=4x, 4=8x, 8=16x)
        scale = max(2, radius * 2)
        small_h = max(1, H // scale)
        small_w = max(1, W // scale)

        # Downsample (bilinear = fast Metal kernel, acts as low-pass filter)
        small = F.interpolate(bright.float(), size=(small_h, small_w), mode="bilinear", align_corners=False)
        # Upsample back (bilinear smoothing = the "blur")
        glow = F.interpolate(small, size=(H, W), mode="bilinear", align_corners=False).to(torch.float16)

        # Additive blend
        out = (x + glow * amount).clamp(0, 1)

        return {"video": out.permute(0, 2, 3, 1)}
