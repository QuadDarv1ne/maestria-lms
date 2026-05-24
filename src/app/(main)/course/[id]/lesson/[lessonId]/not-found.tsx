"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { BookX, ArrowLeft } from "lucide-react";

export default function LessonNotFound() {
  const locale = useAppStore((s) => s.locale);

  return (
    <div className="container mx-auto px-4 py-16 text-center">
      <div className="space-y-6">
        <BookX className="w-24 h-24 text-muted-foreground mx-auto" />
        <h1 className="text-5xl font-bold">{t("lesson.notFound", locale) || "Урок не найден"}</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          {t("lesson.notFoundDesc", locale) || "Запрашиваемый урок не существует или был удалён."}
        </p>
        <div className="flex justify-center gap-4">
          <Button asChild>
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("notFound.toHome", locale)}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/catalog">{t("notFound.toCatalog", locale)}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
