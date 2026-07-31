"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { log } from "@/lib/logger";
import { useAppStore } from "@/lib/store";
import type { Locale } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, RefreshCw, RotateCcw, Bug } from "lucide-react";

let currentLocale: Locale = useAppStore.getState().locale;

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onRetry?: () => void;
  /** Optional error context for better logging */
  context?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  locale: Locale;
  /** Track retry attempts for exponential backoff */
  retryCount: number;
  /** Timestamp of last retry for cooldown */
  lastRetryAt: number;
}

const MAX_RETRIES = 3;
const RETRY_COOLDOWN_MS = 5000;

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private unsubscribe: (() => void) | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      locale: currentLocale,
      retryCount: 0,
      lastRetryAt: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
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
    this.setState({ errorInfo });

    const context = this.props.context ?? "unknown";
    log.error(`[Maestria ErrorBoundary:${context}]`, {
      error: error.message,
      name: error.name,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
    });

    // Report to analytics if available
    if (typeof window !== "undefined" && "fetch" in window) {
      // Fire-and-forget error reporting
      fetch("/api/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "client_error",
          context,
          error: error.message,
          stack: error.stack,
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      }).catch(() => {
        // Silently ignore — error reporting should never cause errors
      });
    }
  }

  handleRetry = () => {
    const now = Date.now();

    // Check retry cooldown
    if (now - this.state.lastRetryAt < RETRY_COOLDOWN_MS) {
      return;
    }

    // Check max retries
    if (this.state.retryCount >= MAX_RETRIES) {
      log.warn("ErrorBoundary: max retries reached, suggesting reload", {
        context: this.props.context,
        retryCount: this.state.retryCount,
      });
      return;
    }

    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prev.retryCount + 1,
      lastRetryAt: now,
    }));

    this.props.onRetry?.();
  };

  handleReload = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      lastRetryAt: 0,
    });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      lastRetryAt: 0,
    });
    window.location.href = "/";
  };

  handleCopyError = () => {
    if (!this.state.error) return;
    const errorText = [
      `Error: ${this.state.error.message}`,
      `Context: ${this.props.context ?? "unknown"}`,
      `URL: ${typeof window !== "undefined" ? window.location.href : "SSR"}`,
      `Stack: ${this.state.error.stack}`,
      this.state.errorInfo?.componentStack
        ? `Component Stack: ${this.state.errorInfo.componentStack}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    navigator.clipboard.writeText(errorText).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = errorText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const locale = this.state.locale;
      const isMaxRetries = this.state.retryCount >= MAX_RETRIES;

      return (
        <div className="min-h-[60vh] flex items-center justify-center px-4" role="alert">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-linear-to-br from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30 rounded-2xl mx-auto mb-6 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">{t("error.somethingWrong", locale)}</h2>
            <p className="text-muted-foreground mb-2">
              {t("error.description", locale)}
            </p>

            {/* Show error details in development */}
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mb-4 text-left">
                <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                  {t("error.details", locale) || "Error details"}
                </summary>
                <pre className="mt-2 text-xs text-red-600 bg-red-50 dark:bg-red-950 p-3 rounded-lg overflow-auto max-h-40 border border-red-200 dark:border-red-900">
                  {this.state.error.message}
                  {"\n\n"}
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center flex-wrap">
              {/* Retry button — hidden when max retries reached */}
              {(this.props.onRetry || isMaxRetries) && !isMaxRetries && (
                <Button onClick={this.handleRetry} variant="outline" disabled={isMaxRetries}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {t("error.retry", locale)}
                </Button>
              )}

              {/* Show reload suggestion when max retries reached */}
              {isMaxRetries && (
                <p className="w-full text-sm text-amber-600 dark:text-amber-400 mb-2">
                  {t("error.maxRetries", locale) || "Проблема не устранена. Попробуйте перезагрузить страницу."}
                </p>
              )}

              <Button onClick={this.handleReload} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                {t("error.reload", locale)}
              </Button>
              <Button onClick={this.handleGoHome} className="bg-blue-700 hover:bg-blue-800 text-white">
                <Home className="w-4 h-4 mr-2" />
                {t("error.goHome", locale)}
              </Button>

              {/* Copy error details button (dev only) */}
              {process.env.NODE_ENV === "development" && this.state.error && (
                <Button onClick={this.handleCopyError} variant="ghost" size="sm">
                  <Bug className="w-4 h-4 mr-2" />
                  {t("error.copyDetails", locale) || "Copy error"}
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
