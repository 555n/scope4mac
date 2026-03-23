# 16-Step Parameter Sequencer

Technical specification for the beat-synced parameter sequencer in Scope4Mac.

## Overview

The sequencer is a 16-step pattern engine that modulates pipeline parameters on the beat grid. It operates at sixteenth-note resolution (16 steps per bar in 4/4 time) and is locked to Ableton Link's shared tempo.

## Data Model

Each step carries two values:
- Value (0-100): the parameter setting, linearly scaled to the parameter's actual range
- Random (0-100): deviation percentage. The actual value is offset by a random amount within this range each frame.

Tracks are either hardwired (strength, seed — always present) or dynamic (auto-populated from active pipeline node schemas).

## Step Advancement

The backend computes the current step from Link's authoritative beat position:

  step = floor(bar_position / beats_per_bar * 16) % 16

This runs in pipeline_processor.process_chunk() on every frame. The step index is included in the 15Hz tempo_update notification for frontend visualisation.

## Value Application

For each active track, per frame:

  base = param_min + (step.value / 100) * (param_max - param_min)
  if step.random > 0:
    max_deviation = (param_max - param_min) * (step.random / 100) * 0.5
    base += uniform(-max_deviation, +max_deviation)
  actual = clamp(base, param_min, param_max)

The computed value overrides call_params[param_key] before it reaches the pipeline.

## Sequencer vs Beat Envelope

When the sequencer has an active track for "strength", the existing beat-reactive strength envelope (cosine decay between beats) is bypassed. The sequencer takes full control of the parameter.

## Pattern Lifecycle

- Frontend sends the full pattern (all tracks, all 16 steps) to the backend via the WebRTC data channel as a sequencer_pattern message
- Backend stores the pattern in StepSequencerEngine (thread-safe, lock-protected)
- Pattern persists across stop/start cycles (frontend state survives, re-sent on stream start)
- Dynamic tracks appear/disappear as pipeline nodes are added/removed — derived from pipeline schemas, not from the OSC paths API

## Backend

StepSequencerEngine (src/scope/server/step_sequencer.py):
- update_pattern(tracks): receives pattern from frontend
- apply(current_step, call_params): overrides call_params with computed values
- get_current_values(): returns actual computed values for real-time visualisation
- has_active_track(param_key): checks if a parameter is under sequencer control

## Frontend

useStepSequencer hook (frontend/src/hooks/useStepSequencer.ts):
- Manages pattern state (tracks, steps, enabled flags)
- Debounced send to backend (100ms) via sendParameterUpdate
- Re-sends pattern on stream start (500ms delay for data channel establishment)

StepSequencerTrack component (frontend/src/components/StepSequencerTrack.tsx):
- 16 vertical columns with value fill and random deviation overlay
- Click/drag sets value, shift+drag sets random
- Active step highlighted (green column background)
- Beat boundary markers every 4 steps

useOscPaths hook (frontend/src/hooks/useOscPaths.ts):
- Derives available parameters from pipeline schemas (not OSC API)
- Responds instantly to node add/remove regardless of streaming state
- Filters out base schema fields and hardwired parameters
