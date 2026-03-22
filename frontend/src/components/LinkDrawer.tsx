import { useEffect, useRef, useState, useCallback } from "react";
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

const WINDOW_WIDTH = 300;
const TITLE_BAR_HEIGHT = 24;

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
  const windowRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: -1, y: -1 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Initialize position to center-right on first open
  useEffect(() => {
    if (open && position.x === -1) {
      setPosition({
        x: window.innerWidth - WINDOW_WIDTH - 40,
        y: 60,
      });
    }
  }, [open, position.x]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Drag handlers
  const onTitleBarMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't drag if clicking the close button
    if ((e.target as HTMLElement).closest("[data-close-button]")) return;
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: position.x,
      origY: position.y,
    };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - WINDOW_WIDTH, dragRef.current.origX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - TITLE_BAR_HEIGHT, dragRef.current.origY + dy)),
      });
    };

    const onMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [position]);

  if (!open) return null;

  return (
    <div
      ref={windowRef}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        width: WINDOW_WIDTH,
        zIndex: 10001,
        display: "flex",
        flexDirection: "column",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)",
        maxHeight: `calc(100vh - ${position.y}px - 20px)`,
        WebkitAppRegion: "no-drag" as any,
      }}
    >
      {/* Title bar — Aqua with pinstripe, draggable */}
      <div
        onMouseDown={onTitleBarMouseDown}
        style={{
          background: AQUA_GRADIENTS.brushedAluminum,
          borderBottom: `1px solid ${AQUA_COLORS.border}`,
          padding: "0 8px",
          display: "flex",
          alignItems: "center",
          height: TITLE_BAR_HEIGHT,
          flexShrink: 0,
          position: "relative",
          cursor: "grab",
          userSelect: "none",
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
          data-close-button
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
          backgroundColor: "#1a1a1a",
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
