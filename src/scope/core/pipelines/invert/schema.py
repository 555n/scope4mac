from pydantic import Field

from ..base_schema import BasePipelineConfig, ModeDefaults, UsageType, ui_field_config


class InvertConfig(BasePipelineConfig):
    """Invert — color inversion with mix control."""

    pipeline_id = "invert"
    pipeline_name = "Invert"
    pipeline_description = "Color inversion with blend control"
    supports_prompts = False
    usage = [UsageType.PREPROCESSOR, UsageType.POSTPROCESSOR]
    modes = {"video": ModeDefaults(default=True)}

    mix: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Inversion amount. 0=original, 1=fully inverted.",
        json_schema_extra=ui_field_config(order=0, label="Mix"),
    )
