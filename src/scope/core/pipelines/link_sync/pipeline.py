"""Ableton Link Sync — beat-gated frame release.

Buffers incoming frames and releases the most recent one on each beat
boundary. Between beats, the last released frame is repeated. This locks
the visual output to the tempo grid — at 120 BPM quarter-note gating,
the display updates exactly 2 times per second regardless of generation rate.
"""

import logging

import torch

from ..interface import Pipeline, Requirements
from .schema import LinkSyncConfig

logger = logging.getLogger(__name__)


class LinkSyncPipeline(Pipeline):

    @classmethod
    def get_config_class(cls):
        return LinkSyncConfig

    def __init__(self, *, lookahead_frames=2, **kwargs):
        self.lookahead_frames = lookahead_frames
        self._buffer = None          # most recent incoming frame
        self._released = None        # last frame released on beat
        self._last_beat_count = -1   # beat boundary tracker
        logger.info("Ableton Link Sync initialized (beat-gated frame release)")

    def prepare(self, **kwargs):
        return Requirements(input_size=1)

    def __call__(self, **kwargs):
        video = kwargs.get("video")
        if video is None:
            return None

        if isinstance(video, list):
            if len(video) == 0:
                return None
            video = video[0]

        # Always buffer the latest frame
        self._buffer = video

        # Read beat state from pipeline_processor injection
        beat_count = kwargs.get("beat_count", -1)
        is_playing = kwargs.get("is_playing", False)

        if not is_playing or beat_count < 0:
            # Link not active — passthrough
            self._released = video
            return {"video": video}

        # Detect beat boundary crossing
        if beat_count != self._last_beat_count:
            # New beat — release the buffered frame
            self._last_beat_count = beat_count
            self._released = self._buffer
            return {"video": self._released}

        # Between beats — repeat the last released frame
        if self._released is not None:
            return {"video": self._released}

        # Fallback — no frame released yet, pass through
        return {"video": video}

    def reset(self):
        self._buffer = None
        self._released = None
        self._last_beat_count = -1
