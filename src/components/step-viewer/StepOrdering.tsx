"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Move, ArrowLeft, ArrowRight, Send } from "lucide-react";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/store";
import type { StepData } from "./StepTypes";

interface StepOrderingProps {
  step: StepData;
  locale: Locale;
  orderingItems: string[];
  setOrderingItems: React.Dispatch<React.SetStateAction<string[]>>;
  orderingSubmitted: boolean;
  handleOrderingSubmit: () => void;
  moveOrderingItem: (idx: number, dir: "up" | "down") => void;
  submittingAssignment: boolean;
}

export function StepOrdering({
  step,
  locale,
  orderingItems,
  orderingSubmitted,
  handleOrderingSubmit,
  moveOrderingItem,
  submittingAssignment,
}: StepOrderingProps) {
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
          <div className="flex items-center gap-2 mb-4 text-sm text-cyan-600 dark:text-cyan-400">
            <Move className="w-4 h-4" />
            <span className="font-medium">{t("course.step.orderingExercise", locale)}</span>
          </div>
          {orderingItems.length === 0 ? (
            <p className="text-muted-foreground">{t("course.step.noItems", locale)}</p>
          ) : (
            <div className="space-y-2">
              {orderingItems.map((item, idx) => (
                <div key={item} className="flex items-center gap-2 p-3 bg-cyan-50 dark:bg-cyan-950/30 rounded-lg border border-cyan-200 dark:border-cyan-800">
                  <Badge variant="secondary" className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold">{idx + 1}</Badge>
                  <span className="flex-1 text-sm">{item}</span>
                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={idx === 0 || orderingSubmitted} onClick={() => moveOrderingItem(idx, "up")}>
                      <ArrowLeft className="w-3 h-3 rotate-90" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={idx === orderingItems.length - 1 || orderingSubmitted} onClick={() => moveOrderingItem(idx, "down")}>
                      <ArrowRight className="w-3 h-3 rotate-90" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-4">
                {!orderingSubmitted ? (
                  <Button className="bg-cyan-600 hover:bg-cyan-700 text-white" onClick={handleOrderingSubmit} disabled={orderingSubmitted || submittingAssignment}>
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
