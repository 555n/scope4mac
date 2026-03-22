"""RIFE-Varispeed schema — adaptive frame interpolation targeting fixed output FPS."""

from pydantic import Field

from ..artifacts import HuggingfaceRepoArtifact
from ..base_schema import BasePipelineConfig, ModeDefaults, UsageType, ui_field_config


class RIFEVarispeedConfig(BasePipelineConfig):
    """RIFE-Varispeed: Adaptive frame interpolation.

    Generates interpolated frames between beat-released keyframes to
    reach a target output FPS (24 on Mac). The number of interpolated
    frames per gap adapts automatically. When frame sync offsets create
    non-uniform gaps, the interpolation density varies per gap,
    producing natural acceleration/deceleration.
    """

    pipeline_id = "rife-varispeed"
    pipeline_name = "RIFE-Varispeed"
    pipeline_description = "Adaptive interpolation to target 24fps from beat-gated keyframes."
    docs_url = "https://github.com/hzwer/Practical-RIFE"
    artifacts = [
        HuggingfaceRepoArtifact(
            repo_id="daydreamlive/RIFE",
            files=["config.json", "flownet.pkl"],
        ),
    ]
    supports_prompts = False
    modified = True
    usage = [UsageType.POSTPROCESSOR]
    modes = {"video": ModeDefaults(default=True)}

    target_fps: int = Field(
        default=24,
        ge=1,
        le=60,
        description="Target output FPS. Interpolated frames are generated to fill gaps between keyframes.",
        json_schema_extra=ui_field_config(order=0, label="Target FPS", is_load_param=False),
    )
