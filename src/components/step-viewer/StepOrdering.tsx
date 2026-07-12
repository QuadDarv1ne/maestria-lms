"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Move, ArrowLeft, ArrowRight, Send } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import type { StepComponentProps } from "./StepTypes";
import { shuffleArray } from "./StepTypes";

export function StepOrdering({ step, locale, submittingAssignment, onSubmitAssignment }: StepComponentProps) {
  const [items, setItems] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const assignment = step.assignments?.[0];
    const options = assignment?.options;
    if (!options) {
      setItems([]);
      return;
    }
    try {
      const parsed: string[] = JSON.parse(options);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setItems(shuffleArray(parsed));
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    }
    setSubmitted(false);
  }, [step?.id, step?.assignments]);

  const moveItem = useCallback((index: number, direction: "up" | "down") => {
    setItems((prev) => {
      const arr = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= arr.length) return prev;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!items.length) {
      toast.error(t("course.step.orderAllItems", locale));
      return;
    }
    const assignment = step.assignments?.[0];
    if (!assignment) return;
    const result = await onSubmitAssignment(assignment.id, items);
    if (result) {
      setSubmitted(true);
      toast.success(t("course.step.answerSent", locale));
    }
  }, [items, step, onSubmitAssignment, locale]);

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
          <div className="flex items-center gap-2 mb-4 text-sm text-cyan-600 dark:text-cyan-400">
            <Move className="w-4 h-4" />
            <span className="font-medium">{t("course.step.orderingExercise", locale)}</span>
          </div>

          {items.length === 0 ? (
            <p className="text-muted-foreground">{t("course.step.noItems", locale)}</p>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item} className="flex items-center gap-2 p-3 bg-cyan-50 dark:bg-cyan-950/30 rounded-lg border border-cyan-200 dark:border-cyan-800">
                  <Badge variant="secondary" className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </Badge>
                  <span className="flex-1 text-sm">{item}</span>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      disabled={idx === 0 || submitted}
                      onClick={() => moveItem(idx, "up")}
                    >
                      <ArrowLeft className="w-3 h-3 rotate-90" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      disabled={idx === items.length - 1 || submitted}
                      onClick={() => moveItem(idx, "down")}
                    >
                      <ArrowRight className="w-3 h-3 rotate-90" />
                    </Button>
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-2 mt-4">
                {!submitted ? (
                  <Button
                    className="bg-cyan-600 hover:bg-cyan-700 text-white"
                    onClick={handleSubmit}
                    disabled={submitted || submittingAssignment}
                  >
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
