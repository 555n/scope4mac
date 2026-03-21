import React from "react";
import { AQUA_COLORS, AQUA_GRADIENTS, AQUA_STYLES } from "../lib/AquaStyles";

interface AquaWindowProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

export function AquaWindow({ title, children, className = "" }: AquaWindowProps) {
  return (
    <div 
      className={`flex flex-col overflow-hidden ${className}`}
      style={{
        borderRadius: "6px 6px 0 0",
        border: `1px solid ${AQUA_COLORS.border}`,
        boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
        backgroundColor: "#f6f6f6",
      }}
    >
      {/* Title Bar */}
      <div style={AQUA_STYLES.titleBar}>
        {/* Pinstripe Background */}
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: AQUA_GRADIENTS.pinstripe,
          pointerEvents: "none",
        }} />
        
        {/* Traffic Lights */}
        <div className="flex gap-1.5 relative z-10 mr-4 shrink-0">
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: AQUA_COLORS.aquaRed, border: "1px solid rgba(0,0,0,0.2)", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.2)" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: AQUA_COLORS.aquaYellow, border: "1px solid rgba(0,0,0,0.2)", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.2)" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: AQUA_COLORS.aquaGreen, border: "1px solid rgba(0,0,0,0.2)", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.2)" }} />
        </div>

        {/* Title */}
        <div className="flex-1 text-center relative z-10 min-w-0">
          <span className="truncate block px-2" style={{ fontSize: "12px", fontWeight: "bold", color: "#333", textShadow: "0 1px 0 rgba(255,255,255,0.5)" }}>
            {title}
          </span>
        </div>
        
        <div className="w-12 shrink-0" /> {/* Spacer to balance traffic lights */}
      </div>

      {/* Body */}
      <div 
        className="flex-1 flex flex-col relative min-h-0 overflow-hidden" 
        style={{ 
          boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)", 
          backgroundColor: "#f6f6f6",
        }}
      >
        {children}
      </div>
    </div>
  );
}
