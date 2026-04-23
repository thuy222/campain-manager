import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: (reset: () => void) => ReactNode;
};

type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface render errors to the browser console so devs see the stack.
    // Production apps would forward to Sentry / similar here.
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(this.reset);

    return (
      <div className="card" role="alert">
        <h1>Something went wrong</h1>
        <p className="muted">{error.message || "An unexpected error occurred."}</p>
        <button type="button" className="button" onClick={this.reset}>
          Try again
        </button>
      </div>
    );
  }
}
