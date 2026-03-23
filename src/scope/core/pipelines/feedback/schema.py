from pydantic import Field

from ..base_schema import BasePipelineConfig, ModeDefaults, UsageType, ui_field_config


class FeedbackConfig(BasePipelineConfig):
    """Feedback — TD-style frame feedback.

    Blends previous output back into current input for trails and ghosting.
    """

    pipeline_id = "feedback"
    pipeline_name = "Feedback"
    pipeline_description = "Frame feedback with trails"
    supports_prompts = False
    usage = [UsageType.PREPROCESSOR, UsageType.POSTPROCESSOR]
    modes = {"video": ModeDefaults(default=True)}

    mix: int = Field(
        default=80,
        ge=0,
        le=100,
        description="Feedback blend % (0=none, 100=full).",
        json_schema_extra=ui_field_config(order=0, label="Mix %"),
    )

    decay: int = Field(
        default=95,
        ge=0,
        le=100,
        description="Brightness decay % per frame.",
        json_schema_extra=ui_field_config(order=1, label="Decay %"),
    )
