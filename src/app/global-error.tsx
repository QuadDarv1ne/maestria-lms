"use client";

import { useEffect } from "react";
import { log } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useAppStore((s) => s.locale);

  useEffect(() => {
    log.error("Global error", { error: error.message, digest: error.digest });
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center space-y-6 max-w-md">
            <AlertTriangle className="w-24 h-24 text-amber-500 mx-auto" />
            <h1 className="text-5xl font-bold">500</h1>
            <p className="text-muted-foreground">
              {t("error.serverErrorDescription", locale) || "Произошла ошибка на сервере. Пожалуйста, попробуйте позже."}
            </p>
            <div className="flex justify-center gap-4">
              <Button onClick={reset}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {t("error.tryAgain", locale) || "Попробовать снова"}
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
