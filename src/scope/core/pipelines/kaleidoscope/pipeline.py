"""Kaleidoscope — radial segment folding via index-based remapping.

Avoids F.grid_sample entirely (broken on MPS with some configs).
Uses integer index remapping instead — no interpolation but artifact-free.
"""

import math

import torch

from ..interface import Pipeline, Requirements
from .schema import KaleidoscopeConfig


class KaleidoscopePipeline(Pipeline):

    @classmethod
    def get_config_class(cls):
        return KaleidoscopeConfig

    def __init__(self, **kwargs):
        device = kwargs.get("device")
        if device is not None and isinstance(device, torch.device):
            self.device = device
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            self.device = torch.device("mps")
        elif torch.cuda.is_available():
            self.device = torch.device("cuda")
        else:
            self.device = torch.device("cpu")
        self._current_rotation = 0.0
        self._flat_idx = None
        self._idx_key = None

    def prepare(self, **kwargs):
        return Requirements(input_size=1)

    def get_output_fps_hint(self):
        return 0.0

    @staticmethod
    def _build_index_map(H, W, segments, angle_rad, zoom, cx_frac, cy_frac):
        """Build integer index maps on CPU. Returns (idx_h, idx_w) each (H, W) long."""
        two_pi = 2.0 * math.pi
        slice_angle = two_pi / segments
        aspect = W / H

        # Center in pixel coords
        cy_px = cy_frac * H
        cx_px = cx_frac * W

        # Build pixel coordinate arrays
        ys = torch.arange(H, dtype=torch.float32)
        xs = torch.arange(W, dtype=torch.float32)
        grid_y, grid_x = torch.meshgrid(ys, xs, indexing="ij")

        # Offset from center, aspect-corrected
        dy = grid_y - cy_px
        dx = (grid_x - cx_px) / aspect

        # Polar
        r = torch.sqrt(dx * dx + dy * dy) / max(zoom, 0.01)
        theta = torch.atan2(dy, dx) - angle_rad
        theta = theta % two_pi

        # Fold into first segment
        theta_in_slice = theta % slice_angle
        slice_f = torch.floor(theta / slice_angle)
        is_odd = (slice_f % 2.0) >= 1.0
        theta_folded = torch.where(is_odd, slice_angle - theta_in_slice, theta_in_slice)

        # Back to pixel coords, undo aspect
        src_x = (r * torch.cos(theta_folded) * aspect + cx_px).round().clamp(0, W - 1).to(torch.int32)
        src_y = (r * torch.sin(theta_folded) + cy_px).round().clamp(0, H - 1).to(torch.int32)

        # Pre-compute flat indices for gather — avoids 2D advanced indexing per frame
        flat_idx = (src_y * W + src_x).to(torch.long)
        return flat_idx

    @torch.no_grad()
    def __call__(self, **kwargs):
        video = kwargs.get("video")
        if video is None:
            raise ValueError("No video")

        segments = max(2, min(16, int(kwargs.get("segments", 6))))
        rotation = float(kwargs.get("rotation", 0.0))
        rotation_speed = float(kwargs.get("rotation_speed", 0.0))
        zoom = max(0.5, min(2.0, float(kwargs.get("zoom", 1.0))))
        center_x = float(kwargs.get("center_x", 0.5))
        center_y = float(kwargs.get("center_y", 0.5))

        self._current_rotation += rotation_speed
        angle_rad = math.radians(rotation + self._current_rotation)

        # Scope plugin convention: list of (1, H, W, C)
        if isinstance(video, list):
            frames = torch.stack([f.squeeze(0) for f in video], dim=0)
        else:
            frames = video
        frames = frames.to(device=self.device)
        if frames.dtype == torch.uint8:
            frames = frames.float() / 255.0
        else:
            frames = frames.float()
        if frames.dim() == 3:
            frames = frames.unsqueeze(0)

        T, H, W, C = frames.shape

        # Cache index maps — rebuild only when params change
        key = (H, W, segments, round(angle_rad, 3), round(zoom, 3),
               round(center_x, 3), round(center_y, 3))
        if self._idx_key != key:
            self._flat_idx = self._build_index_map(
                H, W, segments, angle_rad, zoom, center_x, center_y
            ).reshape(-1).to(device=self.device)
            self._idx_key = key

        # Flat gather — reshape to (T, H*W, C), index, reshape back
        flat = frames.reshape(T, H * W, C)
        # flat_idx is (H*W,) long — reshape to (1, H*W, 1) and expand to (T, H*W, C)
        idx = self._flat_idx.view(1, H * W, 1).expand(T, H * W, C)
        out = flat.gather(1, idx).reshape(T, H, W, C)

        return {"video": out.clamp(0.0, 1.0)}
