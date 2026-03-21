"""Turbo4Mac v3.0 — Real-time SD-Turbo img2img for Apple Silicon MPS.

Sigma-scaled noise injection (like Krea/StreamDiffusion):
  - Strength maps to timestep in 1000-step schedule
  - Scheduler sigma controls noise level — UNet reconstructs structurally
  - Persistent noise for temporal consistency (no per-frame boiling)
  - Manual Euler step: denoised = noisy - sigma * noise_pred
"""

import logging
import time
from typing import TYPE_CHECKING

import torch
import torch.nn.functional as F
import numpy as np
from PIL import Image

from ..interface import Pipeline, Requirements
from .schema import Turbo4MacConfig

if TYPE_CHECKING:
    from ..schema import BasePipelineConfig

logger = logging.getLogger(__name__)

_DEFAULT_PROMPT = "bright clouds on an acid iridescent sky"


def _cf(v, d: float, lo: float, hi: float) -> float:
    try: return max(lo, min(hi, float(v)))
    except (TypeError, ValueError): return d


def _ci(v, d: int, lo: int, hi: int) -> int:
    try: return max(lo, min(hi, int(v)))
    except (TypeError, ValueError): return d


class Turbo4MacPipeline(Pipeline):
    """SD-Turbo img2img — 4-step schedule, 1 UNet pass, persistent noise."""

    @classmethod
    def get_config_class(cls) -> type["BasePipelineConfig"]:
        return Turbo4MacConfig

    def __init__(self, **kwargs):
        device = kwargs.get("device")
        if device is not None and isinstance(device, torch.device):
            self.device = device
        elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            import os
            os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
            os.environ.setdefault("PYTORCH_MPS_HIGH_WATERMARK_RATIO", "0.0")
            self.device = torch.device("mps")
        elif torch.cuda.is_available():
            self.device = torch.device("cuda")
        else:
            self.device = torch.device("cpu")
        logger.info("[turbo4mac] Device: %s", self.device)

        self.height = kwargs.get("height", 256)
        self.width = kwargs.get("width", 256)
        self.strength = kwargs.get("strength", 0.4)
        self.use_gpu_native = kwargs.get("use_gpu_native", True)

        self.pipe = None
        self.unet = None
        self.vae = None
        self.scheduler = None
        self._prompt_embeds = None
        self._current_prompt = ""
        self._frame_count = 0
        self._noise = None
        self._noise_seed = None
        self._seed_lfo_last = 0.0
        self._seed_lfo_counter = 0

    def prepare(self, **kwargs) -> Requirements:
        if self.pipe is not None:
            return Requirements(input_size=1)

        from diffusers import AutoPipelineForImage2Image, AutoencoderTiny

        self.height = kwargs.get("height", self.height)
        self.width = kwargs.get("width", self.width)
        self.strength = kwargs.get("strength", self.strength)
        if "use_gpu_native" in kwargs:
            self.use_gpu_native = kwargs["use_gpu_native"]

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

        self.unet = self.pipe.unet
        self.vae = self.pipe.vae
        self.scheduler = self.pipe.scheduler

        logger.info("[turbo4mac] Ready in %.1fs", time.perf_counter() - t0)
        return Requirements(input_size=1)

    def _encode_prompt(self, prompt: str):
        if prompt == self._current_prompt and self._prompt_embeds is not None:
            return
        result = self.pipe.encode_prompt(
            prompt=prompt, device=self.device,
            num_images_per_prompt=1, do_classifier_free_guidance=False,
        )
        self._prompt_embeds = result[0]
        self._current_prompt = prompt

    def _get_prompt_text(self, kwargs):
        prompts = kwargs.get("prompts", [])
        if prompts and len(prompts) > 0:
            p = prompts[0]
            return p.get("text", _DEFAULT_PROMPT) if isinstance(p, dict) else getattr(p, "text", _DEFAULT_PROMPT)
        return _DEFAULT_PROMPT

    def _get_noise(self, latents: torch.Tensor, seed: int) -> torch.Tensor:
        """Persistent unit-variance noise. No scaling — scheduler handles sigma."""
        if (self._noise is not None
                and self._noise.shape == latents.shape
                and self._noise_seed == seed
                and seed > 0):
            return self._noise
        if seed > 0:
            gen = torch.Generator(device=self.device).manual_seed(seed)
            self._noise = torch.randn(latents.shape, generator=gen,
                                      device=self.device, dtype=latents.dtype)
        else:
            self._noise = torch.randn_like(latents)
        self._noise_seed = seed
        return self._noise

    def __call__(self, **kwargs) -> dict:
        if self.use_gpu_native:
            return self._call_gpu_native(**kwargs)
        return self._call_pil(**kwargs)

    def _call_gpu_native(self, **kwargs) -> dict:
        """GPU-native: fixed-timestep UNet + latent-space strength blend."""
        t0 = time.perf_counter()
        self._frame_count += 1

        strength = _cf(kwargs.get("strength", self.strength), 0.4, 0.1, 0.9)
        seed = _ci(kwargs.get("seed", 42), 42, 0, 999999)

        # Seed LFO — auto-increment seed at configurable rate
        raw_lfo = kwargs.get("seed_lfo", False)
        seed_lfo = raw_lfo is True or raw_lfo == "true" or raw_lfo == "True" or raw_lfo == 1
        seed_lfo_ms = _ci(kwargs.get("seed_lfo_ms", 100), 100, 10, 1000)
        if seed_lfo and seed > 0:
            now = time.perf_counter()
            elapsed_ms = (now - self._seed_lfo_last) * 1000.0
            if elapsed_ms >= seed_lfo_ms:
                self._seed_lfo_counter += 1
                self._seed_lfo_last = now
            seed = (seed + self._seed_lfo_counter) % 1000000

        image = self._frame_to_tensor(kwargs.get("video"))
        t1 = time.perf_counter()

        self._encode_prompt(self._get_prompt_text(kwargs))

        with torch.no_grad():
            # Proven approach: set_timesteps(2), 1 UNet pass via scheduler.step().
            # SD-Turbo is adversarial distillation — manual Euler math produces noise.
            # Only scheduler.step() knows the correct reconstruction for this model.
            self.scheduler.set_timesteps(2, device=self.device)
            all_ts = self.scheduler.timesteps
            if hasattr(self.scheduler, "set_begin_index"):
                self.scheduler.set_begin_index(1)
            timesteps = all_ts[1:]
            latent_timestep = timesteps[:1]

            # TAESD encode
            init_latents = self.vae.encode(image).latents
            t2 = time.perf_counter()

            # Seeded noise — if seed>0, same seed = same noise (stable).
            # LFO increments seed over time for evolving texture.
            if seed > 0:
                gen = torch.Generator(device=self.device).manual_seed(seed)
                noise = torch.randn(init_latents.shape, generator=gen,
                                    device=self.device, dtype=init_latents.dtype)
            else:
                noise = torch.randn_like(init_latents)
            t3 = time.perf_counter()

            # Scheduler injects noise at correct sigma
            latents = self.scheduler.add_noise(init_latents, noise, latent_timestep)

            # Single UNet pass with scheduler.step() — correct for SD-Turbo
            for t in timesteps:
                latent_input = self.scheduler.scale_model_input(latents, t)
                noise_pred = self.unet(
                    latent_input, t,
                    encoder_hidden_states=self._prompt_embeds,
                ).sample
                latents = self.scheduler.step(noise_pred, t, latents).prev_sample
            t4 = time.perf_counter()

            # TAESD decode
            decoded = self.vae.decode(latents).sample
            decoded = (decoded * 0.5 + 0.5).clamp(0, 1)
            t5 = time.perf_counter()

        out = decoded[0].permute(1, 2, 0).float().cpu().unsqueeze(0)

        if self._frame_count % 60 == 1:
            logger.info(
                "[turbo4mac] prep=%.0f enc=%.0f noise=%.0f unet=%.0f dec=%.0f total=%.0fms (%.1f FPS) str=%.2f",
                (t1-t0)*1000, (t2-t1)*1000, (t3-t2)*1000, (t4-t3)*1000, (t5-t4)*1000,
                (t5-t0)*1000, 1/(t5-t0) if (t5-t0) > 0 else 0, strength)
        return {"video": out}

    def _call_pil(self, **kwargs) -> dict:
        """PIL fallback."""
        t0 = time.perf_counter()
        self._frame_count += 1
        strength = _cf(kwargs.get("strength", self.strength), 0.4, 0.1, 0.9)

        video = kwargs.get("video")
        if video is None or (isinstance(video, list) and len(video) == 0):
            pil_img = Image.new("RGB", (self.width, self.height), (128, 128, 128))
        else:
            frame = video[0] if isinstance(video, list) else video
            if isinstance(frame, torch.Tensor):
                if frame.dim() == 4: frame = frame[0]
                frame_np = frame.cpu().numpy()
            else:
                frame_np = np.asarray(frame)
            if frame_np.dtype != np.uint8:
                frame_np = (frame_np * 255).clip(0, 255).astype(np.uint8) if frame_np.max() <= 1.0 else frame_np.astype(np.uint8)
            pil_img = Image.fromarray(frame_np).resize((self.width, self.height), Image.BILINEAR)

        self._encode_prompt(self._get_prompt_text(kwargs))
        with torch.no_grad():
            result = self.pipe(
                prompt_embeds=self._prompt_embeds, image=pil_img,
                num_inference_steps=2, strength=strength,
                guidance_scale=0.0, output_type="pt",
            ).images[0]
        out = result.permute(1, 2, 0).float().cpu().unsqueeze(0)
        return {"video": out}

    def _frame_to_tensor(self, video) -> torch.Tensor:
        if video is None or (isinstance(video, list) and len(video) == 0):
            return torch.zeros(1, 3, self.height, self.width, dtype=torch.float16, device=self.device)
        frame = video[0] if isinstance(video, list) else video
        if isinstance(frame, torch.Tensor):
            if frame.dim() == 4: frame = frame[0]
            t = frame.to(device=self.device, dtype=torch.float16)
            t = t.permute(2, 0, 1).unsqueeze(0)
        else:
            frame_np = np.asarray(frame)
            if frame_np.dtype != np.uint8:
                frame_np = (frame_np * 255).clip(0, 255).astype(np.uint8)
            t = torch.from_numpy(frame_np).to(device=self.device, dtype=torch.float16)
            t = t.permute(2, 0, 1).unsqueeze(0)
        t = t / 127.5 - 1.0
        if t.shape[2] != self.height or t.shape[3] != self.width:
            t = F.interpolate(t, size=(self.height, self.width), mode="bilinear", align_corners=False)
        return t
