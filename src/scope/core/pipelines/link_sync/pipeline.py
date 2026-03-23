"""Ableton Link Sync — beat-gated frame release with syncopation.

Buffers incoming frames and releases the most recent one on each beat
boundary. Frame Sync offsets displace the release point within each beat.
Between release points, the last released frame is repeated.
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
        self._buffer = None
        self._released = None
        self._last_release_beat = -1.0
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

        # Read beat state
        beat_count = kwargs.get("beat_count", -1)
        beat_phase = kwargs.get("beat_phase", 0.0)
        is_playing = kwargs.get("is_playing", False)
        beats_per_bar = kwargs.get("beats_per_bar", 4)

        if not is_playing or beat_count < 0:
            self._released = video
            return {"video": video}

        # Frame sync offsets: [beat1_offset, beat2_offset, beat3_offset, beat4_offset]
        # Each offset is 0-0.75 beats of displacement from the downbeat
        frame_offsets = kwargs.get("frame_offsets", [0, 0, 0, 0])

        # Current position in the bar as a continuous beat number
        bar_position = kwargs.get("bar_position", 0.0)

        # Which beat of the bar we're on (0-indexed)
        current_beat_in_bar = int(bar_position) % max(beats_per_bar, 1)
        offset = 0.0
        if isinstance(frame_offsets, (list, tuple)) and current_beat_in_bar < len(frame_offsets):
            offset = float(frame_offsets[current_beat_in_bar])

        # The release point for this beat = beat_count + offset
        release_point = beat_count + offset

        # Continuous position = beat_count + beat_phase
        continuous_pos = beat_count + beat_phase

        # Release when we cross the release point
        if continuous_pos >= release_point and release_point > self._last_release_beat:
            self._last_release_beat = release_point
            self._released = self._buffer
            return {"video": self._released}

        # Between release points — repeat last released frame
        if self._released is not None:
            return {"video": self._released}

        return {"video": video}

    def reset(self):
        self._buffer = None
        self._released = None
        self._last_release_beat = -1.0
