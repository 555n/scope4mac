/**
 * Y2K Chrome Tribal — corner tribals removed per user request.
 * Only the logo wings remain, larger.
 */

export function ChromeTribalOverlay() {
  // No corner tribals — removed
  return null;
}

/** Chrome tribal wings flanking the Happy Mac logo — big and prominent */
export function ChromeWing({ side }: { side: "left" | "right" }) {
  return (
    <img
      src="/chrome-tribal.png" alt=""
      style={{
        width: 80, height: "auto", display: "inline-block", verticalAlign: "middle",
        transform: side === "left" ? "rotate(15deg) scaleX(-1)" : "rotate(-15deg)",
        opacity: 0.9,
        filter: "drop-shadow(0 0 8px rgba(0,255,255,0.5))",
        marginTop: -10,
      }}
    />
  );
}
