from enum import Enum
from pydantic import Field
from ..base_schema import BasePipelineConfig, ModeDefaults, UsageType, ui_field_config


class Subdivision(str, Enum):
    beat = "beat"
    half = "half"
    quarter = "quarter"
    eighth = "8th"
    bar = "bar"
    two_bar = "2bar"
    four_bar = "4bar"


class BeatQuantizedConfig(BasePipelineConfig):
    """Beat-Quantized Lookahead — schedule hero frames on musical boundaries.

    Holds generation until the next beat subdivision, then fires.
    Between heroes, outputs the held frame (RIFE handles interpolation).
    """

    pipeline_id = "beat-quantized"
    pipeline_name = "Beat-Quantized"
    pipeline_description = "Quantize diffusion frame generation to musical beat boundaries."
    supports_prompts = False
    modified = True
    usage = [UsageType.PREPROCESSOR]
    modes = {"video": ModeDefaults(default=True)}

    subdivision: Subdivision = Field(
        default=Subdivision.beat,
        description="Musical subdivision for hero frame generation.",
        json_schema_extra=ui_field_config(order=0, label="Subdivision", is_load_param=False),
    )

    lookahead_ms: int = Field(
        default=50,
        ge=0,
        le=200,
        description="Generate hero frame this many ms before the beat hits.",
        json_schema_extra=ui_field_config(order=1, label="Lookahead (ms)", is_load_param=False),
    )

    seed_on_beat: bool = Field(
        default=True,
        description="Change seed on each beat boundary for style shifts.",
        json_schema_extra=ui_field_config(order=2, label="Seed on Beat", is_load_param=False),
    )

    strength_envelope: bool = Field(
        default=False,
        description="Modulate strength by beat phase (peaks on downbeat).",
        json_schema_extra=ui_field_config(order=3, label="Strength Envelope", is_load_param=False),
    )

    envelope_depth: float = Field(
        default=0.15,
        ge=0.0,
        le=0.5,
        description="How much beat phase modulates strength.",
        json_schema_extra=ui_field_config(order=4, label="Envelope Depth", is_load_param=False),
    )
