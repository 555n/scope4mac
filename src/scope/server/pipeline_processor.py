"""Pipeline processor for running a single pipeline in a thread."""

import logging
import queue
import threading
import time
from collections import deque
from typing import Any

import torch
from pydantic import TypeAdapter

from scope.core.pipelines.controller import parse_ctrl_input

from .kafka_publisher import publish_event
from .pipeline_manager import PipelineNotAvailableException
from .step_sequencer import StepSequencerEngine

logger = logging.getLogger(__name__)

# Multiply the # of output frames from pipeline by this to get the max size of the output queue
OUTPUT_QUEUE_MAX_SIZE_FACTOR = 2

SLEEP_TIME = 0.001

# FPS calculation constants
MIN_FPS = 1.0  # Minimum FPS to prevent division by zero
MAX_FPS = 60.0  # Maximum FPS cap
BATCH_FPS_SAMPLE_SIZE = 10  # Number of batch-level samples for windowed averaging


class PipelineProcessor:
    """Processes frames through a single pipeline in a dedicated thread."""

    def __init__(
        self,
        pipeline: Any,
        pipeline_id: str,
        initial_parameters: dict = None,
        session_id: str | None = None,
        user_id: str | None = None,
        connection_id: str | None = None,
        connection_info: dict | None = None,
        node_id: str | None = None,
    ):
        """Initialize a pipeline processor.

        Args:
            pipeline: Pipeline instance to process frames with
            pipeline_id: ID of the pipeline (used for logging)
            initial_parameters: Initial parameters for the pipeline
            session_id: Session ID for event tracking
            user_id: User ID for event tracking
            connection_id: Connection ID from fal.ai WebSocket for event correlation
            connection_info: Connection metadata (gpu_type, region, etc.)
            node_id: Graph node ID (used for per-node parameter routing in graph mode)
        """
        self.pipeline = pipeline
        self.pipeline_id = pipeline_id
        self.node_id = node_id or pipeline_id
        self.frame_ready_event: threading.Event | None = None  # set by frame_processor
        self.tempo_sync = None  # set by frame_processor for beat state injection
        self._last_beat_boundary = -1  # for beat-reactive cache reset
        self.session_id = session_id
        self.user_id = user_id
        self.connection_id = connection_id
        self.connection_info = connection_info

        # Port-based queues wired by graph_executor.build_graph()
        self.input_queues: dict[str, queue.Queue] = {}
        self.output_queues: dict[str, list[queue.Queue]] = {}
        # Lock to protect input_queues assignment for thread-safe reference swapping
        self.input_queue_lock = threading.Lock()

        # Per-node recording — set by NodeRecordingManager
        self.node_recorder = None  # NodeRecorder | None

        # Current parameters used by processing thread
        self.parameters = initial_parameters or {}
        # Latest-write-wins parameter updates (replaces bounded queue)
        self._pending_params: dict[str, Any] = {}
        self._pending_params_lock = threading.Lock()

        self.worker_thread: threading.Thread | None = None
        self.shutdown_event = threading.Event()
        self.running = False

        self.is_prepared = False

        # Output FPS tracking (batch-level throughput)
        # Stores (num_frames, interval) tuples so that FPS = sum(frames) / sum(intervals),
        # correctly handling variable batch sizes across pipeline calls
        self._batch_samples: deque[tuple[int, float]] = deque(
            maxlen=BATCH_FPS_SAMPLE_SIZE
        )
        self._last_batch_time: float | None = None
        # Start with a higher initial FPS to prevent initial queue buildup
        self.current_output_fps = MAX_FPS
        self.output_fps_lock = threading.Lock()

        # Input FPS tracking (frame arrival rate at queue boundary)
        # Mirrors output tracking but measures when frames are dequeued,
        # independent of pipeline processing time.
        self._input_batch_samples: deque[tuple[int, float]] = deque(
            maxlen=BATCH_FPS_SAMPLE_SIZE
        )
        self._last_input_time: float | None = None
        self.current_input_fps: float = MAX_FPS
        self._input_fps_lock = threading.Lock()

        self.paused = False
        # Input mode is signaled by the frontend at stream start
        self._video_mode = (initial_parameters or {}).get("input_mode") == "video"

        # Maps output port -> list of (consumer_processor, consumer_input_port).
        # Used by _resize_output_queue to update all downstream consumers when
        # a queue is replaced. Populated by graph_executor.build_graph.
        self.output_consumers: dict[str, list[tuple[PipelineProcessor, str]]] = {}

        # Flag to track pending cache initialization after queue flush
        # Set when reset_cache flushes queues, cleared after successful pipeline call
        self._pending_cache_init = False

        # 16-step parameter sequencer
        self.step_sequencer = StepSequencerEngine()

    def _resize_output_queue(self, port: str, target_size: int):
        """Resize output queues for a given port, transferring existing frames.

        Handles fan-out (multiple queues per port) and port name remapping
        (output port name may differ from consumer's input port name).
        Consumer references are updated via output_consumers which is populated
        by graph_executor.build_graph.
        """
        port_queues = self.output_queues.get(port)
        if not port_queues:
            return

        consumers = self.output_consumers.get(port, [])
        new_list = []
        resized = False

        for old_q in port_queues:
            if old_q.maxsize >= target_size:
                new_list.append(old_q)
                continue

            logger.info(
                f"Increasing output queue size for port '{port}' to {target_size}, "
                f"current size {old_q.maxsize}"
            )
            new_q = queue.Queue(maxsize=target_size)
            while not old_q.empty():
                try:
                    frame = old_q.get_nowait()
                    new_q.put_nowait(frame)
                except queue.Empty:
                    break
            new_list.append(new_q)
            resized = True

            # Update every consumer whose input queue is the old queue object
            for consumer, consumer_port in consumers:
                with consumer.input_queue_lock:
                    if consumer.input_queues.get(consumer_port) is old_q:
                        consumer.input_queues[consumer_port] = new_q

        if resized:
            self.output_queues[port] = new_list

    @property
    def output_queue(self) -> queue.Queue | None:
        """Primary video output queue (used by sink to read frames)."""
        queues = self.output_queues.get("video")
        return queues[0] if queues else None

    def start(self):
        """Start the pipeline processor thread."""
        if self.running:
            return

        self.running = True
        self.shutdown_event.clear()

        self.worker_thread = threading.Thread(target=self.worker_loop, daemon=True)
        self.worker_thread.start()

        logger.info(f"PipelineProcessor started for pipeline: {self.pipeline_id}")

    def stop(self):
        """Stop the pipeline processor thread."""
        if not self.running:
            return

        self.running = False
        self.shutdown_event.set()

        if self.worker_thread and self.worker_thread.is_alive():
            if threading.current_thread() != self.worker_thread:
                self.worker_thread.join(timeout=5.0)

        # Clear all input queues
        with self.input_queue_lock:
            input_queues_copy = dict(self.input_queues)
        for q in input_queues_copy.values():
            while not q.empty():
                try:
                    q.get_nowait()
                except queue.Empty:
                    break

        for queues in self.output_queues.values():
            for q in queues:
                while not q.empty():
                    try:
                        q.get_nowait()
                    except queue.Empty:
                        break

        logger.info(f"PipelineProcessor stopped for pipeline: {self.pipeline_id}")

    def update_parameters(self, parameters: dict[str, Any]):
        """Update parameters — latest-write-wins, never drops."""
        with self._pending_params_lock:
            self._pending_params.update(parameters)

    def _coerce_schema_types(self, updated_keys: dict[str, Any]):
        """Coerce updated parameter values through the pipeline's Pydantic schema.

        JSON from the WebRTC data channel delivers all values as strings.
        This validates each updated key against its schema field type,
        converting e.g. string "8" → int enum value, "auto" → str enum.
        Only touches keys present in both updated_keys and the schema.
        """
        if not hasattr(self.pipeline, "get_config_class"):
            return
        config_cls = self.pipeline.get_config_class()
        if not hasattr(config_cls, "model_fields"):
            return
        for key in updated_keys:
            if key not in config_cls.model_fields or key not in self.parameters:
                continue
            field = config_cls.model_fields[key]
            annotation = field.annotation
            if annotation is None:
                continue
            try:
                adapter = TypeAdapter(annotation)
                self.parameters[key] = adapter.validate_python(self.parameters[key])
            except Exception:
                pass

    def worker_loop(self):
        """Main worker loop that processes frames."""
        logger.info(f"Worker thread started for pipeline: {self.pipeline_id}")

        while self.running and not self.shutdown_event.is_set():
            try:
                self.process_chunk()

            except PipelineNotAvailableException as e:
                logger.debug(
                    f"Pipeline {self.pipeline_id} temporarily unavailable: {e}"
                )
                # Sleep briefly and continue
                self.shutdown_event.wait(SLEEP_TIME)
                continue
            except Exception as e:
                if self._is_recoverable(e):
                    logger.error(
                        f"Error in worker loop for {self.pipeline_id}: {e}",
                        exc_info=True,
                    )
                    continue
                else:
                    logger.error(
                        f"Non-recoverable error in worker loop for {self.pipeline_id}: {e}, stopping"
                    )
                    # Publish error event for pipeline processing failure
                    publish_event(
                        event_type="error",
                        session_id=self.session_id,
                        connection_id=self.connection_id,
                        pipeline_ids=[self.pipeline_id],
                        user_id=self.user_id,
                        error={
                            "error_type": "pipeline_processing_failed",
                            "message": str(e),
                            "exception_type": type(e).__name__,
                            "recoverable": False,
                        },
                        connection_info=self.connection_info,
                    )
                    break

        logger.info(f"Worker thread stopped for pipeline: {self.pipeline_id}")

    def prepare_chunk(
        self, input_queue_ref: queue.Queue, chunk_size: int
    ) -> list[torch.Tensor]:
        """
        Sample frames uniformly from one queue (used when only video port is present).
        """
        step = input_queue_ref.qsize() / chunk_size
        indices = [round(i * step) for i in range(chunk_size)]
        video_frames = []
        last_idx = indices[-1]
        for i in range(last_idx + 1):
            frame = input_queue_ref.get_nowait()
            if i in indices:
                video_frames.append(frame)
        self._track_input_batch(len(video_frames))
        return video_frames

    def prepare_multi_chunk(
        self,
        input_queues_ref: dict[str, queue.Queue],
        chunk_size: int,
    ) -> dict[str, list[torch.Tensor]]:
        """
        Sample chunk_size frames uniformly from each wired queue.

        All queues must have >= chunk_size frames (caller checks readiness).
        Each port is sampled independently using the same uniform strategy.
        """
        return {
            port: self.prepare_chunk(q, chunk_size)
            for port, q in input_queues_ref.items()
        }

    def process_chunk(self):
        """Process a single chunk of frames."""
        # Apply pending parameter updates (latest-write-wins)
        with self._pending_params_lock:
            new_parameters = self._pending_params.copy()
            self._pending_params.clear()

        if new_parameters:
            # Clear stale transition when new prompts arrive without transition
            if (
                "prompts" in new_parameters
                and "transition" not in new_parameters
                and "transition" in self.parameters
            ):
                self.parameters.pop("transition", None)

            # Update video mode if input_mode parameter changes
            if "input_mode" in new_parameters:
                self._video_mode = new_parameters.get("input_mode") == "video"

            # Accumulate ctrl_input: keys = latest, mouse = sum
            if "ctrl_input" in new_parameters:
                if "ctrl_input" in self.parameters:
                    existing = self.parameters["ctrl_input"]
                    new_ctrl = new_parameters["ctrl_input"]
                    new_parameters["ctrl_input"] = {
                        "button": new_ctrl.get("button", []),
                        "mouse": [
                            existing.get("mouse", [0, 0])[0]
                            + new_ctrl.get("mouse", [0, 0])[0],
                            existing.get("mouse", [0, 0])[1]
                            + new_ctrl.get("mouse", [0, 0])[1],
                        ],
                    }

            # Extract sequencer pattern before merge (not a pipeline param)
            seq_pattern = new_parameters.pop("sequencer_pattern", None)
            if seq_pattern is not None:
                tracks = seq_pattern if isinstance(seq_pattern, list) else seq_pattern.get("tracks", [])
                self.step_sequencer.update_pattern(tracks)

            # Merge new parameters with existing ones
            self.parameters = {**self.parameters, **new_parameters}

            # Coerce parameter types through the pipeline's Pydantic schema.
            # WebRTC data channel delivers JSON — all values arrive as strings/dicts.
            # This converts e.g. "8" → InterpolationDepth.x8, "auto" → RifeMode.auto.
            self._coerce_schema_types(new_parameters)

        # Pause or resume the processing
        paused = self.parameters.pop("paused", None)
        if paused is not None and paused != self.paused:
            self._last_batch_time = None
            self.paused = paused
            # Flush all queues on pause/resume to prevent stale frame replay
            with self.input_queue_lock:
                for q in self.input_queues.values():
                    while not q.empty():
                        try:
                            q.get_nowait()
                        except Exception:
                            break
            for queues in self.output_queues.values():
                for q in queues:
                    while not q.empty():
                        try:
                            q.get_nowait()
                        except Exception:
                            break
            # Reset RIFE sliding window state on resume
            if not paused and hasattr(self.pipeline, 'reset'):
                self.pipeline.reset()
            logger.info("[PAUSE] %s queues flushed, paused=%s", self.pipeline_id, paused)
        if self.paused:
            self.shutdown_event.wait(SLEEP_TIME)
            return

        # Prepare pipeline
        reset_cache = self.parameters.pop("reset_cache", None)
        lora_scales = self.parameters.pop("lora_scales", None)

        # Handle explicit reset_cache from user (parameter update):
        # flush output queues + reset pipeline cache state.
        # Beat-triggered resets (set later in beat modulation) only set
        # _pending_cache_init without flushing — avoids starving downstream.
        if reset_cache:
            logger.info(f"Clearing cache for pipeline processor: {self.pipeline_id}")
            for queues in self.output_queues.values():
                for q in queues:
                    while not q.empty():
                        try:
                            q.get_nowait()
                        except queue.Empty:
                            break
            self._pending_cache_init = True

        requirements = None
        if hasattr(self.pipeline, "prepare"):
            prepare_params = dict(self.parameters.items())
            if self._video_mode:
                # Signal to prepare() that video input is expected
                prepare_params["video"] = True
            requirements = self.pipeline.prepare(**prepare_params)

        chunks: dict[str, list[torch.Tensor]] = {}
        if requirements is not None:
            current_chunk_size = requirements.input_size
            with self.input_queue_lock:
                input_queues_ref = dict(self.input_queues)
            # Wait until ALL wired input queues have enough frames
            if not input_queues_ref or not all(
                q.qsize() >= current_chunk_size for q in input_queues_ref.values()
            ):
                # Preserve popped one-shot parameters so they are applied once frames arrive
                if lora_scales is not None:
                    self.parameters["lora_scales"] = lora_scales
                self.shutdown_event.wait(SLEEP_TIME)
                return
            if len(input_queues_ref) == 1:
                port, q = next(iter(input_queues_ref.items()))
                chunks[port] = self.prepare_chunk(q, current_chunk_size)
            else:
                chunks = self.prepare_multi_chunk(input_queues_ref, current_chunk_size)

        try:
            # Pass parameters (excluding prepare-only parameters)
            call_params = dict(self.parameters.items())

            # Inject measured input FPS for postprocessors (e.g. RIFE auto-multiplier)
            with self._input_fps_lock:
                call_params["input_fps"] = self.current_input_fps

            # Inject beat state from tempo sync (if active)
            beat_state = None
            if self.tempo_sync is not None:
                beat_state = self.tempo_sync.get_beat_state()
                if beat_state is not None:
                    call_params["bpm"] = beat_state.bpm
                    call_params["beat_phase"] = beat_state.beat_phase
                    call_params["bar_position"] = beat_state.bar_position
                    call_params["beat_count"] = beat_state.beat_count
                    call_params["is_playing"] = beat_state.is_playing
                    call_params["beats_per_bar"] = self.tempo_sync.beats_per_bar

            # Beat-reactive modulation: on beat boundary crossing,
            # inject strength pulse + seed jump for a visible "pop".
            # Works with non-autoregressive pipelines (turbo4mac/SD-Turbo)
            # that don't have KV cache. For Wan2.1 pipelines, also triggers
            # cache reset for maximum discontinuity.
            # Beat modulation: only apply to pipelines that support prompts
            # (diffusion pipelines). Preprocessors and postprocessors skip this
            # to avoid flushing their output queues on every beat boundary.
            config_cls = self.pipeline.get_config_class() if hasattr(self.pipeline, "get_config_class") else None
            pipeline_supports_beat_mod = config_cls is not None and getattr(config_cls, "supports_prompts", False)

            beat_subdivision = call_params.get("subdivision")
            if not beat_subdivision:
                # Subdivision cleared — reset boundary tracker to avoid
                # stale boundary firing on re-enable
                self._last_beat_boundary = -1
            elif pipeline_supports_beat_mod and beat_state is not None and beat_state.bpm > 0:
                from scope.server.tempo_sync import get_beat_boundary
                import math

                boundary = get_beat_boundary(
                    beat_subdivision,
                    beat_state.beat_count,
                    self.tempo_sync.beats_per_bar,
                )

                is_new_boundary = (
                    boundary != self._last_beat_boundary
                    and self._last_beat_boundary >= 0
                )

                # Read UI-configurable beat modulation params
                seed_on_beat = call_params.get("seed_on_beat", True)
                if isinstance(seed_on_beat, str):
                    seed_on_beat = seed_on_beat in ("true", "True", "1")
                do_strength_envelope = call_params.get("strength_envelope", True)
                if isinstance(do_strength_envelope, str):
                    do_strength_envelope = do_strength_envelope in ("true", "True", "1")
                envelope_depth = float(call_params.get("envelope_depth", 0.25))

                if is_new_boundary:
                    # Seed jump — force new noise pattern on the beat
                    if seed_on_beat:
                        current_seed = int(call_params.get("seed", 42))
                        if current_seed > 0:
                            call_params["seed"] = (current_seed + 997) % 1000000

                    # Signal cache init for autoregressive pipelines (Wan2.1).
                    # Do NOT set reset_cache=True here — that flushes output queues
                    # and starves downstream pipelines. Only flag the init.
                    self._pending_cache_init = True

                self._last_beat_boundary = boundary

                # Continuous strength envelope: peak on beat, decay between
                # Skip if step sequencer owns strength
                if do_strength_envelope and not self.step_sequencer.has_active_track("strength"):
                    beat_phase = beat_state.beat_phase
                    bpb = self.tempo_sync.beats_per_bar
                    if beat_subdivision in ("beat", "quarter"):
                        phase = beat_phase
                    elif beat_subdivision == "8th":
                        phase = (beat_phase * 2) % 1.0
                    elif beat_subdivision == "half":
                        phase = ((beat_state.beat_count % 2) + beat_phase) / 2.0
                    elif beat_subdivision in ("bar",):
                        phase = beat_state.bar_position / max(bpb, 1)
                    else:
                        phase = beat_phase

                    base_strength = float(call_params.get("strength", 0.4))
                    envelope = 0.5 * (1.0 + math.cos(phase * math.pi))
                    call_params["strength"] = base_strength + envelope_depth * envelope

            # 16-step sequencer: compute current step and apply overrides
            if beat_state is not None and beat_state.bpm > 0:
                bpb = self.tempo_sync.beats_per_bar if self.tempo_sync else 4
                if bpb > 0:
                    normalized = beat_state.bar_position / bpb
                    current_step = int(normalized * 16) % 16
                    call_params["current_step"] = current_step
                    self.step_sequencer.apply(current_step, call_params)

            # Pass reset_cache as init_cache to pipeline
            call_params["init_cache"] = not self.is_prepared or self._pending_cache_init
            if reset_cache:
                call_params["init_cache"] = True

            # Pass lora_scales only when present
            if lora_scales is not None:
                call_params["lora_scales"] = lora_scales

            # Extract ctrl_input, parse it, and reset mouse for next frame
            if "ctrl_input" in self.parameters:
                ctrl_data = self.parameters["ctrl_input"]
                call_params["ctrl_input"] = parse_ctrl_input(ctrl_data)
                # Reset mouse accumulator, keep key state
                self.parameters["ctrl_input"]["mouse"] = [0.0, 0.0]

            # Fill call_params from stream chunks (port names are set by graph edges)
            if chunks:
                for port, frame_list in chunks.items():
                    call_params[port] = frame_list

            # Log input state for postprocessor chain debugging
            if chunks and logger.isEnabledFor(logging.DEBUG):
                for port, flist in chunks.items():
                    logger.debug(
                        "[CHAIN] %s recv port=%s frames=%d dtype=%s mean=%.1f",
                        self.pipeline_id, port, len(flist),
                        flist[0].dtype if flist else "?",
                        flist[0].float().mean().item() if flist else 0,
                    )

            processing_start = time.time()
            output_dict = self.pipeline(**call_params)
            processing_time = time.time() - processing_start

            if not output_dict:
                return

            # Clear one-shot parameters after use to prevent sending them on subsequent chunks
            # These parameters should only be sent when explicitly provided in parameter updates
            one_shot_params = [
                "vace_ref_images",
                "images",
                "first_frame_image",
                "last_frame_image",
            ]
            for param in one_shot_params:
                if param in call_params and param in self.parameters:
                    self.parameters.pop(param, None)

            # Clear transition when complete
            if "transition" in call_params and "transition" in self.parameters:
                transition_active = False
                if hasattr(self.pipeline, "state"):
                    transition_active = self.pipeline.state.get(
                        "_transition_active", False
                    )

                transition = call_params.get("transition")
                if not transition_active or transition is None:
                    self.parameters.pop("transition", None)

            output = output_dict.get("video")
            num_frames = 0
            if output is not None:
                num_frames = output.shape[0]

            logger.debug(
                "[PROFILE] pipeline=%s process_chunk input_mode=%s frames_out=%s took=%.3fs",
                self.pipeline_id,
                call_params.get("input_mode"),
                num_frames,
                processing_time,
            )

            # Log output state for postprocessor chain debugging
            if output is not None and logger.isEnabledFor(logging.DEBUG):
                logger.debug(
                    "[CHAIN] %s emit frames=%d shape=%s dtype=%s mean=%.1f oq_ports=%s",
                    self.pipeline_id, num_frames, list(output.shape),
                    output.dtype, output.float().cpu().mean().item(),
                    list(self.output_queues.keys()),
                )

            # Put each output port's frames to its queues (all frame ports are streamed)
            for port, value in output_dict.items():
                if value is None or not isinstance(value, torch.Tensor):
                    continue
                queues = self.output_queues.get(port)
                if not queues:
                    continue
                # Resize output queues to fit at least one full batch
                target_size = value.shape[0] * OUTPUT_QUEUE_MAX_SIZE_FACTOR
                self._resize_output_queue(port, target_size)
                # Re-read queues after potential resize – _resize_output_queue
                # may replace self.output_queues[port] with a new list.
                queues = self.output_queues.get(port)
                if not queues:
                    continue
                if value.dtype != torch.uint8:
                    value = (
                        (value * 255.0)
                        .clamp(0, 255)
                        .to(dtype=torch.uint8)
                        .contiguous()
                        .detach()
                    )
                frames = [value[i].unsqueeze(0) for i in range(value.shape[0])]
                for frame in frames:
                    for q in queues:
                        try:
                            q.put_nowait(frame if q is queues[0] else frame.clone())
                        except queue.Full:
                            logger.debug(
                                f"Output queue full for {self.pipeline_id} port '{port}', dropping frame"
                            )

            # Per-node recording tap (CPU-only, non-blocking)
            if self.node_recorder is not None and output is not None:
                rec_data = output.cpu().numpy() if output.device.type != "cpu" else output.numpy()
                for i in range(rec_data.shape[0]):
                    self.node_recorder.write_frame(rec_data[i])

            # Signal frame ready for event-driven transport
            if self.frame_ready_event is not None and num_frames > 0:
                self.frame_ready_event.set()

            # Track batch-level throughput for FPS calculation
            if output is not None and num_frames > 0:
                self._track_output_batch(num_frames, processing_time)

            # Forward extra params (non-video outputs without queues) to downstream
            # pipelines. Preprocessors may return e.g. {"video": frames,
            # "vace_input_frames": ..., "vace_input_masks": ...} and the extra
            # entries need to reach the consuming pipeline as parameters.
            extra_params = {
                k: v for k, v in output_dict.items() if k not in self.output_queues
            }

            if extra_params and self.output_consumers:
                seen: set[int] = set()
                for consumers in self.output_consumers.values():
                    for consumer_proc, _ in consumers:
                        proc_id = id(consumer_proc)
                        if proc_id not in seen:
                            seen.add(proc_id)
                            consumer_proc.update_parameters(extra_params)

        except Exception as e:
            if self._is_recoverable(e):
                logger.error(
                    f"Error processing chunk for {self.pipeline_id}: {e}", exc_info=True
                )
            else:
                raise e

        self.is_prepared = True
        self._pending_cache_init = False

    def _track_output_batch(self, num_frames: int, processing_time: float):
        """Track batch-level production throughput for FPS calculation.

        Stores (num_frames, interval) tuples and computes FPS as
        sum(frames) / sum(intervals). This correctly handles variable
        batch sizes and avoids the oscillation caused by per-frame delta
        tracking where near-zero intra-batch deltas mixed with large
        inter-batch gaps cause the FPS estimate to swing permanently.

        On the first call, processing_time is used as the interval since
        there is no previous batch to measure against. This gives a useful
        FPS estimate immediately rather than waiting for a second batch.
        """
        now = time.time()
        with self.output_fps_lock:
            if self._last_batch_time is not None:
                interval = now - self._last_batch_time
            elif processing_time > 0:
                # First batch: use processing time as initial interval estimate
                interval = processing_time
            else:
                interval = 0

            if interval > 0:
                self._batch_samples.append((num_frames, interval))

            self._last_batch_time = now

        self._calculate_output_fps()

    def _calculate_output_fps(self):
        """Calculate FPS from batch-level throughput: sum(frames) / sum(intervals)."""
        with self.output_fps_lock:
            if self._batch_samples:
                total_frames = sum(n for n, _ in self._batch_samples)
                total_time = sum(t for _, t in self._batch_samples)
                if total_time > 0:
                    fps = total_frames / total_time
                    self.current_output_fps = max(MIN_FPS, min(MAX_FPS, fps))

    def _track_input_batch(self, num_frames: int):
        """Track input frame arrival rate at the queue boundary.

        Called from prepare_chunk() after frames are dequeued. Measures the
        interval between successive dequeue operations, independent of
        pipeline processing time. This provides an accurate input FPS
        for downstream consumers like RIFE's auto-multiplier.
        """
        now = time.time()
        with self._input_fps_lock:
            if self._last_input_time is not None:
                interval = now - self._last_input_time
                if interval > 0:
                    self._input_batch_samples.append((num_frames, interval))
            self._last_input_time = now

            if self._input_batch_samples:
                total_frames = sum(n for n, _ in self._input_batch_samples)
                total_time = sum(t for _, t in self._input_batch_samples)
                if total_time > 0:
                    self.current_input_fps = max(
                        MIN_FPS, min(MAX_FPS, total_frames / total_time)
                    )

    def get_fps(self) -> float:
        """Get the current dynamically calculated pipeline FPS.

        Returns the FPS based on how fast frames are produced into the output queue,
        adjusted for queue fill level to prevent buildup.
        """
        with self.output_fps_lock:
            output_fps = self.current_output_fps
        return min(MAX_FPS, output_fps)

    @staticmethod
    def _is_recoverable(error: Exception) -> bool:
        """Check if an error is recoverable."""
        if isinstance(error, torch.cuda.OutOfMemoryError):
            return False
        return True
