import { Component, ErrorInfo, ReactNode } from "react";
import { AlertOctagon, RotateCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in Cliqon application:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen w-screen bg-[var(--bg-primary)] text-[var(--text-main)] p-6">
          <div className="max-w-md w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-8 shadow-2xl text-center relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex justify-center mb-6">
              <div className="p-4 bg-red-500/10 text-red-500 rounded-full border border-red-500/20 animate-pulse">
                <AlertOctagon size={48} />
              </div>
            </div>

            <h1 className="text-2xl font-bold mb-3 tracking-tight">Something Went Wrong</h1>
            <p className="text-[var(--text-muted)] text-sm mb-6 leading-relaxed">
              Cliqon encountered an unexpected error and had to stop. Don't worry, your connection profiles and data are safe.
            </p>

            {this.state.error && (
              <div className="mb-6 p-4 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-left overflow-auto max-h-40">
                <p className="font-mono text-xs text-red-400 break-all select-all">
                  {this.state.error.name}: {this.state.error.message}
                </p>
                {this.state.error.stack && (
                  <pre className="font-mono text-[10px] text-[var(--text-muted)] mt-2 whitespace-pre-wrap break-all leading-normal select-all">
                    {this.state.error.stack.split("\n").slice(0, 5).join("\n")}
                  </pre>
                )}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-lg shadow-red-600/20 hover:scale-[1.02] cursor-pointer"
            >
              <RotateCcw size={16} />
              Restart Cliqon
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
