/**
 * SeedLFOControls — compact inline Seed LFO controls.
 *
 * Single row: [LFO on/off] [Amount 0-100] [Freq value] [Hz/ms toggle]
 */

import { useState, useCallback } from "react";
import { ABLETON_COLORS, ABLETON_FONTS } from "../lib/AbletonStyles";

interface SeedLFOControlsProps {
  seedLfo: boolean;
  seedLfoAmount: number;    // 0-1
  seedLfoMs: number;        // 10-1000
  seedLfoHz: number;        // 0-100
  onChange: (params: Record<string, unknown>) => void;
}

export function SeedLFOControls({
  seedLfo,
  seedLfoAmount,
  seedLfoMs,
  seedLfoHz,
  onChange,
}: SeedLFOControlsProps) {
  const [hzMode, setHzMode] = useState(seedLfoHz > 0);

  const toggle = useCallback(() => {
    onChange({ seed_lfo: !seedLfo });
  }, [seedLfo, onChange]);

  const setAmount = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value) / 100;
      onChange({ seed_lfo_amount: Math.max(0, Math.min(1, v)) });
    },
    [onChange],
  );

  const setFreq = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value);
      if (hzMode) {
        onChange({ seed_lfo_hz: Math.max(0.1, Math.min(100, v)) });
      } else {
        onChange({ seed_lfo_ms: Math.max(10, Math.min(1000, v)) });
      }
    },
    [hzMode, onChange],
  );

  const toggleMode = useCallback(() => {
    const newHz = !hzMode;
    setHzMode(newHz);
    if (newHz && seedLfoMs > 0) {
      onChange({ seed_lfo_hz: Math.round((1000 / seedLfoMs) * 10) / 10 });
    } else if (!newHz && seedLfoHz > 0) {
      onChange({ seed_lfo_ms: Math.round(1000 / seedLfoHz) });
    }
  }, [hzMode, seedLfoMs, seedLfoHz, onChange]);

  const inputStyle: React.CSSProperties = {
    fontFamily: ABLETON_FONTS.mono,
    fontSize: 10,
    color: ABLETON_COLORS.lcdFg,
    background: ABLETON_COLORS.retroDisplayBg,
    border: `1px solid ${ABLETON_COLORS.border}`,
    borderRadius: 2,
    padding: "1px 4px",
    outline: "none",
    textAlign: "center",
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: ABLETON_FONTS.ui,
    fontSize: 8,
    color: ABLETON_COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 24,
        paddingLeft: 60,
      }}
    >
      {/* LFO toggle */}
      <button
        onClick={toggle}
        style={{
          fontFamily: ABLETON_FONTS.ui,
          fontSize: 8,
          fontWeight: 600,
          textTransform: "uppercase",
          color: seedLfo ? ABLETON_COLORS.accent : ABLETON_COLORS.textMuted,
          background: seedLfo ? "rgba(247, 167, 56, 0.12)" : "transparent",
          border: `1px solid ${seedLfo ? ABLETON_COLORS.accent : ABLETON_COLORS.border}`,
          borderRadius: 2,
          padding: "1px 6px",
          cursor: "pointer",
          letterSpacing: "0.05em",
        }}
      >
        LFO
      </button>

      {/* Amount */}
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <span style={labelStyle}>Amt</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(seedLfoAmount * 100)}
          onChange={setAmount}
          disabled={!seedLfo}
          style={{ width: 48, height: 10, accentColor: ABLETON_COLORS.accent }}
        />
      </div>

      {/* Frequency */}
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <span style={labelStyle}>{hzMode ? "Hz" : "ms"}</span>
        <input
          type="number"
          value={hzMode ? seedLfoHz : seedLfoMs}
          onChange={setFreq}
          disabled={!seedLfo}
          step={hzMode ? 0.1 : 10}
          min={hzMode ? 0.1 : 10}
          max={hzMode ? 100 : 1000}
          style={{ ...inputStyle, width: 44 }}
        />
      </div>

      {/* Hz/ms toggle */}
      <button
        onClick={toggleMode}
        style={{
          fontFamily: ABLETON_FONTS.mono,
          fontSize: 8,
          color: ABLETON_COLORS.textSecondary,
          background: "transparent",
          border: `1px solid ${ABLETON_COLORS.border}`,
          borderRadius: 2,
          padding: "1px 4px",
          cursor: "pointer",
        }}
      >
        {hzMode ? "ms" : "Hz"}
      </button>
    </div>
  );
}
