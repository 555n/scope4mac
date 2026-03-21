import { useEffect, useRef, useState, useCallback } from "react";
import { AquaWindow } from "./AquaWindow";
import { PlayOverlay } from "./ui/play-overlay";

interface VideoOutputProps {
  className?: string;
  remoteStream: MediaStream | null;
  isPipelineLoading?: boolean;
  isCloudConnecting?: boolean;
  isConnecting?: boolean;
  pipelineError?: string | null;
  cloudConnectStage?: string | null;
  pipelineLoadingStage?: string | null;
  isPlaying?: boolean;
  isDownloading?: boolean;
  onPlayPauseToggle?: () => void;
  onStartStream?: () => void;
  onVideoPlaying?: () => void;
  // Controller input props
  supportsControllerInput?: boolean;
  isPointerLocked?: boolean;
  onRequestPointerLock?: () => void;
  /** Ref to expose the video container element for pointer lock */
  videoContainerRef?: React.RefObject<HTMLDivElement | null>;
  /** Video scale mode: 'fit' fills available space, 'native' shows at actual resolution */
  videoScaleMode?: "fit" | "native";
}

export function VideoOutput({
  className = "",
  remoteStream,
  isPipelineLoading = false,
  isCloudConnecting = false,
  isConnecting = false,
  pipelineError: _pipelineError = null,
  cloudConnectStage = null,
  pipelineLoadingStage = null,
  isPlaying = true,
  isDownloading = false,
  onPlayPauseToggle,
  onStartStream,
  onVideoPlaying,
  supportsControllerInput = false,
  isPointerLocked = false,
  onRequestPointerLock,
  videoContainerRef,
  videoScaleMode: _videoScaleMode = "fit",
}: VideoOutputProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [hasFirstFrame, setHasFirstFrame] = useState(false);
  const overlayTimeoutRef = useRef<number | null>(null);

  // Use external ref if provided, otherwise use internal
  const containerRef = videoContainerRef || internalContainerRef;

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
      setHasFirstFrame(false); // reset on new stream
    } else {
      setHasFirstFrame(false);
    }
  }, [remoteStream]);

  // Listen for video playing event to notify parent + track first frame
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !remoteStream) return;

    const handlePlaying = () => {
      setHasFirstFrame(true);
      onVideoPlaying?.();
    };

    if (!video.paused && video.currentTime > 0 && !video.ended) {
      setHasFirstFrame(true);
      setTimeout(() => onVideoPlaying?.(), 0);
    }

    video.addEventListener("playing", handlePlaying);
    return () => {
      video.removeEventListener("playing", handlePlaying);
    };
  }, [onVideoPlaying, remoteStream]);

  const triggerPlayPause = useCallback(() => {
    if (onPlayPauseToggle && remoteStream) {
      onPlayPauseToggle();

      // Show overlay and immediately start fade out animation
      setShowOverlay(true);
      setIsFadingOut(false);

      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }

      // Start fade out immediately (CSS transition handles the timing)
      requestAnimationFrame(() => {
        setIsFadingOut(true);
      });

      // Remove overlay after animation completes (400ms transition)
      overlayTimeoutRef.current = setTimeout(() => {
        setShowOverlay(false);
        setIsFadingOut(false);
      }, 400);
    }
  }, [onPlayPauseToggle, remoteStream]);

  const handleVideoClick = () => {
    // If controller input is supported and not locked, request pointer lock
    if (supportsControllerInput && !isPointerLocked && onRequestPointerLock) {
      onRequestPointerLock();
      return;
    }

    // Otherwise toggle play/pause
    if (!isPointerLocked) {
      triggerPlayPause();
    }
  };

  // Handle spacebar press for play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if spacebar is pressed and stream is active
      if (e.code === "Space" && remoteStream) {
        // Don't trigger if user is typing in an input/textarea/select or any contenteditable element
        const target = e.target as HTMLElement;
        const isInputFocused =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable;

        if (!isInputFocused) {
          // Prevent default spacebar behavior (page scroll)
          e.preventDefault();
          triggerPlayPause();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [remoteStream, triggerPlayPause]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
    };
  }, []);

  return (
    <AquaWindow title="Video Output" className={`h-full flex-col ${className}`}>
      <div style={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden", background: "#e8e8e8" }}>
        {remoteStream ? (
          <div
            ref={containerRef}
            className="absolute inset-0 cursor-pointer"
            onClick={handleVideoClick}
          >
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
            {/* Play/Pause Overlay */}
            {showOverlay && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                  className={`transition-all duration-400 ${
                    isFadingOut
                      ? "opacity-0 scale-150"
                      : "opacity-100 scale-100"
                  }`}
                >
                  <PlayOverlay isPlaying={isPlaying} size="lg" />
                </div>
              </div>
            )}
            {/* Waiting for first frame — show until video actually plays */}
            {!hasFirstFrame && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#e8e8e8] pointer-events-none z-10">
                <img src="/happy-mac.svg" alt="" className="h-10 w-10 opacity-50" />
                <p className="text-sm text-[#555]">Waiting for video...</p>
                <div style={{
                  width: 160, height: 16, borderRadius: 8,
                  background: "linear-gradient(180deg, #e0e0e0 0%, #c8c8c8 50%, #d4d4d4 100%)",
                  border: "1px solid rgba(0,0,0,0.2)", overflow: "hidden", position: "relative",
                }}>
                  <div style={{
                    position: "absolute", inset: 2, borderRadius: 6,
                    background: "linear-gradient(180deg, #6cb4f8 0%, #3d8be8 40%, #2a6fcc 60%, #4a9af0 100%)",
                  }}>
                    <div style={{
                      position: "absolute", inset: 0, borderRadius: 6,
                      backgroundImage: "repeating-linear-gradient(55deg, transparent, transparent 6px, rgba(255,255,255,0.15) 6px, rgba(255,255,255,0.15) 12px)",
                      backgroundSize: "24px 100%",
                      animation: "candybar-stripes 0.5s linear infinite",
                    }} />
                  </div>
                </div>
              </div>
            )}
            {/* Controller Input Overlay */}
            {supportsControllerInput && !isPointerLocked && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg text-sm pointer-events-none">
                Click to enable controller input
              </div>
            )}
          </div>
        ) : isDownloading || isCloudConnecting || isPipelineLoading || isConnecting ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-[#555]">
            <img src="/happy-mac.svg" alt="" className="h-12 w-12 opacity-60" />
            <p key={pipelineLoadingStage || cloudConnectStage || "load"} className="text-sm animate-fade-in">
              {isDownloading ? "Downloading models..." :
               isCloudConnecting ? (cloudConnectStage || "Connecting to cloud...") :
               isPipelineLoading ? (pipelineLoadingStage || "Loading pipeline...") :
               "Connecting..."}
            </p>
            <div style={{
              width: 200, height: 20, borderRadius: 10,
              background: "linear-gradient(180deg, #e0e0e0 0%, #c8c8c8 50%, #d4d4d4 100%)",
              border: "1px solid rgba(0,0,0,0.3)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 3px rgba(0,0,0,0.2)",
              overflow: "hidden", position: "relative",
            }}>
              <div style={{
                position: "absolute", inset: 2, borderRadius: 8,
                background: "linear-gradient(180deg, #6cb4f8 0%, #3d8be8 40%, #2a6fcc 60%, #4a9af0 100%)",
              }}>
                <div style={{
                  position: "absolute", inset: 0, borderRadius: 8,
                  backgroundImage: "repeating-linear-gradient(55deg, transparent, transparent 8px, rgba(255,255,255,0.15) 8px, rgba(255,255,255,0.15) 16px)",
                  backgroundSize: "32px 100%",
                  animation: "candybar-stripes 0.6s linear infinite",
                }} />
                <div style={{
                  position: "absolute", top: 1, left: 4, right: 4, height: "45%",
                  borderRadius: "6px 6px 50% 50%",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.05) 100%)",
                }} />
              </div>
            </div>
            <style>{`
              @keyframes candybar-stripes { 0% { background-position: 0 0; } 100% { background-position: 32px 0; } }
            `}</style>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#e8e8e8" }}>
            {/* QuickTime-style gel play button */}
            <button
              onClick={onStartStream}
              data-testid="start-stream-button"
              aria-label="Start stream"
              style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "linear-gradient(180deg, #6cb4f8 0%, #3d8be8 35%, #2a6fcc 65%, #4a9af0 100%)",
                border: "2px solid rgba(0,0,0,0.25)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", position: "relative", overflow: "hidden",
              }}
              className="hover:brightness-110 active:brightness-90 transition-all active:scale-95"
            >
              {/* Gloss */}
              <div style={{
                position: "absolute", top: 2, left: "15%", right: "15%", height: "40%",
                borderRadius: "50%",
                background: "linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%)",
              }} />
              {/* Play triangle */}
              <svg width="28" height="32" viewBox="0 0 28 32" style={{ marginLeft: 4, position: "relative", zIndex: 1 }}>
                <polygon points="0,0 28,16 0,32" fill="white" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </AquaWindow>
  );
}
