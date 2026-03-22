"""Ableton Link Sync — beat-synced frame gate postprocessor.

Buffers generated frames arriving at max gen rate.
Releases 1 frame per beat (quarter note), timed to Link beat boundaries.
Between beats, holds the last released frame.

Frame format: receives list of [1,H,W,C] uint8 tensors from upstream queue.
Returns {"video": tensor} in [T,H,W,C] float32 [0,1] format.
"""

import logging
import time
from collections import deque

import torch

from ..interface import Pipeline, Requirements
from .schema import LinkSyncConfig

logger = logging.getLogger(__name__)


class LinkSyncPipeline(Pipeline):

    @classmethod
    def get_config_class(cls):
        return LinkSyncConfig

    def __init__(self, config, device=None, dtype=torch.float16):
        self.device = device or torch.device("cpu")
        self.lookahead_frames = getattr(config, "lookahead_frames", 2)

        self._last_released = None
        self._last_beat_count = -1

        # FPS measurement — use larger window for stability
        self._gen_times = deque(maxlen=60)
        self._gen_fps = 0.0
        # Beat-synced FPS: derive from BPM directly instead of measuring
        self._beat_synced_fps = 0.0
        self._release_count = 0
        self._n = 0
        self._hint = 0.0

        logger.info(
            "Ableton Link Sync initialized (postprocessor, lookahead=%d)",
            self.lookahead_frames,
        )

    def prepare(self, **kwargs):
        return Requirements(input_size=1)

    def __call__(self, **kwargs):
        video = kwargs.get("video")
        if video is None:
            return None

        now = time.perf_counter()
        self._n += 1

        # Measure gen FPS
        self._gen_times.append(now)
        if len(self._gen_times) >= 2:
            dt = self._gen_times[-1] - self._gen_times[0]
            if dt > 0:
                self._gen_fps = (len(self._gen_times) - 1) / dt

        # Extract the frame — input is list of [1,H,W,C] uint8 tensors
        if isinstance(video, list):
            if len(video) == 0:
                return None
            frame = video[-1]
        else:
            frame = video

        if not isinstance(frame, torch.Tensor):
            return None

        # Normalize to [H,W,C]
        while frame.dim() > 3:
            frame = frame.squeeze(0)

        # Read beat state
        beat_count = int(kwargs.get("beat_count", 0))
        is_playing = kwargs.get("is_playing", False)
        bpm = float(kwargs.get("bpm", 0))

        # Derive beat-synced FPS from BPM directly (stable, no drift)
        if bpm > 0 and is_playing:
            self._beat_synced_fps = bpm / 60.0  # quarter notes per second

        should_release = False

        if not is_playing:
            # No Link — pass through at gen rate
            should_release = True
            self._beat_synced_fps = 0.0
        else:
            # Beat boundary detection — handle skipped beats
            if self._last_beat_count < 0:
                # First call with playing — initialize, release first frame
                should_release = True
            elif beat_count != self._last_beat_count:
                should_release = True
                self._release_count += 1

            self._last_beat_count = beat_count

        if should_release:
            self._last_released = frame.clone()

            if self._n % 60 == 1:
                latency_ms = round(self.lookahead_frames / max(self._gen_fps, 1.0) * 1000)
                logger.info(
                    "[LinkSync] RELEASE beat=%d gen=%.1ffps synced=%.1ffps latency=%dms releases=%d",
                    beat_count, self._gen_fps, self._beat_synced_fps, latency_ms,
                    self._release_count,
                )
        elif self._last_released is None:
            self._last_released = frame.clone()

        # Output the held frame: float32 [1,H,W,C] in [0,1]
        out = self._last_released.float() / 255.0
        out = out.unsqueeze(0)

        if is_playing and self._beat_synced_fps > 0:
            self._hint = self._beat_synced_fps
        else:
            self._hint = self._gen_fps

        result = {"video": out}
        result["_link_sync_metrics"] = {
            "gen_fps": round(self._gen_fps, 1),
            "beat_synced_fps": round(self._beat_synced_fps, 1),
            "min_latency_ms": round(self.lookahead_frames / max(self._gen_fps, 1.0) * 1000),
        }

        return result

    def get_output_fps_hint(self):
        return self._hint if self._hint > 0 else 0.0

    def reset(self):
        self._last_released = None
        self._last_beat_count = -1
        self._gen_times.clear()
        self._gen_fps = 0.0
        self._beat_synced_fps = 0.0
        self._release_count = 0
        self._n = 0
