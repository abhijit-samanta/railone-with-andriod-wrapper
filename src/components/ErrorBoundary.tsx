import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = 'Something went wrong while syncing your RailOne data.';
    if (error.message) {
      try {
        const parsed = JSON.parse(error.message) as { error?: string };
        if (parsed && typeof parsed.error === 'string') {
          readable = parsed.error.includes('Quota exceeded')
            ? 'Cloud storage daily quota reached. Please try again tomorrow.'
            : 'Unable to sync with cloud storage. Please sign in again and retry.';
        }
      } catch {
        readable = error.message;
      }
    }
    return {
      hasError: true,
      message: readable,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('RailOne ErrorBoundary caught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#EEF6FB] flex items-center justify-center px-5">
          <div className="max-w-sm w-full rounded-3xl bg-white border border-slate-200 shadow-lg p-6 text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="font-display text-lg font-bold text-slate-900">
              RailOne Sync Interrupted
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[44px] rounded-xl bg-[#0066FF] hover:bg-[#0052CC] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
