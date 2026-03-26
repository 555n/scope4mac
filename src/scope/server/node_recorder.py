"""Per-node MP4 recorder — writes pipeline output frames to disk.

Uses Apple Silicon hardware encoder (h264_videotoolbox) for near-zero CPU cost.
Background thread consumes from a bounded queue so the pipeline is never stalled.
"""

import logging
import os
import queue
import threading
import time

import av
import numpy as np

logger = logging.getLogger(__name__)

# Codec preference: hardware first, software fallback
_CODEC_PREFERENCE = ["h264_videotoolbox", "libx264"]
_CODEC = None


def _select_codec() -> str:
    """Select the best available H.264 encoder at import time."""
    global _CODEC
    if _CODEC is not None:
        return _CODEC
    for name in _CODEC_PREFERENCE:
        try:
            av.codec.Codec(name, "w")
            _CODEC = name
            logger.info("[NodeRecorder] Using codec: %s", name)
            return _CODEC
        except Exception:
            continue
    _CODEC = "libx264"
    logger.warning("[NodeRecorder] No preferred codec found, falling back to libx264")
    return _CODEC


class NodeRecorder:
    """Records frames from a single pipeline node to MP4.

    Non-blocking: write_frame() enqueues to a bounded queue.
    Background thread dequeues and encodes via PyAV.
    """

    def __init__(
        self,
        file_path: str,
        width: int,
        height: int,
        fps: float = 30.0,
    ):
        self.file_path = file_path
        self.width = width
        self.height = height
        self.fps = fps
        self.codec_name = _select_codec()

        self._queue: queue.Queue[np.ndarray | None] = queue.Queue(maxsize=2)
        self._running = False
        self._thread: threading.Thread | None = None
        self._frame_count = 0
        self._start_time: float | None = None

    def start(self) -> None:
        """Start the background writer thread."""
        if self._running:
            return
        self._running = True
        self._start_time = time.monotonic()
        self._thread = threading.Thread(
            target=self._writer_loop, daemon=True, name=f"rec-{os.path.basename(self.file_path)}"
        )
        self._thread.start()
        logger.info("[NodeRecorder] Started: %s (%dx%d @ %.1f fps, codec=%s)",
                     self.file_path, self.width, self.height, self.fps, self.codec_name)

    def write_frame(self, frame: np.ndarray) -> None:
        """Non-blocking enqueue. Drops frame if queue full."""
        if not self._running:
            return
        try:
            self._queue.put_nowait(frame)
        except queue.Full:
            # Drop oldest, put new
            try:
                self._queue.get_nowait()
            except queue.Empty:
                pass
            try:
                self._queue.put_nowait(frame)
            except queue.Full:
                pass

    def stop(self) -> str | None:
        """Stop recording, finalize MP4, return file path."""
        if not self._running:
            return None
        self._running = False
        # Sentinel to unblock the writer thread
        try:
            self._queue.put_nowait(None)
        except queue.Full:
            try:
                self._queue.get_nowait()
                self._queue.put_nowait(None)
            except (queue.Empty, queue.Full):
                pass

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5.0)

        elapsed = time.monotonic() - self._start_time if self._start_time else 0
        logger.info("[NodeRecorder] Stopped: %s (%d frames in %.1fs)",
                     self.file_path, self._frame_count, elapsed)

        if self._frame_count > 0 and os.path.exists(self.file_path):
            return self.file_path
        return None

    def _writer_loop(self) -> None:
        """Background thread: dequeue frames → encode to MP4."""
        container = None
        stream = None

        try:
            container = av.open(self.file_path, mode="w")
            stream = container.add_stream(self.codec_name, rate=int(self.fps))
            stream.width = self.width
            stream.height = self.height
            if self.codec_name == "h264_videotoolbox":
                stream.pix_fmt = "nv12"
            else:
                stream.pix_fmt = "yuv420p"
                stream.options = {"preset": "ultrafast", "tune": "zerolatency"}

            while self._running or not self._queue.empty():
                try:
                    frame_np = self._queue.get(timeout=0.1)
                except queue.Empty:
                    continue

                if frame_np is None:
                    break

                # Handle resolution mismatch — close and reopen
                h, w = frame_np.shape[:2]
                if w != self.width or h != self.height:
                    logger.info("[NodeRecorder] Resolution changed %dx%d → %dx%d, adapting",
                                self.width, self.height, w, h)
                    self.width = w
                    self.height = h
                    # Flush and close current stream
                    for packet in stream.encode():
                        container.mux(packet)
                    container.close()
                    # Open new segment with updated resolution
                    container = av.open(self.file_path, mode="w")
                    stream = container.add_stream(self.codec_name, rate=int(self.fps))
                    stream.width = self.width
                    stream.height = self.height
                    if self.codec_name == "h264_videotoolbox":
                        stream.pix_fmt = "nv12"
                    else:
                        stream.pix_fmt = "yuv420p"
                        stream.options = {"preset": "ultrafast", "tune": "zerolatency"}

                video_frame = av.VideoFrame.from_ndarray(frame_np, format="rgb24")
                video_frame.pts = self._frame_count
                video_frame.time_base = av.Fraction(1, int(self.fps))

                for packet in stream.encode(video_frame):
                    container.mux(packet)
                self._frame_count += 1

        except Exception:
            logger.exception("[NodeRecorder] Writer error for %s", self.file_path)
        finally:
            if container and stream:
                try:
                    # Flush encoder
                    for packet in stream.encode():
                        container.mux(packet)
                    container.close()
                except Exception:
                    logger.warning("[NodeRecorder] Error finalizing %s", self.file_path)
