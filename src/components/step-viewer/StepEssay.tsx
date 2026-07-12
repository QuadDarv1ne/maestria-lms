"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Send } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import type { StepComponentProps } from "./StepTypes";

export function StepEssay({ step, locale, submittingAssignment, onSubmitAssignment }: StepComponentProps) {
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!answer.trim()) {
      toast.error(t("course.step.writeEssayFirst", locale));
      return;
    }
    if (answer.trim().length < 100) {
      toast.error(t("course.step.essayTooShort", locale));
      return;
    }
    const assignment = step.assignments?.[0];
    if (!assignment) return;
    const result = await onSubmitAssignment(assignment.id, answer);
    if (result) {
      setSubmitted(true);
      toast.success(t("course.step.answerSent", locale));
    }
  }, [answer, step, onSubmitAssignment, locale]);

  return (
    <div className="space-y-4 mb-6">
      {step.content && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">
              {step.content}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-3 text-sm text-pink-600 dark:text-pink-400">
            <Pencil className="w-4 h-4" />
            <span className="font-medium">{t("course.step.essay", locale)}</span>
          </div>
          <Textarea
            placeholder={t("course.step.essayPlaceholder", locale)}
            className="min-h-[300px] resize-y text-sm leading-relaxed"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={submitted}
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-muted-foreground">
              {answer.length} {t("course.step.characters", locale)}
              {answer.length < 100 && answer.length > 0 && (
                <span className="text-amber-600 ml-2">
                  ({t("course.step.minimum", locale)} 100)
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {!submitted ? (
                <Button
                  className="bg-pink-600 hover:bg-pink-700 text-white"
                  onClick={handleSubmit}
                  disabled={answer.length < 100 || submittingAssignment}
                >
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
