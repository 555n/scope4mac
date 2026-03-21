from enum import Enum

from pydantic import Field

from ..artifacts import HuggingfaceRepoArtifact
from ..base_schema import BasePipelineConfig, ModeDefaults, UsageType, ui_field_config


class RifeMode(str, Enum):
    auto = "auto"
    manual = "manual"


class InterpolationDepth(int, Enum):
    x2 = 2
    x4 = 4
    x8 = 8
    x16 = 16


class RIFEConfig(BasePipelineConfig):
    """RIFE-Buffered: Adaptive frame interpolation.

    Auto:   Set target FPS → system picks depth automatically.
    Manual: Set interpolation depth → output = input × depth.
    """

    pipeline_id = "rife"
    pipeline_name = "RIFE-Buffered"
    pipeline_description = "Auto = target FPS. Manual = pick depth."
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

    rife_mode: RifeMode = Field(
        default=RifeMode.auto,
        description="auto = target FPS, system picks depth. manual = you pick depth.",
        json_schema_extra=ui_field_config(order=0, label="Mode", is_load_param=False),
    )

    # Auto mode: target FPS
    target_fps: int = Field(
        default=60,
        ge=0,
        le=240,
        description="(Auto) Target output FPS. System picks closest depth.",
        json_schema_extra=ui_field_config(order=1, label="Target FPS", is_load_param=False),
    )

    # Manual mode: interpolation depth
    depth: InterpolationDepth = Field(
        default=InterpolationDepth.x2,
        description="(Manual) Interpolation multiplier.",
        json_schema_extra=ui_field_config(order=2, label="Interpolation Depth", is_load_param=False),
    )
