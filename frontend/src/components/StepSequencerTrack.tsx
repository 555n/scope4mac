/**
 * StepSequencerTrack — 16-step dual-slider parameter track.
 *
 * Each step has a value (0-100) and random deviation (0-100).
 * Click/drag sets value. Shift+drag sets random.
 * Active step highlighted. Actual value shown as moving indicator.
 */

import { useCallback, useRef } from "react";
import { ABLETON_COLORS, ABLETON_FONTS } from "../lib/AbletonStyles";

interface StepSequencerTrackProps {
  label: string;
  paramKey: string;
  steps: Array<{ value: number; random: number }>;
  enabled: boolean;
  currentStep: number;
  onStepChange: (stepIdx: number, value: number, random: number) => void;
  onEnabledChange: (enabled: boolean) => void;
}

export function StepSequencerTrack({
  label,
  steps,
  enabled,
  currentStep,
  onStepChange,
  onEnabledChange,
}: StepSequencerTrackProps) {
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const columnRefs = useRef<(HTMLDivElement | null)[]>([]);

  const startDrag = useCallback(
    (stepIdx: number, e: React.MouseEvent) => {
      e.preventDefault();
      const col = columnRefs.current[stepIdx];
      if (!col) return;
      const isRandom = e.shiftKey;

      const updateFromMouse = (clientY: number, idx: number) => {
        const rect = columnRefs.current[idx]?.getBoundingClientRect();
        if (!rect) return;
        const ratio = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
        const val = Math.round(ratio * 100);
        const step = stepsRef.current[idx];
        if (isRandom) {
          onStepChange(idx, step.value, val);
        } else {
          onStepChange(idx, val, step.random);
        }
      };

      // Allow dragging across columns
      const onMove = (ev: MouseEvent) => {
        // Find which column the mouse is over
        for (let i = 0; i < 16; i++) {
          const r = columnRefs.current[i]?.getBoundingClientRect();
          if (r && ev.clientX >= r.left && ev.clientX <= r.right) {
            updateFromMouse(ev.clientY, i);
            break;
          }
        }
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      updateFromMouse(e.clientY, stepIdx);
    },
    [onStepChange],
  );

  return (
    <div style={{ display: "flex", gap: 0, height: 56 }}>
      {/* Left margin: label + toggle */}
      <div
        style={{
          width: 60,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-end",
          paddingRight: 6,
          gap: 2,
        }}
      >
        <button
          onClick={() => onEnabledChange(!enabled)}
          style={{
            fontFamily: ABLETON_FONTS.ui,
            fontSize: 9,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            color: enabled ? ABLETON_COLORS.accent : ABLETON_COLORS.textMuted,
            background: enabled ? "rgba(247, 167, 56, 0.12)" : "transparent",
            border: `1px solid ${enabled ? ABLETON_COLORS.accent : ABLETON_COLORS.border}`,
            borderRadius: 2,
            padding: "2px 6px",
            cursor: "pointer",
            lineHeight: 1.2,
          }}
        >
          {label}
        </button>
      </div>

      {/* 16 step columns */}
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
        {steps.map((step, idx) => {
          const isActive = idx === currentStep;
          const isBeatBoundary = idx > 0 && idx % 4 === 0;
          const valuePct = step.value;
          const randomPct = step.random;

          // Random zone: centered on value, extending randomPct/2 above and below
          const randomHalfPct = (randomPct / 100) * 50;
          const randomTop = Math.max(0, 100 - valuePct - randomHalfPct);
          const randomBottom = Math.max(0, valuePct - randomHalfPct);
          const randomHeight = 100 - randomTop - randomBottom;

          return (
            <div
              key={idx}
              ref={(el) => { columnRefs.current[idx] = el; }}
              onMouseDown={(e) => startDrag(idx, e)}
              style={{
                flex: 1,
                position: "relative",
                cursor: "crosshair",
                borderLeft: isBeatBoundary
                  ? `2px solid ${ABLETON_COLORS.lcdLine}`
                  : idx > 0
                    ? `1px solid rgba(255,255,255,0.04)`
                    : "none",
                // Active step: bright column background (visible regardless of enabled)
                background: isActive
                  ? "rgba(0, 255, 129, 0.15)"
                  : "transparent",
              }}
            >
              {/* Value fill — bottom-up */}
              {enabled && valuePct > 0 && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: `${valuePct}%`,
                    background: "rgba(247, 167, 56, 0.25)",
                    pointerEvents: "none",
                  }}
                />
              )}

              {/* Random zone — hatched overlay centered on value */}
              {enabled && randomPct > 0 && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: `${randomTop}%`,
                    height: `${randomHeight}%`,
                    background: "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(100,180,255,0.18) 2px, rgba(100,180,255,0.18) 4px)",
                    pointerEvents: "none",
                    zIndex: 2,
                  }}
                />
              )}

              {/* Value line — thin bright line at value position */}
              {enabled && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: `${valuePct}%`,
                    height: 1,
                    background: ABLETON_COLORS.accent,
                    opacity: 0.6,
                    pointerEvents: "none",
                    zIndex: 3,
                  }}
                />
              )}

              {/* Step number (every 4th) */}
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
