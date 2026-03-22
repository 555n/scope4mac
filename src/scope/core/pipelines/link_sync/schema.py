"""Ableton Link Sync — beat-synced frame gate postprocessor schema."""

from pydantic import Field
from ..base_schema import BasePipelineConfig, ModeDefaults, UsageType, ui_field_config


class LinkSyncConfig(BasePipelineConfig):
    """Ableton Link Sync: Beat-synced frame gate.

    Postprocessor that buffers generated frames and releases them
    locked to Ableton Link beat boundaries (quarter notes).
    Generation runs at max rate — this node controls output timing.

    Lookahead determines minimum latency: frames are buffered so
    the most recent gen frame is available when the beat fires.
    """

    pipeline_id = "link-sync"
    pipeline_name = "Ableton Link Sync"
    pipeline_description = "Beat-locked frame output gate. Buffers gen frames, releases on beat."
    supports_prompts = False
    modified = True
    usage = [UsageType.POSTPROCESSOR]
    modes = {"video": ModeDefaults(default=True)}

    lookahead_frames: int = Field(
        default=2,
        ge=1,
        le=8,
        description="Frame buffer depth. Higher = more latency, more precise beat alignment. Min latency = lookahead / gen_fps.",
        json_schema_extra=ui_field_config(order=0, label="Lookahead Frames", is_load_param=True),
    )
