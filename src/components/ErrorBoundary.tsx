import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Optional label shown in the fallback UI (e.g. "Canvas", "App"). */
  label?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Generic class-based ErrorBoundary.
 * Used at two levels:
 *   - Global (App): catches any uncaught error and prevents full app crash.
 *   - Canvas (RFPlannerPage): catches Canvas render errors without losing the rest of the UI.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Log to console in development; a real app would send to an error tracking service.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      const { label = 'Application' } = this.props;
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex flex-col items-center justify-center gap-3 p-6 text-center h-full w-full bg-background text-foreground"
        >
          <p className="font-semibold text-red-500">{label} error</p>
          <p className="text-[13px] text-muted-foreground max-w-sm">{this.state.message}</p>
          <button
            onClick={this.handleReset}
            className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-[13px] hover:bg-indigo-700 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
