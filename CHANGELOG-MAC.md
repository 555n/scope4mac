# Scope4Mac Changelog

## 0.7.0-mac (2026-03-17)

### RIFE target FPS buffering
- **Target FPS menu**: Set desired output framerate (24/30/60/120). RIFE auto-computes multiplier from measured input FPS.
- **Recursive interpolation**: 2x/4x/8x via repeated midpoint subdivision. Each pass is a single batched model call.
  - 2x: +6ms (28 FPS with 14 FPS input)
  - 4x: +12ms (56 FPS with 14 FPS input)
  - 8x: +21ms (112 FPS with 14 FPS input)
- **Schema-driven UI**: `target_fps` runtime parameter auto-renders in postprocessor settings panel. No custom frontend code.
- **MPS autocast fix**: float16 autocast on MPS (was defaulting to float32, triggering warning)

### GPU-native turbo4mac path — 14 FPS
- **Fixed noise bug**: Low-level GPU-native path now produces correct output
  - Root cause: scheduler `_step_index` not reset between frames + input normalization mismatch
  - Fix: call `set_timesteps()` + `set_begin_index()` each frame, normalize input to [-1, 1]
- **GPU-native path**: No PIL, no CPU round-trips. 14 FPS at 256x256 on M2 Max
  - Tensor stays on MPS throughout: input → TAESD encode → UNet → TAESD decode → output
  - `torch.mps.synchronize()` at frame boundary prevents async corruption
  - F.interpolate for GPU-native resize (replaces PIL.resize)
- **Dual path**: `use_gpu_native` load param (default True). PIL fallback still available.
- **MPS env setup**: Pipeline auto-sets `PYTORCH_ENABLE_MPS_FALLBACK` and `PYTORCH_MPS_HIGH_WATERMARK_RATIO`

## 0.2.0-mac (2026-03-17)

### Critical: Inference now produces output
- **Fix VAE decode `.to("cuda")` hardcode** — replaced with `latent.device`, VAE now decodes on MPS
- **Fix VAE dtype** — use float16 on MPS (bfloat16 has limited MPS support)

### Critical: float64 elimination (28 occurrences across 12 files)
- All `torch.float64` replaced with `torch.float32` in pipeline code
- All `.double()` replaced with `.float()` in scheduler/generator
- MPS does not support float64 — every occurrence crashed inference

### Critical: fp8 text encoder
- Added bf16 text encoder artifact (`models_t5_umt5-xxl-enc-bf16.pth`)
- `_get_text_encoder_path()` selects bf16 on MPS, fp8 on CUDA
- Safety cast: any remaining fp8 tensors converted to fp16 during load

### Critical: flex_attention (CUDA-only)
- All 5 causal_model.py files: conditional import with `_USE_FLEX_ATTENTION`
- SDPA fallback (`scaled_dot_product_attention`) on MPS for all 9 call sites
- `create_block_mask` returns None on MPS, SDPA uses `is_causal=True`
- torch.compile skipped on non-CUDA (no inductor backend for MPS)

### Core MPS port
- `get_device()`: CUDA -> MPS -> CPU fallback chain
- Flash attention: conditional import, SDPA fallback when unavailable
- FP8 quantization: skipped on non-CUDA, model moved to device in fp16
- torch.compile mode: "default" instead of "max-autotune-no-cudagraphs"
- `torch.cuda.empty_cache()`: guarded in VACE model
- `torch.cuda.amp`: all imports wrapped in try/except, autocast device-agnostic

### Unified memory detection
- `_get_gpu_vram_gb()` reads Apple Silicon unified memory via `os.sysconf`
- Hardware info endpoint reports MPS allocated memory
- All 5 diffusion pipelines register (96GB > 20GB requirement)
- Memory gauge in UI header (polls every 5s)

### Rebranding
- Product name: Daydream Scope4Mac
- App ID: live.daydream.scope4mac
- All artifact names updated

---

## 0.1.7 (upstream)

Base Daydream Scope release (Windows/Linux, CUDA only).
