"""Feedback — TD-style frame feedback with decay."""

import torch

from ..interface import Pipeline, Requirements
from .schema import FeedbackConfig


class FeedbackPipeline(Pipeline):

    @classmethod
    def get_config_class(cls):
        return FeedbackConfig

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
        self._buffer = None

    def prepare(self, **kwargs):
        return Requirements(input_size=1)

    def get_output_fps_hint(self):
        return 0.0

    def reset(self):
        self._buffer = None

    @torch.no_grad()
    def __call__(self, **kwargs):
        video = kwargs.get("video")
        if video is None:
            raise ValueError("No video")

        raw_mix = float(kwargs.get("mix", 80))
        raw_decay = float(kwargs.get("decay", 95))
        mix = raw_mix / 100.0 if raw_mix > 1.0 else raw_mix
        decay = raw_decay / 100.0 if raw_decay > 1.0 else raw_decay

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
        x = x.permute(0, 3, 1, 2).float()  # NCHW float32

        if self._buffer is None or self._buffer.shape[-2:] != (H, W):
            self._buffer = x.clone()

        out = (x * (1.0 - mix) + self._buffer * mix).clamp(0, 1)
        self._buffer = (out * decay).clone()

        return {"video": out.permute(0, 2, 3, 1)}
