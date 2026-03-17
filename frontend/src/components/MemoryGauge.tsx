import { useState, useEffect, useCallback, useRef } from "react";
import type { HardwareInfoResponse } from "../lib/api";

interface MemoryGaugeProps {
  hardwareInfo: HardwareInfoResponse | null;
  refreshHardwareInfo: () => Promise<unknown>;
  pollIntervalMs?: number;
}

export function MemoryGauge({
  hardwareInfo,
  refreshHardwareInfo,
  pollIntervalMs = 5000,
}: MemoryGaugeProps) {
  const [allocatedGb, setAllocatedGb] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update local state when hardwareInfo changes
  useEffect(() => {
    if (hardwareInfo?.mps_allocated_gb != null) {
      setAllocatedGb(hardwareInfo.mps_allocated_gb);
    }
  }, [hardwareInfo]);

  // Poll for updated memory usage
  const poll = useCallback(async () => {
    try {
      await refreshHardwareInfo();
    } catch {
      // Silently ignore polling errors
    }
  }, [refreshHardwareInfo]);

  useEffect(() => {
    intervalRef.current = setInterval(poll, pollIntervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [poll, pollIntervalMs]);

  const totalGb = hardwareInfo?.vram_gb ?? null;

  // Don't render if we have no total memory info (non-MPS system or no data yet)
  if (totalGb == null) return null;

  const usedGb = allocatedGb ?? 0;
  const pct = Math.min((usedGb / totalGb) * 100, 100);

  // Color thresholds
  const barColor =
    pct > 90
      ? "var(--destructive)"
      : pct > 70
        ? "#CC8800"
        : "var(--g3-primary)";

  return (
    <div className="flex items-center gap-2" title={`${usedGb.toFixed(1)} / ${totalGb.toFixed(0)} GB unified memory used`}>
      <span
        className="text-xs font-medium whitespace-nowrap"
        style={{ fontFamily: "Chicago, 'Charcoal', monospace", color: "var(--text-secondary)" }}
      >
        {usedGb.toFixed(1)} / {totalGb.toFixed(0)} GB
      </span>
      {/* OS9-style beveled progress trough */}
      <div
        style={{
          width: 100,
          height: 14,
          background: "var(--field-bg)",
          border: "2px solid",
          borderColor: "var(--bevel-dark) var(--bevel-light) var(--bevel-light) var(--bevel-dark)",
          borderRadius: 2,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Fill bar */}
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: `linear-gradient(180deg, ${barColor} 0%, color-mix(in srgb, ${barColor} 70%, black) 100%)`,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)",
            transition: "width 0.6s ease-out",
          }}
        />
      </div>
    </div>
  );
}
