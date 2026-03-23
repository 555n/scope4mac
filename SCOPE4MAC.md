# Scope4Mac

macOS port of Daydream Scope with Ableton Link integration, beat-synced parameter sequencing, and a live-performance-oriented processing pipeline.

## What It Does

Scope4Mac turns Daydream Scope into a beat-locked visual instrument. Diffusion parameters, processing effects, and frame timing synchronise to Ableton Link's shared tempo grid across any Link-enabled application on the network.

## Core Features

### Ableton Link Integration
- Joins the Link session as a peer — syncs with Ableton Live, Resolume, TouchDesigner, or any Link-enabled app
- Beat state (BPM, phase, bar position, transport) available to all pipeline nodes
- Beat-reactive modulation: seed jumps and strength envelopes fire on beat boundaries
- Configurable subdivision: quarter, eighth, half, bar, 2-bar, 4-bar
- Interactive BPM control: double-click to type, vertical drag to adjust in real time

### 16-Step Parameter Sequencer
- Sixteenth-note resolution (16 steps per bar) locked to Link's beat clock
- Each step carries a value (0-100) and a random deviation (0-100), scaled to the parameter's actual range
- Hardwired tracks for diffusion strength and seed
- Dynamic tracks auto-populate from active pipeline nodes — add a node, its runtime parameters appear as sequencer tracks; remove it, they disappear
- Pattern state persists across stop/start cycles
- Backend-authoritative step advancement from Link's linear timeline model
- 60fps playhead via client-side BPM extrapolation (requestAnimationFrame, zero React re-renders)

### Pipeline Hot-Swap
- Add, remove, and reorder pre/postprocessor nodes during live streaming
- Backend rebuilds the pipeline graph without dropping the WebRTC connection
- Unloaded pipelines are loaded on demand during hot-swap
- Frame flow resumes within ~300ms

### Prompt Timeline

Rebuilt the prompt timeline with DAW-style editing tools:
- **Scissors tool** — click on a prompt clip to split it at that point
- **Hand tool** — drag to pan the timeline view
- **Select tool** — click to select, drag to move clips in time
- **Live prompt tracking** — the active prompt block extends its right edge to track the current playback position in real time
- **Double-click to edit** — inline text editing on prompt clips
- Clips are draggable, splittable, and deletable during both playback and idle
- Aqua-styled toolbar for tool selection

Note: the timeline editor has a known regression in the current build. The underlying prompt submission and transition system (weight blending, temporal interpolation) works during streaming.

### Processing Nodes (6 published)
- **RIFE-Buffered** — frame interpolation via RIFE HDv3, auto (target FPS) and manual (2x-16x) modes
- **RIFE-Varispeed** — adaptive interpolation with MPS-optimised 8x cap
- **Fast Bloom** — GPU bloom/glow via bilinear downsample-upsample, zero convolution overhead
- **Kaleidoscope** — N-fold radial symmetry via polar coordinate folding, with rotation, zoom, and center control
- **Feedback** — TouchDesigner-style frame buffer with mix and decay for trails and ghosting
- **Invert** — colour inversion with mix control

All nodes work as both preprocessor and postprocessor. All parameters are runtime-controllable and sequenceable.

### Dynamic Parameter Surface
- Runtime parameters from active pipeline nodes are automatically registered as OSC paths
- The sequencer UI, OSC input, and REST API all address the same parameter set
- Adding or removing a node updates the available parameter surface instantly
- Foundation for external control via Max for Live, TouchDesigner, or any OSC-capable application

### Seed LFO
- Time-based seed modulation with configurable frequency (Hz or ms) and depth
- Counter resets on toggle for predictable behaviour
- Independent of beat sync — continuous modulation alongside step-sequenced values

### UI
- macOS Aqua-styled interface: brushed aluminum menu bar, floating utility windows, traffic light controls
- System gauges: CPU (load average), GPU (IOKit device utilisation), unified memory
- Floating windows constrained to viewport bounds
- Ableton-styled sequencer with beat grid, step highlighting, and per-track enable

## Technical Details

- **Platform**: macOS (Apple Silicon MPS), Electron desktop app
- **Diffusion**: SD-Turbo + TAESD via Turbo4Mac pipeline (~6 FPS generation on M2 Max)
- **Transport**: Ableton Link via aalink (async Python wrapper), 100Hz poll, 15Hz frontend notification
- **Playhead**: Client-side linear extrapolation from Link's timeline model (BeatTime = HostTime × Tempo)
- **Sequencer engine**: Thread-safe, lock-protected, applies values per-frame from authoritative beat clock
- **Hot-swap**: graph_executor rebuilds pipeline DAG, pipeline_manager loads nodes on demand
- **Video I/O**: WebRTC (WHIP/WHEP), with live track replacement for video file hot-swap
- **OSC**: Always-on UDP server on same port as HTTP API, validates against dynamic path inventory
- **Parameter coercion**: Pydantic TypeAdapter at WebRTC boundary for type-safe enum/int/float conversion

## Roadmap

- **Max for Live devices** — audio-reactive OSC control surface. M4L devices auto-discover available Scope parameters via REST API, send analysis-derived values (envelope follower, spectral centroid, onset detection, band energy) directly to pipeline parameters via OSC. Modular architecture: one discovery device, multiple analysis-to-parameter mappers.
- **Parameter envelopes** — declarative keyframe definitions sent as a whole pattern. Backend interpolates against local beat clock. Frontend shows preview aligned via shared Link phase reference.
- **Graph-level transport controller** — sequencer as a controller above the pipeline DAG, not a node within it. Addresses nodes by ID, propagates flush signals downstream for hard transitions (LoRA swaps, pipeline switches).
- **RIFE structural fixes** — input FPS measurement at queue boundary, multi-frame chunk preservation, Pydantic enum coercion (designed, deferred for stability)
- **Cloud inference Link bridge** — internal metronome for cloud mode where Link UDP multicast is unavailable

## Published Nodes

| Node | Install |
|------|---------|
| RIFE-Buffered | `git+https://github.com/555n/scope-rife-buffered.git` |
| RIFE-Varispeed | `git+https://github.com/555n/scope-rife-varispeed.git` |
| Fast Bloom | `git+https://github.com/555n/scope-fast-bloom.git` |
| Kaleidoscope | `git+https://github.com/555n/scope-kaleidoscope.git` |
| Feedback | `git+https://github.com/555n/scope-feedback.git` |
| Invert | `git+https://github.com/555n/scope-invert.git` |

## License

MIT
