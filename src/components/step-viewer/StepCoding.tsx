"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Code2, Lightbulb, Send, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { LessonContent } from "./LessonContent";
import type { StepComponentProps } from "./StepTypes";

interface SubmissionResponse {
  submission?: { score?: number | null; status?: string };
}

/**
 * Read the graded result the server returned.
 *
 * This component used to print a canned console — "> Hello, World! > Program
 * completed successfully" — next to a green "Success" badge. Nothing executes
 * the submitted code, so that text was pure fiction: a student whose program
 * does not compile saw a passing run. The platform has no sandbox, so the
 * honest outcome is the submission status: auto-graded against the reference
 * answer when the teacher provided one, otherwise queued for review.
 */
function readOutcome(result: unknown): { score: number | null; status: string | null } {
  const submission = (result as SubmissionResponse | null)?.submission;
  return {
    score: typeof submission?.score === "number" ? submission.score : null,
    status: typeof submission?.status === "string" ? submission.status : null,
  };
}

export function StepCoding({ step, locale, submittingAssignment, onSubmitAssignment }: StepComponentProps) {
  const [codeValue, setCodeValue] = useState("");
  const [outcome, setOutcome] = useState<{ score: number | null; status: string | null } | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!codeValue.trim()) {
      toast.error(t("course.step.writeCodeFirst", locale));
      return;
    }
    const assignment = step.assignments?.[0];
    if (!assignment) return;
    const result = await onSubmitAssignment(assignment.id, codeValue);
    if (result) {
      setOutcome(readOutcome(result));
      toast.success(t("course.step.codeSent", locale));
    }
  }, [codeValue, step, onSubmitAssignment, locale]);

  const submitted = outcome !== null;
  const score = outcome?.score ?? null;

  return (
    <div className="space-y-4 mb-6">
      {step.content && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3 text-sm text-amber-600">
              <Lightbulb className="w-4 h-4" />
              <span className="font-medium">{t("course.step.theory", locale)}</span>
            </div>
            <LessonContent content={step.content} locale={locale} />
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="bg-gray-900 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-green-400" />
            <span className="text-sm text-gray-300 font-medium">{t("course.step.codeEditor", locale)}</span>
          </div>
          <div className="flex items-center gap-2" aria-hidden="true">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
        </div>
        <CardContent className="p-0">
          <Textarea
            className="font-mono text-sm bg-gray-900 text-green-400 border-0 rounded-none min-h-[200px] resize-y focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder={t("course.step.codePlaceholder", locale)}
            aria-label={t("course.step.codeEditor", locale)}
            value={codeValue}
            onChange={(e) => setCodeValue(e.target.value)}
            disabled={submitted}
          />
        </CardContent>
      </Card>

      {submitted && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <span className="text-sm font-medium">{t("course.step.executionResult", locale)}</span>
            {score !== null ? (
              <Badge className={score >= 60 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0"}>
                {t("course.step.result", locale)}: {score}%
              </Badge>
            ) : (
              <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-0">
                {t("course.step.awaitingReview", locale)}
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Button
          className="bg-amber-600 hover:bg-amber-700 text-white"
          onClick={handleSubmit}
          disabled={submitted || submittingAssignment}
        >
          <Send className="w-4 h-4 mr-2" />
          {submitted ? t("course.step.sent", locale) : t("course.step.submitCode", locale)}
        </Button>
        {submitted && (
          <Button variant="outline" onClick={() => setOutcome(null)}>
            <RotateCcw className="w-4 h-4 mr-2" />
            {t("course.step.tryAgain", locale)}
          </Button>
        )}
      </div>
    </div>
  );
}
