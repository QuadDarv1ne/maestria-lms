"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { log } from "@/lib/logger";
import { useAppStore } from "@/lib/store";
import type { Locale } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, RefreshCw, RotateCcw } from "lucide-react";

let currentLocale: Locale = "ru";

export function syncErrorBoundaryLocale() {
  currentLocale = useAppStore.getState().locale;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  locale: Locale;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private unsubscribe: (() => void) | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, locale: currentLocale };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, locale: currentLocale };
  }

  componentDidMount() {
    currentLocale = useAppStore.getState().locale;
    this.setState({ locale: currentLocale });
    this.unsubscribe = useAppStore.subscribe((state, prevState) => {
      if (state.locale !== prevState.locale) {
        currentLocale = state.locale;
        this.setState({ locale: currentLocale });
      }
    });
  }

  componentWillUnmount() {
    this.unsubscribe?.();
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    log.error("[Maestria ErrorBoundary]", {
      error: error.message,
      stack: errorInfo.componentStack,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, locale: currentLocale });
    this.props.onRetry?.();
  };

  handleReload = () => {
    this.setState({ hasError: false, error: null, locale: currentLocale });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, locale: currentLocale });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const locale = this.state.locale;

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
