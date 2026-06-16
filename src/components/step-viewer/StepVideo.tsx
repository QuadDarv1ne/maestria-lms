"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, CheckCircle2 } from "lucide-react";
import { t } from "@/lib/i18n";
import type { StepComponentProps } from "./StepTypes";

export function StepVideo({ step, locale }: StepComponentProps) {
  return (
    <Card className="border-0 shadow-sm mb-6 overflow-hidden">
      <CardContent className="p-0">
        <div className="bg-gray-900 aspect-video flex items-center justify-center relative group">
          {step.videoUrl ? (
            <iframe
              src={step.videoUrl}
              className="w-full h-full"
              allowFullScreen
              title={step.title}
            />
          ) : (
            <div className="text-center text-white">
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-white/20 transition-colors cursor-pointer">
                <Play className="w-10 h-10 ml-1" />
              </div>
              <p className="text-lg font-medium mb-1">{t("course.step.videoLesson", locale)}</p>
              <p className="text-sm opacity-50">{t("course.step.clickToPlay", locale)}</p>
            </div>
          )}
          {step.completed && (
            <div className="absolute top-3 right-3 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {t("course.step.watched", locale)}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
