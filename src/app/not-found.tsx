"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Search, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  const locale = useAppStore((s) => s.locale);

  return (
    <div className="container mx-auto px-4 py-16 md:py-24 text-center" role="alert" aria-live="polite">
      <div className="max-w-md mx-auto space-y-6">
        <div className="relative animate-in slide-in-from-bottom-8 duration-600 fill-mode-both">
          <div className="text-8xl md:text-9xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent animate-gradient bg-[length:200%_200%]">
            404
          </div>
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-blue-100 dark:bg-blue-900/30 rounded-full blur-2xl opacity-50" />
          <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-violet-100 dark:bg-violet-900/30 rounded-full blur-2xl opacity-50" />
        </div>
        <h2 className="text-2xl font-semibold animate-in slide-in-from-bottom-4 duration-500 delay-200 fill-mode-both">
          {t("notFound.title", locale)}
        </h2>
        <p className="text-muted-foreground animate-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both">
          {t("notFound.description", locale)}
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2 animate-in slide-in-from-bottom-4 duration-500 delay-400 fill-mode-both">
          <Button asChild size="lg">
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              {t("notFound.toHome", locale)}
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href="/catalog">
              <Search className="w-4 h-4 mr-2" />
              {t("notFound.toCatalog", locale)}
            </Link>
          </Button>
        </div>
        <div className="animate-in fade-in duration-500 delay-500 fill-mode-both">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("notFound.goBack", locale)}
          </button>
        </div>
      </div>
    </div>
  );
}
