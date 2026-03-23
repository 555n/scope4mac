"""Invert — simple color inversion with mix control."""

import torch
from ..interface import Pipeline, Requirements
from .schema import InvertConfig


class InvertPipeline(Pipeline):

    @classmethod
    def get_config_class(cls):
        return InvertConfig

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
        return 0.0

    @torch.no_grad()
    def __call__(self, **kwargs):
        video = kwargs.get("video")
        if video is None:
            raise ValueError("No video")

        mix = float(kwargs.get("mix", 1.0))

        if isinstance(video, list):
            video = torch.cat(video, dim=0)

        x = video.to(device=self.device)
        if x.dtype == torch.uint8:
            x = x.to(torch.float16) / 255.0
        else:
            x = x.to(torch.float16)

        if x.dim() == 3:
            x = x.unsqueeze(0)

        inverted = 1.0 - x
        out = x * (1.0 - mix) + inverted * mix

        return {"video": out}
