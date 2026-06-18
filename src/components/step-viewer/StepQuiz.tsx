"use client";

import { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HelpCircle, CheckCircle2, Send, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import type { StepComponentProps } from "./StepTypes";

function checkQuizAnswer(
  correctAnswer: string,
  selected: string,
  options?: string,
  optionIndex?: number,
): boolean {
  const parsedIndex = parseInt(correctAnswer, 10);
  if (!Number.isNaN(parsedIndex)) {
    if (optionIndex !== undefined) return optionIndex === parsedIndex;
    if (options) {
      try {
        const parsedOptions: string[] = JSON.parse(options);
        return parsedOptions.indexOf(selected) === parsedIndex;
      } catch { return false; }
    }
    return false;
  }
  return correctAnswer === selected;
}

export function StepQuiz({ step, locale }: StepComponentProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<Record<string, boolean>>({});
  const [quizResults, setQuizResults] = useState<Record<string, boolean>>({});

  const quizScore = useMemo(() => {
    if (!step.assignments?.length) return null;
    const answered = step.assignments.filter((a) => quizSubmitted[a.id]);
    if (answered.length === 0) return null;
    const correct = answered.filter((a) => quizResults[a.id]).length;
    return Math.round((correct / step.assignments.length) * 100);
  }, [step, quizSubmitted, quizResults]);

  const handleSubmit = useCallback((assignmentId: string) => {
    if (!step) return;
    const assignment = step.assignments.find((a) => a.id === assignmentId);
    if (!assignment) return;
    const selected = selectedAnswers[assignmentId];
    if (!selected) {
      toast.error(t("course.step.selectAnswer", locale));
      return;
    }
    const isCorrect = assignment.correctAnswer
      ? checkQuizAnswer(assignment.correctAnswer, selected, assignment.options ?? undefined)
      : false;
    setQuizSubmitted((prev) => ({ ...prev, [assignmentId]: true }));
    setQuizResults((prev) => ({ ...prev, [assignmentId]: isCorrect }));
    toast.success(isCorrect
      ? `${t("course.step.correct", locale)} 🎉`
      : `${t("course.step.incorrect", locale)}. ${t("course.step.tryAgain", locale)}.`
    );
  }, [step, selectedAnswers, locale]);

  const handleReset = useCallback((assignmentId: string) => {
    setQuizSubmitted((prev) => ({ ...prev, [assignmentId]: false }));
    setQuizResults((prev) => ({ ...prev, [assignmentId]: false }));
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
            <Badge className={quizScore >= 60 ? "bg-green-100 text-green-700 border-0" : "bg-red-100 text-red-700 border-0"}>
              {quizScore >= 60 ? t("course.step.passed", locale) : t("course.step.failed", locale)}
            </Badge>
          </CardContent>
        </Card>
      )}

      {step.content && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">{step.content}</div>
          </CardContent>
        </Card>
      )}

      {step.assignments?.map((assignment, aIdx) => {
        let options: string[] = [];
        if (assignment.options) {
          try { options = JSON.parse(assignment.options); } catch { options = []; }
        }
        const isSubmitted = quizSubmitted[assignment.id];
        const isCorrect = quizResults[assignment.id];

        return (
          <Card key={assignment.id} className={`border-0 shadow-sm overflow-hidden transition-all ${isSubmitted ? isCorrect ? "ring-2 ring-green-400" : "ring-2 ring-red-400" : ""}`}>
            <div className={`px-4 py-3 flex items-center justify-between ${isSubmitted ? isCorrect ? "bg-green-50 dark:bg-green-950/30" : "bg-red-50 dark:bg-red-950/30" : "bg-orange-50 dark:bg-orange-950/30"}`}>
              <div className="flex items-center gap-2">
                <HelpCircle className={`w-4 h-4 ${isSubmitted ? isCorrect ? "text-green-600" : "text-red-600" : "text-orange-600"}`} />
                <span className="font-medium text-sm">{t("course.step.question", locale)} {aIdx + 1}</span>
              </div>
              {isSubmitted && (
                <Badge className={`${isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"} border-0 text-xs`}>
                  {isCorrect ? t("course.step.correct", locale) : t("course.step.incorrect", locale)}
                </Badge>
              )}
            </div>
            <CardContent className="p-6">
              <h4 className="font-semibold mb-2">{assignment.title}</h4>
              {assignment.description && <p className="text-sm text-muted-foreground mb-4">{assignment.description}</p>}

              <div className="space-y-2">
                {options.map((opt, optIdx) => {
                  const isSelected = selectedAnswers[assignment.id] === opt;
                  const isCorrectOption = assignment.correctAnswer
                    ? checkQuizAnswer(assignment.correctAnswer, opt, assignment.options ?? undefined, optIdx)
                    : false;
                  let optionClass = "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer";
                  if (isSubmitted) {
                    if (isCorrectOption) optionClass = "border-green-400 bg-green-50 dark:bg-green-950/30";
                    else if (isSelected && !isCorrect) optionClass = "border-red-400 bg-red-50 dark:bg-red-950/30";
                    else optionClass = "border-gray-200 dark:border-gray-700 opacity-60";
                  } else if (isSelected) optionClass = "border-blue-500 bg-blue-50 dark:bg-blue-950/30";

                  return (
                    <label key={optIdx} className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${optionClass} ${isSubmitted ? "cursor-default" : "cursor-pointer"}`}>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? isSubmitted ? isCorrectOption ? "border-green-500 bg-green-500" : "border-red-500 bg-red-500" : "border-blue-500 bg-blue-500" : "border-gray-300 dark:border-gray-600"}`}>
                        {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <span className="text-sm">{opt}</span>
                      {isSubmitted && isCorrectOption && <CheckCircle2 className="w-4 h-4 text-green-600 ml-auto" />}
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 mt-4">
                {!isSubmitted ? (
                  <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => handleSubmit(assignment.id)} disabled={!selectedAnswers[assignment.id]}>
                    <Send className="w-4 h-4 mr-2" />
                    {t("course.step.answer", locale)}
                  </Button>
                ) : (
                  !isCorrect && (
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
