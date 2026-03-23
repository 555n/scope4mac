from pydantic import Field

from ..base_schema import BasePipelineConfig, ModeDefaults, UsageType, ui_field_config


class KaleidoscopeConfig(BasePipelineConfig):
    """Configuration for Kaleidoscope processor pipeline.

    Mirror-segment kaleidoscope effect. Folds the image into radial
    segments around a configurable center point, with rotation,
    auto-rotation, and zoom controls. Works as preprocessor or
    postprocessor.
    """

    pipeline_id = "kaleidoscope"
    pipeline_name = "Kaleidoscope"
    pipeline_description = "Mirror-segment kaleidoscope effect"
    supports_prompts = False
    usage = [UsageType.PREPROCESSOR, UsageType.POSTPROCESSOR]
    modes = {"video": ModeDefaults(default=True)}

    segments: int = Field(
        default=6,
        ge=2,
        le=16,
        description="Number of mirror segments.",
        json_schema_extra=ui_field_config(order=0, label="Segments"),
    )

    rotation: float = Field(
        default=0.0,
        ge=0.0,
        le=360.0,
        description="Manual rotation in degrees.",
        json_schema_extra=ui_field_config(order=1, label="Rotation"),
    )

    rotation_speed: float = Field(
        default=0.0,
        ge=-10.0,
        le=10.0,
        description="Auto-rotate speed in degrees per frame.",
        json_schema_extra=ui_field_config(order=2, label="Rotation Speed"),
    )

    zoom: float = Field(
        default=1.0,
        ge=0.5,
        le=2.0,
        description="Zoom into center of kaleidoscope.",
        json_schema_extra=ui_field_config(order=3, label="Zoom"),
    )

    center_x: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Horizontal center point (0=left, 1=right).",
        json_schema_extra=ui_field_config(order=4, label="Center X"),
    )

    center_y: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Vertical center point (0=top, 1=bottom).",
        json_schema_extra=ui_field_config(order=5, label="Center Y"),
    )
