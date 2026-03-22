"""Beat-Quantized Lookahead — rhythmic visual modulation on musical boundaries.

Sits as a preprocessor in the chain. Passes ALL video frames through.
The actual beat-reactive effect (KV cache reset on boundary crossing)
is handled by pipeline_processor.py, which detects the 'subdivision'
parameter and triggers init_cache on the downstream diffusion pipeline.

This preprocessor's role is:
  - Accept and forward video frames
  - Track beat boundaries for logging/diagnostics
  - Provide the subdivision/lookahead schema for the frontend UI

Requires tempo_sync to be active (Ableton Link or MIDI Clock).
Without tempo data, passes frames through unmodified.

Beat state arrives in kwargs from the pipeline processor:
  bpm, beat_phase, bar_position, beat_count, is_playing
"""

import logging

import torch

from ..interface import Pipeline, Requirements
from .schema import BeatQuantizedConfig

logger = logging.getLogger(__name__)


class BeatQuantizedPipeline(Pipeline):

    @classmethod
    def get_config_class(cls):
        return BeatQuantizedConfig

    def __init__(self, **kwargs):
        self._last_beat_boundary = -1
        self._frame_count = 0

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

        self._frame_count += 1

        # Read beat state for diagnostics logging
        bpm = kwargs.get("bpm", 0)
        beat_count = kwargs.get("beat_count", 0)
        beat_phase = kwargs.get("beat_phase", 0)
        is_playing = kwargs.get("is_playing", False)
        subdivision = str(kwargs.get("subdivision", "beat"))
        beats_per_bar = int(kwargs.get("beats_per_bar", 4))

        if bpm > 0 and is_playing:
            boundary = self._get_boundary(subdivision, beat_count, beat_phase, beats_per_bar)
            if boundary != self._last_beat_boundary:
                self._last_beat_boundary = boundary
                if self._frame_count % 30 == 1:
                    logger.info(
                        "[BeatQ] boundary=%d bpm=%.0f subdiv=%s",
                        boundary, bpm, subdivision,
                    )

        return {"video": video}

    def _get_boundary(self, subdivision, beat_count, beat_phase, beats_per_bar):
        if subdivision == "8th":
            return beat_count * 2 + (1 if beat_phase >= 0.5 else 0)
        elif subdivision in ("quarter", "beat"):
            return beat_count
        elif subdivision == "half":
            return beat_count // 2
        elif subdivision in ("bar",):
            return beat_count // max(beats_per_bar, 1)
        elif subdivision in ("2bar", "2_bar"):
            return beat_count // max(beats_per_bar * 2, 1)
        elif subdivision in ("4bar", "4_bar"):
            return beat_count // max(beats_per_bar * 4, 1)
        return beat_count

    def reset(self):
        self._last_beat_boundary = -1
