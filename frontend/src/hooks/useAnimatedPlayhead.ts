/**
 * useAnimatedPlayhead — 60fps playhead driven by Link's linear timeline model.
 *
 * Link defines timing as a linear equation: BeatTime = HostTime × Tempo.
 * Given an anchor snapshot (barPosition, bpm, timestamp), we extrapolate
 * the current bar position at any host time using:
 *
 *   currentPos = anchorPos + elapsed × (bpm / 60)
 *
 * This runs in requestAnimationFrame, bypassing React's render cycle
 * entirely. The 15Hz tempo_update from the backend corrects drift by
 * resetting the anchor point.
 */

import { useEffect, useRef, type RefObject } from "react";

export interface TempoAnchor {
  /** Bar position from last backend update (0..beatsPerBar) */
  barPosition: number;
  /** Current BPM from Link session */
  bpm: number;
  /** Beats per bar / quantum (typically 4 for 4/4) */
  beatsPerBar: number;
  /** performance.now() timestamp when this anchor was captured */
  timestamp: number;
  /** Whether Ableton transport is playing */
  isPlaying: boolean;
}

/**
 * Drives a playhead element at 60fps using client-side BPM extrapolation.
 *
 * @param tempoAnchor - Ref to the latest tempo anchor (updated at 15Hz by data channel)
 * @param active - Whether beat sync is enabled
 * @returns Ref to attach to the playhead DOM element
 */
export function useAnimatedPlayhead(
  tempoAnchor: RefObject<TempoAnchor>,
  active: boolean,
): RefObject<HTMLDivElement | null> {
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      if (playheadRef.current) {
        playheadRef.current.style.left = "0%";
      }
      return;
    }

    const animate = () => {
      const anchor = tempoAnchor.current;
      const el = playheadRef.current;

      if (el && anchor && anchor.isPlaying && anchor.bpm > 0 && anchor.timestamp > 0) {
        const elapsedMs = performance.now() - anchor.timestamp;
        const elapsedSec = elapsedMs / 1000;
        const beatsElapsed = elapsedSec * (anchor.bpm / 60);
        const bpb = anchor.beatsPerBar || 4;
        const currentBarPos = (anchor.barPosition + beatsElapsed) % bpb;
        const progress = currentBarPos / bpb;
        el.style.left = `${progress * 100}%`;
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, tempoAnchor]);

  return playheadRef;
}
