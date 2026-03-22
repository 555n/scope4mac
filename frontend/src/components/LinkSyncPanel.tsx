/**
 * LinkSyncPanel — Custom Ableton-styled settings panel for the Link Sync postprocessor.
 *
 * Bypasses the auto-generated SchemaPrimitiveField (which uses Tailwind/Aqua
 * styling that ignores CSS vars). Renders with native inline Ableton styles.
 */

import { ABLETON_COLORS, ABLETON_FONTS, ABLETON_STYLES } from "../lib/AbletonStyles";

interface LinkSyncPanelProps {
  overrides?: Record<string, unknown>;
  onChange?: (key: string, value: unknown, isRuntimeParam?: boolean) => void;
  isStreaming?: boolean;
  isLoading?: boolean;
  /** Measured gen FPS from backend (for latency display) */
  genFps?: number;
}

export function LinkSyncPanel({
  overrides,
  onChange,
  isStreaming,
  isLoading,
  genFps = 6,
}: LinkSyncPanelProps) {
  const lookaheadFrames = (overrides?.lookahead_frames as number) ?? 2;
  const minLatencyMs = Math.round((lookaheadFrames / Math.max(genFps, 1)) * 1000);
  const disabled = isLoading;

  return (
    <div
      style={{
        background: ABLETON_COLORS.retroDisplayBg,
        borderRadius: 2,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        fontFamily: ABLETON_FONTS.ui,
      }}
    >
      {/* Lookahead Frames */}
      <div>
        <div style={{ ...ABLETON_STYLES.sectionLabel, marginBottom: 6 }}>
          Lookahead Frames
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Slider track */}
          <div style={{ flex: 1, position: "relative", height: 20 }}>
            <div
              style={{
                position: "absolute",
                top: 8,
                left: 0,
                right: 0,
                height: 4,
                background: ABLETON_COLORS.surfaceArea,
                border: `1px solid ${ABLETON_COLORS.border}`,
                borderRadius: 2,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 8,
                left: 0,
                width: `${((lookaheadFrames - 1) / 7) * 100}%`,
                height: 4,
                background: ABLETON_COLORS.accent,
                borderRadius: 2,
              }}
            />
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={lookaheadFrames}
              disabled={disabled || isStreaming}
              onChange={(e) => onChange?.("lookahead_frames", Number(e.target.value), false)}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                opacity: 0,
                cursor: disabled || isStreaming ? "not-allowed" : "pointer",
                margin: 0,
              }}
            />
          </div>

          {/* Value */}
          <span
            style={{
              fontFamily: ABLETON_FONTS.mono,
              fontSize: 12,
              color: ABLETON_COLORS.lcdFg,
              minWidth: 16,
              textAlign: "right",
            }}
          >
            {lookaheadFrames}
          </span>
        </div>

        {/* Info display */}
        <div
          style={{
            marginTop: 6,
            fontFamily: ABLETON_FONTS.mono,
            fontSize: 10,
            color: ABLETON_COLORS.textSecondary,
            display: "flex",
            gap: 16,
          }}
        >
          <span>Max rate: <span style={{ color: ABLETON_COLORS.lcdFg }}>{genFps.toFixed(0)}</span> fps</span>
          <span>Min latency: <span style={{ color: ABLETON_COLORS.lcdFg }}>{minLatencyMs}</span> ms</span>
        </div>
      </div>

      {/* Load param notice */}
      {isStreaming && (
        <div
          style={{
            fontSize: 9,
            color: ABLETON_COLORS.textDisabled,
            fontStyle: "italic",
          }}
        >
          Lookahead is a load parameter — change requires pipeline reload.
        </div>
      )}
    </div>
  );
}
