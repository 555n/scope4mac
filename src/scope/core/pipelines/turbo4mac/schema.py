from pydantic import Field

from ..artifacts import HuggingfaceRepoArtifact
from ..base_schema import (
    BasePipelineConfig,
    ModeDefaults,
    height_field,
    ui_field_config,
    width_field,
)


SD_TURBO_ARTIFACT = HuggingfaceRepoArtifact(repo_id="stabilityai/sd-turbo", files=[])
TAESD_ARTIFACT = HuggingfaceRepoArtifact(repo_id="madebyollin/taesd", files=[])


class Turbo4MacConfig(BasePipelineConfig):
    """Turbo4Mac: Real-time SD-Turbo img2img for Apple Silicon."""

    pipeline_id = "turbo4mac"
    pipeline_name = "Turbo4Mac"
    pipeline_description = "Real-time SD-Turbo img2img + TAESD for Apple Silicon."
    pipeline_version = "2.0.0"
    estimated_vram_gb = None
    supports_prompts = True
    modified = True
    artifacts = [SD_TURBO_ARTIFACT, TAESD_ARTIFACT]
    modes = {"video": ModeDefaults(default=True)}

    # Load params
    height: int = height_field(default=256)
    width: int = width_field(default=256)
    use_gpu_native: bool = Field(
        default=True,
        description="GPU-native path.",
        json_schema_extra=ui_field_config(order=1, is_load_param=True, label="GPU Native"),
    )

    # Runtime params
    strength: float = Field(
        default=0.4,
        ge=0.05,
        le=0.95,
        description="AI intensity. Low=subtle, high=heavy transform.",
        json_schema_extra=ui_field_config(order=3, label="Strength"),
    )
    seed: int = Field(
        default=42,
        ge=0,
        le=999999,
        description="Noise seed. Fixed=stable, 0=random per frame.",
        json_schema_extra=ui_field_config(order=5, label="Seed"),
    )
    seed_lfo: bool = Field(
        default=False,
        description="Auto-increment seed at clock rate.",
        json_schema_extra=ui_field_config(order=6, label="Seed LFO"),
    )
    seed_lfo_ms: int = Field(
        default=100,
        ge=10,
        le=1000,
        description="Seed increment interval in milliseconds.",
        json_schema_extra=ui_field_config(order=7, label="LFO Rate (ms)"),
    )
