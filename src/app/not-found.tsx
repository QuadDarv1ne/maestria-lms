"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";

export default function NotFound() {
  const locale = useAppStore((s) => s.locale);

  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <div className="space-y-6">
        <h1 className="text-9xl font-bold text-muted-foreground">404</h1>
        <h2 className="text-2xl font-semibold">{t("notFound.title", locale)}</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          {t("notFound.description", locale)}
        </p>
        <div className="flex justify-center gap-4">
          <Button asChild>
            <Link href="/">{t("notFound.toHome", locale)}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/catalog">{t("notFound.toCatalog", locale)}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
