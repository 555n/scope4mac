/**
 * FrameGateTrack — 16-step binary gate pattern.
 *
 * Each step is a toggle: open (releases a buffered frame on beat)
 * or closed (holds previous frame). Click to toggle. All-on by default.
 * Playhead driven at 60fps by useAnimatedPlayhead.
 */

import { type RefObject } from "react";
import { ABLETON_COLORS, ABLETON_FONTS } from "../lib/AbletonStyles";
import { useAnimatedPlayhead, type TempoAnchor } from "../hooks/useAnimatedPlayhead";

interface FrameSyncopationTrackProps {
  offsets: number[];
  tempoAnchor: RefObject<TempoAnchor>;
  active: boolean;
  onChange: (offsets: number[]) => void;
}

export function FrameSyncopationTrack({
  offsets,
  tempoAnchor,
  active,
  onChange,
}: FrameSyncopationTrackProps) {
  // Ensure 16 steps
  const gates = offsets.length === 16
    ? offsets
    : Array.from({ length: 16 }, (_, i) => offsets[i] ?? 1);

  const playheadRef = useAnimatedPlayhead(tempoAnchor, active);

  const toggle = (idx: number) => {
    const next = [...gates];
    next[idx] = next[idx] > 0 ? 0 : 1;
    onChange(next);
  };

  return (
    <div style={{ display: "flex", gap: 0, height: 40 }}>
      {/* Label */}
      <div
        style={{
          width: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: 6,
        }}
      >
        <span
          style={{
            fontFamily: ABLETON_FONTS.ui,
            fontSize: 9,
            fontWeight: 600,
            color: active ? ABLETON_COLORS.textSecondary : ABLETON_COLORS.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}
        >
          Gate
        </span>
      </div>

      {/* 16 step toggles */}
      <div
        style={{
          flex: 1,
          display: "flex",
          position: "relative",
          background: ABLETON_COLORS.retroDisplayBg,
          border: `1px solid ${ABLETON_COLORS.border}`,
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        {/* Playhead */}
        {active && (
          <div
            ref={playheadRef}
            style={{
              position: "absolute",
              left: "0%",
              top: 0,
              bottom: 0,
              width: 1,
              background: ABLETON_COLORS.playGreen,
              opacity: 0.7,
              zIndex: 5,
              pointerEvents: "none",
            }}
          />
        )}

        {gates.map((val, idx) => {
          const isOpen = val > 0;
          const isBeat = idx > 0 && idx % 4 === 0;

          return (
            <div
              key={idx}
              onClick={() => toggle(idx)}
              style={{
                flex: 1,
                position: "relative",
                cursor: "pointer",
                borderLeft: isBeat
                  ? `2px solid ${ABLETON_COLORS.lcdLine}`
                  : idx > 0
                    ? `1px solid rgba(255,255,255,0.04)`
                    : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Gate block — filled when open */}
              <div
                style={{
                  width: "70%",
                  height: "60%",
                  borderRadius: 2,
                  background: isOpen
                    ? (active ? ABLETON_COLORS.accent : "#666")
                    : "transparent",
                  border: `1px solid ${isOpen
                    ? (active ? ABLETON_COLORS.accent : "#666")
                    : "rgba(255,255,255,0.1)"}`,
                  transition: "background 0.05s",
                }}
              />

              {/* Beat number every 4 steps */}
              {idx % 4 === 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: 1,
                    left: 2,
                    fontFamily: ABLETON_FONTS.mono,
                    fontSize: 7,
                    color: ABLETON_COLORS.textMuted,
                    pointerEvents: "none",
                    userSelect: "none",
                    opacity: 0.6,
                  }}
                >
                  {idx / 4 + 1}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
