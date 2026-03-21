/**
 * Mac OS X 10.0 Cheetah / 10.1 Puma Aqua UI (2001) Constants
 * PURGED: All blue/periwinkle tints from metal surfaces.
 */

export const AQUA_COLORS = {
  windowChromeTop: "#eeeeee",
  windowChromeMid: "#cccccc",
  windowChromeBottom: "#dddddd",
  aquaBlueTop: "#6cb4f8",
  aquaBlueMid1: "#3d8be8",
  aquaBlueMid2: "#2a6fcc",
  aquaBlueBottom: "#4a9af0",
  aquaRed: "#ff5f57",
  aquaYellow: "#febc2e",
  aquaGreen: "#28c840",
  body: "#f6f6f6",
  text: "#333",
  border: "#888",
  lcdBg: "#1a1a1a",
  lcdText: "#00ff00",
};

export const AQUA_GRADIENTS = {
  // Neutral Aluminum (No blue tint)
  brushedAluminum: `linear-gradient(180deg, #eeeeee 0%, #cccccc 50%, #dddddd 100%)`,
  // Neutral Industrial Titanium (No blue tint)
  titanium: `linear-gradient(180deg, #d8d8d8 0%, #b0b0b0 45%, #808080 50%, #b0b0b0 55%, #d0d0d0 100%)`,
  titaniumGrain: `repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.05) 1px, rgba(0,0,0,0.05) 2px)`,
  aquaGel: `linear-gradient(180deg, #6cb4f8 0%, #3d8be8 40%, #2a6fcc 60%, #4a9af0 100%)`,
  aquaGelPressed: `linear-gradient(180deg, #4a9af0 0%, #2a6fcc 40%, #3d8be8 60%, #6cb4f8 100%)`,
  pinstripe: `repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 2px)`,
};

export const AQUA_SHADOWS = {
  inner: "inset 0 1px 3px rgba(0,0,0,0.1)",
  button: "0 1px 2px rgba(0,0,0,0.25)",
  window: "0 10px 30px rgba(0,0,0,0.3)",
  lcd: "inset 0 2px 5px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.2)",
  milled: "inset 0 2px 4px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.2)",
};

export const AQUA_STYLES = {
  windowBody: {
    backgroundColor: "#f6f6f6",
    border: "1px solid #888",
    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)",
    color: "#333",
  },
  titleBar: {
    background: `linear-gradient(180deg, #eeeeee 0%, #cccccc 50%, #dddddd 100%)`,
    height: "24px",
    display: "flex",
    alignItems: "center",
    padding: "0 8px",
    position: "relative" as const,
    borderBottom: "1px solid #888",
  },
  gelButton: {
    background: `linear-gradient(180deg, #6cb4f8 0%, #3d8be8 40%, #2a6fcc 60%, #4a9af0 100%)`,
    borderRadius: "14px",
    border: "1px solid rgba(0,0,0,0.25)",
    boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
    color: "white",
    fontWeight: "bold" as const,
    textShadow: "0 -1px 0 rgba(0,0,0,0.2)",
    position: "relative" as const,
    overflow: "hidden" as const,
  },
  gelHighlight: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    height: "40%",
    background: "rgba(255,255,255,0.4)",
    pointerEvents: "none" as const,
  }
};
