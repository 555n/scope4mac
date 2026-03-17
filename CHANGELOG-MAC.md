# Scope4Mac Changelog

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
