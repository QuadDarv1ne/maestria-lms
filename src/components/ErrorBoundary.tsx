"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, RefreshCw, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[Maestria ErrorBoundary]", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.hash = "home";
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const locale = useAppStore.getState().locale;

      return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30 rounded-2xl mx-auto mb-6 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{t("error.somethingWrong", locale)}</h2>
            <p className="text-muted-foreground mb-2">
              {t("error.description", locale)}
            </p>
            {this.state.error && (
              <p className="text-xs text-muted-foreground/60 mb-6 font-mono bg-muted/50 p-3 rounded-lg overflow-auto max-h-24">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-3 justify-center flex-wrap">
              {this.props.onRetry && (
                <Button onClick={this.handleRetry} variant="outline">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {t("error.retry", locale)}
                </Button>
              )}
              <Button onClick={this.handleReload} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                {t("error.reload", locale)}
              </Button>
              <Button onClick={this.handleGoHome} className="bg-blue-700 hover:bg-blue-800 text-white">
                <Home className="w-4 h-4 mr-2" />
                {t("error.goHome", locale)}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
