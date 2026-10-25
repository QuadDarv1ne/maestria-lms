"use client";

import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { t } from "@/lib/i18n";
import { LessonContent } from "./LessonContent";
import type { StepComponentProps } from "./StepTypes";

export function StepText({ step, locale }: StepComponentProps) {
  return (
    <Card className="border-0 shadow-sm mb-6">
      <CardContent className="p-6 md:p-8">
        <div className="flex items-center gap-2 mb-4 text-sm text-violet-600 dark:text-violet-400">
          <FileText className="w-4 h-4" />
          <span className="font-medium">{t("course.step.theory", locale)}</span>
        </div>
        <LessonContent content={step.content} locale={locale} />
      </CardContent>
    </Card>
  );
}
