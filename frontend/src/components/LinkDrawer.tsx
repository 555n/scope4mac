/**
 * LinkDrawer — Ableton Link connection window.
 *
 * OS X Aqua title bar + Ableton-styled body.
 * Stripped to essentials: source, BPM, beat display.
 * Sequencer controls moved to SequencerWindow.
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
  /** Show sequencer window */
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
  const [bpmInput, setBpmInput] = useState("120");
  const bpmFocused = useRef(false);
  const [beatsPerBar, setBeatsPerBar] = useState(tempoState.beatsPerBar || 4);
  const sourcesLoaded = useRef(false);

  useEffect(() => {
    if (tempoState.enabled && tempoState.beatsPerBar) {
      setBeatsPerBar(tempoState.beatsPerBar);
    }
  }, [tempoState.enabled, tempoState.beatsPerBar]);

  useEffect(() => {
    if (tempoState.bpm !== null && !bpmFocused.current) {
      setBpmInput(String(Math.round(tempoState.bpm)));
    }
  }, [tempoState.bpm]);

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

  const handleToggle = useCallback(() => {
    if (tempoState.enabled) {
      onDisable();
    } else {
      const req: TempoEnableRequest = {
        source: selectedSource,
        bpm: parseFloat(bpmInput) || 120,
        beats_per_bar: beatsPerBar,
      };
      if (selectedSource === "midi_clock" && selectedMidiDevice) {
        req.midi_device = selectedMidiDevice;
      }
      onEnable(req);
    }
  }, [tempoState.enabled, selectedSource, bpmInput, beatsPerBar, selectedMidiDevice, onEnable, onDisable]);

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

          {/* BPM display + beat info (when connected) */}
          {tempoState.enabled && tempoState.bpm !== null && (
            <div
              style={{
                ...ABLETON_STYLES.lcdPanel,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {/* BPM */}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span
                  style={{
                    fontFamily: ABLETON_FONTS.mono,
                    fontSize: 28,
                    fontWeight: "bold",
                    color: ABLETON_COLORS.lcdFg,
                    lineHeight: 1,
                  }}
                >
                  {tempoState.bpm.toFixed(1)}
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

          {/* Set BPM (when connected) */}
          {tempoState.enabled && onSetBpm && (
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <input
                type="number"
                min={20}
                max={300}
                step={1}
                value={bpmInput}
                onChange={(e) => setBpmInput(e.target.value)}
                onFocus={() => (bpmFocused.current = true)}
                onBlur={() => (bpmFocused.current = false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = parseFloat(bpmInput);
                    if (v >= 20 && v <= 300) onSetBpm(v);
                  }
                }}
                style={{ ...ABLETON_STYLES.textInput, width: 56, textAlign: "center" }}
              />
              <button
                onClick={() => {
                  const v = parseFloat(bpmInput);
                  if (v >= 20 && v <= 300) onSetBpm(v);
                }}
                style={ABLETON_STYLES.button}
              >
                Set
              </button>
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
