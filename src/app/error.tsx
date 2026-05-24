"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useAppStore((s) => s.locale);

  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <div className="space-y-6">
        <AlertTriangle className="w-24 h-24 text-amber-500 mx-auto" />
        <h1 className="text-5xl font-bold">{t("error.serverErrorTitle", locale) || "500"}</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          {t("error.serverErrorDescription", locale) || "Произошла ошибка на сервере. Пожалуйста, попробуйте позже."}
        </p>
        {process.env.NODE_ENV === "development" && error && (
          <pre className="text-sm text-red-600 bg-red-50 dark:bg-red-950 p-4 rounded-lg max-w-lg mx-auto overflow-auto text-left">
            {error.message}
          </pre>
        )}
        <div className="flex justify-center gap-4">
          <Button onClick={reset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {t("error.tryAgain", locale) || "Попробовать снова"}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">{t("notFound.toHome", locale)}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
