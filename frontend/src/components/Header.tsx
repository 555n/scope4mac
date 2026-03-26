import { useState, useEffect, useRef, useCallback } from "react";
import { Cloud, CloudOff, Link2 } from "lucide-react";
import { SettingsDialog } from "./SettingsDialog";
import { PluginsDialog } from "./PluginsDialog";
import { toast } from "sonner";
import { useCloudStatus } from "../hooks/useCloudStatus";
import { AQUA_GRADIENTS, AQUA_COLORS } from "../lib/AquaStyles";

// --- Aqua gel menu bar primitives ---

const gelButtonStyle = (active = false): React.CSSProperties => ({
  background: active ? AQUA_GRADIENTS.aquaGelPressed : "transparent",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  color: active ? "#fff" : "#333",
  textShadow: active ? "0 -1px 0 rgba(0,0,0,0.3)" : "0 1px 0 rgba(255,255,255,0.5)",
  padding: "2px 10px",
  height: 22,
  display: "inline-flex",
  alignItems: "center",
  position: "relative" as const,
  overflow: "hidden" as const,
  fontFamily: "system-ui, -apple-system, sans-serif",
});

function AquaGelHighlight({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: "45%",
      background: "rgba(255,255,255,0.35)", borderRadius: "4px 4px 0 0",
      pointerEvents: "none",
    }} />
  );
}

function MenuItem({
  label, onClick, disabled, shortcut, checked,
}: { label: string; onClick?: () => void; disabled?: boolean; shortcut?: string; checked?: boolean }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: "4px 16px 4px 12px", background: "none", border: "none",
        fontSize: 13, color: disabled ? "#999" : "#222", cursor: disabled ? "default" : "pointer",
        fontFamily: "system-ui, -apple-system, sans-serif", whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.background = AQUA_COLORS.aquaBlueMid1; e.currentTarget.style.color = "#fff"; }}}
      onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = disabled ? "#999" : "#222"; }}
    >
      <span style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
        <span>{checked !== undefined ? `${checked ? "✓ " : "   "}${label}` : label}</span>
        {shortcut && <span style={{ opacity: 0.5, fontSize: 11 }}>{shortcut}</span>}
      </span>
    </button>
  );
}

function MenuSeparator() {
  return <div style={{ height: 1, background: "#ccc", margin: "3px 8px" }} />;
}

function MenuBarItem({
  label, icon, children, activeMenu, menuId, onActivate,
}: {
  label?: string; icon?: React.ReactNode; children: React.ReactNode;
  activeMenu: string | null; menuId: string; onActivate: (id: string | null) => void;
}) {
  const isOpen = activeMenu === menuId;
  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => { if (activeMenu && activeMenu !== menuId) onActivate(menuId); }}
    >
      <button
        onClick={() => onActivate(isOpen ? null : menuId)}
        style={gelButtonStyle(isOpen)}
      >
        <AquaGelHighlight show={isOpen} />
        {icon}
        {label && <span>{label}</span>}
      </button>
      {isOpen && (
        <div style={{
          position: "absolute", top: 26, left: 0, minWidth: 220,
          background: "linear-gradient(180deg, #f8f8f8 0%, #e8e8e8 100%)",
          border: "1px solid #999", borderRadius: 6,
          boxShadow: "0 6px 20px rgba(0,0,0,0.3)", padding: "4px 0", zIndex: 20001,
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

// --- Aqua gauge (matches MemoryGauge style from StatusBar) ---

function AquaBarGauge({ label, valueText, pct, barColor }: {
  label: string; valueText: string; pct: number; barColor?: string;
}) {
  const clampedPct = Math.min(100, Math.max(0, pct));
  const color = barColor ?? (clampedPct > 90 ? "#ff5f57" : clampedPct > 70 ? "#CC8800" : "#4a9af0");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}
      title={`${label}: ${valueText}`}
    >
      <span style={{
        fontSize: 10, fontWeight: 500, whiteSpace: "nowrap", opacity: 0.6,
        fontFamily: "Lucida Grande, sans-serif", color: "var(--text-secondary, #666)",
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 12, fontWeight: 500, whiteSpace: "nowrap",
        fontFamily: "Lucida Grande, sans-serif", color: "var(--text-secondary, #555)",
      }}>
        {valueText}
      </span>
      <div style={{
        width: 100, height: 14,
        background: "linear-gradient(180deg, #e0e0e0 0%, #c8c8c8 50%, #d4d4d4 100%)",
        border: "2px solid rgba(0,0,0,0.3)", borderRadius: 7,
        overflow: "hidden", position: "relative",
      }}>
        <div style={{
          width: `${clampedPct}%`, height: "100%",
          background: color,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)",
          transition: "width 0.6s ease-out",
        }} />
      </div>
    </div>
  );
}

// --- Header ---

interface OutputSinkState {
  enabled: boolean;
  name: string;
}

interface HeaderProps {
  className?: string;
  onPipelinesRefresh?: () => Promise<unknown>;
  cloudDisabled?: boolean;
  openSettingsTab?: string | null;
  onSettingsTabOpened?: () => void;
  linkEnabled?: boolean;
  onLinkToggle?: () => void;
  // Output sinks
  ndiOutputAvailable?: boolean;
  syphonOutputAvailable?: boolean;
  outputSinks?: Record<string, OutputSinkState>;
  onOutputSinkToggle?: (sinkType: string, config: OutputSinkState) => void;
  // Recording
  isNodeRecording?: boolean;
  onNodeRecordingToggle?: () => void;
  isWindowRecording?: boolean;
  onWindowRecordingToggle?: () => void;
  onChooseRecordingDir?: () => void;
  onOpenRecordings?: () => void;
  // Status bar data
  fps?: number;
  bitrate?: number;
  unifiedMemoryUsed?: number;
  unifiedMemoryTotal?: number;
  cpuPercent?: number;
  gpuPercent?: number;
}

export function Header({
  className = "",
  onPipelinesRefresh,
  cloudDisabled,
  openSettingsTab,
  onSettingsTabOpened,
  linkEnabled,
  onLinkToggle,
  ndiOutputAvailable,
  syphonOutputAvailable,
  outputSinks,
  onOutputSinkToggle,
  isNodeRecording,
  onNodeRecordingToggle,
  isWindowRecording,
  onWindowRecordingToggle,
  onChooseRecordingDir,
  onOpenRecordings,
  fps,
  bitrate,
  unifiedMemoryUsed,
  unifiedMemoryTotal,
  cpuPercent: cpuPercentProp,
  gpuPercent: gpuPercentProp,
}: HeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [initialTab, setInitialTab] = useState<
    "general" | "account" | "api-keys" | "loras" | "osc"
  >("general");
  const [initialPluginPath, setInitialPluginPath] = useState("");

  const { isConnected, isConnecting, lastCloseCode, lastCloseReason } =
    useCloudStatus();

  const lastNotifiedCloseCodeRef = useRef<number | null>(null);
  const hasBeenConnectedRef = useRef(false);
  const prevConnectedRef = useRef(false);

  useEffect(() => {
    if (isConnected) {
      hasBeenConnectedRef.current = true;
      lastNotifiedCloseCodeRef.current = null;
    }
    if (hasBeenConnectedRef.current && lastCloseCode !== null && lastCloseCode !== lastNotifiedCloseCodeRef.current) {
      toast.error("Cloud connection lost", {
        description: `WebSocket closed ${lastCloseReason ? `(${lastCloseReason})` : ""}`,
        duration: 10000,
      });
      lastNotifiedCloseCodeRef.current = lastCloseCode;
    }
  }, [lastCloseCode, lastCloseReason, isConnected]);

  useEffect(() => {
    if (prevConnectedRef.current !== isConnected) {
      onPipelinesRefresh?.().catch(e => console.error("[Header] Pipeline refresh failed:", e));
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected, onPipelinesRefresh]);

  useEffect(() => {
    if (openSettingsTab) {
      if (openSettingsTab === "plugins") setPluginsOpen(true);
      else { setInitialTab(openSettingsTab as any); setSettingsOpen(true); }
      onSettingsTabOpened?.();
    }
  }, [openSettingsTab, onSettingsTabOpened]);

  useEffect(() => {
    if (window.scope?.onDeepLinkAction) {
      return window.scope.onDeepLinkAction(data => {
        if (data.action === "install-plugin" && data.package) {
          setInitialPluginPath(data.package);
          setPluginsOpen(true);
        }
      });
    }
  }, []);

  const openSettings = useCallback((tab: typeof initialTab) => {
    setInitialTab(tab); setSettingsOpen(true); setActiveMenu(null);
  }, []);
  const closeMenus = useCallback(() => setActiveMenu(null), []);

  const fpsValue = fps !== undefined && fps > 0 ? fps.toFixed(1) : "N/A";
  const bitrateValue = bitrate !== undefined && bitrate > 0
    ? bitrate >= 1000000 ? `${(bitrate / 1000000).toFixed(1)} Mbps` : `${Math.round(bitrate / 1000)} kbps`
    : "N/A";
  const memUsed = unifiedMemoryUsed ?? 0;
  const memTotal = unifiedMemoryTotal ?? 96;
  const cpuPercent = cpuPercentProp ?? 0;
  const gpuPercent = gpuPercentProp ?? 0;

  return (
    <>
      {/* Top status strip — same height as bottom StatusBar (px-6 py-2 = ~36px) */}
      <div
        style={{
          background: "linear-gradient(180deg, #b8d4f0 0%, #89b4dc 50%, #a0c4e8 100%)",
          borderBottom: `1px solid ${AQUA_COLORS.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "8px 24px 8px 78px",
          gap: 20,
          flexShrink: 0,
          WebkitAppRegion: "drag" as any,
          userSelect: "none",
        }}
      >
        <AquaBarGauge
          label="Unified Memory"
          valueText={`${memUsed.toFixed(1)} / ${memTotal.toFixed(0)} GB`}
          pct={(memUsed / Math.max(memTotal, 1)) * 100}
        />
        <AquaBarGauge
          label="CPU"
          valueText={`${cpuPercent.toFixed(0)}%`}
          pct={cpuPercent}
        />
        <AquaBarGauge
          label="GPU"
          valueText={`${gpuPercent.toFixed(0)}%`}
          pct={gpuPercent}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, color: "#444", fontWeight: 500, fontFamily: "Lucida Grande, sans-serif" }}>FPS</span>
          <span style={{ fontSize: 12, color: "#333", fontFamily: "monospace", fontWeight: 600 }}>{fpsValue}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, color: "#444", fontWeight: 500, fontFamily: "Lucida Grande, sans-serif" }}>Bitrate</span>
          <span style={{ fontSize: 12, color: "#333", fontFamily: "monospace", fontWeight: 600 }}>{bitrateValue}</span>
        </div>
      </div>

      {/* Aqua menu bar */}
      <header
        className={`w-full ${className}`}
        style={{
          background: AQUA_GRADIENTS.brushedAluminum,
          borderBottom: `1px solid ${AQUA_COLORS.border}`,
          height: 28,
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          position: "relative",
          userSelect: "none",
          flexShrink: 0,
          zIndex: 20000,
        }}
      >
        {/* Pinstripe */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          background: AQUA_GRADIENTS.pinstripe, pointerEvents: "none",
        }} />

        {/* Backdrop to close menus */}
        {activeMenu && (
          <div onClick={closeMenus} style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 19999,
          }} />
        )}

        {/* Left: icon + name + menus */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, position: "relative", zIndex: 20002 }}>
          {/* App icon + name menu (Settings) */}
          <MenuBarItem
            menuId="app"
            icon={
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <img src="/daydream-logo.svg" alt="" style={{ width: 16, height: 16, borderRadius: 3 }} />
                <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: "-0.3px" }}>Scope4Mac</span>
              </span>
            }
            activeMenu={activeMenu}
            onActivate={setActiveMenu}
          >
            <MenuItem label="General" onClick={() => openSettings("general")} />
            <MenuItem label="Account" onClick={() => openSettings("account")} />
            <MenuItem label="API Keys" onClick={() => openSettings("api-keys")} />
            <MenuItem label="LoRAs" onClick={() => openSettings("loras")} />
            <MenuItem label="OSC" onClick={() => openSettings("osc")} />
            <MenuSeparator />
            <MenuItem label="Plugins..." onClick={() => { setPluginsOpen(true); closeMenus(); }} />
          </MenuBarItem>

          <MenuBarItem menuId="file" label="File" activeMenu={activeMenu} onActivate={setActiveMenu}>
            <MenuItem label="Import Workflow..." shortcut={"\u2318O"} disabled />
            <MenuItem label="Export Workflow..." shortcut={"\u2318S"} disabled />
          </MenuBarItem>

          <MenuBarItem menuId="edit" label="Edit" activeMenu={activeMenu} onActivate={setActiveMenu}>
            <MenuItem label="Copy Prompt Sequence" shortcut={"\u2318C"} disabled />
            <MenuItem label="Paste Prompt Sequence" shortcut={"\u2318V"} disabled />
            <MenuSeparator />
            <MenuItem label="Copy Link Sequence" disabled />
            <MenuItem label="Paste Link Sequence" disabled />
            <MenuSeparator />
            <MenuItem label="Copy Nodes" disabled />
            <MenuItem label="Paste Nodes" disabled />
            <MenuSeparator />
            <MenuItem label="Copy Sequence and Nodes" disabled />
            <MenuItem label="Paste Sequence and Nodes" disabled />
          </MenuBarItem>

          <MenuBarItem menuId="cloud" label="Cloud" activeMenu={activeMenu} onActivate={setActiveMenu}>
            <MenuItem
              label={isConnected ? "Disconnect from Cloud" : "Connect to Cloud"}
              onClick={() => openSettings("account")}
            />
            <MenuItem label="Account Settings..." onClick={() => openSettings("account")} />
            <MenuSeparator />
            <MenuItem label={`Status: ${isConnected ? "Connected" : isConnecting ? "Connecting..." : "Disconnected"}`} disabled />
          </MenuBarItem>

          <MenuBarItem menuId="output" label="Output" activeMenu={activeMenu} onActivate={setActiveMenu}>
            {syphonOutputAvailable && (
              <MenuItem
                label="Syphon"
                checked={outputSinks?.syphon?.enabled ?? false}
                onClick={() => {
                  const current = outputSinks?.syphon;
                  onOutputSinkToggle?.("syphon", {
                    enabled: !(current?.enabled ?? false),
                    name: current?.name ?? "Scope",
                  });
                  closeMenus();
                }}
              />
            )}
            {ndiOutputAvailable && (
              <MenuItem
                label="NDI"
                checked={outputSinks?.ndi?.enabled ?? false}
                onClick={() => {
                  const current = outputSinks?.ndi;
                  onOutputSinkToggle?.("ndi", {
                    enabled: !(current?.enabled ?? false),
                    name: current?.name ?? "Scope",
                  });
                  closeMenus();
                }}
              />
            )}
            {!syphonOutputAvailable && !ndiOutputAvailable && (
              <MenuItem label="No outputs available" disabled />
            )}
            <MenuSeparator />
            <MenuItem
              label="Record Pipeline Stages"
              checked={isNodeRecording ?? false}
              onClick={() => { onNodeRecordingToggle?.(); closeMenus(); }}
            />
            <MenuItem
              label="Record Window"
              checked={isWindowRecording ?? false}
              onClick={() => { onWindowRecordingToggle?.(); closeMenus(); }}
            />
            <MenuSeparator />
            <MenuItem
              label="Recording Folder..."
              onClick={() => { onChooseRecordingDir?.(); closeMenus(); }}
            />
            <MenuItem
              label="Open Recordings"
              onClick={() => { onOpenRecordings?.(); closeMenus(); }}
            />
          </MenuBarItem>

          <MenuBarItem menuId="link" label="Link" activeMenu={activeMenu} onActivate={setActiveMenu}>
            <MenuItem
              label={linkEnabled ? "Ableton Link Settings..." : "Enable Ableton Link..."}
              onClick={() => { onLinkToggle?.(); closeMenus(); }}
            />
            <MenuSeparator />
            <MenuItem label={`Status: ${linkEnabled ? "Connected" : "Disconnected"}`} disabled />
          </MenuBarItem>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Right: status indicators */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative", zIndex: 2 }}>
          <div
            onDoubleClick={() => openSettings("account")}
            title={`Cloud: ${isConnected ? "Connected" : "Disconnected"}`}
            style={{ display: "flex", alignItems: "center", gap: 3, cursor: "default" }}
          >
            {isConnected ? (
              <Cloud className="h-3.5 w-3.5" style={{ color: AQUA_COLORS.aquaGreen }} />
            ) : isConnecting ? (
              <Cloud className="h-3.5 w-3.5 animate-pulse" style={{ color: AQUA_COLORS.aquaYellow }} />
            ) : (
              <CloudOff className="h-3.5 w-3.5" style={{ color: "#999" }} />
            )}
          </div>
          <div
            onDoubleClick={onLinkToggle}
            title={`Link: ${linkEnabled ? "Connected" : "Disconnected"}`}
            style={{ cursor: "default" }}
          >
            <Link2 className="h-3.5 w-3.5" style={{ color: linkEnabled ? AQUA_COLORS.aquaGreen : "#999" }} />
          </div>
        </div>
      </header>

      {/* Dialogs */}
      <PluginsDialog
        open={pluginsOpen}
        onClose={() => { setPluginsOpen(false); setInitialPluginPath(""); }}
        initialPluginPath={initialPluginPath}
        disabled={cloudDisabled || isConnecting}
        cloudConnected={isConnected}
      />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => { setSettingsOpen(false); setInitialTab("general"); }}
        initialTab={initialTab}
        onPipelinesRefresh={onPipelinesRefresh}
        cloudDisabled={cloudDisabled}
      />
    </>
  );
}
