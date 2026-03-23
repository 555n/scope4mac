/**
 * LinkDrawer — Ableton Link connection window.
 *
 * OS X Aqua title bar + Ableton-styled body.
 * Auto-enables Link on open. Single interactive BPM display:
 * double-click to type, drag vertically to adjust in real time.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { FloatingWindow } from "./FloatingWindow";
import { ABLETON_COLORS, ABLETON_FONTS, ABLETON_STYLES } from "../lib/AbletonStyles";
import type { TempoState } from "../hooks/useTempoSync";
import type {
  TempoSourcesResponse,
  TempoEnableRequest,
} from "../lib/api";

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
  onOpenSequencers?: () => void;
}

function BeatDot({ phase }: { phase: number }) {
  const brightness = 1 - phase;
  return (
    <div
      style={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: `rgba(247, 167, 56, ${0.2 + brightness * 0.8})`,
        boxShadow: brightness > 0.5
          ? `0 0 ${4 + brightness * 4}px rgba(247, 167, 56, ${brightness * 0.5})`
          : "none",
        transition: "background 0.06s, box-shadow 0.06s",
      }}
    />
  );
}

/**
 * Interactive BPM display.
 * - Shows current BPM as large mono text
 * - Double-click to enter edit mode (type a value, Enter to confirm, Escape to cancel)
 * - Click-drag vertically to adjust BPM in real time (1 BPM per 4px)
 */
function InteractiveBpm({
  bpm,
  onSetBpm,
}: {
  bpm: number;
  onSetBpm: (bpm: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ startY: number; startBpm: number; lastSent: number } | null>(null);
  const [dragBpm, setDragBpm] = useState<number | null>(null);

  const commitEdit = () => {
    const v = parseFloat(editValue);
    if (v >= 20 && v <= 300) onSetBpm(v);
    setEditing(false);
  };

  const handleDoubleClick = () => {
    setEditValue(String(Math.round(bpm)));
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (editing) return;
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startBpm: bpm, lastSent: bpm };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dy = dragRef.current.startY - ev.clientY;
      const newBpm = Math.round(Math.max(20, Math.min(300, dragRef.current.startBpm + dy / 4)));
      setDragBpm(newBpm);
      // Throttle API calls — only send when value changes by >= 1 BPM
      if (Math.abs(newBpm - dragRef.current.lastSent) >= 1) {
        dragRef.current.lastSent = newBpm;
        onSetBpm(newBpm);
      }
    };
    const onUp = () => {
      if (dragRef.current) {
        // Send final value on release
        const dy = dragRef.current.startY - 0; // unused, use lastSent
        onSetBpm(dragRef.current.lastSent);
      }
      dragRef.current = null;
      setDragBpm(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const displayBpm = dragBpm ?? bpm;

  if (editing) {
    return (
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <input
          ref={inputRef}
          type="number"
          min={20}
          max={300}
          step={1}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={commitEdit}
          style={{
            fontFamily: ABLETON_FONTS.mono,
            fontSize: 28,
            fontWeight: "bold",
            color: ABLETON_COLORS.lcdFg,
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${ABLETON_COLORS.accent}`,
            borderRadius: 2,
            outline: "none",
            width: 80,
            lineHeight: 1,
            padding: "2px 4px",
            textAlign: "left",
          }}
        />
        <span
          style={{
            fontFamily: ABLETON_FONTS.ui,
            fontSize: 10,
            color: ABLETON_COLORS.textSecondary,
            textTransform: "uppercase",
          }}
        >
          BPM
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        cursor: "ns-resize",
        userSelect: "none",
      }}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
    >
      <span
        style={{
          fontFamily: ABLETON_FONTS.mono,
          fontSize: 28,
          fontWeight: "bold",
          color: ABLETON_COLORS.lcdFg,
          lineHeight: 1,
        }}
      >
        {displayBpm.toFixed(1)}
      </span>
      <span
        style={{
          fontFamily: ABLETON_FONTS.ui,
          fontSize: 10,
          color: ABLETON_COLORS.textSecondary,
          textTransform: "uppercase",
        }}
      >
        BPM
      </span>
    </div>
  );
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
  onOpenSequencers,
}: LinkDrawerProps) {
  const [selectedSource, setSelectedSource] = useState<"link" | "midi_clock">("link");
  const [selectedMidiDevice, setSelectedMidiDevice] = useState("");
  const [beatsPerBar, setBeatsPerBar] = useState(tempoState.beatsPerBar || 4);
  const sourcesLoaded = useRef(false);
  const autoEnabled = useRef(false);

  useEffect(() => {
    if (tempoState.enabled && tempoState.beatsPerBar) {
      setBeatsPerBar(tempoState.beatsPerBar);
    }
  }, [tempoState.enabled, tempoState.beatsPerBar]);

  useEffect(() => {
    if (sources && !sourcesLoaded.current) {
      sourcesLoaded.current = true;
      if (sources.sources.link?.available) setSelectedSource("link");
      else if (sources.sources.midi_clock?.available) {
        setSelectedSource("midi_clock");
        const devs = sources.sources.midi_clock.devices ?? [];
        if (devs.length > 0) setSelectedMidiDevice(devs[0]);
      }
    }
  }, [sources]);

  // Auto-enable Link when drawer opens and sources are available
  useEffect(() => {
    if (open && !tempoState.enabled && !loading && !autoEnabled.current && sources) {
      const linkAvail = sources.sources.link?.available;
      if (linkAvail) {
        autoEnabled.current = true;
        onEnable({ source: "link", bpm: 120, beats_per_bar: beatsPerBar });
      }
    }
    if (!open) {
      autoEnabled.current = false;
    }
  }, [open, tempoState.enabled, loading, sources, beatsPerBar, onEnable]);

  const handleToggle = useCallback(() => {
    if (tempoState.enabled) {
      onDisable();
    } else {
      const req: TempoEnableRequest = {
        source: selectedSource,
        bpm: 120,
        beats_per_bar: beatsPerBar,
      };
      if (selectedSource === "midi_clock" && selectedMidiDevice) {
        req.midi_device = selectedMidiDevice;
      }
      onEnable(req);
    }
  }, [tempoState.enabled, selectedSource, beatsPerBar, selectedMidiDevice, onEnable, onDisable]);

  const linkAvailable = sources?.sources.link?.available ?? false;
  const midiAvailable = sources?.sources.midi_clock?.available ?? false;
  const midiDevices = sources?.sources.midi_clock?.devices ?? [];
  const noSources = !linkAvailable && !midiAvailable;

  return (
    <FloatingWindow
      id="link"
      title="Ableton Link"
      open={open}
      onClose={onClose}
      width={260}
      defaultX={-1}
      defaultY={60}
      bodyBackground={ABLETON_COLORS.surfaceBg}
      bodyStyle={{ padding: 12, color: ABLETON_COLORS.textPrimary }}
    >
      {noSources ? (
        <div style={{ fontSize: 11, color: ABLETON_COLORS.textDisabled, fontFamily: ABLETON_FONTS.ui }}>
          No tempo sources. Install <code style={{ fontSize: 10 }}>aalink</code> for Link.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Enable toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ ...ABLETON_STYLES.sectionLabel }}>Link</span>
            <button
              onClick={handleToggle}
              disabled={loading}
              style={tempoState.enabled ? ABLETON_STYLES.buttonOn : ABLETON_STYLES.button}
            >
              {tempoState.enabled ? "ON" : "OFF"}
            </button>
          </div>

          {/* Source selector — only when not connected */}
          {!tempoState.enabled && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 10, color: ABLETON_COLORS.textSecondary, fontFamily: ABLETON_FONTS.ui }}>
                Source
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                {linkAvailable && (
                  <button
                    onClick={() => setSelectedSource("link")}
                    style={selectedSource === "link" ? ABLETON_STYLES.buttonOn : ABLETON_STYLES.button}
                  >
                    Link
                  </button>
                )}
                {midiAvailable && (
                  <button
                    onClick={() => setSelectedSource("midi_clock")}
                    style={selectedSource === "midi_clock" ? ABLETON_STYLES.buttonOn : ABLETON_STYLES.button}
                  >
                    MIDI
                  </button>
                )}
              </div>

              {selectedSource === "midi_clock" && midiDevices.length > 0 && (
                <select
                  value={selectedMidiDevice}
                  onChange={(e) => setSelectedMidiDevice(e.target.value)}
                  style={{ ...ABLETON_STYLES.textInput, width: "100%" }}
                >
                  {midiDevices.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* BPM + beat display (when connected) */}
          {tempoState.enabled && tempoState.bpm !== null && (
            <div
              style={{
                ...ABLETON_STYLES.lcdPanel,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {/* Interactive BPM — double-click to edit, drag to adjust */}
              <InteractiveBpm
                bpm={tempoState.bpm}
                onSetBpm={onSetBpm ?? (() => {})}
              />

              {/* Beat indicator + bar/beat info */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <BeatDot phase={tempoState.beatPhase} />
                <div
                  style={{
                    fontFamily: ABLETON_FONTS.mono,
                    fontSize: 10,
                    color: ABLETON_COLORS.lcdScaleText,
                    display: "flex",
                    gap: 12,
                  }}
                >
                  <span>{tempoState.barPosition.toFixed(2)} / {tempoState.beatsPerBar}</span>
                  <span>Beat {tempoState.beatCount}</span>
                </div>
              </div>

              {/* Peers */}
              {tempoState.sourceType === "link" && tempoState.numPeers !== null && (
                <div
                  style={{
                    fontFamily: ABLETON_FONTS.ui,
                    fontSize: 10,
                    color: ABLETON_COLORS.textSecondary,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: ABLETON_COLORS.playGreen,
                    }}
                  />
                  {tempoState.numPeers} peer{tempoState.numPeers !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          )}

          {/* Sequencers button (when connected) */}
          {tempoState.enabled && onOpenSequencers && (
            <button
              onClick={onOpenSequencers}
              style={{
                ...ABLETON_STYLES.button,
                width: "100%",
                textAlign: "center",
                marginTop: 4,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontSize: 10,
              }}
            >
              Sequencers
            </button>
          )}

          {error && (
            <div style={{ fontSize: 10, color: ABLETON_COLORS.alert, fontFamily: ABLETON_FONTS.ui }}>
              {error}
            </div>
          )}
        </div>
      )}
    </FloatingWindow>
  );
}
