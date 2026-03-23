# Ableton Link Integration

Technical specification for the Ableton Link implementation in Scope4Mac.

## Overview

Scope4Mac joins the Ableton Link session as a peer on the local network. It synchronises with Live, Resolume, TouchDesigner, or any Link-enabled application. The integration provides beat state to all pipeline nodes and drives the 16-step parameter sequencer.

## Backend

### Link Source (src/scope/server/tempo_sources/link.py)

- Uses aalink (async Python wrapper for Ableton Link)
- Polls Link state at 100Hz in an asyncio task
- Caches BeatState: bpm, beat_phase (0-1 within beat), bar_position (0-quantum), beat_count (monotonic), is_playing, timestamp
- link.quantum set to beats_per_bar (default 4)
- link.start_stop_sync_enabled = True for transport sync

### Tempo Sync (src/scope/server/tempo_sync.py)

- Pushes beat state to frontend sessions at 15Hz via WebRTC data channel
- Notification includes: bpm, beat_phase, bar_position, beat_count, is_playing, beats_per_bar, current_step (0-15), sequencer_values
- current_step computed as floor(bar_position / beats_per_bar * 16) % 16

### Pipeline Processor (src/scope/server/pipeline_processor.py)

Beat state injected into call_params on every process_chunk():
- bpm, beat_phase, bar_position, beat_count, is_playing, beats_per_bar
- Beat-reactive modulation: seed jump + strength envelope on beat boundaries
- Subdivision options: beat, 8th, half, bar, 2bar, 4bar
- Step sequencer applied after beat modulation

## Frontend

### Playhead (frontend/src/hooks/useAnimatedPlayhead.ts)

60fps playhead driven by client-side extrapolation from Link's linear timeline model:

  elapsed = (performance.now() - anchor.timestamp) / 1000
  beatsElapsed = elapsed * (bpm / 60)
  currentBarPos = (anchor.barPosition + beatsElapsed) % beatsPerBar
  progress = currentBarPos / beatsPerBar

The anchor is a TempoAnchor ref updated at 15Hz from the data channel. The rAF loop reads it and writes directly to DOM (element.style.left). Zero React re-renders for animation.

### Link Drawer (frontend/src/components/LinkDrawer.tsx)

- Auto-enables Link when drawer opens (if Link source available)
- Auto-adds Link Sync node to postprocessor chain when Link engages
- Interactive BPM: double-click to type a value, vertical drag to adjust in real time
- Displays: BPM, beat dot indicator, bar position, beat count, peer count

### TempoAnchor Type

  interface TempoAnchor {
    barPosition: number    // 0..beatsPerBar from last backend update
    bpm: number
    beatsPerBar: number
    timestamp: number      // performance.now() at receipt
    isPlaying: boolean
  }

## Link Sync Node

The Link Sync postprocessor (src/scope/core/pipelines/link_sync/) is a pure passthrough that provides the Link parameter schema/UI. Beat-gated frame output is handled by the pipeline processor layer, not by the node itself.

Auto-added to the postprocessor chain when Ableton Link is enabled. Inserted before other postprocessors.

## aalink API Reference

Properties (read from Link session):
- link.beat: monotonically increasing float, never wraps
- link.phase: 0..quantum, wraps at quantum (quantum = beats_per_bar)
- link.tempo: current session BPM
- link.playing: True when Ableton transport is playing (False when stopped, but clock still runs)
- link.num_peers: number of Link peers on the network

Properties are non-atomic reads — can be inconsistent between calls. The 100Hz poll caches a consistent snapshot.

## Performance

- Link poll: 100Hz asyncio task, negligible CPU
- Tempo notification: 15Hz data channel push, ~200 bytes per message
- Playhead: 60fps rAF, pure DOM write, <0.1ms per frame
- Step advancement: integer arithmetic in process_chunk(), <0.01ms per frame
