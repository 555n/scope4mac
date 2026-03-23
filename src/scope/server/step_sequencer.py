"""16-step parameter sequencer engine.

Receives a declarative pattern from the frontend (16 steps per track,
each with value 0-100 and random deviation 0-100). On each process_chunk()
call, the pipeline_processor computes the current step index from the
authoritative beat clock and calls apply() to override call_params.

Thread-safe: update_pattern() is called from the WebRTC event loop,
apply() is called from the pipeline processing thread.
"""

import logging
import random
import threading
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class SequencerStep:
    value: float = 50.0    # 0-100, user-facing scale
    random: float = 0.0    # 0-100, deviation percentage


@dataclass
class SequencerTrack:
    param_key: str = ""
    enabled: bool = False
    steps: list[SequencerStep] = field(default_factory=lambda: [SequencerStep() for _ in range(16)])
    param_min: float = 0.0
    param_max: float = 1.0
    is_integer: bool = False


class StepSequencerEngine:
    """Thread-safe 16-step parameter sequencer."""

    def __init__(self):
        self._tracks: list[SequencerTrack] = []
        self._lock = threading.Lock()
        self._rng = random.Random()
        self._current_values: dict[str, float] = {}
        self._last_step: int = -1

    def update_pattern(self, tracks_data: list[dict]) -> None:
        """Receive a pattern update from the frontend.

        Expected format per track:
        {
            "paramKey": "strength",
            "enabled": true,
            "steps": [{"value": 50, "random": 10}, ...],  # 16 entries
            "paramRange": [0.05, 1.0],
            "isInteger": false
        }
        """
        new_tracks: list[SequencerTrack] = []
        for td in tracks_data:
            steps = []
            for sd in td.get("steps", []):
                steps.append(SequencerStep(
                    value=float(sd.get("value", 50)),
                    random=float(sd.get("random", 0)),
                ))
            # Pad to 16 if short
            while len(steps) < 16:
                steps.append(SequencerStep())

            new_tracks.append(SequencerTrack(
                param_key=td.get("paramKey", ""),
                enabled=bool(td.get("enabled", False)),
                steps=steps[:16],
                param_min=float(td.get("paramRange", [0, 1])[0]),
                param_max=float(td.get("paramRange", [0, 1])[1]),
                is_integer=bool(td.get("isInteger", False)),
            ))

        with self._lock:
            self._tracks = new_tracks
        logger.info("[StepSeq] Pattern updated: %d tracks", len(new_tracks))

    def apply(self, current_step: int, call_params: dict) -> set[str]:
        """Apply sequencer values to call_params for the current step.

        Returns set of param keys that were overridden (so caller can
        skip other modulation for those params).
        """
        overridden: set[str] = set()

        with self._lock:
            tracks = list(self._tracks)

        if not tracks:
            return overridden

        step_idx = current_step % 16

        for track in tracks:
            if not track.enabled or not track.param_key:
                continue

            step = track.steps[step_idx]
            span = track.param_max - track.param_min

            # Base value: scale 0-100 to param range
            base = track.param_min + (step.value / 100.0) * span

            # Random deviation
            if step.random > 0:
                max_dev = span * (step.random / 100.0) * 0.5
                deviation = self._rng.uniform(-max_dev, max_dev)
                base += deviation

            # Clamp to range
            actual = max(track.param_min, min(track.param_max, base))

            if track.is_integer:
                actual = round(actual)

            call_params[track.param_key] = actual
            overridden.add(track.param_key)

            # Store for visualization
            self._current_values[track.param_key] = actual

        self._last_step = step_idx
        return overridden

    def get_current_values(self) -> dict[str, float]:
        """Return the last computed actual values for visualization."""
        with self._lock:
            return dict(self._current_values)

    def has_active_track(self, param_key: str) -> bool:
        """Check if a specific param has an active sequencer track."""
        with self._lock:
            return any(
                t.enabled and t.param_key == param_key
                for t in self._tracks
            )
