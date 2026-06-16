"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Send } from "lucide-react";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/store";
import type { StepData } from "./StepTypes";

interface StepEssayProps {
  step: StepData;
  locale: Locale;
  essayAnswer: string;
  setEssayAnswer: React.Dispatch<React.SetStateAction<string>>;
  essaySubmitted: boolean;
  handleEssaySubmit: () => void;
  submittingAssignment: boolean;
}

export function StepEssay({
  step,
  locale,
  essayAnswer,
  setEssayAnswer,
  essaySubmitted,
  handleEssaySubmit,
  submittingAssignment,
}: StepEssayProps) {
  return (
    <div className="space-y-4 mb-6">
      {step.content && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">{step.content}</div>
          </CardContent>
        </Card>
      )}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-3 text-sm text-pink-600 dark:text-pink-400">
            <Pencil className="w-4 h-4" />
            <span className="font-medium">{t("course.step.essay", locale)}</span>
          </div>
          <Textarea placeholder={t("course.step.essayPlaceholder", locale)} className="min-h-[300px] resize-y text-sm leading-relaxed" value={essayAnswer} onChange={(e) => setEssayAnswer(e.target.value)} disabled={essaySubmitted} />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-muted-foreground">
              {essayAnswer.length} {t("course.step.characters", locale)}
              {essayAnswer.length < 100 && essayAnswer.length > 0 && (
                <span className="text-amber-600 ml-2">({t("course.step.minimum", locale)} 100)</span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {!essaySubmitted ? (
                <Button className="bg-pink-600 hover:bg-pink-700 text-white" onClick={handleEssaySubmit} disabled={essayAnswer.length < 100 || submittingAssignment}>
                  <Send className="w-4 h-4 mr-2" />
                  {t("course.step.submitEssay", locale)}
                </Button>
              ) : (
                <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-0">
                  {t("course.step.awaitingReview", locale)}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
