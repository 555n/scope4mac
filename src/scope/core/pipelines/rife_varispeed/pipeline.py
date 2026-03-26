"""RIFE-Varispeed — Adaptive frame interpolation using RIFE's batched subdivision.

Uses RIFE's recursive midpoint subdivision (batched inference) for efficiency,
then selects frames to output. On MPS, caps at 8x (3 batched model calls).

For v1: uses uniform subdivision (same as standard RIFE but with beat-aware
target FPS). Varispeed frame selection for non-uniform timing is a future step.
"""

import logging
import time

import torch

from ..interface import Pipeline, Requirements
from .schema import RIFEVarispeedConfig

logger = logging.getLogger(__name__)


class RIFEVarispeedPipeline(Pipeline):

    @classmethod
    def get_config_class(cls):
        return RIFEVarispeedConfig

    def __init__(self, config=None, device=None, dtype=torch.float16, **kwargs):
        from ..rife.modules.interpolation import RIFEInterpolator

        self.device = device or (
            torch.device("cuda") if torch.cuda.is_available()
            else torch.device("mps") if hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
            else torch.device("cpu")
        )
        self.dtype = dtype

        logger.info("Loading RIFE-Varispeed (batched subdivision)...")
        self.rife = RIFEInterpolator(enabled=True, device=self.device)
        logger.info("RIFE-Varispeed loaded")

        self._prev = None
        self._n = 0
        self._hint = 0.0
        # Input FPS measured externally by pipeline_processor (injected as kwarg)
        self._fallback_fps = 6.0

    def prepare(self, **kwargs):
        return Requirements(input_size=1)

    def __call__(self, **kwargs):
        v = kwargs.get("video")
        if v is None:
            return None

        # Extract single frame: list of [1,H,W,C] uint8 → [H,W,C] uint8
        if isinstance(v, list):
            if len(v) == 0:
                return None
            frame = v[0]
            if frame.dim() == 4:
                frame = frame[0]  # [1,H,W,C] → [H,W,C]
        elif isinstance(v, torch.Tensor):
            frame = v.to(self.device)
            if frame.dim() == 4:
                frame = frame[0]
        else:
            return None

        frame = frame.to(self.device)
        if frame.dtype != torch.uint8:
            frame = (frame * 255).clamp(0, 255).to(torch.uint8)

        self._n += 1
        target_fps = int(kwargs.get("target_fps", 24))

        # Use input_fps from pipeline_processor (measured at queue level)
        input_fps = float(kwargs.get("input_fps", self._fallback_fps))
        if input_fps > 0:
            self._fallback_fps = input_fps

        # First frame — store and pass through
        if self._prev is None:
            self._prev = frame.clone()
            out = frame.unsqueeze(0)  # [H,W,C] → [1,H,W,C]
            self._hint = input_fps
            return {"video": out}

        # Calculate multiplier from measured input rate and target
        mult = self._calc_mult(target_fps, input_fps)

        # Use RIFE's batched subdivision — efficient on MPS
        # interpolate expects [T,H,W,C] uint8, returns [T_out,H,W,C] uint8
        pair = torch.stack([self._prev, frame])  # [2,H,W,C]
        out = self.rife.interpolate(pair, multiplier=mult)
        # out includes both endpoints: [2*mult+1, H, W, C] → skip first (prev)
        out = out[1:]
        self._prev = frame.clone()
        self._hint = min(60.0, max(input_fps, 1.0) * mult)

        if self._n % 30 == 1:
            logger.info(
                "[RIFE-VS] %dx in=%.1ffps→%.0f frames=%d target=%d",
                mult, input_fps, self._hint, out.shape[0], target_fps,
            )

        # Return [T,H,W,C] uint8 — skip float conversion since
        # pipeline_processor expects uint8 and would convert back anyway
        return {"video": out}

    def _calc_mult(self, target: int, input_fps: float) -> int:
        """Calculate power-of-2 multiplier to reach target FPS from measured input rate."""
        if target <= 0 or self._n < 3 or input_fps <= 0:
            return 2
        r = target / max(input_fps, 1e-6)
        # Cap at 8x on MPS for performance
        if r < 1.15:
            return 1
        if r < 3:
            return 2
        if r < 6:
            return 4
        return 8  # Max 8x on MPS (3 batched calls)

    def get_output_fps_hint(self):
        return self._hint if self._hint > 0 else 0.0

    def reset(self):
        self._prev = None
        self._n = 0
        self._fallback_fps = 6.0
        self._hint = 0.0
