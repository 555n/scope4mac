/**
 * Ableton Live Dark Theme — Design Constants
 *
 * Derived from Ableton Live's .ask skin format (Dark theme, Live 11/12).
 * Font: Ableton Sans (proprietary) — use system sans-serif / Source Sans Pro as fallback.
 */

export const ABLETON_COLORS = {
  // Backgrounds (darkest to lightest)
  surfaceArea: "#1A1A1A",
  retroDisplayBg: "#1E1E1E",
  displayBg: "#282828",
  surfaceBg: "#2E3133",
  controlFrame: "#3F4446",
  desktop: "#424242",
  detailBg: "#474747",
  controlBg: "#505658",

  // Text hierarchy
  textPrimary: "#D2D2D2",
  textSecondary: "#949494",
  textDisabled: "#787878",
  textMuted: "#555555",
  textOnAccent: "#141414",
  textClip: "#000000",

  // Accent / functional
  accent: "#F7A738",           // ChosenDefault — primary amber
  accentLight: "#F9CD90",      // PotiNeedle — light amber
  accentDark: "#C47608",       // ViewCheckControlEnabledOn — dark amber
  progress: "#FFB532",         // Progress bar
  playGreen: "#00FF81",        // ChosenPlay
  recordRed: "#FF4032",        // ChosenRecord
  alert: "#FF476F",            // Alert / automation
  modCyan: "#6DD7FF",          // Modulation
  learnBlue: "#53AAFC",        // MIDI learn

  // Controls
  controlFill: "#7A7A7A",      // ControlFillHandle
  scrollbar: "#828282",
  poti: "#4F4F4F",             // Knob body
  potiNeedle: "#F9CD90",
  rangeActive: "#C47608",
  rangeDisabled: "#4F4F4F",

  // LCD / Retro display
  lcdBg: "#1E1E1E",
  lcdLine: "#464646",
  lcdFg: "#F7A93B",            // Amber foreground
  lcdFg2: "#6DD7FF",           // Cyan secondary
  lcdScaleText: "rgba(255,255,255,0.4)",

  // Selection
  selectionBg: "#C5E0BC",
  selectionFg: "#141414",
  selectionFrame: "#D2D2D2",

  // Shadows
  shadowDark: "rgba(0,0,0,0.65)",
  shadowLight: "rgba(85,85,85,0.63)",

  // Borders
  border: "#3F4446",
  borderSubtle: "rgba(255,255,255,0.06)",

  // View controls
  viewOn: "#F7A738",
  viewOff: "#40434B",
};

export const ABLETON_FONTS = {
  // Ableton Sans is proprietary — use these as closest match
  ui: "'Source Sans Pro', 'Segoe UI', system-ui, -apple-system, sans-serif",
  mono: "'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace",
};

export const ABLETON_STYLES = {
  /** Flat rectangular button — inactive */
  button: {
    background: ABLETON_COLORS.viewOff,
    color: ABLETON_COLORS.textPrimary,
    border: `1px solid ${ABLETON_COLORS.border}`,
    borderRadius: 2,
    fontFamily: ABLETON_FONTS.ui,
    fontSize: 11,
    fontWeight: 500,
    padding: "3px 8px",
    cursor: "pointer",
  } as React.CSSProperties,

  /** Flat rectangular button — active/on */
  buttonOn: {
    background: ABLETON_COLORS.accent,
    color: ABLETON_COLORS.textOnAccent,
    border: `1px solid ${ABLETON_COLORS.accentDark}`,
    borderRadius: 2,
    fontFamily: ABLETON_FONTS.ui,
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 8px",
    cursor: "pointer",
  } as React.CSSProperties,

  /** LCD/retro display panel */
  lcdPanel: {
    background: ABLETON_COLORS.lcdBg,
    border: `1px solid ${ABLETON_COLORS.border}`,
    borderRadius: 2,
    padding: "6px 8px",
    fontFamily: ABLETON_FONTS.mono,
    color: ABLETON_COLORS.lcdFg,
  } as React.CSSProperties,

  /** Section label */
  sectionLabel: {
    fontFamily: ABLETON_FONTS.ui,
    fontSize: 10,
    fontWeight: 600,
    color: ABLETON_COLORS.textSecondary,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  } as React.CSSProperties,

  /** Panel background (mid-level surface) */
  panel: {
    background: ABLETON_COLORS.surfaceBg,
    borderRadius: 0,
  } as React.CSSProperties,

  /** Control text input */
  textInput: {
    background: "#323232",
    color: ABLETON_COLORS.textPrimary,
    border: `1px solid ${ABLETON_COLORS.border}`,
    borderRadius: 1,
    fontFamily: ABLETON_FONTS.mono,
    fontSize: 11,
    padding: "2px 6px",
    outline: "none",
  } as React.CSSProperties,

  /** Slider track */
  sliderTrack: {
    background: ABLETON_COLORS.retroDisplayBg,
    border: `1px solid ${ABLETON_COLORS.border}`,
    borderRadius: 1,
    height: 6,
  } as React.CSSProperties,
};
