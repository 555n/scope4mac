# Scope4Mac

A fork of [Daydream Scope](https://github.com/daydreamlive/scope) ported to Apple Silicon MPS. Real-time AI video diffusion on a Mac with unified memory — no NVIDIA GPU, no cloud.

Built for a Daydream hackathon. March 2026.

## What Works

| Pipeline | FPS (M2 Max 96GB) | Resolution | Notes |
|---|---|---|---|
| **turbo4mac** | **~14 FPS** | 256x256 | SD-Turbo 1-step img2img + TAESD. GPU-native path. |
| **turbo4mac (PIL)** | ~13 FPS | 256x256 | Fallback path with PIL conversion. |
| **LongLive** | ~0.6 FPS | 320x576 | Wan2.1 1.3B autoregressive. Real output, slow. |
| **RIFE** | works | any | Frame interpolation postprocessor. 2-frame minimum. |
| **Preprocessors** | all work | any | passthrough, scribble, gray, optical flow, depth, controller-viz |

Krea (14B) and StreamDiffusionV2 load but are too slow for interactive use on MPS.

## What Doesn't Work (Yet)

- **RIFE target FPS menu**: Not implemented. RIFE works as a postprocessor but there's no UI to select target framerate (15/24/30/60).
- **In-app FPS verification**: The 14 FPS number is from isolated benchmarks. Full app context (WebRTC, Electron, pipeline_processor overhead) needs verification.

## How to Build

```bash
# Prerequisites
brew install node
curl -LsSf https://astral.sh/uv/install.sh | sh
pyenv install 3.12.8

# Clone and setup
git clone <this-repo> scope4mac-fork
cd scope4mac-fork
git checkout mac-mps-port
pyenv local 3.12.8

# Python backend
uv sync

# Frontend
cd frontend && npm install && npx vite build && cd ..

# Electron app → DMG
cd app && npm install && npm run dist:mac && cd ..

# Output: app/dist/DaydreamScope4Mac-arm64.dmg
```

## Dev Mode (no DMG rebuild)

```bash
# Terminal 1: Python backend
uv run daydream-scope --host 127.0.0.1 --port 8000 --no-browser

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Electron
cd app && npm run dev
```

## MPS Port — Lessons Learned

This is the valuable part for anyone porting PyTorch GPU code to Apple Silicon.

### The Dtype Wall

MPS does not support:
- `torch.float64` / `.double()` — crashes immediately
- `torch.float8_e4m3fn` — crashes immediately
- `torch.bfloat16` — partially supported, slow, mixed-dtype bugs

Every `float64` in the codebase (28 occurrences across 12 files) had to be replaced with `float32`. Every `fp8` weight file needed a `bf16` or `fp16` alternative. The text encoder shipped as `umt5-xxl-enc-fp8_e4m3fn.safetensors` — we added `models_t5_umt5-xxl-enc-bf16.pth` as an artifact and route to it on MPS.

### The Autocast Trap

The single biggest performance killer: `torch.amp.autocast(device_type="cpu")` was used everywhere as the non-CUDA fallback. This forces the entire VAE encode/decode to run on CPU even when MPS is available. Fix: `device_type = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")`. This one change moved VAE from ~800ms (CPU) to ~200ms (MPS).

### Flash Attention → SDPA

Flash attention (`flash_attn`) is CUDA-only. All imports wrapped with `if torch.cuda.is_available():` guards. Fallback: `torch.nn.functional.scaled_dot_product_attention` which works on MPS. Performance: ~5-10x slower than flash attention but functional.

### flex_attention is CUDA-Only

`torch.nn.attention.flex_attention` (used in all causal models) does not work on MPS. Required conditional imports + SDPA fallback at 9 call sites across 5 pipeline files. `create_block_mask` returns `None` on MPS; SDPA uses `is_causal=True` instead.

### torch.compile is a No-Op on MPS

The `inductor` backend doesn't support MPS. `mode="max-autotune-no-cudagraphs"` crashes. Set `mode="default"` on non-CUDA or skip compilation entirely. On NVIDIA, torch.compile provides ~2-3x speedup via kernel fusion — losing this is a major reason MPS is slower.

### grid_sample Padding Mode

`torch.nn.functional.grid_sample(padding_mode='border')` is not supported on MPS. Use `'zeros'` as fallback. This broke RIFE frame interpolation.

### Unified Memory Detection

```python
import os
total_bytes = os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")
total_gb = total_bytes / (1024**3)
```

This reports the full unified memory pool (96GB on M2 Max). Used for pipeline registration — pipelines with `estimated_vram_gb` requirements are filtered against this.

### The Scheduler Index Bug

`EulerAncestralDiscreteScheduler.step()` with `num_inference_steps=1` crashes with `IndexError: index 2 is out of bounds for dimension 0 with size 2` — it tries to access `sigmas[step_index + 1]`. Workaround: use `num_inference_steps=2` with `strength=0.5` to get 1 actual UNet pass through the scheduler without the crash.

### PIL Overhead (Solved)

Converting tensors to PIL and back costs ~30-40ms per frame. The v0.7.0 GPU-native path eliminates this: input tensor stays on MPS, resize via `F.interpolate`, TAESD encode/decode on device, single CPU transfer at output. Result: 72ms/frame (14 FPS) vs 77ms/frame (13 FPS PIL path).

The noise bug that plagued earlier low-level attempts (v0.3.5, v0.4.8) was caused by not resetting the scheduler state between frames (`set_timesteps` + `set_begin_index` must be called each frame) and incorrect input normalization (must be [-1, 1], not [0, 255] or [0, 1]).

## Architecture

```
Daydream Scope4Mac (Electron + React + Python)
├── app/                    # Electron shell (macOS arm64 DMG)
├── frontend/               # React/TypeScript UI (Frutiger Aero skin)
├── src/scope/
│   ├── server/             # FastAPI + WebRTC + pipeline manager
│   └── core/pipelines/
│       ├── turbo4mac/      # NEW: SD-Turbo + TAESD (fast)
│       ├── longlive/       # Wan2.1 1.3B (quality)
│       ├── streamdiffusionv2/
│       ├── krea_realtime_video/
│       ├── rife/           # Frame interpolation
│       └── wan2_1/         # Shared model components
└── build-mac.sh            # Build script
```

## Models (~16GB on disk)

| Model | Size | Used by |
|---|---|---|
| SD-Turbo (UNet + CLIP) | ~3.5 GB | turbo4mac |
| TAESD (tiny VAE) | ~5 MB | turbo4mac |
| Wan2.1-T2V-1.3B | ~3 GB | LongLive, StreamDiffusionV2, MemFlow, RewardForcing |
| UMT5-XXL (bf16) | ~11 GB | All Wan2.1 pipelines |
| Wan2.1 VAE | ~300 MB | All Wan2.1 pipelines |
| RIFE HDv3 | ~30 MB | RIFE postprocessor |

All models auto-download from HuggingFace on first use. Cached at `~/.daydream-scope/models/`.

## Performance Notes

Raw UNet forward pass benchmarks on M2 Max 96GB:

| Model | Resolution | Latent | Time | FPS |
|---|---|---|---|---|
| SD-Turbo (866M) | 256x256 | 32x32 | 85ms | 12 |
| SD-Turbo (866M) | 512x512 | 64x64 | ~300ms | 3.3 |
| Wan2.1 1.3B | 320x576 | 40x72 | ~1.9s | 0.5 |

End-to-end turbo4mac benchmarks (TAESD encode + UNet + TAESD decode + scheduling):

| Path | Resolution | Time | FPS |
|---|---|---|---|
| GPU-native | 256x256 | 72ms | 14 |
| PIL fallback | 256x256 | 77ms | 13 |

In-app FPS may be lower due to WebRTC framing and pipeline_processor overhead.

## Credits

- [Daydream](https://daydream.live) — Scope platform
- [Stability AI](https://stability.ai) — SD-Turbo model
- [madebyollin](https://huggingface.co/madebyollin) — TAESD tiny autoencoder
- Port by: Claude Opus 4.6 + Gemini (architecture) + Codex (dtype fixes)
- Aesthetic spec: 555n-construct aesthetics-librarian (Frutiger Aero knowledge)

## License

Same as upstream Scope — MIT.
