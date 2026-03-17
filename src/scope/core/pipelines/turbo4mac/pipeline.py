"""Turbo4Mac — Real-time SD-Turbo img2img for Apple Silicon MPS.

AutoPipeline with PIL input (proven correct in v0.5.2) +
prompt caching + output_type="pt" to skip output PIL conversion.
"""

import logging
import time
from typing import TYPE_CHECKING

import torch
import numpy as np
from PIL import Image

from ..interface import Pipeline, Requirements
from .schema import Turbo4MacConfig

if TYPE_CHECKING:
    from ..schema import BasePipelineConfig

logger = logging.getLogger(__name__)


class Turbo4MacPipeline(Pipeline):
    """SD-Turbo img2img — proven PIL input + optimized output."""

    @classmethod
    def get_config_class(cls) -> type["BasePipelineConfig"]:
        return Turbo4MacConfig

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

        self.height = kwargs.get("height", 256)
        self.width = kwargs.get("width", 256)
        self.strength = kwargs.get("strength", 0.5)
        self.pipe = None
        self._prompt_embeds = None
        self._current_prompt = ""

    def prepare(self, **kwargs) -> Requirements:
        if self.pipe is not None:
            return Requirements(input_size=1)

        from diffusers import AutoPipelineForImage2Image, AutoencoderTiny

        self.height = kwargs.get("height", self.height)
        self.width = kwargs.get("width", self.width)
        self.strength = kwargs.get("strength", self.strength)

        logger.info("[turbo4mac] Loading on %s (%dx%d)", self.device, self.width, self.height)
        t0 = time.perf_counter()

        self.pipe = AutoPipelineForImage2Image.from_pretrained(
            "stabilityai/sd-turbo", torch_dtype=torch.float16,
        ).to(self.device)
        self.pipe.vae = AutoencoderTiny.from_pretrained(
            "madebyollin/taesd", torch_dtype=torch.float16,
        ).to(self.device)
        self.pipe.safety_checker = None
        self.pipe.set_progress_bar_config(disable=True)

        logger.info("[turbo4mac] Ready in %.1fs", time.perf_counter() - t0)
        return Requirements(input_size=1)

    def _encode_prompt(self, prompt: str):
        if prompt == self._current_prompt and self._prompt_embeds is not None:
            return
        result = self.pipe.encode_prompt(
            prompt=prompt,
            device=self.device,
            num_images_per_prompt=1,
            do_classifier_free_guidance=False,
        )
        self._prompt_embeds = result[0]
        self._current_prompt = prompt

    def __call__(self, **kwargs) -> dict:
        t0 = time.perf_counter()

        # --- PIL input (proven correct in v0.5.2) ---
        video = kwargs.get("video")
        if video is None or (isinstance(video, list) and len(video) == 0):
            pil_img = Image.new("RGB", (self.width, self.height), (128, 128, 128))
        else:
            frame = video[0] if isinstance(video, list) else video
            if isinstance(frame, torch.Tensor):
                if frame.dim() == 4:
                    frame = frame[0]
                frame_np = frame.cpu().numpy()
            else:
                frame_np = np.asarray(frame)
            if frame_np.dtype != np.uint8:
                frame_np = (frame_np * 255).clip(0, 255).astype(np.uint8) if frame_np.max() <= 1.0 else frame_np.astype(np.uint8)
            pil_img = Image.fromarray(frame_np).resize((self.width, self.height), Image.BILINEAR)

        # --- Prompt (cached) ---
        prompts = kwargs.get("prompts", [])
        if prompts and len(prompts) > 0:
            p = prompts[0]
            prompt = p.get("text", "a beautiful painting") if isinstance(p, dict) else getattr(p, "text", "a beautiful painting")
        else:
            prompt = "a beautiful painting"
        self._encode_prompt(prompt)

        # --- Inference with cached embeds + pt output ---
        with torch.no_grad():
            result = self.pipe(
                prompt_embeds=self._prompt_embeds,
                image=pil_img,
                num_inference_steps=2,
                strength=self.strength,
                guidance_scale=0.0,
                output_type="pt",
            ).images[0]  # (3, H, W) float [0,1] on GPU

        # --- Single CPU transfer ---
        out = result.permute(1, 2, 0).float().cpu().unsqueeze(0)

        dt = time.perf_counter() - t0
        logger.info("[turbo4mac] %dx%d %.0fms (%.1f FPS)", self.width, self.height, dt * 1000, 1 / dt if dt > 0 else 0)
        return {"video": out}
