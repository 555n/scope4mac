import { useState, useEffect, useRef } from "react";
import { Settings, Cloud, CloudOff, Plug, Link2 } from "lucide-react";
import { Button } from "./ui/button";
import { SettingsDialog } from "./SettingsDialog";
import { PluginsDialog } from "./PluginsDialog";
// ChromeWing moved to left panel branding
import { toast } from "sonner";
import { useCloudStatus } from "../hooks/useCloudStatus";

interface HeaderProps {
  className?: string;
  onPipelinesRefresh?: () => Promise<unknown>;
  cloudDisabled?: boolean;
  // External settings tab control
  openSettingsTab?: string | null;
  onSettingsTabOpened?: () => void;
  // Link drawer
  linkEnabled?: boolean;
  onLinkToggle?: () => void;
}

export function Header({
  className = "",
  onPipelinesRefresh,
  cloudDisabled,
  openSettingsTab,
  onSettingsTabOpened,
  linkEnabled,
  onLinkToggle,
}: HeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pluginsOpen, setPluginsOpen] = useState(false);
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

    if (
      hasBeenConnectedRef.current &&
      lastCloseCode !== null &&
      lastCloseCode !== lastNotifiedCloseCodeRef.current
    ) {
      toast.error("Cloud connection lost", {
        description: `WebSocket closed ${lastCloseReason ? `(${lastCloseReason})` : ""}`,
        duration: 10000,
      });
      lastNotifiedCloseCodeRef.current = lastCloseCode;
    }
  }, [lastCloseCode, lastCloseReason, isConnected]);

  useEffect(() => {
    if (prevConnectedRef.current !== isConnected) {
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
    <header className={`w-full px-2 py-1 ${className}`} style={{ background: "transparent" }}>
      <div className="flex items-center justify-end">

          <div className="flex items-center gap-2" style={{
            background: "linear-gradient(180deg, #eeeeee 0%, #cccccc 50%, #dddddd 100%)",
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
                onClick={onLinkToggle}
                className={`hover:opacity-80 transition-opacity h-8 w-8 ${
                  linkEnabled
                    ? "text-green-500 opacity-100"
                    : "text-muted-foreground opacity-80"
                }`}
                title={linkEnabled ? "Ableton Link (connected)" : "Ableton Link"}
              >
                <Link2 className="h-4 w-4" />
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
