import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, info: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] caught error:', error, info);
    this.setState({ info });
  }

  reset = () => {
    this.setState({ hasError: false, error: null, info: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-background text-foreground p-8 overflow-auto">
          <div className="max-w-2xl w-full rounded-3xl border border-destructive/30 bg-destructive/5 p-8 space-y-4">
            <p className="text-xs uppercase tracking-[0.22em] text-destructive">
              {this.props.fallbackTitle ?? 'Something broke'}
            </p>
            <h2 className="text-2xl">Render error in this view</h2>
            <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground bg-secondary/40 p-4 rounded-xl border border-border max-h-64 overflow-auto">
              {this.state.error?.message ?? 'Unknown error'}
              {'\n\n'}
              {this.state.error?.stack ?? ''}
            </pre>
            <button
              type="button"
              onClick={this.reset}
              className="rounded-full bg-accent text-accent-foreground px-5 py-2 text-sm font-semibold hover:brightness-110"
            >
              Dismiss
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
