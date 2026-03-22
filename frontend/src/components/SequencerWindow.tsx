/**
 * SequencerWindow — Multitrack beat sequencer in Ableton aesthetic.
 *
 * OS X Aqua title bar, Ableton-styled body. Horizontal layout.
 * Contains persistent Frame Syncopation track.
 * RIFE-Varispeed easing is derived from frame offsets (no user controls).
 */

import { FloatingWindow } from "./FloatingWindow";
import { FrameSyncopationTrack } from "./FrameSyncopationTrack";
import { ABLETON_COLORS } from "../lib/AbletonStyles";

interface SequencerWindowProps {
  open: boolean;
  onClose: () => void;
  frameOffsets: [number, number, number, number];
  onFrameOffsetsChange: (offsets: [number, number, number, number]) => void;
  barProgress: number;
  beatSyncActive: boolean;
}

export function SequencerWindow({
  open,
  onClose,
  frameOffsets,
  onFrameOffsetsChange,
  barProgress,
  beatSyncActive,
}: SequencerWindowProps) {
  return (
    <FloatingWindow
      id="sequencer"
      title="Sequencers"
      open={open}
      onClose={onClose}
      width={560}
      defaultX={60}
      defaultY={120}
      bodyBackground={ABLETON_COLORS.surfaceBg}
      bodyStyle={{ padding: 12, minHeight: 80 }}
    >
      <FrameSyncopationTrack
        offsets={frameOffsets}
        barProgress={barProgress}
        active={beatSyncActive}
        onChange={onFrameOffsetsChange}
      />
    </FloatingWindow>
  );
}
