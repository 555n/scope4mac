/**
 * FrameSyncopationTrack — 4-beat frame displacement control.
 *
 * Each beat column has a draggable region. Solid yellow fill shows
 * displacement amount with a thick yellow line at the target edge.
 * Continuous (no snapping). Playhead wraps cleanly without snap-back.
 */

import { useCallback, useRef } from "react";
import { ABLETON_COLORS, ABLETON_FONTS } from "../lib/AbletonStyles";

const TOOLTIP_TEXT =
  "Frame Syncopation \u2014 Drag to displace generated frames from beat onset.";

interface FrameSyncopationTrackProps {
  offsets: [number, number, number, number];
  barProgress: number;
  active: boolean;
  onChange: (offsets: [number, number, number, number]) => void;
}

export function FrameSyncopationTrack({
  offsets,
  barProgress,
  active,
  onChange,
}: FrameSyncopationTrackProps) {
  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);
  const offsetsRef = useRef(offsets);
  offsetsRef.current = offsets;
  const prevBarProgress = useRef(barProgress);

  // Detect bar wrap (progress jumps backward by more than 0.5 = new bar)
  const isWrapping = barProgress < prevBarProgress.current - 0.5;
  prevBarProgress.current = barProgress;

  const startDrag = useCallback(
    (beatIdx: number, e: React.MouseEvent) => {
      e.preventDefault();
      const track = trackRefs.current[beatIdx];
      if (!track) return;
      const rect = track.getBoundingClientRect();

      const updateOffset = (clientX: number) => {
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        // Map full width to 0.0-0.75, continuous (no snapping)
        const value = Math.round(ratio * 0.75 * 1000) / 1000; // 3 decimal precision, no grid snap
        const clamped = Math.max(0, Math.min(0.75, value));
        const next = [...offsetsRef.current] as [number, number, number, number];
        next[beatIdx] = clamped;
        onChange(next);
      };

      const onMove = (ev: MouseEvent) => updateOffset(ev.clientX);
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      updateOffset(e.clientX);
    },
    [onChange],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        title={TOOLTIP_TEXT}
        style={{
          fontFamily: ABLETON_FONTS.ui,
          fontSize: 10,
          fontWeight: 600,
          color: ABLETON_COLORS.textSecondary,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          paddingLeft: 2,
          cursor: "default",
        }}
      >
        Frame Sync
      </div>

      <div
        title={TOOLTIP_TEXT}
        style={{
          display: "flex",
          position: "relative",
          background: ABLETON_COLORS.retroDisplayBg,
          border: `1px solid ${ABLETON_COLORS.border}`,
          borderRadius: 2,
          height: 48,
          overflow: "hidden",
          cursor: "default",
        }}
      >
        {/* Playhead — no transition on bar wrap, smooth otherwise */}
        {active && (
          <div
            style={{
              position: "absolute",
              left: `${barProgress * 100}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: ABLETON_COLORS.playGreen,
              opacity: 0.7,
              zIndex: 5,
              // No transition on wrap (prevents elastic snap-back)
              transition: isWrapping ? "none" : "left 0.06s linear",
              pointerEvents: "none",
            }}
          />
        )}

        {offsets.map((offset, beatIdx) => {
          const fillPct = offset <= 0 ? 0 : (offset / 0.75) * 100;

          return (
            <div
              key={beatIdx}
              ref={(el) => { trackRefs.current[beatIdx] = el; }}
              onMouseDown={(e) => startDrag(beatIdx, e)}
              style={{
                flex: 1,
                position: "relative",
                borderRight: beatIdx < 3 ? `1px solid ${ABLETON_COLORS.lcdLine}` : "none",
                cursor: "ew-resize",
              }}
            >
              {/* 16th grid lines */}
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  style={{
                    position: "absolute",
                    left: `${(s / 4) * 100}%`,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: "rgba(255,255,255,0.05)",
                    pointerEvents: "none",
                  }}
                />
              ))}

              {/* Beat number */}
              <div
                style={{
                  position: "absolute",
                  top: 2,
                  left: 4,
                  fontFamily: ABLETON_FONTS.mono,
                  fontSize: 9,
                  color: ABLETON_COLORS.textMuted,
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              >
                {beatIdx + 1}
              </div>

              {/* Solid yellow fill — 80% opacity */}
              {fillPct > 0 && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${fillPct}%`,
                    background: active
                      ? "rgba(247, 167, 56, 0.2)"
                      : "rgba(127, 127, 127, 0.15)",
                    zIndex: 2,
                    pointerEvents: "none",
                  }}
                />
              )}

              {/* Thick bright yellow target line at fill edge */}
              {fillPct > 0 && (
                <div
                  style={{
                    position: "absolute",
                    left: `${fillPct}%`,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    marginLeft: -1,
                    background: active ? "#F7A738" : "#888",
                    zIndex: 3,
                    pointerEvents: "none",
                    boxShadow: active ? "0 0 6px rgba(247, 167, 56, 0.5)" : "none",
                  }}
                />
              )}

              {/* Offset value */}
              <div
                style={{
                  position: "absolute",
                  bottom: 2,
                  right: 4,
                  fontFamily: ABLETON_FONTS.mono,
                  fontSize: 8,
                  color: active ? ABLETON_COLORS.accent : ABLETON_COLORS.textMuted,
                  pointerEvents: "none",
                  userSelect: "none",
                  opacity: 0.8,
                }}
              >
                {offset <= 0 ? "0" : `+${(offset * 4).toFixed(1)}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
