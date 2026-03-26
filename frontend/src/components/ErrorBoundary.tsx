import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches uncaught React render errors and shows recovery UI
 * instead of a blank screen. Critical for live performance stability.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught render error:", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleDismiss = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "hsl(0, 0%, 6%)",
          color: "hsl(0, 0%, 90%)",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: 20,
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
          UI crashed
        </h1>
        <p style={{ fontSize: 13, color: "hsl(0, 0%, 55%)", marginBottom: 8, maxWidth: 420 }}>
          {this.state.error?.message ?? "Unknown error"}
        </p>
        <pre
          style={{
            fontSize: 11,
            color: "hsl(0, 60%, 65%)",
            background: "hsl(0, 0%, 10%)",
            padding: 12,
            borderRadius: 4,
            maxWidth: 500,
            maxHeight: 120,
            overflow: "auto",
            marginBottom: 20,
            textAlign: "left",
            width: "100%",
          }}
        >
          {this.state.error?.stack?.split("\n").slice(0, 6).join("\n")}
        </pre>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={this.handleDismiss}
            style={{
              background: "hsl(0, 0%, 20%)",
              color: "hsl(0, 0%, 80%)",
              border: "1px solid hsl(0, 0%, 30%)",
              padding: "8px 16px",
              borderRadius: 4,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Try to recover
          </button>
          <button
            onClick={this.handleReload}
            style={{
              background: "hsl(210, 70%, 50%)",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: 4,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
