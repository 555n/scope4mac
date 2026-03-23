"""Ableton Link Sync — beat-gated frame release with subdivision and syncopation.

Gates at configurable subdivision: quarter (1/beat), 8th (2/beat), 16th (4/beat).
At 120 BPM 8th notes: 4 releases/sec. At 6 FPS gen, most gates fire a fresh frame.
Missed gates repeat the last frame. RIFE after this node smooths the output.
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
        self._last_gate_idx = -1

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

        # Subdivision: how many gates per beat
        subdivision = str(kwargs.get("subdivision", "8th"))
        if subdivision == "16th":
            gates_per_beat = 4
        elif subdivision == "8th":
            gates_per_beat = 2
        else:  # quarter
            gates_per_beat = 1

        # Global gate index: monotonic, increments gates_per_beat times per beat
        gate_idx = beat_count * gates_per_beat + int(beat_phase * gates_per_beat)

        # Frame sync offsets (per beat, not per subdivision)
        frame_offsets = kwargs.get("frame_offsets", [0, 0, 0, 0])
        current_beat_in_bar = int(bar_position) % max(beats_per_bar, 1)
        offset = 0.0
        if isinstance(frame_offsets, (list, tuple)) and current_beat_in_bar < len(frame_offsets):
            offset = float(frame_offsets[current_beat_in_bar])

        # Apply offset: shift gate_idx by offset fraction of one gate period
        if offset > 0:
            sub_phase = beat_phase * gates_per_beat
            sub_idx = int(sub_phase)
            sub_frac = sub_phase - sub_idx
            # Offset delays the gate within each subdivision
            if sub_frac < offset:
                gate_idx = self._last_gate_idx  # hold previous gate

        # New gate — release buffered frame
        if gate_idx != self._last_gate_idx:
            self._last_gate_idx = gate_idx
            self._released = self._buffer
            return {"video": self._released}

        # Between gates — repeat
        if self._released is not None:
            return {"video": self._released}

        return {"video": video}

    def reset(self):
        self._buffer = None
        self._released = None
        self._last_gate_idx = -1
