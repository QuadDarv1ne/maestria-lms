"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useAppStore((s) => s.locale);

  return (
    <div className="container mx-auto px-4 py-16 md:py-24 text-center animate-in fade-in duration-500">
      <div className="max-w-md mx-auto space-y-6">
        <div className="w-24 h-24 rounded-full bg-red-50 dark:bg-red-950/50 flex items-center justify-center mx-auto animate-in zoom-in duration-500 fill-mode-both">
          <AlertTriangle className="w-12 h-12 text-red-500 animate-pulse" />
        </div>
        <h1 className="text-5xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent animate-in slide-in-from-bottom-4 duration-500 delay-200 fill-mode-both">
          500
        </h1>
        <p className="text-muted-foreground animate-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both">
          {t("error.serverErrorDescription", locale)}
        </p>
        {process.env.NODE_ENV === "development" && error && (
          <pre className="text-sm text-red-600 bg-red-50 dark:bg-red-950 p-4 rounded-lg max-w-lg mx-auto overflow-auto text-left border border-red-200 dark:border-red-900 animate-in fade-in duration-500 delay-400 fill-mode-both">
            {error.message}
          </pre>
        )}
        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2 animate-in slide-in-from-bottom-4 duration-500 delay-400 fill-mode-both">
          <Button onClick={reset} size="lg">
            <RefreshCw className="w-4 h-4 mr-2" />
            {t("error.tryAgain", locale)}
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              {t("notFound.toHome", locale)}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
