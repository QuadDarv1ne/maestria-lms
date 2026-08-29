"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PenTool, Send, Timer } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import type { StepComponentProps } from "./StepTypes";

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function StepAssignment({ step, locale, submittingAssignment, onSubmitAssignment }: StepComponentProps) {
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const timeLimit = step.assignments?.[0]?.timeLimit && step.assignments[0].timeLimit > 0
    ? step.assignments[0].timeLimit
    : null;

  const [timeLeft, setTimeLeft] = useState<number | null>(() =>
    timeLimit && !step.completed ? timeLimit * 60 : null
  );
  const [timedOut, setTimedOut] = useState(false);

  const answerRef = useRef(answer);
  const submittedRef = useRef(submitted);

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  useEffect(() => {
    submittedRef.current = submitted;
  }, [submitted]);

  const submitAnswer = useCallback(async (value: string) => {
    if (!value.trim()) {
      toast.error(t("course.step.writeAnswerFirst", locale));
      return;
    }
    const assignment = step.assignments?.[0];
    if (!assignment) return;
    const result = await onSubmitAssignment(assignment.id, value);
    if (result) {
      setSubmitted(true);
      toast.success(t("course.step.answerSent", locale));
    }
  }, [step, onSubmitAssignment, locale]);

  const handleSubmit = useCallback(() => {
    submitAnswer(answerRef.current);
  }, [submitAnswer]);

  useEffect(() => {
    if (!timeLimit || step.completed) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 0) return 0;
        if (prev === 1) {
          clearInterval(timer);
          setTimedOut(true);
          if (!submittedRef.current) {
            submitAnswer(answerRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLimit, step.completed, submitAnswer]);

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
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold">{t("course.step.yourAnswer", locale)}</h4>
            {timeLimit && (
              <Badge variant={timedOut ? "destructive" : "outline"}>
                <Timer className="w-3 h-3 mr-1" />
                {timedOut
                  ? t("course.step.timeUp", locale)
                  : t("course.step.timeRemaining", locale).replace("{time}", formatTime(timeLeft ?? 0))}
              </Badge>
            )}
          </div>
          <Textarea
            placeholder={t("course.step.answerPlaceholder", locale)}
            className="min-h-[120px] resize-y"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={submitted || timedOut}
          />
          <div className="flex items-center gap-2 mt-3">
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleSubmit}
              disabled={submitted || timedOut || submittingAssignment}
            >
              <Send className="w-4 h-4 mr-2" />
              {submitted ? t("course.step.sent", locale) : t("course.step.submitAnswer", locale)}
            </Button>
            {submitted && !timedOut && (
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0">
                {t("course.step.awaitingReview", locale)}
              </Badge>
            )}
            {timedOut && (
              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">
                {t("course.step.timeUpNotice", locale)}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}