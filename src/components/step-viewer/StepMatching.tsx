"use client";

import { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, Send } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { LessonContent } from "./LessonContent";
import type { StepComponentProps } from "./StepTypes";
import type { PublicMatchingOptions } from "@/lib/assignment-options";

interface GradedResult {
  score?: number | null;
}

function gradedScore(result: unknown): number | null {
  const submission = (result as { submission?: GradedResult } | null)?.submission;
  return typeof submission?.score === "number" ? submission.score : null;
}

export function StepMatching({ step, locale, submittingAssignment, onSubmitAssignment }: StepComponentProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const assignments = step.assignments;
  // The server sends `{ left: [...], right: [...] }` with the right column
  // already deranged, so the correct partner of a row is not recoverable from
  // the payload. Answering is by index, which is what grading compares.
  const options = useMemo<PublicMatchingOptions>(() => {
    if (!assignments?.[0]?.options) return { left: [], right: [] };
    try {
      const parsed = JSON.parse(assignments[0].options);
      if (Array.isArray(parsed)) {
        // Legacy shape: an array of { left, right } pairs. The rows are still
        // usable, the right column is not — it *was* the answer, so it is
        // dropped rather than shown as an option list.
        return { left: parsed.map((p: { left?: unknown }) => String(p?.left ?? "")), right: [] };
      }
      return {
        left: Array.isArray(parsed?.left) ? parsed.left.map(String) : [],
        right: Array.isArray(parsed?.right) ? parsed.right.map(String) : [],
      };
    } catch {
      return { left: [], right: [] };
    }
  }, [assignments]);

  const leftItems = options.left;
  const rightOptions = options.right;

  const handleSubmit = useCallback(async () => {
    const allAnswered = leftItems.every((left) => answers[left]);
    if (!allAnswered) {
      toast.error(t("course.step.matchAllPairs", locale));
      return;
    }
    const assignment = step.assignments?.[0];
    if (!assignment) return;
    const answerPairs = leftItems.map((left) => ({ left, right: answers[left] }));
    const result = await onSubmitAssignment(assignment.id, answerPairs);
    if (result) {
      setSubmitted(true);
      setScore(gradedScore(result));
      toast.success(t("course.step.answerSent", locale));
    }
  }, [answers, leftItems, step, onSubmitAssignment, locale]);

  return (
    <div className="space-y-4 mb-6">
      {step.content && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <LessonContent content={step.content} locale={locale} />
          </CardContent>
        </Card>
      )}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4 text-sm text-teal-600 dark:text-teal-400">
            <ArrowUpDown className="w-4 h-4" />
            <span className="font-medium">{t("course.step.matchingExercise", locale)}</span>
          </div>
          {leftItems.length === 0 ? (
            <p className="text-muted-foreground">{t("course.step.noPairs", locale)}</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {leftItems.map((left) => (
                  <div key={left} className="flex items-center gap-4">
                    <div className="flex-1 p-3 bg-teal-50 dark:bg-teal-950/30 rounded-lg border border-teal-200 dark:border-teal-800">
                      <span className="text-sm font-medium">{left}</span>
                    </div>
                    <span className="text-muted-foreground">→</span>
                    <select
                      className="flex-1 p-2 border rounded-lg text-sm"
                      value={answers[left] || ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [left]: e.target.value }))}
                      disabled={submitted}
                    >
                      <option value="">{t("course.step.selectMatch", locale)}</option>
                      {rightOptions.map((opt, oi) => (
                        <option key={`${opt}-${oi}`} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {/* Per-row correctness is deliberately absent: the correct partner
                  is not in the payload any more, and a checkmark on every
                  answered row would claim an accuracy the client cannot know.
                  The graded score is shown instead. */}
              <div className="flex items-center gap-2 mt-4">
                {!submitted ? (
                  <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSubmit} disabled={submitted || submittingAssignment}>
                    <Send className="w-4 h-4 mr-2" />
                    {t("course.step.submitAnswer", locale)}
                  </Button>
                ) : (
                  <>
                    <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-0">
                      {t("course.step.sent", locale)}
                    </Badge>
                    {score !== null && (
                      <Badge variant="outline">
                        {t("course.step.result", locale)}: {score}%
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
