import { Component, type ErrorInfo, type ReactNode } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      "Error de renderizado no controlado.",
      error,
      info.componentStack,
    );
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="state-panel state-panel--error" role="alert">
        <div>
          <strong>No fue posible mostrar esta sección</strong>
          <p>Recargue la página para continuar.</p>
        </div>
        <button
          className="button button--primary button--md"
          type="button"
          onClick={() => window.location.reload()}
        >
          Recargar
        </button>
      </main>
    );
  }
}
