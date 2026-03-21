"""RIFE (Real-Time Intermediate Flow Estimation) HDv3 frame interpolation module.

This module provides frame interpolation functionality using RIFE HDv3 to multiply
the frame rate of video output from the pipeline.

Supports recursive interpolation for 2x/4x/8x multipliers via repeated
midpoint subdivision — each pass is a single batched model call.

Modified from https://github.com/hzwer/Practical-RIFE
The original repo is: https://github.com/hzwer/Practical-RIFE
"""

import logging
import math
from pathlib import Path

import torch
import torch.nn.functional as F

logger = logging.getLogger(__name__)

# Try to import RIFE model
RIFE_AVAILABLE = False
RIFE_MODEL_CLASS = None

# Import RIFE HDv3 model from our codebase
try:
    from .RIFE_HDv3 import Model as RIFEModel

    RIFE_MODEL_CLASS = RIFEModel
    RIFE_AVAILABLE = True
    logger.info("RIFE HDv3 model found and imported")
except ImportError as e:
    RIFE_AVAILABLE = False
    logger.debug(f"RIFE HDv3 import failed: {e}")


class RIFEInterpolator:
    """RIFE HDv3-based frame interpolator.

    Supports recursive multi-pass interpolation for 2x/4x/8x frame rate
    multiplication. Each pass doubles the frame count via midpoint subdivision,
    using a single batched model call per pass.

    Attributes:
        enabled: Whether interpolation is enabled
        device: Device to run interpolation on
        model: RIFE HDv3 model instance (if available)
        model_path: Path to RIFE HDv3 model weights directory
    """

    def __init__(
        self,
        enabled: bool = False,
        device: torch.device | None = None,
        model_path: str | None = None,
    ):
        self.enabled = enabled
        self.device = device or (
            torch.device("cuda") if torch.cuda.is_available() else torch.device("cpu")
        )
        self.model = None
        self.model_path = model_path

        if enabled:
            if not RIFE_AVAILABLE:
                raise ImportError(
                    "RIFE interpolation requested but RIFE HDv3 is not available. "
                    "Please install RIFE HDv3 from https://github.com/hzwer/arXiv2020-RIFE. "
                    "See docs/rife.md for installation instructions."
                )

            try:
                self._load_model()
                if self.model is None:
                    raise RuntimeError(
                        "RIFE HDv3 model weights not found. "
                        "Please download RIFE HDv3 model weights and place flownet.pkl in "
                        "arXiv2020-RIFE/train_log/ directory. "
                        "See docs/rife.md for installation instructions."
                    )
                logger.info("RIFE HDv3 model loaded successfully")
            except Exception as e:
                logger.error(f"Failed to load RIFE model: {e}")
                raise RuntimeError(
                    f"Failed to load RIFE model: {e}. "
                    "Please ensure RIFE is properly installed. "
                    "See docs/rife.md for installation instructions."
                ) from e

    def _load_model(self):
        """Load RIFE model."""
        if not RIFE_AVAILABLE or RIFE_MODEL_CLASS is None:
            return

        try:
            self.model = RIFE_MODEL_CLASS()

            model_dir_path = None
            if self.model_path:
                model_path_obj = Path(self.model_path)
                if model_path_obj.is_file():
                    model_dir_path = str(model_path_obj.parent)
                elif model_path_obj.is_dir():
                    model_dir_path = str(model_path_obj)
            else:
                from scope.server.models_config import get_models_dir

                current_file = Path(__file__).resolve()
                project_root = None
                for parent in current_file.parents:
                    if (parent / "pyproject.toml").exists():
                        project_root = parent
                        break

                default_model_dirs = []
                if project_root:
                    weights_dir = project_root / "weights" / "RIFE"
                    default_model_dirs.append(weights_dir)

                default_model_dirs.append(get_models_dir() / "RIFE")

                default_model_dirs.append(
                    Path.home() / ".daydream-scope" / "models" / "RIFE"
                )

                for model_dir in default_model_dirs:
                    if model_dir.exists() and (model_dir / "flownet.pkl").exists():
                        model_dir_path = str(model_dir)
                        break

            if model_dir_path:
                self.model.load_model(model_dir_path, -1)
                self.model.eval()
                self.model.device()
                logger.info(
                    f"Loaded RIFE HDv3 weights from {model_dir_path}/flownet.pkl"
                )
            else:
                raise FileNotFoundError(
                    "RIFE HDv3 model weights (flownet.pkl) not found. "
                    "Please download RIFE HDv3 model from https://github.com/hzwer/arXiv2020-RIFE "
                    "and place flownet.pkl in ~/.daydream-scope/models/RIFE/ directory. "
                    "See docs/rife.md for installation instructions."
                )
        except FileNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Error loading RIFE HDv3 model: {e}", exc_info=True)
            raise RuntimeError(
                f"Failed to load RIFE HDv3 model: {e}. "
                "See docs/rife.md for installation instructions."
            ) from e

    def interpolate(self, frames: torch.Tensor, multiplier: int = 2) -> torch.Tensor:
        """Interpolate frames to multiply the frame rate.

        Args:
            frames: Input frames tensor [T, H, W, C] with values in [0, 255] (uint8)
            multiplier: Frame rate multiplier (must be power of 2: 2, 4, 8).
                        Default 2 for backwards compatibility.

        Returns:
            Interpolated frames tensor [T_out, H, W, C] with values in [0, 255] (uint8)
            where T_out = (T - 1) * multiplier + 1
        """
        if not self.enabled or multiplier <= 1:
            return frames

        if frames.shape[0] < 2:
            return frames

        if not RIFE_AVAILABLE or self.model is None:
            raise RuntimeError(
                "RIFE interpolation is enabled but RIFE HDv3 model is not available."
            )

        # Clamp multiplier to powers of 2
        multiplier = max(2, multiplier)
        depth = max(1, int(math.log2(multiplier)))
        actual_multiplier = 2 ** depth

        if actual_multiplier != multiplier:
            logger.debug(
                "[RIFE] Rounded multiplier %d to %d (depth=%d)",
                multiplier, actual_multiplier, depth,
            )

        frames_float = frames.float()
        return self._rife_interpolate(frames_float, depth)

    def _rife_interpolate(self, frames: torch.Tensor, depth: int = 1) -> torch.Tensor:
        """Recursive RIFE interpolation.

        Each depth level doubles the frame count by inserting midpoints between
        all consecutive frames. Uses a single batched model call per level.

        depth=1 → 2x (T=2 → 3 frames, 1 model call)
        depth=2 → 4x (T=2 → 5 frames, 2 model calls)
        depth=3 → 8x (T=2 → 9 frames, 3 model calls)

        Args:
            frames: Input [T, H, W, C] in [0, 255] float
            depth: Number of recursive passes (multiplier = 2^depth)

        Returns:
            Interpolated [T_out, H, W, C] in [0, 255] uint8
        """
        num_frames = frames.shape[0]
        if num_frames < 2:
            return frames.clamp(0, 255).to(torch.uint8)

        T, H, W, C = frames.shape

        # Convert to [T, C, H, W] normalized [0, 1], move to device
        frames_chw = (frames.permute(0, 3, 1, 2) / 255.0).to(self.device).contiguous()

        # Pad to multiples of 32 (RIFE v4.25 requirement)
        tmp = 32
        ph = ((H - 1) // tmp + 1) * tmp
        pw = ((W - 1) // tmp + 1) * tmp
        padding = (0, pw - W, 0, ph - H)

        frames_padded = F.pad(frames_chw, padding)  # [T, C, pH, pW]

        with torch.no_grad():
            # BF16 autocast on CUDA; MPS supports float16 autocast; skip on CPU
            if self.device.type == "cuda":
                ctx = torch.amp.autocast(device_type="cuda", dtype=torch.bfloat16)
            elif self.device.type == "mps":
                ctx = torch.amp.autocast(device_type="mps", dtype=torch.float16)
            else:
                from contextlib import nullcontext
                ctx = nullcontext()

            with ctx:
                # Recursive midpoint subdivision
                current = frames_padded
                for level in range(depth):
                    current = self._subdivide(current)

            # Remove padding, scale to [0, 255], transfer to CPU
            result_chw = (current[:, :, :H, :W].float() * 255.0).cpu()

        # Convert to [T_out, H, W, C] uint8
        result = result_chw.permute(0, 2, 3, 1).contiguous()
        result = result.clamp(0.0, 255.0).to(torch.uint8)

        return result

    def _subdivide(self, frames: torch.Tensor) -> torch.Tensor:
        """Single subdivision pass: insert midpoints between all consecutive frames.

        Takes T frames, returns 2T-1 frames with interpolated midpoints.
        Single batched model call for all T-1 pairs.

        Args:
            frames: [T, C, pH, pW] on device

        Returns:
            [2T-1, C, pH, pW] on device
        """
        T = frames.shape[0]
        if T < 2:
            return frames

        frames1 = frames[:-1]  # [T-1, C, pH, pW]
        frames2 = frames[1:]   # [T-1, C, pH, pW]

        # Batched inference — all pairs at once, single model call
        mids = self.model.inference(frames1, frames2, scale=1.0)  # [T-1, C, pH, pW]

        # Interleave: [f0, m0, f1, m1, ..., f(T-2), m(T-2), f(T-1)]
        new_T = T * 2 - 1
        result = torch.zeros(
            new_T, *frames.shape[1:], dtype=frames.dtype, device=frames.device
        )
        result[0::2] = frames
        result[1::2] = mids

        return result

    def set_enabled(self, enabled: bool):
        """Enable or disable interpolation."""
        if enabled:
            if not RIFE_AVAILABLE:
                raise RuntimeError(
                    "RIFE interpolation cannot be enabled: RIFE HDv3 is not available."
                )
            if self.model is None:
                try:
                    self._load_model()
                    if self.model is None:
                        raise RuntimeError("RIFE HDv3 model weights not found.")
                except Exception as e:
                    raise RuntimeError(
                        f"Failed to load RIFE HDv3 model when enabling: {e}."
                    ) from e
        self.enabled = enabled


def is_rife_available() -> bool:
    """Check if RIFE is available for use."""
    return RIFE_AVAILABLE


def get_rife_model_path() -> Path | None:
    """Get the default RIFE HDv3 model directory path."""
    from scope.server.models_config import get_models_dir

    current_file = Path(__file__).resolve()
    project_root = None
    for parent in current_file.parents:
        if (parent / "pyproject.toml").exists():
            project_root = parent
            break

    default_dirs = []
    if project_root:
        weights_dir = project_root / "weights" / "RIFE"
        default_dirs.append(weights_dir)

    default_dirs.append(get_models_dir() / "RIFE")
    default_dirs.append(Path.home() / ".daydream-scope" / "models" / "RIFE")

    for model_dir in default_dirs:
        if model_dir.exists() and (model_dir / "flownet.pkl").exists():
            return model_dir
    return None
