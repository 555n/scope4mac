/**
 * useStepSequencer — manages 16-step sequencer pattern state.
 *
 * Stores the pattern (tracks with 16 steps each), handles step
 * value/random changes, and sends the full pattern to the backend
 * via sendParameterUpdate (debounced).
 */

import { useState, useCallback, useRef, useEffect, type RefObject } from "react";

export interface SequencerStep {
  value: number;   // 0-100
  random: number;  // 0-100
}

export interface SequencerTrack {
  paramKey: string;
  label: string;
  enabled: boolean;
  steps: SequencerStep[];
  paramRange: [number, number];
  isInteger: boolean;
}

function makeEmptySteps(): SequencerStep[] {
  return Array.from({ length: 16 }, () => ({ value: 50, random: 0 }));
}

export function useStepSequencer(
  sendParameterUpdate: (params: Record<string, unknown>) => void,
  isStreaming: boolean,
) {
  const [tracks, setTracks] = useState<SequencerTrack[]>([
    {
      paramKey: "strength",
      label: "Strength",
      enabled: false,
      steps: makeEmptySteps(),
      paramRange: [0.05, 1.0],
      isInteger: false,
    },
    {
      paramKey: "seed",
      label: "Seed",
      enabled: false,
      steps: makeEmptySteps(),
      paramRange: [0, 999999],
      isInteger: true,
    },
  ]);

  const sendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendPattern = useCallback(
    (updatedTracks: SequencerTrack[]) => {
      if (sendTimeoutRef.current) clearTimeout(sendTimeoutRef.current);
      sendTimeoutRef.current = setTimeout(() => {
        const payload = updatedTracks.map((t) => ({
          paramKey: t.paramKey,
          enabled: t.enabled,
          steps: t.steps,
          paramRange: t.paramRange,
          isInteger: t.isInteger,
        }));
        sendParameterUpdate({ sequencer_pattern: { tracks: payload } });
      }, 100);
    },
    [sendParameterUpdate],
  );

  const setStepValue = useCallback(
    (trackIdx: number, stepIdx: number, value: number, random: number) => {
      setTracks((prev) => {
        const next = prev.map((t, i) => {
          if (i !== trackIdx) return t;
          const newSteps = [...t.steps];
          newSteps[stepIdx] = { value, random };
          return { ...t, steps: newSteps };
        });
        sendPattern(next);
        return next;
      });
    },
    [sendPattern],
  );

  const setTrackEnabled = useCallback(
    (trackIdx: number, enabled: boolean) => {
      setTracks((prev) => {
        const next = prev.map((t, i) =>
          i === trackIdx ? { ...t, enabled } : t,
        );
        sendPattern(next);
        return next;
      });
    },
    [sendPattern],
  );

  const addDynamicTrack = useCallback(
    (paramKey: string, label: string, paramRange: [number, number], isInteger: boolean) => {
      setTracks((prev) => {
        if (prev.some((t) => t.paramKey === paramKey)) return prev;
        const next = [
          ...prev,
          {
            paramKey,
            label,
            enabled: false,
            steps: makeEmptySteps(),
            paramRange,
            isInteger,
          },
        ];
        return next;
      });
    },
    [],
  );

  const removeDynamicTrack = useCallback(
    (paramKey: string) => {
      // Don't remove hardwired tracks
      if (paramKey === "strength" || paramKey === "seed") return;
      setTracks((prev) => {
        const next = prev.filter((t) => t.paramKey !== paramKey);
        sendPattern(next);
        return next;
      });
    },
    [sendPattern],
  );

  // Re-send pattern to backend when stream starts (backend has fresh engine)
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  useEffect(() => {
    if (isStreaming) {
      // Delay to let WebRTC data channel establish
      const timer = setTimeout(() => {
        sendPattern(tracksRef.current);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, sendPattern]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (sendTimeoutRef.current) clearTimeout(sendTimeoutRef.current);
    };
  }, []);

  return {
    tracks,
    setStepValue,
    setTrackEnabled,
    addDynamicTrack,
    removeDynamicTrack,
  };
}
