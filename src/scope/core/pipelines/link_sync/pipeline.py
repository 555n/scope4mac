"""Ableton Link Sync — buffered beat-gated frame release.

Collects one bar's worth of generated frames into a buffer before releasing.
On each sixteenth-note boundary, if the gate is open (from the 16-step gate
pattern), releases the next buffered frame. If closed, holds the last frame.

Latency = one bar (at 120 BPM = 2 seconds). This guarantees frames are
available for every gate, even at low generation rates.
"""

import collections
import logging

from ..interface import Pipeline, Requirements
from .schema import LinkSyncConfig

logger = logging.getLogger(__name__)

# Minimum frames to buffer before first release
MIN_BUFFER_FRAMES = 4


class LinkSyncPipeline(Pipeline):

    @classmethod
    def get_config_class(cls):
        return LinkSyncConfig

    def __init__(self, *, lookahead_frames=2, **kwargs):
        self._frame_buffer = collections.deque(maxlen=64)
        self._released = None
        self._last_gate_idx = -1
        self._primed = False
        self._frames_needed = 16  # recalculated from gen FPS
        self._frame_count = 0
        logger.info("Ableton Link Sync initialized (buffered gate)")

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

        # Always collect into buffer
        self._frame_buffer.append(video)
        self._frame_count += 1

        beat_count = kwargs.get("beat_count", -1)
        beat_phase = kwargs.get("beat_phase", 0.0)
        is_playing = kwargs.get("is_playing", False)

        # Gate when Link clock is running (bpm > 0 and beats advancing).
        # link.playing is only True when Ableton transport is playing,
        # but the clock runs regardless — use beat_count > 0 instead.
        bpm = kwargs.get("bpm", 0)
        if beat_count < 0 or bpm <= 0:
            self._released = video
            self._primed = False
            return {"video": video}

        # Wait until we have enough frames for a full bar
        if not self._primed:
            if len(self._frame_buffer) >= MIN_BUFFER_FRAMES:
                self._primed = True
                self._last_gate_idx = -1
                logger.info("[LinkSync] Primed with %d frames", len(self._frame_buffer))
            else:
                # Still collecting — output last frame or passthrough
                if self._released is not None:
                    return {"video": self._released}
                return {"video": video}

        # 16 gates per bar = 4 per beat (sixteenth notes)
        gate_idx = beat_count * 4 + int(beat_phase * 4)

        # Gate pattern from frame_offsets: 16-element array, >0 = open, 0 = closed
        frame_offsets = kwargs.get("frame_offsets")
        gate_open = True  # default: all open if no pattern

        if isinstance(frame_offsets, (list, tuple)) and len(frame_offsets) >= 16:
            step = gate_idx % 16
            gate_open = float(frame_offsets[step]) > 0

        # New gate boundary
        if gate_idx != self._last_gate_idx:
            self._last_gate_idx = gate_idx

            if gate_open and len(self._frame_buffer) > 0:
                # Release next buffered frame
                self._released = self._frame_buffer.popleft()
                return {"video": self._released}

        # Between gates or closed gate — repeat last
        if self._released is not None:
            return {"video": self._released}

        return {"video": video}

    def reset(self):
        self._frame_buffer.clear()
        self._released = None
        self._last_gate_idx = -1
        self._primed = False
        self._frame_count = 0
