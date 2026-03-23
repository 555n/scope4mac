"""Ableton Link Sync — beat-gated frame release with syncopation.

Buffers incoming frames and releases the most recent one on each beat
boundary. Frame Sync offsets displace the release point within each beat.
RIFE should be placed AFTER this node to interpolate between beat-locked frames.
"""

import logging

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
        self._last_beat = -1
        self._released_this_beat = False
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

        self._buffer = video

        beat_count = kwargs.get("beat_count", -1)
        beat_phase = kwargs.get("beat_phase", 0.0)
        bar_position = kwargs.get("bar_position", 0.0)
        is_playing = kwargs.get("is_playing", False)
        beats_per_bar = kwargs.get("beats_per_bar", 4)

        if not is_playing or beat_count < 0:
            self._released = video
            return {"video": video}

        # New beat detected
        if beat_count != self._last_beat:
            self._last_beat = beat_count
            self._released_this_beat = False

        # Frame sync offset for current beat
        frame_offsets = kwargs.get("frame_offsets", [0, 0, 0, 0])
        current_beat_in_bar = int(bar_position) % max(beats_per_bar, 1)
        offset = 0.0
        if isinstance(frame_offsets, (list, tuple)) and current_beat_in_bar < len(frame_offsets):
            offset = float(frame_offsets[current_beat_in_bar])

        # Release when beat_phase crosses the offset threshold
        if not self._released_this_beat and beat_phase >= offset:
            self._released_this_beat = True
            self._released = self._buffer
            return {"video": self._released}

        # Between releases — repeat last frame
        if self._released is not None:
            return {"video": self._released}

        return {"video": video}

    def reset(self):
        self._buffer = None
        self._released = None
        self._last_beat = -1
        self._released_this_beat = False
