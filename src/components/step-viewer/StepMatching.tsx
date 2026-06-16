"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowUpDown, CheckCircle2, Send, X } from "lucide-react";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/store";
import type { StepData } from "./StepTypes";

interface StepMatchingProps {
  step: StepData;
  locale: Locale;
  matchingAnswers: Record<string, string>;
  setMatchingAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  matchingSubmitted: boolean;
  handleMatchingSubmit: () => void;
  submittingAssignment: boolean;
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function StepMatching({
  step,
  locale,
  matchingAnswers,
  setMatchingAnswers,
  matchingSubmitted,
  handleMatchingSubmit,
  submittingAssignment,
}: StepMatchingProps) {
  let pairs: Array<{ left: string; right: string }> = [];
  if (step.assignments?.[0]?.options) {
    try { pairs = JSON.parse(step.assignments[0].options); } catch { pairs = []; }
  }
  const rightOptions = shuffleArray(pairs.map(p => p.right));

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
                      value={matchingAnswers[pair.left] || ""}
                      onChange={(e) => setMatchingAnswers((prev) => ({ ...prev, [pair.left]: e.target.value }))}
                      disabled={matchingSubmitted}
                    >
                      <option value="">{t("course.step.selectMatch", locale)}</option>
                      {rightOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    {matchingSubmitted && (
                      matchingAnswers[pair.left] === pair.right ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <X className="w-5 h-5 text-red-600" />
                      )
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-4">
                {!matchingSubmitted ? (
                  <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={handleMatchingSubmit} disabled={matchingSubmitted || submittingAssignment}>
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
