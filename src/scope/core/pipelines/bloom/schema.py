from pydantic import Field

from ..base_schema import BasePipelineConfig, ModeDefaults, UsageType, ui_field_config


class BloomConfig(BasePipelineConfig):
    """Configuration for Bloom postprocessor pipeline.

    GPU bloom/glow effect applied after diffusion output. Extracts bright
    areas above a threshold, applies gaussian blur, and blends back into
    the original frame for a glow effect.
    """

    pipeline_id = "bloom"
    pipeline_name = "Bloom"
    pipeline_description = "GPU bloom/glow postprocessor"
    supports_prompts = False
    usage = [UsageType.POSTPROCESSOR]
    modes = {"video": ModeDefaults(default=True)}

    amount: float = Field(
        default=0.3,
        ge=0.0,
        le=2.0,
        description="Glow intensity.",
        json_schema_extra=ui_field_config(order=0, label="Amount"),
    )

    radius: int = Field(
        default=4,
        ge=1,
        le=8,
        description="Glow spread (1=tight, 8=wide).",
        json_schema_extra=ui_field_config(order=1, label="Radius"),
    )

    threshold: float = Field(
        default=0.7,
        ge=0.0,
        le=1.0,
        description="Brightness cutoff — only pixels above this glow.",
        json_schema_extra=ui_field_config(order=2, label="Threshold"),
    )
