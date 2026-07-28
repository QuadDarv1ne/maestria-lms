"use client";

import { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, CheckCircle2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import type { StepComponentProps } from "./StepTypes";
import { shuffleArray } from "./StepTypes";

export function StepMatching({ step, locale, submittingAssignment, onSubmitAssignment }: StepComponentProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const assignments = step.assignments;
  const pairs = useMemo<Array<{ left: string; right: string }>>(() => {
    if (!assignments?.[0]?.options) return [];
    try { return JSON.parse(assignments[0].options); } catch { return []; }
  }, [assignments]);

  const rightOptions = useMemo(() => shuffleArray(pairs.map(p => p.right)), [pairs]);

  const handleSubmit = useCallback(async () => {
    const allAnswered = pairs.every((p) => answers[p.left]);
    if (!allAnswered) {
      toast.error(t("course.step.matchAllPairs", locale));
      return;
    }
    const assignment = step.assignments?.[0];
    if (!assignment) return;
    const answerPairs = pairs.map((p) => ({ left: p.left, right: answers[p.left] }));
    const result = await onSubmitAssignment(assignment.id, answerPairs);
    if (result) {
      setSubmitted(true);
      toast.success(t("course.step.answerSent", locale));
    }
  }, [answers, pairs, step, onSubmitAssignment, locale]);

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
          <div className="flex items-center gap-2 mb-4 text-sm text-teal-600 dark:text-teal-400">
            <ArrowUpDown className="w-4 h-4" />
            <span className="font-medium">{t("course.step.matchingExercise", locale)}</span>
          </div>
          {pairs.length === 0 ? (
            <p className="text-muted-foreground">{t("course.step.noPairs", locale)}</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {pairs.map((pair) => (
                  <div key={pair.left} className="flex items-center gap-4">
                    <div className="flex-1 p-3 bg-teal-50 dark:bg-teal-950/30 rounded-lg border border-teal-200 dark:border-teal-800">
                      <span className="text-sm font-medium">{pair.left}</span>
                    </div>
                    <span className="text-muted-foreground">→</span>
                    <select
                      className="flex-1 p-2 border rounded-lg text-sm"
                      value={answers[pair.left] || ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [pair.left]: e.target.value }))}
                      disabled={submitted}
                    >
                      <option value="">{t("course.step.selectMatch", locale)}</option>
                      {rightOptions.map((opt, oi) => (
                        <option key={`${opt}-${oi}`} value={opt}>{opt}</option>
                      ))}
                    </select>
                    {submitted && (
                      answers[pair.left] === pair.right ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <X className="w-5 h-5 text-red-600" />
                      )
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-4">
                {!submitted ? (
                  <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleSubmit} disabled={submitted || submittingAssignment}>
                    <Send className="w-4 h-4 mr-2" />
                    {t("course.step.submitAnswer", locale)}
                  </Button>
                ) : (
                  <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-0">
                    {t("course.step.sent", locale)}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
