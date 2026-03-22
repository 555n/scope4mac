"""RIFE-Varispeed — Adaptive frame interpolation using RIFE's batched subdivision.

Uses RIFE's recursive midpoint subdivision (batched inference) for efficiency,
then selects frames to output. On MPS, caps at 8x (3 batched model calls).

For v1: uses uniform subdivision (same as standard RIFE but with beat-aware
target FPS). Varispeed frame selection for non-uniform timing is a future step.
"""

import logging
import time

import torch
from einops import rearrange

from ..interface import Pipeline, Requirements
from ..process import normalize_frame_sizes, postprocess_chunk, preprocess_chunk
from .schema import RIFEVarispeedConfig

logger = logging.getLogger(__name__)


class RIFEVarispeedPipeline(Pipeline):

    @classmethod
    def get_config_class(cls):
        return RIFEVarispeedConfig

    def __init__(self, config, device=None, dtype=torch.float16):
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
        self._last_t = 0.0
        self._fps_ema = 0.0
        self._alpha = 0.3
        self._n = 0
        self._hint = 0.0

    def prepare(self, **kwargs):
        return Requirements(input_size=1)

    def __call__(self, **kwargs):
        v = kwargs.get("video")
        if v is None:
            return None

        self._tick()

        # Handle input format: list of [1,H,W,C] uint8 or float32 tensor
        if isinstance(v, list):
            if len(v) == 0:
                return None
            v = normalize_frame_sizes(v)
            v = preprocess_chunk(v, self.device, self.dtype)

        f = postprocess_chunk(rearrange(v, "B C T H W -> B T C H W"))
        f = (f * 255).clamp(0, 255).to(torch.uint8)
        if f.dim() == 4:
            f = f[0]

        target_fps = int(kwargs.get("target_fps", 24))

        if self._prev is None:
            self._prev = f.clone()
            self._hint = max(self._fps_ema, 1.0)
            return {"video": (f.float() / 255).unsqueeze(0)}

        # Calculate multiplier from measured input rate and target
        mult = self._calc_mult(target_fps)

        # Use RIFE's batched subdivision — efficient on MPS
        pair = torch.stack([self._prev, f])
        out = self.rife.interpolate(pair, multiplier=mult)[1:]  # Skip first (prev) frame
        self._prev = f.clone()
        self._hint = min(60.0, max(self._fps_ema, 1.0) * mult)

        if self._n % 30 == 1:
            logger.info(
                "[RIFE-VS] %dx in=%.1ffps→%.0f frames=%d target=%d",
                mult, self._fps_ema, self._hint, out.shape[0], target_fps,
            )

        return {"video": out.float() / 255}

    def _calc_mult(self, target: int) -> int:
        """Calculate power-of-2 multiplier to reach target FPS from measured input rate."""
        if target <= 0 or self._n < 3 or self._fps_ema <= 0:
            return 2
        r = target / max(self._fps_ema, 1e-6)
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
        self._last_t = 0.0
        self._fps_ema = 0.0
        self._n = 0

    def _tick(self):
        now = time.perf_counter()
        self._n += 1
        if self._last_t > 0:
            dt = now - self._last_t
            if dt > 0:
                i = 1.0 / dt
                self._fps_ema = (self._alpha * i + (1 - self._alpha) * self._fps_ema) if self._fps_ema > 0 else i
        self._last_t = now
