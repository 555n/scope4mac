import { Terminal } from "lucide-react";
import { MemoryGauge } from "./MemoryGauge";
import type { HardwareInfoResponse } from "../lib/api";

interface StatusBarProps {
  className?: string;
  fps?: number;
  bitrate?: number;
  onLogToggle?: () => void;
  isLogOpen?: boolean;
  logUnreadCount?: number;
  hardwareInfo?: HardwareInfoResponse | null;
  refreshHardwareInfo?: () => Promise<unknown>;
}

export function StatusBar({
  className = "",
  fps,
  bitrate,
  onLogToggle,
  isLogOpen,
  logUnreadCount = 0,
  hardwareInfo,
  refreshHardwareInfo,
}: StatusBarProps) {
  const MetricItem = ({
    label,
    value,
    unit = "",
  }: {
    label: string;
    value: number | string;
    unit?: string;
  }) => (
    <div className="flex items-center gap-1 text-xs">
      <span className="font-medium">{label}:</span>
      <span className="font-mono">
        {value}
        {unit}
      </span>
    </div>
  );

  const formatBitrate = (bps?: number): string => {
    if (bps === undefined || bps === 0) return "N/A";

    if (bps >= 1000000) {
      return `${(bps / 1000000).toFixed(1)} Mbps`;
    } else {
      return `${Math.round(bps / 1000)} kbps`;
    }
  };

  const fpsValue = fps !== undefined && fps > 0 ? fps.toFixed(1) : "N/A";
  const bitrateValue = formatBitrate(bitrate);

  return (
    <div
      className={`border-t bg-muted/30 px-6 py-2 flex items-center flex-shrink-0 ${className}`}
    >
      {/* Left: Log toggle */}
      <div className="flex items-center gap-2">
        {onLogToggle && (
          <button
            onClick={onLogToggle}
            className={`flex items-center gap-1 text-xs transition-colors ${
              isLogOpen
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Toggle log panel"
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Logs</span>
            {logUnreadCount > 0 && !isLogOpen && (
              <span className="bg-blue-500 text-white text-[10px] px-1 rounded-full min-w-[16px] text-center leading-4">
                {logUnreadCount > 99 ? "99+" : logUnreadCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Centre: Memory gauge */}
      <div className="flex items-center justify-center flex-1">
        <MemoryGauge hardwareInfo={hardwareInfo ?? null} refreshHardwareInfo={refreshHardwareInfo} />
      </div>

      {/* Right: Metrics + version */}
      <div className="flex items-center gap-6">
        <MetricItem label="FPS" value={fpsValue} />
        <MetricItem label="Bitrate" value={bitrateValue} />
        <span className="text-[10px] text-muted-foreground font-mono opacity-60">v0.6.0-mac</span>
      </div>
    </div>
  );
}
