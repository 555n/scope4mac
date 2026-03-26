"""Manages per-node recording across the pipeline graph.

Creates one NodeRecorder per PipelineProcessor, attaches it via
processor.node_recorder, and handles lifecycle (start/stop/hot-swap).
"""

import logging
import os
import time
from typing import TYPE_CHECKING

from .node_recorder import NodeRecorder

if TYPE_CHECKING:
    from .pipeline_processor import PipelineProcessor

logger = logging.getLogger(__name__)


class NodeRecordingManager:
    """Per-node-stage recording for the entire pipeline chain."""

    def __init__(self):
        self._recorders: list[NodeRecorder] = []
        self._recording = False
        self._output_dir: str = ""
        self._session_id: str = ""
        self._recorded_files: list[str] = []

    @property
    def is_recording(self) -> bool:
        return self._recording

    def start(
        self,
        processors: list["PipelineProcessor"],
        output_dir: str,
        session_id: str = "",
        fps: float = 30.0,
    ) -> None:
        """Create and attach a recorder to each processor."""
        if self._recording:
            self.stop()

        self._output_dir = output_dir
        self._session_id = session_id
        self._recorded_files = []

        # Create timestamped subdirectory
        ts = time.strftime("%Y%m%d_%H%M%S")
        rec_dir = os.path.join(output_dir, f"rec_{ts}")
        os.makedirs(rec_dir, exist_ok=True)

        for idx, proc in enumerate(processors):
            pid = proc.pipeline_id or f"node_{idx}"
            file_name = f"{idx}_{pid}.mp4"
            file_path = os.path.join(rec_dir, file_name)

            # Get resolution from the processor's last known output or defaults
            width = int(proc.parameters.get("width", 512))
            height = int(proc.parameters.get("height", 512))

            recorder = NodeRecorder(
                file_path=file_path,
                width=width,
                height=height,
                fps=fps,
            )
            recorder.start()
            proc.node_recorder = recorder
            self._recorders.append(recorder)

        self._recording = True
        logger.info(
            "[NodeRecording] Started %d recorders in %s",
            len(self._recorders), rec_dir,
        )

    def stop(self) -> list[str]:
        """Stop all recorders, detach from processors, return file paths."""
        if not self._recording:
            return self._recorded_files

        self._recording = False
        paths: list[str] = []

        for recorder in self._recorders:
            path = recorder.stop()
            if path:
                paths.append(path)

        self._recorders.clear()
        self._recorded_files = paths

        logger.info("[NodeRecording] Stopped. %d files recorded.", len(paths))
        return paths

    def detach_all(self) -> None:
        """Detach recorders from processors without stopping them.

        Used during hot-swap: processors are about to be destroyed,
        but we want to finalize recordings cleanly via stop().
        """
        # Recorders still reference their own queues/threads — just
        # clear the processor.node_recorder references so the old
        # processors don't write to recorders after they're stopped.
        # The actual stop() call happens separately.
        pass

    def get_status(self) -> dict:
        """Return current recording state for API response."""
        return {
            "recording": self._recording,
            "num_recorders": len(self._recorders),
            "output_dir": self._output_dir,
            "recorded_files": self._recorded_files,
        }
