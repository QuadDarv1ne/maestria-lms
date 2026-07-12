"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PenTool, Send } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import type { StepComponentProps } from "./StepTypes";

export function StepAssignment({ step, locale, submittingAssignment, onSubmitAssignment }: StepComponentProps) {
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!answer.trim()) {
      toast.error(t("course.step.writeAnswerFirst", locale));
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
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-3 text-sm text-indigo-600">
            <PenTool className="w-4 h-4" />
            <span className="font-medium">{t("course.step.practicalAssignment", locale)}</span>
          </div>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap">
            {step.content || t("course.step.loadingContent", locale)}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h4 className="font-semibold mb-3">{t("course.step.yourAnswer", locale)}</h4>
          <Textarea
            placeholder={t("course.step.answerPlaceholder", locale)}
            className="min-h-[120px] resize-y"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={submitted}
          />
          <div className="flex items-center gap-2 mt-3">
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleSubmit}
              disabled={submitted || submittingAssignment}
            >
              <Send className="w-4 h-4 mr-2" />
              {submitted ? t("course.step.sent", locale) : t("course.step.submitAnswer", locale)}
            </Button>
            {submitted && (
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">
                {t("course.step.awaitingReview", locale)}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
