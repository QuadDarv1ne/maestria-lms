"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Grip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import type { StepComponentProps } from "./StepTypes";
import { shuffleArray } from "./StepTypes";

export function StepDragDrop({ step, locale, submittingAssignment, onSubmitAssignment }: StepComponentProps) {
  const [items, setItems] = useState<Array<{ id: string; text: string; group: string }>>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    setSubmitted(false);
    setAnswers({});
    setSelectedItemId(null);
    const assignment = step?.assignments?.[0];
    const options = assignment?.options;
    if (!options) {
      setItems([]);
      setGroups([]);
      return;
    }
    try {
      const parsed: Array<{ id: string; text: string; group: string }> = JSON.parse(options);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setItems(shuffleArray([...parsed]));
        setGroups([...new Set(parsed.map((i) => i.group))]);
      } else {
        setItems([]);
        setGroups([]);
      }
    } catch {
      setItems([]);
      setGroups([]);
    }
  }, [step?.id, step?.assignments]);

  const handleSubmit = useCallback(async () => {
    if (!items.length) {
      toast.error(t("course.step.dragDropHint", locale));
      return;
    }
    const placedCount = Object.keys(answers).length;
    if (placedCount < items.length) {
      toast.error(t("course.step.placeAllItems", locale));
      return;
    }
    const assignment = step?.assignments?.[0];
    if (!assignment) return;
    const result = await onSubmitAssignment(assignment.id, answers);
    if (result) {
      setSubmitted(true);
      toast.success(t("course.step.answerSent", locale));
    }
  }, [items, answers, step, onSubmitAssignment, locale]);

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
          <div className="flex items-center gap-2 mb-4 text-sm text-purple-600 dark:text-purple-400">
            <Grip className="w-4 h-4" />
            <span className="font-medium">{t("course.step.dragDropExercise", locale)}</span>
          </div>
          {items.length === 0 ? (
            <p className="text-muted-foreground">{t("course.step.noItems", locale)}</p>
          ) : (
            <div className="space-y-6">
              {items.filter((item) => !answers[item.id]).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">{t("course.step.dragDropHint", locale)}</p>
                  <div className="flex flex-wrap gap-2">
                    {items.filter((item) => !answers[item.id]).map((item) => (
                      <Badge key={item.id} className={`px-3 py-2 cursor-pointer text-sm select-none ${selectedItemId === item.id ? "bg-purple-600 text-white border-purple-700 ring-2 ring-purple-300" : "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50"}`} onClick={() => { if (!submitted) setSelectedItemId((prev) => prev === item.id ? null : item.id); }}>
                        {item.text}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {groups.map((group) => {
                const itemsInGroup = items.filter((item) => answers[item.id] === group);
                const correctItemsInGroup = items.filter((item) => item.group === group && answers[item.id] === group);
                return (
                  <div key={group} className={`border-2 border-dashed rounded-lg p-4 min-h-[60px] ${selectedItemId && !submitted ? "border-purple-400 bg-purple-50/50 dark:bg-purple-950/20 cursor-pointer hover:border-purple-500" : ""}`} onClick={() => { if (!submitted && selectedItemId) { setAnswers((prev) => ({ ...prev, [selectedItemId]: group })); setSelectedItemId(null); } }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-purple-700 dark:text-purple-400">{group}</p>
                      {submitted && (
                        <Badge className={correctItemsInGroup.length === itemsInGroup.length && itemsInGroup.length > 0 ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"}>
                          {itemsInGroup.length > 0 ? `${correctItemsInGroup.length}/${itemsInGroup.length}` : "-"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 min-h-[28px]">
                      {itemsInGroup.map((item) => (
                        <Badge key={item.id} className={`px-3 py-1.5 text-sm cursor-pointer select-none ${submitted ? item.group === group ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800" : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800"}`} onClick={(e) => { if (!submitted) { e.stopPropagation(); setAnswers((prev) => { const next = { ...prev }; delete next[item.id]; return next; }); } }}>
                          {item.text}
                          {!submitted && <X className="w-3 h-3 ml-1 text-muted-foreground" />}
                        </Badge>
                      ))}
                      {itemsInGroup.length === 0 && !selectedItemId && <span className="text-xs text-muted-foreground italic">{t("course.step.dropHere", locale)}</span>}
                      {itemsInGroup.length === 0 && selectedItemId && <span className="text-xs text-purple-500 italic">{t("course.step.dropHere", locale)}</span>}
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-2">
                {!submitted ? (
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleSubmit} disabled={submitted || submittingAssignment}>
                    <Send className="w-4 h-4 mr-2" />
                    {t("course.step.submitDragDrop", locale)}
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
