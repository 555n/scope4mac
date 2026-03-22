import { useCallback, useMemo } from "react";
import { AQUA_COLORS, AQUA_GRADIENTS } from "../lib/AquaStyles";

const STEP_COUNT = 16;

const PRESETS: Record<string, boolean[]> = {
  kick: Array.from({ length: 16 }, (_, i) => [0, 4, 8, 12].includes(i)),
  snare: Array.from({ length: 16 }, (_, i) => [4, 12].includes(i)),
  hats: Array.from({ length: 16 }, () => true),
  tresillo: Array.from({ length: 16 }, (_, i) => [0, 3, 6, 8, 10, 12].includes(i)),
};

interface StepSequencerProps {
  steps: boolean[];
  currentStep: number;
  onChange: (steps: boolean[]) => void;
}

export function StepSequencer({ steps, currentStep, onChange }: StepSequencerProps) {
  const safeSteps = useMemo(
    () => (steps && steps.length === STEP_COUNT ? steps : Array(STEP_COUNT).fill(false)),
    [steps],
  );

  const toggleStep = useCallback(
    (index: number) => {
      const next = [...safeSteps];
      next[index] = !next[index];
      onChange(next);
    },
    [safeSteps, onChange],
  );

  const applyPreset = useCallback(
    (name: string) => {
      onChange([...PRESETS[name]]);
    },
    [onChange],
  );

  const clearAll = useCallback(() => {
    onChange(Array(STEP_COUNT).fill(false));
  }, [onChange]);

  return (
    <div style={{ marginTop: 12 }}>
      {/* Section label */}
      <div
        style={{
          fontSize: 10,
          fontWeight: "bold",
          color: "#888",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 6,
        }}
      >
        Step Sequencer
      </div>

      {/* 16 pads — two rows of 8 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {[0, 8].map((rowStart) => (
          <div key={rowStart} style={{ display: "flex", gap: 2 }}>
            {Array.from({ length: 8 }, (_, i) => {
              const idx = rowStart + i;
              const isOn = safeSteps[idx];
              const isCurrent = currentStep === idx;
              const isDownbeat = idx % 4 === 0;

              return (
                <button
                  key={idx}
                  onClick={() => toggleStep(idx)}
                  title={`Step ${idx + 1}`}
                  style={{
                    flex: 1,
                    height: 24,
                    minWidth: 0,
                    border: isCurrent
                      ? `2px solid ${AQUA_COLORS.aquaGreen}`
                      : isOn
                        ? "1px solid rgba(0,0,0,0.3)"
                        : `1px solid ${isDownbeat ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 4,
                    background: isOn
                      ? AQUA_GRADIENTS.aquaGel
                      : isDownbeat
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(255,255,255,0.03)",
                    boxShadow: isOn
                      ? isCurrent
                        ? `0 0 6px ${AQUA_COLORS.aquaGreen}, 0 1px 2px rgba(0,0,0,0.25)`
                        : "0 1px 2px rgba(0,0,0,0.25)"
                      : isCurrent
                        ? `0 0 4px ${AQUA_COLORS.aquaGreen}`
                        : "none",
                    cursor: "pointer",
                    position: "relative",
                    overflow: "hidden",
                    padding: 0,
                    transition: "background 0.05s, border-color 0.05s, box-shadow 0.05s",
                  }}
                >
                  {/* Gel highlight */}
                  {isOn && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: "40%",
                        background: "rgba(255,255,255,0.35)",
                        borderRadius: "3px 3px 0 0",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Presets row */}
      <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
        {Object.keys(PRESETS).map((name) => (
          <button
            key={name}
            onClick={() => applyPreset(name)}
            style={{
              flex: 1,
              fontSize: 9,
              fontWeight: "bold",
              color: AQUA_COLORS.text,
              textShadow: "0 1px 0 rgba(255,255,255,0.5)",
              background: AQUA_GRADIENTS.brushedAluminum,
              border: `1px solid ${AQUA_COLORS.border}`,
              borderRadius: 10,
              padding: "2px 0",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            {name}
          </button>
        ))}
        <button
          onClick={clearAll}
          style={{
            width: 32,
            fontSize: 9,
            fontWeight: "bold",
            color: "#999",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            padding: "2px 0",
            cursor: "pointer",
          }}
        >
          CLR
        </button>
      </div>
    </div>
  );
}
