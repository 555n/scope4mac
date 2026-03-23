/**
 * FloatingWindow — OS X Aqua-era utility window behavior.
 *
 * Per Aqua HIG Chapter 5:
 * - Title bar with close button, draggable
 * - Window layering: clicking brings to front without disturbing others
 * - Maintains position across show/hide
 * - Utility windows float above document windows
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AQUA_COLORS, AQUA_GRADIENTS } from "../lib/AquaStyles";

// Global z-index counter for window stacking
let globalZCounter = 10000;
function nextZ() {
  return ++globalZCounter;
}

interface FloatingWindowProps {
  id: string;
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  defaultX?: number;
  defaultY?: number;
  width?: number | string;
  minWidth?: number;
  /** Body background — override per window */
  bodyBackground?: string;
  /** Extra styles on body div */
  bodyStyle?: React.CSSProperties;
}

export function FloatingWindow({
  id,
  title,
  open,
  onClose,
  children,
  defaultX,
  defaultY,
  width = "auto",
  minWidth,
  bodyBackground,
  bodyStyle,
}: FloatingWindowProps) {
  const windowRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: defaultX ?? -1, y: defaultY ?? -1 });
  const [zIndex, setZIndex] = useState(() => nextZ());
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Initialize position on first open — constrain below header
  useEffect(() => {
    if (open && position.x === -1) {
      setPosition({
        x: defaultX ?? Math.max(40, window.innerWidth / 2 - 200),
        y: Math.max(64, defaultY ?? 80),
      });
    }
  }, [open, position.x, defaultX, defaultY]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Bring to front on click
  const bringToFront = useCallback(() => {
    setZIndex(nextZ());
  }, []);

  // Title bar drag
  const onTitleBarMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-close-button]")) return;
      e.preventDefault();
      bringToFront();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: position.x,
        origY: position.y,
      };

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const newX = dragRef.current.origX + ev.clientX - dragRef.current.startX;
        const newY = dragRef.current.origY + ev.clientY - dragRef.current.startY;
        // Constrain: top to below menu bar + status strip (64px),
        // bottom to keep title bar on screen, left/right keep 60px visible
        const minY = 64;
        const maxY = window.innerHeight - 40;
        const maxX = window.innerWidth - 60;
        const winW = typeof width === "number" ? width : 300;
        setPosition({
          x: Math.max(-(winW - 60), Math.min(maxX, newX)),
          y: Math.max(minY, Math.min(maxY, newY)),
        });
      };

      const onMouseUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [position, bringToFront],
  );

  if (!open) return null;

  return (
    <div
      ref={windowRef}
      data-window-id={id}
      onMouseDown={bringToFront}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        width,
        minWidth,
        zIndex,
        display: "flex",
        flexDirection: "column",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)",
        WebkitAppRegion: "no-drag" as any,
      }}
    >
      {/* OS X Aqua title bar */}
      <div
        onMouseDown={onTitleBarMouseDown}
        style={{
          background: AQUA_GRADIENTS.brushedAluminum,
          borderBottom: `1px solid ${AQUA_COLORS.border}`,
          padding: "0 8px",
          display: "flex",
          alignItems: "center",
          height: 24,
          flexShrink: 0,
          position: "relative",
          cursor: "grab",
          userSelect: "none",
        }}
      >
        {/* Pinstripe */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: AQUA_GRADIENTS.pinstripe,
            pointerEvents: "none",
          }}
        />

        {/* Close button (traffic light red) */}
        <div
          data-close-button
          onClick={onClose}
          title="Close"
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: AQUA_COLORS.aquaRed,
            border: "1px solid rgba(0,0,0,0.2)",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.2)",
            cursor: "pointer",
            flexShrink: 0,
            position: "relative",
            zIndex: 10,
          }}
        />

        {/* Title text */}
        <div style={{ flex: 1, textAlign: "center", position: "relative", zIndex: 10 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: "bold",
              color: AQUA_COLORS.text,
              textShadow: "0 1px 0 rgba(255,255,255,0.5)",
            }}
          >
            {title}
          </span>
        </div>

        {/* Spacer to balance close button */}
        <div style={{ width: 12, flexShrink: 0 }} />
      </div>

      {/* Body */}
      <div
        style={{
          background: bodyBackground ?? "#1a1a1a",
          overflowY: "auto",
          ...bodyStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}
