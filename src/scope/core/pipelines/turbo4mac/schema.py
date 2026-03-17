from pydantic import Field

from ..artifacts import HuggingfaceRepoArtifact
from ..base_schema import (
    BasePipelineConfig,
    ModeDefaults,
    height_field,
    ui_field_config,
    width_field,
)


# SD-Turbo model artifact (auto-downloaded by diffusers, declared for registry)
SD_TURBO_ARTIFACT = HuggingfaceRepoArtifact(
    repo_id="stabilityai/sd-turbo",
    files=[],
)

# TAESD tiny autoencoder artifact (25x faster VAE decode)
TAESD_ARTIFACT = HuggingfaceRepoArtifact(
    repo_id="madebyollin/taesd",
    files=[],
)


class Turbo4MacConfig(BasePipelineConfig):
    """Configuration for Turbo4Mac pipeline.

    Real-time SD-Turbo img2img for Apple Silicon. Uses adversarial diffusion
    distillation for 1-step generation with no classifier-free guidance.
    TAESD replaces the full VAE decoder for 25x faster decode (1.2M vs 49M params).
    """

    pipeline_id = "turbo4mac"
    pipeline_name = "Turbo4Mac"
    pipeline_description = (
        "Real-time SD-Turbo img2img for Apple Silicon. "
        "1-step adversarial diffusion distillation, no CFG. "
        "TAESD for fast decode."
    )
    pipeline_version = "1.0.0"
    estimated_vram_gb = None  # Runs on anything with MPS or CPU
    supports_prompts = True
    modified = True

    artifacts = [SD_TURBO_ARTIFACT, TAESD_ARTIFACT]

    modes = {"video": ModeDefaults(default=True)}

    # Load params — set at pipeline load time, not adjustable while streaming
    height: int = height_field(default=256)
    width: int = width_field(default=256)
    strength: float = Field(
        default=0.9,
        ge=0.1,
        le=1.0,
        description="Denoising strength. Lower preserves more of the input frame.",
        json_schema_extra=ui_field_config(
            order=1,
            is_load_param=True,
            label="Strength",
        ),
    )

    # Runtime params — adjustable while streaming
    style_preset: str = Field(
        default="none",
        description="Style preset for prompt augmentation.",
        json_schema_extra=ui_field_config(
            order=10,
            label="Style Preset",
        ),
    )
