import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
} from "react";

import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import {
  Play,
  Pause,
  Circle,
  Download,
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Trash2,
  Maximize2,
  Minimize2,
  Scissors,
  Hand,
  MousePointer2,
} from "lucide-react";
import { ExportDialog } from "./ExportDialog";
import { MIDIMappable } from "./MIDIMappable";
import { AQUA_GRADIENTS } from "../lib/AquaStyles";

import type { PromptItem } from "../lib/api";
import { generateRandomColor } from "../utils/promptColors";

// Timeline constants
const BASE_PIXELS_PER_SECOND = 20;
const MIN_DURATION_SECONDS = 0.5;
const MAX_ZOOM_LEVEL = 4;
const MIN_ZOOM_LEVEL = 0.25;
// Removed: DEFAULT_VISIBLE_END_TIME — visibleEndTime is now derived

// Utility functions
const timeToPosition = (
  time: number,
  visibleStartTime: number,
  pixelsPerSecond: number
): number => {
  return (time - visibleStartTime) * pixelsPerSecond;
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

// Helper function to get adjacent colors for color generation
const getAdjacentColors = (
  prompts: TimelinePrompt[],
  currentIndex: number
): string[] => {
  const adjacentColors: string[] = [];
  if (currentIndex > 0 && prompts[currentIndex - 1].color) {
    adjacentColors.push(prompts[currentIndex - 1].color!);
  }
  if (currentIndex < prompts.length - 1 && prompts[currentIndex + 1].color) {
    adjacentColors.push(prompts[currentIndex + 1].color!);
  }
  return adjacentColors;
};

// Helper function to calculate prompt box position
const calculatePromptPosition = (
  prompt: TimelinePrompt,
  index: number,
  visiblePrompts: TimelinePrompt[],
  timeToPositionFn: (time: number) => number
): number => {
  let leftPosition = Math.max(0, timeToPositionFn(prompt.startTime));

  if (index > 0) {
    const previousPrompt = visiblePrompts[index - 1];
    const previousEndPosition = Math.max(
      0,
      timeToPositionFn(previousPrompt.endTime)
    );
    leftPosition = Math.max(leftPosition, previousEndPosition);
  }

  return leftPosition;
};

// Helper function to get prompt box styling
const getPromptBoxStyle = (
  prompt: TimelinePrompt,
  leftPosition: number,
  timelineWidth: number,
  timeToPositionFn: (time: number) => number,
  isSelected: boolean,
  isLivePrompt: boolean,
  boxColor: string,
  currentTime?: number
) => {
  // Live prompts: render right edge at currentTime so block tracks cursor exactly
  const effectiveEnd = (isLivePrompt && currentTime != null)
    ? Math.max(prompt.endTime, currentTime)
    : prompt.endTime;

  return {
    left: leftPosition,
    top: "8px",
    bottom: "8px",
    width: Math.max(
      isLivePrompt ? 12 : 0,
      Math.min(
        timelineWidth - leftPosition,
        timeToPositionFn(effectiveEnd) - leftPosition
      )
    ),
    backgroundColor: isLivePrompt ? "#6B7280" : boxColor,
    borderColor: isLivePrompt ? "#9CA3AF" : boxColor,
    opacity: isSelected ? 1.0 : 0.7,
  };
};

export interface TimelinePrompt {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  prompts?: Array<{ text: string; weight: number }>;
  color?: string;
  isLive?: boolean;
  transitionSteps?: number;
  temporalInterpolationMethod?: "linear" | "slerp";
}

interface PromptTimelineProps {
  className?: string;
  prompts: TimelinePrompt[];
  onPromptsChange: (prompts: TimelinePrompt[]) => void;
  disabled?: boolean;
  isPlaying?: boolean;
  currentTime?: number;
  onPlayPause?: () => void;
  onReset?: () => void;
  onClear?: () => void;
  onPromptSubmit?: (prompt: string) => void;
  initialPrompt?: string;
  selectedPromptId?: string | null;
  onPromptSelect?: (promptId: string | null) => void;
  onPromptEdit?: (prompt: TimelinePrompt | null) => void;
  onLivePromptSubmit?: (prompts: PromptItem[]) => void;
  isCollapsed?: boolean;
  onCollapseToggle?: (collapsed: boolean) => void;
  onScrollToTime?: (scrollFn: (time: number) => void) => void;
  isStreaming?: boolean;
  isLoading?: boolean;
  videoScaleMode?: "fit" | "native";
  onVideoScaleModeToggle?: () => void;
  isDownloading?: boolean;
  onSaveGeneration?: () => void;
  isRecording?: boolean;
  onRecordingToggle?: () => void;
  onWorkflowExport?: () => void;
  onWorkflowImport?: () => void;
  onExportToDaydream?: () => void;
  isAuthenticated?: boolean;
  isExportingToDaydream?: boolean;
}

export function PromptTimeline({
  className = "",
  prompts,
  onPromptsChange,
  disabled = false,
  isPlaying = false,
  currentTime = 0,
  onPlayPause,
  onReset,
  onClear,
  onPromptSubmit: _onPromptSubmit,
  initialPrompt: _initialPrompt,
  selectedPromptId = null,
  onPromptSelect,
  onPromptEdit,
  onLivePromptSubmit: _onLivePromptSubmit,
  isCollapsed = false,
  onCollapseToggle,
  onScrollToTime,
  isStreaming = false,
  isLoading = false,
  videoScaleMode = "fit",
  onVideoScaleModeToggle,
  isDownloading = false,
  onSaveGeneration,
  isRecording = false,
  onRecordingToggle,
  onWorkflowExport,
  onWorkflowImport,
  onExportToDaydream,
  isAuthenticated = false,
  isExportingToDaydream = false,
}: PromptTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState(800);
  const [visibleStartTime, setVisibleStartTime] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [toolMode, setToolMode] = useState<"select" | "scissors" | "hand">("select");
  const [draggingPrompt, setDraggingPrompt] = useState<{ id: string; offsetSec: number } | null>(null);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");

  // Check if live mode is active
  void useMemo(() => prompts.some(p => p.isLive), [prompts]);

  // Calculate timeline metrics (must come before visiblePrompts which depends on visibleEndTime)
  const pixelsPerSecond = useMemo(
    () => BASE_PIXELS_PER_SECOND * zoomLevel,
    [zoomLevel]
  );
  const visibleTimeRange = useMemo(
    () => timelineWidth / pixelsPerSecond,
    [timelineWidth, pixelsPerSecond]
  );

  // Scroll timeline to show a specific time
  const scrollToTime = useCallback(
    (time: number) => {
      const targetVisibleStartTime = Math.max(0, time - visibleTimeRange * 0.5);
      setVisibleStartTime(targetVisibleStartTime);
    },
    [visibleTimeRange]
  );

  // Expose scroll function to parent
  useEffect(() => {
    if (onScrollToTime) {
      onScrollToTime(scrollToTime);
    }
  }, [onScrollToTime, scrollToTime]);

  // Derived — single source of truth, no state race
  const visibleEndTime = visibleStartTime + visibleTimeRange;

  // Auto-scroll: useLayoutEffect so it updates BEFORE paint
  useLayoutEffect(() => {
    if (isDraggingRef.current || !isPlaying) return;

    if (currentTime > visibleEndTime - visibleTimeRange * 0.15 ||
        currentTime < visibleStartTime + visibleTimeRange * 0.1) {
      setVisibleStartTime(Math.max(0, currentTime - visibleTimeRange * 0.3));
    }
  }, [isPlaying, currentTime, visibleEndTime, visibleStartTime, visibleTimeRange]);

  // Sort by time, then filter to visible window
  const sortedPrompts = useMemo(
    () => [...prompts].sort((a, b) => a.startTime - b.startTime),
    [prompts]
  );

  const visiblePrompts = useMemo(() => {
    return sortedPrompts.filter(
      prompt =>
        prompt.isLive || (
          prompt.startTime !== prompt.endTime &&
          prompt.endTime >= visibleStartTime &&
          prompt.startTime <= visibleEndTime
        )
    );
  }, [sortedPrompts, visibleStartTime, visibleEndTime]);

  // Update timeline width when component mounts or resizes
  useEffect(() => {
    const updateWidth = () => {
      if (timelineRef.current) {
        setTimelineWidth(timelineRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Resize state
  const resizeStateRef = useRef<{
    promptId: string;
    edge: "left" | "right";
    startClientX: number;
    startPrompt: TimelinePrompt;
    prevPrompt?: TimelinePrompt;
    nextPrompt?: TimelinePrompt;
  } | null>(null);

  const beginResize = useCallback(
    (
      e: React.MouseEvent,
      prompt: TimelinePrompt,
      edge: "left" | "right",
      prevPrompt?: TimelinePrompt,
      nextPrompt?: TimelinePrompt
    ) => {
      e.stopPropagation();
      // Only prevent resizing if the stream is actively playing OR if this is a live prompt box
      if (prompt.isLive) return;
      resizeStateRef.current = {
        promptId: prompt.id,
        edge,
        startClientX: e.clientX,
        startPrompt: { ...prompt },
        prevPrompt: prevPrompt ? { ...prevPrompt } : undefined,
        nextPrompt: nextPrompt ? { ...nextPrompt } : undefined,
      };
      document.body.style.cursor = "col-resize";
    },
    [isPlaying]
  );

  // Memoized time-to-position conversion
  const timeToPositionMemo = useCallback(
    (time: number) => timeToPosition(time, visibleStartTime, pixelsPerSecond),
    [visibleStartTime, pixelsPerSecond]
  );

  // Memoized current time cursor position
  const currentTimePosition = useMemo(() => {
    return Math.max(
      0,
      Math.min(
        timelineWidth,
        (currentTime - visibleStartTime) * pixelsPerSecond
      )
    );
  }, [currentTime, timelineWidth, visibleStartTime, pixelsPerSecond]);

  const timeMarkers = useMemo(() => {
    const targetPixelGap = 100;
    const idealInterval = targetPixelGap / pixelsPerSecond;

    const niceIntervals = [1, 2, 5, 10, 15, 30, 60];
    let interval = niceIntervals[niceIntervals.length - 1];
    for (const nice of niceIntervals) {
      if (nice >= idealInterval) {
        interval = nice;
        break;
      }
    }

    const startTime = Math.floor(visibleStartTime / interval) * interval;
    const endTime = Math.ceil(visibleEndTime / interval) * interval;

    const markers = [];
    for (let time = startTime; time <= endTime; time += interval) {
      const position = (time - visibleStartTime) * pixelsPerSecond;
      markers.push({ time, position });
    }
    return markers;
  }, [visibleEndTime, visibleStartTime, pixelsPerSecond]);

  // Hand tool: start drag on mousedown (not click)
  const beginPromptDrag = useCallback(
    (e: React.MouseEvent, prompt: TimelinePrompt) => {
      if (toolMode !== "hand" || prompt.isLive) return;
      e.preventDefault();
      e.stopPropagation();
      const track = timelineRef.current?.querySelector('[style*="height: 60px"]');
      const rect = track?.getBoundingClientRect();
      if (!rect) return;
      const mouseTime = visibleStartTime + (e.clientX - rect.left) / pixelsPerSecond;
      setDraggingPrompt({ id: prompt.id, offsetSec: mouseTime - prompt.startTime });
    },
    [toolMode, visibleStartTime, pixelsPerSecond]
  );

  const handlePromptClick = useCallback(
    (e: React.MouseEvent, prompt: TimelinePrompt) => {
      e.stopPropagation();
      if (prompt.isLive) return;

      // SCISSORS: split prompt at click position
      if (toolMode === "scissors" && onPromptsChange) {
        const rect = timelineRef.current?.querySelector('[style*="height: 60px"]')?.getBoundingClientRect();
        if (!rect) return;
        const clickX = e.clientX - rect.left;
        const clickTime = visibleStartTime + clickX / pixelsPerSecond;
        const minDur = MIN_DURATION_SECONDS;
        const splitTime = Math.max(prompt.startTime + minDur, Math.min(prompt.endTime - minDur, clickTime));
        if (splitTime <= prompt.startTime || splitTime >= prompt.endTime) return;

        const left = { ...prompt, endTime: splitTime, id: prompt.id };
        const right = { ...prompt, startTime: splitTime, id: `${prompt.id}_split_${Date.now()}` };
        const newPrompts = prompts.map(p => p.id === prompt.id ? left : p);
        newPrompts.splice(newPrompts.indexOf(left) + 1, 0, right);
        onPromptsChange(newPrompts);
        return;
      }

      // HAND: handled by onMouseDown (beginPromptDrag), not click
      if (toolMode === "hand") return;

      // SELECT: click to select, re-click selected to inline edit
      if (isPlaying && selectedPromptId !== prompt.id) return;
      const isCurrentlySelected = selectedPromptId === prompt.id;
      if (isCurrentlySelected && !prompt.isLive && toolMode === "select") {
        // Enter inline edit mode
        setEditingPromptId(prompt.id);
        setDraftText(prompt.text);
        return;
      }
      if (onPromptSelect) onPromptSelect(isCurrentlySelected ? null : prompt.id);
      if (onPromptEdit) onPromptEdit(isCurrentlySelected ? null : prompt);
    },
    [selectedPromptId, onPromptSelect, onPromptEdit, isPlaying, toolMode, visibleStartTime, pixelsPerSecond, prompts, onPromptsChange]
  );

  // Hand tool: drag handler with adjacency clamping
  useEffect(() => {
    if (!draggingPrompt || toolMode !== "hand") return;
    const handleMouseMove = (e: MouseEvent) => {
      const timeline = timelineRef.current;
      if (!timeline) return;
      const rect = timeline.querySelector('[style*="height: 60px"]')?.getBoundingClientRect();
      if (!rect) return;
      const mouseTime = visibleStartTime + (e.clientX - rect.left) / pixelsPerSecond;
      const targetTime = Math.max(0, mouseTime - draggingPrompt.offsetSec);
      if (onPromptsChange) {
        const withDurations = prompts.map(p => ({ ...p, _dur: p.endTime - p.startTime }));
        const dragged = withDurations.find(p => p.id === draggingPrompt.id);
        if (!dragged) return;

        // Only reorder if target center crosses a neighbor midpoint (hysteresis)
        const draggedCenter = targetTime + dragged._dur / 2;
        const currentIdx = withDurations.findIndex(p => p.id === dragged.id);
        const others = withDurations.filter(p => p.id !== dragged.id);

        let insertAt = currentIdx; // default: stay in place
        // Check if we should move left
        if (currentIdx > 0) {
          const leftNeighbor = withDurations[currentIdx - 1];
          const leftMid = leftNeighbor.startTime + leftNeighbor._dur / 2;
          if (draggedCenter < leftMid) {
            insertAt = others.findIndex(p => p.id === leftNeighbor.id);
          }
        }
        // Check if we should move right
        if (currentIdx < withDurations.length - 1) {
          const rightNeighbor = withDurations[currentIdx + 1];
          const rightMid = rightNeighbor.startTime + rightNeighbor._dur / 2;
          if (draggedCenter > rightMid) {
            const rightIdx = others.findIndex(p => p.id === rightNeighbor.id);
            insertAt = rightIdx + 1;
          }
        }

        const ordered = [...others.slice(0, insertAt), dragged, ...others.slice(insertAt)];

        // Repack contiguously from t=0
        let t = 0;
        const repacked = ordered.map(p => {
          const next = { ...p, startTime: t, endTime: t + p._dur };
          t = next.endTime;
          return next;
        });

        onPromptsChange(repacked);
      }
    };
    const handleMouseUp = () => {
      setDraggingPrompt(null);
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingPrompt, toolMode, visibleStartTime, pixelsPerSecond, prompts, onPromptsChange]);

  // Handle timeline clicks to deselect prompts when clicking on empty areas
  const handleTimelineClick = useCallback(
    (_e: React.MouseEvent) => {
      // Only deselect if clicking on the timeline background (not on a prompt box)
      // The prompt boxes will handle their own clicks via handlePromptClick
      if (selectedPromptId && onPromptSelect) {
        onPromptSelect(null);
      }
      if (selectedPromptId && onPromptEdit) {
        onPromptEdit(null);
      }
    },
    [selectedPromptId, onPromptSelect, onPromptEdit]
  );

  const [showExportDialog, setShowExportDialog] = useState(false);

  const handleExport = useCallback(() => {
    setShowExportDialog(true);
  }, []);

  // Drag-to-pan state
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartVisibleStartRef = useRef(0);

  // Handle mouse down on the track to begin panning
  const handleTimelineMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!timelineRef.current) return;
      if (toolMode !== "select") return; // only pan in select mode
      isDraggingRef.current = true;
      dragStartXRef.current = e.clientX;
      dragStartVisibleStartRef.current = visibleStartTime;
      // Change cursor to grabbing while dragging
      document.body.style.cursor = "grabbing";
    },
    [visibleStartTime, toolMode]
  );

  // Global listeners to update panning and finish drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Resize has priority over panning
      if (resizeStateRef.current) {
        const state = resizeStateRef.current;
        const deltaX = e.clientX - state.startClientX;
        const deltaSeconds = deltaX / pixelsPerSecond;

        // Find the prompt index directly since prompts are in chronological order
        const index = prompts.findIndex(p => p.id === state.promptId);
        if (index === -1) return;

        const current = { ...state.startPrompt };
        const prev = index > 0 ? prompts[index - 1] : null;
        const next = index < prompts.length - 1 ? prompts[index + 1] : null;

        if (state.edge === "left") {
          let newStart = current.startTime + deltaSeconds;
          const leftBound = prev ? prev.startTime + MIN_DURATION_SECONDS : 0;
          const rightBound = current.endTime - MIN_DURATION_SECONDS;
          newStart = Math.max(leftBound, Math.min(newStart, rightBound));

          current.startTime = newStart;
          if (prev) {
            // Keep adjacency
            prev.endTime = newStart;
          }
        } else {
          let newEnd = current.endTime + deltaSeconds;
          const leftBound = current.startTime + MIN_DURATION_SECONDS;
          const rightBound = next
            ? next.endTime - MIN_DURATION_SECONDS
            : Number.POSITIVE_INFINITY;
          newEnd = Math.max(leftBound, Math.min(newEnd, rightBound));

          current.endTime = newEnd;
          if (next) {
            // Keep adjacency
            next.startTime = newEnd;
          }
        }

        const updated = prompts.map((p, i) => {
          if (i === index) return current;
          if (state.edge === "left" && prev && i === index - 1) return prev;
          if (state.edge === "right" && next && i === index + 1) return next;
          return p;
        });
        onPromptsChange(updated);
        return;
      }

      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - dragStartXRef.current;
      const deltaSeconds = -deltaX / pixelsPerSecond;
      const nextStart = Math.max(
        0,
        dragStartVisibleStartRef.current + deltaSeconds
      );
      setVisibleStartTime(nextStart);
    };

    const handleMouseUp = () => {
      if (resizeStateRef.current) {
        resizeStateRef.current = null;
        document.body.style.cursor = "";
        return;
      }
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        document.body.style.cursor = "";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [pixelsPerSecond, prompts, onPromptsChange]);

  // Zoom controlled via range input in transport bar

  const currentActivePromptText = useMemo(() => {
    // Same live-time rule as render: live blocks extend to currentTime
    const active = prompts.find(p =>
      p.isLive ? currentTime >= p.startTime : currentTime >= p.startTime && currentTime <= p.endTime
    );
    return active?.text || "Welcome to Scope";
  }, [prompts, currentTime]);

  return (
    <Card className={`${className} min-w-0 overflow-hidden`} style={{ 
      position: "relative",
      background: AQUA_GRADIENTS.titanium, 
      borderRadius: "6px", 
      border: "1px solid #666", 
      boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
      padding: "2px"
    }}>
      {/* Titanium Grain Texture Layer */}
      <div style={{ position: "absolute", inset: 0, background: AQUA_GRADIENTS.titaniumGrain, pointerEvents: "none", opacity: 0.4, borderRadius: "6px" }} />

      <CardContent className={`p-4 ${isCollapsed ? "py-2" : ""} relative z-10 min-w-0`}>
        {/* iTunes 1.0 (2001) Transport Section */}
        <div className="flex items-center justify-between gap-4 mb-4 px-2 min-w-0">
          
          {/* LEFT: Button Cluster */}
          <div className="flex items-center gap-3 bg-black/10 rounded-full p-1.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] border border-white/10 shrink-0">
            <MIDIMappable actionId="reset_timeline" mappingType="trigger">
              <button
                onClick={onReset}
                disabled={disabled || isLoading || isDownloading}
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: AQUA_GRADIENTS.aquaGel,
                  border: "1px solid rgba(0,0,0,0.4)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", position: "relative", overflow: "hidden"
                }}
                className="hover:brightness-110 active:scale-90 transition-all"
              >
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "45%", background: "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, transparent 100%)", borderRadius: "50% 50% 0 0" }} />
                <RotateCcw className="h-3 w-3 text-white relative z-10" />
              </button>
            </MIDIMappable>

            <MIDIMappable actionId="toggle_pause" mappingType="trigger">
              <button
                onClick={onPlayPause}
                disabled={disabled || isLoading || isDownloading}
                style={{
                  width: 52, height: 52, borderRadius: "50%",
                  background: AQUA_GRADIENTS.aquaGel,
                  border: "1px solid rgba(0,0,0,0.4)",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.5)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", position: "relative", overflow: "hidden"
                }}
                className="hover:brightness-110 active:scale-95 transition-all"
              >
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "45%", background: "linear-gradient(180deg, rgba(255,255,255,0.6) 0%, transparent 100%)", borderRadius: "50% 50% 0 0" }} />
                {isPlaying ? (
                  <Pause className="h-7 w-7 text-white relative z-10" fill="white" />
                ) : (
                  <Play className="h-7 w-7 text-white relative z-10 fill-white ml-1" />
                )}
              </button>
            </MIDIMappable>

            <button
              onClick={onClear}
              disabled={disabled || isPlaying || isStreaming}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: AQUA_GRADIENTS.aquaGel,
                border: "1px solid rgba(0,0,0,0.4)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", position: "relative", overflow: "hidden",
                opacity: (disabled || isPlaying || isStreaming) ? 0.5 : 1
              }}
              className="hover:brightness-110 active:scale-90 transition-all"
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "45%", background: "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, transparent 100%)", borderRadius: "50% 50% 0 0" }} />
              <Trash2 className="h-3 w-3 text-white relative z-10" />
            </button>
          </div>

          {/* CENTER: LCD — taller for 2-line prompt */}
          <div className="flex-1 flex items-center px-5 min-w-0" style={{
            height: 72,
            background: "#000",
            borderRadius: 16,
            border: "2px solid #555",
            boxShadow: "inset 0 4px 8px rgba(0,0,0,1), 0 1px 2px rgba(255,255,255,0.4)",
            position: "relative",
            overflow: "hidden",
            maxWidth: "500px",
          }}>
            <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,255,0,0.03) 1px, rgba(0,255,0,0.03) 2px)", pointerEvents: "none", zIndex: 5 }} />

            <div className="flex flex-col justify-center flex-1 min-w-0 z-10">
              <div className="text-[7px] uppercase tracking-[0.4em] font-black text-gray-600 mb-1 whitespace-nowrap">{isPlaying ? "Now Generating:" : "Daydream Player"}</div>
              <div className="text-[13px] font-mono text-[#00ff00] drop-shadow-[0_0_5px_rgba(0,255,0,0.8)] leading-tight" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {currentActivePromptText}
              </div>
            </div>
            <div className="ml-4 flex flex-col items-end z-10 shrink-0">
              <div className="text-2xl font-mono text-[#00ff00] drop-shadow-[0_0_8px_rgba(0,255,0,0.9)] leading-none">
                {formatTime(currentTime)}
              </div>
              <div className="text-[8px] text-gray-600 mt-1 font-black tracking-widest uppercase">Elapsed</div>
            </div>
          </div>

          {/* RIGHT: Milled Utility Controls */}
          <div className="flex items-center gap-3 bg-black/10 rounded-full p-1.5 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] border border-white/10 shrink-0">
            {/* Zoom Slider */}
            <div className="flex items-center gap-2 px-3 py-1">
              <ZoomOut className="h-3 w-3 text-gray-700" />
              <div className="w-24">
                <input 
                  type="range" 
                  min={MIN_ZOOM_LEVEL} 
                  max={MAX_ZOOM_LEVEL} 
                  step="0.1"
                  value={zoomLevel}
                  onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                  style={{
                    width: "100%", height: "6px", appearance: "none",
                    background: "linear-gradient(180deg, #333 0%, #111 100%)", borderRadius: "3px",
                    border: "1px solid #555",
                    outline: "none",
                    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)"
                  }}
                  className="cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-600 [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
                />
              </div>
              <ZoomIn className="h-3 w-3 text-gray-700" />
            </div>

            <button
              onClick={onRecordingToggle}
              disabled={disabled || isStreaming}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: isRecording ? "#ff5f57" : "linear-gradient(180deg, #666 0%, #333 100%)",
                border: "1px solid rgba(0,0,0,0.5)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", position: "relative", overflow: "hidden"
              }}
              className={`${isRecording ? 'animate-pulse' : ''} hover:brightness-110 active:scale-90 transition-all`}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "40%", background: "linear-gradient(180deg, rgba(255,255,255,0.3) 0%, transparent 100%)", borderRadius: "50% 50% 0 0" }} />
              <Circle className={`h-3 w-3 ${isRecording ? 'fill-white text-white' : 'fill-gray-400 text-gray-400'} relative z-10`} />
            </button>
            
            <button
              onClick={() => onCollapseToggle?.(!isCollapsed)}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "linear-gradient(180deg, #fff 0%, #ddd 100%)",
                border: "1px solid #aaa",
                boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer"
              }}
              className="hover:brightness-105 active:scale-95 transition-all"
            >
              {isCollapsed ? <ChevronDown className="h-4 w-4 text-gray-700" /> : <ChevronUp className="h-4 w-4 text-gray-700" />}
            </button>
          </div>
        </div>

        {/* Toolbar (Tools + Export/Import) */}
        {!isCollapsed && (
          <div className="flex items-center justify-between mb-4 border-t border-black/20 pt-4 relative min-w-0">
             <div style={{ position: "absolute", inset: 0, top: "1px", background: "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 100%)", pointerEvents: "none" }} />

            {/* Timeline tools */}
            <div className="flex items-center gap-1 relative z-10 shrink-0 mr-3">
              {([
                { mode: "select" as const, icon: MousePointer2, label: "Select" },
                { mode: "scissors" as const, icon: Scissors, label: "Split" },
                { mode: "hand" as const, icon: Hand, label: "Move" },
              ]).map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setToolMode(mode)}
                  title={label}
                  style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: toolMode === mode ? "linear-gradient(180deg, #6cb4f8 0%, #3d8be8 100%)" : "linear-gradient(180deg, #f0f0f0 0%, #d8d8d8 100%)",
                    border: `1px solid ${toolMode === mode ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.15)"}`,
                    boxShadow: toolMode === mode ? "inset 0 1px 0 rgba(255,255,255,0.3)" : "0 1px 0 rgba(255,255,255,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  }}
                  className="hover:brightness-110 active:scale-95 transition-all"
                >
                  <Icon className={`h-3.5 w-3.5 ${toolMode === mode ? "text-white" : "text-gray-600"}`} />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 relative z-10 shrink-0">
               <Button onClick={handleExport} size="sm" variant="default">
                <Upload className="h-4 w-4 mr-1" /> Export
              </Button>
              <Button onClick={() => onWorkflowImport?.()} size="sm" variant="outline" className="border-black/30 bg-white/20">
                <Download className="h-4 w-4 mr-1" /> Import
              </Button>
            </div>
            <div className="flex items-center gap-2 relative z-10 shrink-0">
               {onVideoScaleModeToggle && (
                <Button onClick={onVideoScaleModeToggle} size="sm" variant="outline" className="border-black/30 bg-white/20">
                  {videoScaleMode === "fit" ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Timeline Visualization */}
        {!isCollapsed && (
          <div className="relative overflow-hidden w-full bg-black/5 rounded-lg p-2 border border-black/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]" ref={timelineRef}>
            {/* Time markers */}
            <div className="relative mb-1 w-full" style={{ height: "20px" }}>
              {timeMarkers.map(({ time, position }) => (
                <div
                  key={time}
                  className="absolute top-0 flex items-center justify-center"
                  style={{
                    left: time === 0 ? position + 10 : position,
                    transform: "translateX(-50%)",
                  }}
                >
                  <span className="text-gray-500 text-[9px] font-black">
                    {formatTime(time)}
                  </span>
                </div>
              ))}
            </div>

            {/* Timeline track */}
            <div
              className={`relative bg-black/20 rounded border border-black/30 overflow-hidden w-full shadow-[inset_0_2px_10px_rgba(0,0,0,0.4)] ${toolMode === "scissors" ? "cursor-crosshair" : toolMode === "hand" ? "cursor-grab" : "cursor-default"}`}
              style={{ height: "60px" }}
              onClick={handleTimelineClick}
              onMouseDown={handleTimelineMouseDown}
            >
              {/* Current time cursor */}
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-red-600 z-30 shadow-[0_0_4px_rgba(255,0,0,0.8)]"
                style={{ left: currentTimePosition }}
              />

              {/* Prompt blocks */}
              {visiblePrompts.map((prompt, index) => {
                const isSelected = selectedPromptId === prompt.id;
                const isActive = prompt.isLive
                  ? currentTime >= prompt.startTime
                  : currentTime >= prompt.startTime && currentTime <= prompt.endTime;
                let boxColor = prompt.color || generateRandomColor(getAdjacentColors(visiblePrompts, index));

                const leftPosition = calculatePromptPosition(prompt, index, visiblePrompts, timeToPositionMemo);
                void (!isPlaying || isSelected || prompt.isLive);

                return (
                  <div
                    key={prompt.id}
                    className={`absolute rounded border shadow-sm ${
                      prompt.isLive ? "" : "transition-all"
                    } ${
                      toolMode === "scissors" ? "cursor-crosshair" :
                      toolMode === "hand" ? "cursor-grab" :
                      toolMode === "select" ? "cursor-text" : "cursor-pointer"
                    }`}
                    style={{
                      ...getPromptBoxStyle(prompt, leftPosition, timelineWidth, timeToPositionMemo, isSelected, prompt.isLive || false, boxColor, currentTime),
                      borderWidth: isSelected ? '3px' : '1px',
                      borderColor: isSelected ? '#4a9af0' : 'rgba(0,0,0,0.4)',
                      boxShadow: isActive ? '0 0 12px rgba(0,255,0,0.6)' : 'none'
                    }}
                    onMouseDown={e => {
                      e.stopPropagation(); // prevent track pan
                      if (toolMode === "hand") beginPromptDrag(e, prompt);
                    }}
                    onClick={e => handlePromptClick(e, prompt)}
                  >
                    {!prompt.isLive && toolMode === "select" && (
                      <>
                        <div className="absolute top-0 bottom-0 w-2 -left-1 z-40 cursor-col-resize" onMouseDown={e => { e.stopPropagation(); beginResize(e, prompt, "left", visiblePrompts[index-1], visiblePrompts[index+1]); }} />
                        <div className="absolute top-0 bottom-0 w-2 -right-1 z-40 cursor-col-resize" onMouseDown={e => { e.stopPropagation(); beginResize(e, prompt, "right", visiblePrompts[index-1], visiblePrompts[index+1]); }} />
                      </>
                    )}
                    <div className="flex flex-col justify-center h-full px-2 overflow-hidden">
                      {editingPromptId === prompt.id ? (
                        <textarea
                          autoFocus
                          value={draftText}
                          onChange={e => setDraftText(e.target.value)}
                          onBlur={() => {
                            if (draftText.trim() && onPromptsChange) {
                              onPromptsChange(prompts.map(p => p.id === prompt.id ? { ...p, text: draftText.trim() } : p));
                            }
                            setEditingPromptId(null);
                          }}
                          onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              (e.target as HTMLTextAreaElement).blur();
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              setEditingPromptId(null);
                            }
                          }}
                          onClick={e => e.stopPropagation()}
                          onMouseDown={e => e.stopPropagation()}
                          className="w-full h-full bg-transparent border-none outline-none text-[10px] text-white font-black uppercase tracking-tighter leading-tight resize-none p-0"
                          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
                        />
                      ) : (
                      <span className="text-[10px] text-white font-black uppercase tracking-tighter truncate leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        {prompt.text}
                      </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
      <ExportDialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onSaveGeneration={onSaveGeneration ?? (() => {})}
        onSaveTimeline={onWorkflowExport ?? (() => {})}
        onExportToDaydream={onExportToDaydream ?? (() => {})}
        isRecording={isRecording}
        isAuthenticated={isAuthenticated}
        isExportingToDaydream={isExportingToDaydream}
      />
    </Card>
  );
}
