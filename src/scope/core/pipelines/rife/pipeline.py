"""RIFE-Buffered — Auto + Manual frame interpolation.

Auto:   Target FPS → system picks 2x/4x/8x/16x from measured input rate.
Manual: User picks depth directly. Output = input × depth.
"""

import collections
import logging
import math
import time

import torch
from einops import rearrange

from ..interface import Pipeline, Requirements
from ..process import normalize_frame_sizes, postprocess_chunk, preprocess_chunk
from .schema import RIFEConfig

logger = logging.getLogger(__name__)


class RIFEPipeline(Pipeline):

    @classmethod
    def get_config_class(cls):
        return RIFEConfig

    def __init__(self, config, device=None, dtype=torch.float16):
        from .modules.interpolation import RIFEInterpolator

        self.device = device or (
            torch.device("cuda") if torch.cuda.is_available()
            else torch.device("mps") if hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
            else torch.device("cpu"))
        self.dtype = dtype

        logger.info("Loading RIFE HDv3...")
        self.rife_interpolator = RIFEInterpolator(enabled=True, device=self.device)
        logger.info("RIFE HDv3 loaded")

        self._prev = None
        self._last_t = 0.0
        self._fps_ema = 0.0
        self._alpha = 0.3
        self._n = 0
        self._hint = 0.0
        self._mult = 2

    def prepare(self, **kwargs):
        return Requirements(input_size=1)

    def __call__(self, **kwargs):
        v = kwargs.get("video")
        if v is None:
            raise ValueError("No video input")

        # Tick BEFORE processing to measure input arrival rate (not including
        # our own processing time, which would create a feedback loop)
        self._tick()

        if isinstance(v, list):
            v = normalize_frame_sizes(v)
            v = preprocess_chunk(v, self.device, self.dtype)

        f = postprocess_chunk(rearrange(v, "B C T H W -> B T C H W"))
        f = (f * 255).clamp(0, 255).to(torch.uint8)
        if f.dim() == 4:
            f = f[0]

        mode = str(kwargs.get("rife_mode", "auto"))

        if mode == "manual":
            d = 8  # default to 8x
            raw_depth = kwargs.get("depth", 8)
            try:
                # Handle enum strings like "x8", "x4" etc
                if isinstance(raw_depth, str):
                    cleaned = raw_depth.lstrip("x").lstrip("X")
                    d = int(cleaned) if cleaned.isdigit() else 8
                else:
                    d = int(raw_depth)
            except (TypeError, ValueError):
                d = 8
            mult = self._p2(d)
        else:
            tfps = 60
            try:
                tfps = int(kwargs.get("target_fps", 60))
            except (TypeError, ValueError):
                pass
            mult = self._auto_mult(tfps)

        if self._prev is None:
            self._prev = f.clone()
            self._hint = max(self._fps_ema, 1.0)
            return {"video": (f.float() / 255).unsqueeze(0)}

        pair = torch.stack([self._prev, f])
        process_start = time.perf_counter()
        out = self.rife_interpolator.interpolate(pair, multiplier=mult)[1:]
        process_time = time.perf_counter() - process_start
        # Compensate _last_t so next _tick() doesn't count our processing time
        self._last_t += process_time
        self._prev = f.clone()
        self._hint = min(60.0, max(self._fps_ema, 1.0) * mult)
        self._mult = mult

        if self._n % 30 == 1:
            logger.info("[RIFE-%s] %dx in=%.1f→%.0f frames=%d depth_raw=%s",
                        mode, mult, self._fps_ema, self._hint, out.shape[0],
                        kwargs.get("depth", "?"))

        return {"video": out.float() / 255}

    def get_output_fps_hint(self):
        return self._hint if self._hint > 0 else 0.0

    def reset(self):
        self._prev = None
        self._last_t = 0.0
        self._fps_ema = 0.0
        self._n = 0

    def _tick(self):
        """Measure input frame arrival rate.

        Records time at START of __call__ (before processing). The interval
        between starts is the true input rate, uncontaminated by our own
        processing time. This prevents a feedback loop where higher multipliers
        cause longer processing, which inflates the measured interval, which
        raises the multiplier further.
        """
        now = time.perf_counter()
        self._n += 1
        if self._last_t > 0:
            dt = now - self._last_t
            if dt > 0:
                i = 1.0 / dt
                self._fps_ema = (self._alpha * i + (1 - self._alpha) * self._fps_ema) if self._fps_ema > 0 else i
        self._last_t = now

    def _auto_mult(self, target):
        if target <= 0 or self._n < 3 or self._fps_ema <= 0:
            return 2
        r = target / max(self._fps_ema, 1e-6)
        if r < 1.15: return 1
        if r < 3: return 2
        if r < 6: return 4
        if r < 12: return 8
        return 16

    @staticmethod
    def _p2(d):
        return min(16, 2 ** max(1, round(math.log2(max(d, 2)))))
