"use client";

import { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HelpCircle, CheckCircle2, Send, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { LessonContent } from "./LessonContent";
import type { StepComponentProps } from "./StepTypes";

type AnswerOutcome = "correct" | "incorrect" | "pending";

interface SubmissionResponse {
  submission?: { score?: number | null };
}

/**
 * Turn the graded submission into what the UI may claim.
 *
 * The lesson payload deliberately carries no `correctAnswer`, so the browser
 * cannot decide right from wrong on its own — the previous version did exactly
 * that against an `undefined` field and therefore marked every answer wrong
 * without ever creating a submission. The server is now the only source of
 * truth, and `score: null` (free-form or manually reviewed work) stays
 * "pending" rather than being reported as a failure.
 */
function outcomeFrom(result: unknown): { outcome: AnswerOutcome; score: number | null } {
  const score = (result as SubmissionResponse | null)?.submission?.score;
  if (typeof score !== "number") return { outcome: "pending", score: null };
  return { outcome: score >= 100 ? "correct" : "incorrect", score };
}

export function StepQuiz({ step, locale, submittingAssignment, onSubmitAssignment }: StepComponentProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [results, setResults] = useState<Record<string, { outcome: AnswerOutcome; score: number | null }>>({});

  const quizScore = useMemo(() => {
    if (!step.assignments?.length) return null;
    const graded = step.assignments
      .map((a) => results[a.id])
      .filter((r): r is { outcome: AnswerOutcome; score: number | null } => !!r && r.score !== null);
    if (graded.length === 0) return null;
    const sum = graded.reduce((acc, r) => acc + (r.score ?? 0), 0);
    return Math.round(sum / graded.length);
  }, [step, results]);

  const handleSubmit = useCallback(async (assignmentId: string) => {
    if (!step) return;
    const assignment = step.assignments.find((a) => a.id === assignmentId);
    if (!assignment) return;
    const selectedIndex = selectedAnswers[assignmentId];
    if (selectedIndex === undefined) {
      toast.error(t("course.step.selectAnswer", locale));
      return;
    }
    // An array keeps single- and multiple-choice gradable by the same server
    // code path: `gradeQuiz` unwraps the first element for a numeric key and
    // compares sets for an array key.
    const result = await onSubmitAssignment(assignmentId, [selectedIndex]);
    if (!result) return;

    const { outcome, score } = outcomeFrom(result);
    setResults((prev) => ({ ...prev, [assignmentId]: { outcome, score } }));
    if (outcome === "correct") {
      toast.success(`${t("course.step.correct", locale)} 🎉`);
    } else if (outcome === "pending") {
      toast.success(t("course.step.answerSent", locale));
    } else {
      toast.error(`${t("course.step.incorrect", locale)}. ${t("course.step.tryAgain", locale)}.`);
    }
  }, [step, selectedAnswers, onSubmitAssignment, locale]);

  const handleReset = useCallback((assignmentId: string) => {
    setResults((prev) => { const n = { ...prev }; delete n[assignmentId]; return n; });
    setSelectedAnswers((prev) => { const n = { ...prev }; delete n[assignmentId]; return n; });
  }, []);

  return (
    <div className="space-y-4 mb-6">
      {quizScore !== null && (
        <Card className={`border-0 shadow-sm ${quizScore >= 60 ? "bg-green-50 dark:bg-green-950/30" : "bg-red-50 dark:bg-red-950/30"}`}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {quizScore >= 60 ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <HelpCircle className="w-5 h-5 text-red-600" />}
              <span className="font-medium text-sm">{t("course.step.result", locale)}: {quizScore}%</span>
            </div>
            <Badge className={quizScore >= 60 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0"}>
              {quizScore >= 60 ? t("course.step.passed", locale) : t("course.step.failed", locale)}
            </Badge>
          </CardContent>
        </Card>
      )}

      {step.content && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <LessonContent content={step.content} locale={locale} />
          </CardContent>
        </Card>
      )}

      {step.assignments?.map((assignment, aIdx) => {
        let options: string[] = [];
        if (assignment.options) {
          try {
            const parsed = JSON.parse(assignment.options);
            if (Array.isArray(parsed)) options = parsed.map(String);
          } catch { options = []; }
        }
        // Guard: show error if no options defined for this quiz assignment
        if (options.length === 0) {
          return (
            <Card key={assignment.id} className="border-0 shadow-sm">
              <CardContent className="p-8 text-center">
                <HelpCircle className="w-12 h-12 text-red-400/50 mx-auto mb-3" />
                <p className="text-red-500 text-sm font-medium">{t("course.step.quizConfigError", locale)}</p>
              </CardContent>
            </Card>
          );
        }
        const result = results[assignment.id];
        const isSubmitted = !!result;
        const isCorrect = result?.outcome === "correct";

        return (
          <Card key={assignment.id} className={`border-0 shadow-sm overflow-hidden transition-all ${isSubmitted ? isCorrect ? "ring-2 ring-green-400" : result.outcome === "pending" ? "ring-2 ring-blue-300" : "ring-2 ring-red-400" : ""}`}>
            <div className={`px-4 py-3 flex items-center justify-between ${isSubmitted ? isCorrect ? "bg-green-50 dark:bg-green-950/30" : result.outcome === "pending" ? "bg-blue-50 dark:bg-blue-950/30" : "bg-red-50 dark:bg-red-950/30" : "bg-orange-50 dark:bg-orange-950/30"}`}>
              <div className="flex items-center gap-2">
                <HelpCircle className={`w-4 h-4 ${isSubmitted ? isCorrect ? "text-green-600" : result.outcome === "pending" ? "text-blue-600" : "text-red-600" : "text-orange-600"}`} />
                <span className="font-medium text-sm">{t("course.step.question", locale)} {aIdx + 1}</span>
              </div>
              {isSubmitted && (
                <Badge className={`${isCorrect ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : result.outcome === "pending" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"} border-0 text-xs`}>
                  {isCorrect
                    ? t("course.step.correct", locale)
                    : result.outcome === "pending"
                      ? t("course.step.awaitingReview", locale)
                      : t("course.step.incorrect", locale)}
                </Badge>
              )}
            </div>
            <CardContent className="p-6">
              <h4 className="font-semibold mb-2">{assignment.title}</h4>
              {assignment.description && <p className="text-sm text-muted-foreground mb-4">{assignment.description}</p>}

              <div className="space-y-2">
                {options.map((opt, optIdx) => {
                  const isSelected = selectedAnswers[assignment.id] === optIdx;
                  // Only the chosen option is coloured: which one is right is
                  // not part of the payload any more, so marking others would
                  // be a guess presented as fact.
                  let optionClass = "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer";
                  if (isSubmitted) {
                    if (isSelected) {
                      optionClass = isCorrect
                        ? "border-green-400 bg-green-50 dark:bg-green-950/30"
                        : result.outcome === "pending"
                          ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30"
                          : "border-red-400 bg-red-50 dark:bg-red-950/30";
                    } else {
                      optionClass = "border-gray-200 dark:border-gray-700 opacity-60";
                    }
                  } else if (isSelected) {
                    optionClass = "border-blue-500 bg-blue-50 dark:bg-blue-950/30";
                  }

                  return (
                    <label key={optIdx} className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${optionClass} ${isSubmitted ? "cursor-default" : "cursor-pointer"}`}>
                      <input
                        type="radio"
                        name={`quiz-${assignment.id}`}
                        className="sr-only"
                        checked={isSelected}
                        disabled={isSubmitted}
                        onChange={() => setSelectedAnswers((prev) => ({ ...prev, [assignment.id]: optIdx }))}
                      />
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? isSubmitted ? isCorrect ? "border-green-500 bg-green-500" : result.outcome === "pending" ? "border-blue-500 bg-blue-500" : "border-red-500 bg-red-500" : "border-blue-500 bg-blue-500" : "border-gray-300 dark:border-gray-600"}`}>
                        {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <span className="text-sm">{opt}</span>
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 mt-4">
                {!isSubmitted ? (
                  <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => handleSubmit(assignment.id)} disabled={selectedAnswers[assignment.id] === undefined || submittingAssignment}>
                    <Send className="w-4 h-4 mr-2" />
                    {t("course.step.answer", locale)}
                  </Button>
                ) : (
                  !isCorrect && result.outcome !== "pending" && (
                    <Button variant="outline" onClick={() => handleReset(assignment.id)}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      {t("course.step.tryAgain", locale)}
                    </Button>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {(!step.assignments || step.assignments.length === 0) && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <HelpCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">{t("course.step.noQuestions", locale)}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
