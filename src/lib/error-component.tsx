import { Component, type ErrorInfo, type ReactNode } from "react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export type GawCrash = { message: string; stack?: string; componentStack?: string | null };

declare global {
  interface Window {
    __lastCrash?: GawCrash;
  }
}

const FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

export class AppCrashBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[GAW_CRASH]", error.message, errorInfo.componentStack);
    window.__lastCrash = { message: error.message, stack: error.stack, componentStack: errorInfo.componentStack };
  }

  override render() {
    if (this.state.error) return <ErrorView error={this.state.error} />;
    return this.props.children;
  }
}

function ErrorView({ error }: { error: unknown }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <span className="text-danger" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="font-display text-3xl">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-muted">{errorMessage(error)}</p>
    </main>
  );
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return <ErrorView error={error} />;
}
