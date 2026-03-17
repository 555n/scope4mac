import { useState, useEffect, useRef } from "react";
import { Settings, Cloud, CloudOff, Plug } from "lucide-react";
import { Button } from "./ui/button";
import { SettingsDialog } from "./SettingsDialog";
import { PluginsDialog } from "./PluginsDialog";
import { MemoryGauge } from "./MemoryGauge";
import { ChromeWing } from "./ChromeTribalOverlay";
import { toast } from "sonner";
import { useCloudStatus } from "../hooks/useCloudStatus";
import type { HardwareInfoResponse } from "../lib/api";

interface HeaderProps {
  className?: string;
  onPipelinesRefresh?: () => Promise<unknown>;
  cloudDisabled?: boolean;
  // External settings tab control
  openSettingsTab?: string | null;
  onSettingsTabOpened?: () => void;
  // Hardware info for memory gauge
  hardwareInfo?: HardwareInfoResponse | null;
  refreshHardwareInfo?: () => Promise<unknown>;
}

export function Header({
  className = "",
  onPipelinesRefresh,
  cloudDisabled,
  openSettingsTab,
  onSettingsTabOpened,
  hardwareInfo,
  refreshHardwareInfo,
}: HeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<
    "general" | "account" | "api-keys" | "loras" | "osc"
  >("general");
  const [initialPluginPath, setInitialPluginPath] = useState("");

  // Use shared cloud status hook - single source of truth
  const { isConnected, isConnecting, lastCloseCode, lastCloseReason } =
    useCloudStatus();

  // Track the last close code we've shown a toast for to avoid duplicates
  const lastNotifiedCloseCodeRef = useRef<number | null>(null);

  // Only show "connection lost" after we've seen a successful connection this session
  const hasBeenConnectedRef = useRef(false);

  // Track previous connection state to detect transitions for pipeline refresh
  const prevConnectedRef = useRef(false);

  // Detect unexpected disconnection and show toast
  useEffect(() => {
    if (isConnected) {
      hasBeenConnectedRef.current = true;
      lastNotifiedCloseCodeRef.current = null;
    }

    if (
      hasBeenConnectedRef.current &&
      lastCloseCode !== null &&
      lastCloseCode !== lastNotifiedCloseCodeRef.current
    ) {
      console.warn(
        `[Header] Cloud WebSocket closed unexpectedly (code=${lastCloseCode}, reason=${lastCloseReason})`
      );
      toast.error("Cloud connection lost", {
        description: `WebSocket closed ${lastCloseReason ? `(${lastCloseReason})` : ""}`,
        duration: 10000,
      });
      lastNotifiedCloseCodeRef.current = lastCloseCode;
    }
  }, [lastCloseCode, lastCloseReason, isConnected]);

  // Refresh pipelines when cloud connection status changes
  // This ensures pipeline list updates even if settings dialog is closed
  useEffect(() => {
    if (prevConnectedRef.current !== isConnected) {
      // Connection status changed - refresh pipelines to get the right list
      onPipelinesRefresh?.().catch(e =>
        console.error(
          "[Header] Failed to refresh pipelines after cloud status change:",
          e
        )
      );
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected, onPipelinesRefresh]);

  const handleCloudIconClick = () => {
    setInitialTab("account");
    setSettingsOpen(true);
  };

  // React to external requests to open a specific settings/plugins tab
  useEffect(() => {
    if (openSettingsTab) {
      if (openSettingsTab === "plugins") {
        setPluginsOpen(true);
      } else {
        setInitialTab(
          openSettingsTab as
            | "general"
            | "account"
            | "api-keys"
            | "loras"
            | "osc"
        );
        setSettingsOpen(true);
      }
      onSettingsTabOpened?.();
    }
  }, [openSettingsTab, onSettingsTabOpened]);

  useEffect(() => {
    // Handle deep link actions for plugin installation
    if (window.scope?.onDeepLinkAction) {
      return window.scope.onDeepLinkAction(data => {
        if (data.action === "install-plugin" && data.package) {
          setInitialPluginPath(data.package);
          setPluginsOpen(true);
        }
      });
    }
  }, []);

  const handleSettingsClose = () => {
    setSettingsOpen(false);
    setInitialTab("general");
  };

  const handlePluginsClose = () => {
    setPluginsOpen(false);
    setInitialPluginPath("");
  };

  return (
    <header className={`w-full px-4 py-2 ${className}`} style={{ background: "transparent" }}>
      <div className="flex items-center justify-between">
        {/* Left spacer */}
        <div className="flex-1" />

        {/* Centre: Logo */}
        <div className="flex items-center gap-1 justify-center">
          <ChromeWing side="left" />
          <img src="/happy-mac.svg" alt="Happy Mac" className="h-8 w-8" />
          <h1 className="text-xl font-medium text-foreground">Scope4Mac</h1>
          <ChromeWing side="right" />
        </div>

        {/* Right: controls in faux OS X window */}
        <div className="flex items-center flex-1 justify-end">
        {/* Right — controls in faux OS X window */}
        <div className="flex items-center gap-2" style={{
          background: "linear-gradient(180deg, rgba(200,200,210,0.85) 0%, rgba(180,180,195,0.8) 100%)",
          borderRadius: 8,
          padding: "4px 12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.6)",
          border: "1px solid rgba(150,150,160,0.5)",
        }}>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCloudIconClick}
            className={`hover:opacity-80 transition-opacity h-8 gap-1.5 px-2 ${
              isConnected
                ? "text-green-500 opacity-100"
                : isConnecting
                  ? "text-amber-400 opacity-100"
                  : "text-muted-foreground opacity-80"
            }`}
            title={
              isConnected
                ? "Cloud connected"
                : isConnecting
                  ? "Connecting to cloud..."
                  : "Enable remote inference"
            }
          >
            {isConnected ? (
              <Cloud className="h-4 w-4" />
            ) : isConnecting ? (
              <Cloud className="h-4 w-4 animate-pulse" />
            ) : (
              <CloudOff className="h-4 w-4" />
            )}
            <span className="text-xs font-medium">
              {isConnected
                ? "Connected"
                : isConnecting
                  ? "Connecting..."
                  : "Enable Remote Inference"}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPluginsOpen(true)}
            className="hover:opacity-80 transition-opacity text-muted-foreground opacity-80 h-8 w-8"
            title="Plugins"
          >
            <Plug className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            className="hover:opacity-80 transition-opacity text-muted-foreground opacity-80 h-8 w-8"
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
        </div>
        </div>
      </div>

      <PluginsDialog
        open={pluginsOpen}
        onClose={handlePluginsClose}
        initialPluginPath={initialPluginPath}
        disabled={cloudDisabled || isConnecting}
        cloudConnected={isConnected}
      />

      <SettingsDialog
        open={settingsOpen}
        onClose={handleSettingsClose}
        initialTab={initialTab}
        onPipelinesRefresh={onPipelinesRefresh}
        cloudDisabled={cloudDisabled}
      />
    </header>
  );
}
