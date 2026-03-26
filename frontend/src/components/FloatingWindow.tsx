/**
 * FloatingWindow — OS X Aqua-era utility window behavior.
 *
 * Per Aqua HIG Chapter 5:
 * - Title bar with close button, draggable
 * - Window layering: clicking brings to front without disturbing others
 * - Maintains position across show/hide
 * - Utility windows float above document windows
 *
 * Popout: creates a separate OS window via window.open() with its own
 * React root. Callbacks work cross-window via closures. Children are
 * re-rendered in the child root on each parent update.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
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
  /** Enable popout button in title bar */
  allowPopout?: boolean;
  /** Popout window dimensions */
  popoutWidth?: number;
  popoutHeight?: number;
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
  allowPopout = false,
  popoutWidth = 400,
  popoutHeight = 500,
}: FloatingWindowProps) {
  const windowRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: defaultX ?? -1, y: defaultY ?? -1 });
  const [zIndex, setZIndex] = useState(() => nextZ());
  const [isPoppedOut, setIsPoppedOut] = useState(false);
  const childWindowRef = useRef<Window | null>(null);
  const childRootRef = useRef<Root | null>(null);
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

  // Close on Escape (only when inline, not popped out)
  useEffect(() => {
    if (!open || isPoppedOut) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, isPoppedOut]);

  // Re-render children in the child window's React root on every update
  useEffect(() => {
    if (isPoppedOut && childRootRef.current) {
      childRootRef.current.render(
        <div style={{ background: bodyBackground ?? "#1a1a1a", minHeight: "100vh", ...bodyStyle }}>
          {children}
        </div>,
      );
    }
  });

  // Clean up child window on close
  useEffect(() => {
    if (!open) {
      if (childRootRef.current) {
        childRootRef.current.unmount();
        childRootRef.current = null;
      }
      if (childWindowRef.current && !childWindowRef.current.closed) {
        childWindowRef.current.close();
      }
      childWindowRef.current = null;
      if (isPoppedOut) setIsPoppedOut(false);
    }
  }, [open, isPoppedOut]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (childRootRef.current) {
        childRootRef.current.unmount();
        childRootRef.current = null;
      }
      if (childWindowRef.current && !childWindowRef.current.closed) {
        childWindowRef.current.close();
      }
    };
  }, []);

  // Bring to front — skip if already on top to avoid re-renders during drag
  const zIndexRef = useRef(zIndex);
  zIndexRef.current = zIndex;
  const bringToFront = useCallback(() => {
    if (zIndexRef.current < globalZCounter) {
      setZIndex(nextZ());
    }
  }, []);

  // Title bar drag
  const onTitleBarMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-close-button]")) return;
      if ((e.target as HTMLElement).closest("[data-popout-button]")) return;
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
    [position, bringToFront, width],
  );

  const handlePopOut = useCallback(() => {
    if (childWindowRef.current && !childWindowRef.current.closed) {
      childWindowRef.current.focus();
      return;
    }

    const left = window.screenX + (position.x > 0 ? position.x : 80);
    const top = window.screenY + (position.y > 0 ? position.y : 80);
    const features = `width=${popoutWidth},height=${popoutHeight},left=${left},top=${top},menubar=no,toolbar=no,status=no`;

    const child = window.open("about:blank", "", features);
    if (!child) return;

    childWindowRef.current = child;
    child.document.title = title;

    // Copy parent stylesheets for consistent rendering
    const parentStyles = document.querySelectorAll('style, link[rel="stylesheet"]');
    parentStyles.forEach((node) => {
      child.document.head.appendChild(node.cloneNode(true));
    });

    // Match app theme
    child.document.body.style.cssText =
      `margin:0; padding:0; background:${bodyBackground ?? "hsl(0,0%,8%)"}; color:hsl(0,0%,90%); overflow:auto; font-family:-apple-system,BlinkMacSystemFont,sans-serif;`;

    // Create a separate React root in the child window.
    // This gives the child its own event delegation — clicks, inputs,
    // and all React synthetic events work. Callbacks from the parent
    // work cross-window because they're JavaScript closures.
    const container = child.document.createElement("div");
    container.id = "popout-root";
    container.style.cssText = "padding:0; min-height:100vh;";
    child.document.body.appendChild(container);

    const childRoot = createRoot(container);
    childRootRef.current = childRoot;

    // Initial render
    childRoot.render(
      <div style={{ background: bodyBackground ?? "#1a1a1a", minHeight: "100vh", ...bodyStyle }}>
        {children}
      </div>,
    );

    setIsPoppedOut(true);

    // When child closes, close the panel
    child.addEventListener("beforeunload", () => {
      if (childRootRef.current) {
        childRootRef.current.unmount();
        childRootRef.current = null;
      }
      childWindowRef.current = null;
      setIsPoppedOut(false);
      onClose();
    });
  }, [title, popoutWidth, popoutHeight, position, bodyBackground, bodyStyle, onClose, children]);

  if (!open) return null;

  // When popped out, render nothing in the parent — child root handles rendering
  if (isPoppedOut) {
    return null;
  }

  // Inline floating window
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

        {/* Popout button (traffic light green) */}
        {allowPopout && (
          <div
            data-popout-button
            onClick={handlePopOut}
            title="Pop out to separate window"
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: AQUA_COLORS.aquaGreen ?? "#61c554",
              border: "1px solid rgba(0,0,0,0.2)",
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.2)",
              cursor: "pointer",
              flexShrink: 0,
              position: "relative",
              zIndex: 10,
              marginLeft: 4,
            }}
          />
        )}

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

        {/* Spacer to balance traffic lights */}
        <div style={{ width: allowPopout ? 28 : 12, flexShrink: 0 }} />
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
