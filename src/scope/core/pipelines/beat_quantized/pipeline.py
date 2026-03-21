"""Beat-Quantized Lookahead — schedule hero frames on musical boundaries.

Sits as a preprocessor in the chain. Receives video frames, holds them,
and only releases a frame when the beat clock hits the configured subdivision.
Between beats, repeats the last hero frame. Downstream RIFE interpolates.

Requires tempo_sync to be active (Ableton Link or MIDI Clock).
Without tempo data, passes frames through unmodified.

Beat state arrives in kwargs from the pipeline processor:
  bpm, beat_phase, bar_position, beat_count, is_playing
"""

import logging
import math
import time

import torch

from ..interface import Pipeline, Requirements
from .schema import BeatQuantizedConfig

logger = logging.getLogger(__name__)


class BeatQuantizedPipeline(Pipeline):

    @classmethod
    def get_config_class(cls):
        return BeatQuantizedConfig

    def __init__(self, **kwargs):
        self._last_hero = None
        self._last_beat_boundary = -1
        self._last_seed_boundary = -1
        self._seed_offset = 0
        self._frame_count = 0

    def prepare(self, **kwargs):
        return Requirements(input_size=1)

    def __call__(self, **kwargs):
        video = kwargs.get("video")
        if video is None:
            raise ValueError("No video input")

        self._frame_count += 1

        # Read beat state from tempo sync (injected by pipeline processor)
        bpm = kwargs.get("bpm", 0)
        beat_phase = kwargs.get("beat_phase", 0)  # 0.0-1.0 within current beat
        bar_position = kwargs.get("bar_position", 0)
        beat_count = kwargs.get("beat_count", 0)
        is_playing = kwargs.get("is_playing", False)

        # Read our params
        subdivision = str(kwargs.get("subdivision", "beat"))
        lookahead_ms = int(kwargs.get("lookahead_ms", 50))
        seed_on_beat = kwargs.get("seed_on_beat", True)
        if isinstance(seed_on_beat, str):
            seed_on_beat = seed_on_beat in ("true", "True", "1")
        strength_envelope = kwargs.get("strength_envelope", False)
        if isinstance(strength_envelope, str):
            strength_envelope = strength_envelope in ("true", "True", "1")
        envelope_depth = float(kwargs.get("envelope_depth", 0.15))

        # No tempo data — pass through
        if bpm <= 0 or not is_playing:
            self._last_hero = video
            return {"video": video}

        # Calculate current boundary index based on subdivision
        boundary = self._get_boundary(subdivision, beat_count, beat_phase, bpm)

        # Lookahead: are we close enough to the NEXT boundary?
        beat_duration_ms = 60000.0 / bpm
        subdiv_ms = self._subdiv_duration_ms(subdivision, beat_duration_ms)
        phase_within_subdiv = self._phase_within_subdiv(subdivision, beat_phase, bar_position)
        ms_until_next = subdiv_ms * (1.0 - phase_within_subdiv)
        is_near_boundary = ms_until_next <= lookahead_ms or boundary != self._last_beat_boundary

        if is_near_boundary:
            # HERO FRAME — release this frame on the beat
            self._last_beat_boundary = boundary
            self._last_hero = video

            # Seed shift on beat
            if seed_on_beat and boundary != self._last_seed_boundary:
                self._seed_offset += 1
                self._last_seed_boundary = boundary
                # Inject modified seed into kwargs for downstream turbo4mac
                current_seed = int(kwargs.get("seed", 42))
                if current_seed > 0:
                    kwargs["seed"] = (current_seed + self._seed_offset) % 1000000

            # Strength envelope: peak on downbeat, trough between beats
            if strength_envelope:
                base_strength = float(kwargs.get("strength", 0.4))
                # Cosine envelope: 1.0 at boundary, decays between
                envelope = 0.5 * (1.0 + math.cos(phase_within_subdiv * math.pi))
                kwargs["strength"] = base_strength + envelope_depth * envelope

            if self._frame_count % 30 == 1:
                logger.info("[BeatQ] HERO boundary=%d bpm=%.0f subdiv=%s ms_until=%.0f",
                            boundary, bpm, subdivision, ms_until_next)

            return {"video": video}
        else:
            # HOLD — repeat last hero frame (RIFE will interpolate downstream)
            if self._last_hero is not None:
                return {"video": self._last_hero}
            return {"video": video}

    def _get_boundary(self, subdivision, beat_count, beat_phase, bpm):
        """Return an integer boundary index for the current position."""
        if subdivision == "8th":
            return beat_count * 2 + (1 if beat_phase >= 0.5 else 0)
        elif subdivision == "quarter":
            return beat_count
        elif subdivision == "half":
            return beat_count // 2
        elif subdivision == "beat":
            return beat_count
        elif subdivision == "bar":
            return beat_count // 4
        elif subdivision == "2bar":
            return beat_count // 8
        elif subdivision == "4bar":
            return beat_count // 16
        return beat_count

    def _subdiv_duration_ms(self, subdivision, beat_ms):
        """Duration of one subdivision in ms."""
        if subdivision == "8th":
            return beat_ms / 2
        elif subdivision in ("quarter", "beat"):
            return beat_ms
        elif subdivision == "half":
            return beat_ms * 2
        elif subdivision == "bar":
            return beat_ms * 4
        elif subdivision == "2bar":
            return beat_ms * 8
        elif subdivision == "4bar":
            return beat_ms * 16
        return beat_ms

    def _phase_within_subdiv(self, subdivision, beat_phase, bar_position):
        """0.0-1.0 phase within the current subdivision."""
        if subdivision == "8th":
            return (beat_phase * 2) % 1.0
        elif subdivision in ("quarter", "beat"):
            return beat_phase
        elif subdivision == "half":
            return (beat_phase / 2) % 1.0
        elif subdivision == "bar":
            return bar_position % 1.0
        return beat_phase

    def reset(self):
        self._last_hero = None
        self._last_beat_boundary = -1
        self._last_seed_boundary = -1
        self._seed_offset = 0
