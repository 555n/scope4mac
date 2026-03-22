import { useEffect, useRef } from "react";
import { AQUA_COLORS, AQUA_GRADIENTS, AQUA_SHADOWS } from "../lib/AquaStyles";
import { TempoSyncSection } from "./settings/TempoSyncSection";
import type { TempoState } from "../hooks/useTempoSync";
import type {
  TempoSourcesResponse,
  TempoEnableRequest,
  PipelineConfigSchema,
} from "../lib/api";
import type { ModulationsState } from "./settings/ModulationSection";

interface LinkDrawerProps {
  open: boolean;
  onClose: () => void;
  tempoState: TempoState;
  sources: TempoSourcesResponse | null;
  loading: boolean;
  error: string | null;
  onEnable: (request: TempoEnableRequest) => void;
  onDisable: () => void;
  onSetBpm?: (bpm: number) => void;
  onRefreshSources: () => void;
  quantizeMode?: string;
  onQuantizeModeChange?: (mode: string) => void;
  lookaheadMs?: number;
  onLookaheadMsChange?: (ms: number) => void;
  modulations?: ModulationsState;
  onModulationsChange?: (modulations: ModulationsState) => void;
  configSchema?: PipelineConfigSchema;
  beatCacheResetRate?: string;
  onBeatCacheResetRateChange?: (rate: string) => void;
  promptCycleRate?: string;
  onPromptCycleRateChange?: (rate: string) => void;
}

export function LinkDrawer({
  open,
  onClose,
  tempoState,
  sources,
  loading,
  error,
  onEnable,
  onDisable,
  onSetBpm,
  onRefreshSources,
  quantizeMode,
  onQuantizeModeChange,
  lookaheadMs,
  onLookaheadMsChange,
  modulations,
  onModulationsChange,
  configSchema,
  beatCacheResetRate,
  onBeatCacheResetRateChange,
  promptCycleRate,
  onPromptCycleRateChange,
}: LinkDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<boolean>(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Close on click outside — skip clicks during the same frame as open
  useEffect(() => {
    if (!open) {
      toggleRef.current = false;
      return;
    }
    toggleRef.current = true;
    const handler = (e: MouseEvent) => {
      if (toggleRef.current) {
        toggleRef.current = false;
        return;
      }
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  return (
    <div
      ref={drawerRef}
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 300,
        zIndex: 50,
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 200ms ease-in-out",
        pointerEvents: open ? "auto" : "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Title bar — Aqua with pinstripe */}
      <div
        style={{
          background: AQUA_GRADIENTS.brushedAluminum,
          borderBottom: `1px solid ${AQUA_COLORS.border}`,
          borderLeft: `1px solid ${AQUA_COLORS.border}`,
          borderTopLeftRadius: 6,
          padding: "0 8px",
          display: "flex",
          alignItems: "center",
          height: 24,
          flexShrink: 0,
          position: "relative",
        }}
      >
        {/* Pinstripe overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: AQUA_GRADIENTS.pinstripe,
            pointerEvents: "none",
          }}
        />

        {/* Close dot (traffic light red) */}
        <div
          onClick={onClose}
          title="Close"
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: AQUA_COLORS.aquaRed,
            border: "1px solid rgba(0,0,0,0.2)",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.2)",
            cursor: "pointer",
            flexShrink: 0,
            position: "relative",
            zIndex: 10,
          }}
        />

        {/* Title */}
        <div
          style={{
            flex: 1,
            textAlign: "center",
            position: "relative",
            zIndex: 10,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: "bold",
              color: AQUA_COLORS.text,
              textShadow: "0 1px 0 rgba(255,255,255,0.5)",
            }}
          >
            Ableton Link
          </span>
        </div>

        {/* Status indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            position: "relative",
            zIndex: 10,
          }}
        >
          {tempoState.enabled && tempoState.bpm !== null && (
            <span
              style={{
                fontSize: 10,
                fontFamily: "monospace",
                color: "#555",
              }}
            >
              {tempoState.bpm.toFixed(0)}
            </span>
          )}
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: tempoState.enabled ? AQUA_COLORS.aquaGreen : "#bbb",
              border: "1px solid rgba(0,0,0,0.15)",
              boxShadow: tempoState.enabled
                ? `0 0 4px ${AQUA_COLORS.aquaGreen}`
                : "none",
            }}
          />
        </div>
      </div>

      {/* Body — dark background so Tailwind dark-theme classes render correctly */}
      <div
        className="dark"
        style={{
          flex: 1,
          backgroundColor: "#1a1a1a",
          borderLeft: `1px solid ${AQUA_COLORS.border}`,
          boxShadow: `-4px 0 12px rgba(0,0,0,0.15)`,
          overflowY: "auto",
          padding: 16,
          color: "#e0e0e0",
        }}
      >
        <TempoSyncSection
          tempoState={tempoState}
          sources={sources}
          loading={loading}
          error={error}
          onEnable={onEnable}
          onDisable={onDisable}
          onSetBpm={onSetBpm}
          onRefreshSources={onRefreshSources}
          quantizeMode={quantizeMode}
          onQuantizeModeChange={onQuantizeModeChange}
          lookaheadMs={lookaheadMs}
          onLookaheadMsChange={onLookaheadMsChange}
          modulations={modulations}
          onModulationsChange={onModulationsChange}
          configSchema={configSchema}
          beatCacheResetRate={beatCacheResetRate}
          onBeatCacheResetRateChange={onBeatCacheResetRateChange}
          promptCycleRate={promptCycleRate}
          onPromptCycleRateChange={onPromptCycleRateChange}
        />
      </div>
    </div>
  );
}
