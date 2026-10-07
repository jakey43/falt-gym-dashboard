// Visar felet på skärmen i stället för en tom sida om något kraschar.
import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { del } from "idb-keyval";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Fält kraschade:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="app" style={{ paddingTop: 40 }}>
        <div className="card">
          <div className="label">Något gick fel</div>
          <h1 className="page-title" style={{ fontSize: 32, margin: "10px 0 14px" }}>
            Appen kraschade
          </h1>
          <p>Skicka gärna felmeddelandet nedan så kan det rättas.</p>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "var(--paper)",
              padding: 14,
              borderRadius: 12,
              fontSize: 12.5,
              maxHeight: 260,
              overflow: "auto",
            }}
          >
            {`${error.name}: ${error.message}\n\n${(error.stack ?? "").split("\n").slice(0, 8).join("\n")}\n\n${navigator.userAgent}`}
          </pre>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" onClick={() => location.reload()}>
              Ladda om
            </button>
            <button
              className="btn danger"
              onClick={async () => {
                if (!confirm("Radera all sparad data i appen och starta om?")) return;
                await del("falt:data:v1").catch(() => {});
                location.reload();
              }}
            >
              Rensa sparad data
            </button>
          </div>
        </div>
      </div>
    );
  }
}
