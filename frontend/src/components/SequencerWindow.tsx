/**
 * SequencerWindow — Multitrack beat sequencer.
 *
 * Contains:
 * 1. Frame Syncopation track (4-beat frame offsets)
 * 2. Strength step sequencer (hardwired, 16 steps)
 * 3. Seed step sequencer (hardwired, 16 steps)
 * 4. Seed LFO controls (compact inline)
 * 5. Dynamic tracks from active pipeline params
 */

import { useEffect, useRef, type RefObject } from "react";
import { FloatingWindow } from "./FloatingWindow";
import { FrameSyncopationTrack } from "./FrameSyncopationTrack";
import { StepSequencerTrack } from "./StepSequencerTrack";
import { ABLETON_COLORS, ABLETON_FONTS } from "../lib/AbletonStyles";
import type { TempoAnchor } from "../hooks/useAnimatedPlayhead";
import type { SequencerTrack } from "../hooks/useStepSequencer";
import type { OscParam } from "../hooks/useOscPaths";

interface SequencerWindowProps {
  open: boolean;
  onClose: () => void;
  frameOffsets: [number, number, number, number];
  onFrameOffsetsChange: (offsets: [number, number, number, number]) => void;
  tempoAnchor: RefObject<TempoAnchor>;
  beatSyncActive: boolean;
  // Step sequencer
  tracks: SequencerTrack[];
  currentStep: number;
  sequencerValues: Record<string, number>;
  onStepChange: (trackIdx: number, stepIdx: number, value: number, random: number) => void;
  onTrackEnabled: (trackIdx: number, enabled: boolean) => void;
  // Dynamic tracks
  activeParams: OscParam[];
  onAddDynamicTrack: (key: string, label: string, range: [number, number], isInt: boolean) => void;
  onRemoveDynamicTrack: (key: string) => void;
}

export function SequencerWindow({
  open,
  onClose,
  frameOffsets,
  onFrameOffsetsChange,
  tempoAnchor,
  beatSyncActive,
  tracks,
  currentStep,
  sequencerValues,
  onStepChange,
  onTrackEnabled,
  activeParams,
  onAddDynamicTrack,
  onRemoveDynamicTrack,
}: SequencerWindowProps) {
  // Auto-add/remove dynamic tracks when activeParams change
  // Use ref for tracks to avoid infinite effect loop (tracks changes → effect → add track → tracks changes)
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  useEffect(() => {
    const hardwired = new Set(["strength", "seed"]);
    const activeKeys = new Set(activeParams.map((p) => p.key));
    const trackKeys = new Set(tracksRef.current.map((t) => t.paramKey));

    for (const p of activeParams) {
      if (!hardwired.has(p.key) && !trackKeys.has(p.key)) {
        onAddDynamicTrack(p.key, p.label || p.key, [p.min ?? 0, p.max ?? 1], p.type === "integer");
      }
    }

    for (const t of tracksRef.current) {
      if (!hardwired.has(t.paramKey) && !activeKeys.has(t.paramKey)) {
        onRemoveDynamicTrack(t.paramKey);
      }
    }
  }, [activeParams, onAddDynamicTrack, onRemoveDynamicTrack]);

  return (
    <FloatingWindow
      id="sequencer"
      title="Sequencers"
      open={open}
      onClose={onClose}
      width={680}
      defaultX={60}
      defaultY={120}
      bodyBackground={ABLETON_COLORS.surfaceBg}
      bodyStyle={{ padding: 12, minHeight: 80 }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Frame Syncopation — existing 4-beat track */}
        <FrameSyncopationTrack
          offsets={frameOffsets}
          tempoAnchor={tempoAnchor}
          active={beatSyncActive}
          onChange={onFrameOffsetsChange}
        />

        {/* Divider */}
        <div style={{ height: 1, background: ABLETON_COLORS.border, margin: "2px 0" }} />

        {/* Step sequencer tracks */}
        {tracks.map((track, idx) => (
          <StepSequencerTrack
            key={track.paramKey}
            label={track.label}
            paramKey={track.paramKey}
            steps={track.steps}
            enabled={track.enabled}
            currentStep={currentStep}
            onStepChange={(stepIdx, value, random) =>
              onStepChange(idx, stepIdx, value, random)
            }
            onEnabledChange={(enabled) => onTrackEnabled(idx, enabled)}
          />
        ))}

        {/* Dynamic tracks section header (when there are dynamic params) */}
        {tracks.length > 2 && (
          <div
            style={{
              fontFamily: ABLETON_FONTS.ui,
              fontSize: 8,
              color: ABLETON_COLORS.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              paddingTop: 4,
            }}
          >
            Pipeline Parameters
          </div>
        )}
      </div>
    </FloatingWindow>
  );
}
