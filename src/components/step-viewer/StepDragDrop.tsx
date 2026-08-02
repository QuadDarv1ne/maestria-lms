"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Grip, GripVertical, Send, X } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import type { StepComponentProps } from "./StepTypes";
import { shuffleArray } from "./StepTypes";

interface DragDropItem {
  id: string;
  text: string;
  group: string;
}

const POOL_ID = "__pool__";
const zoneId = (group: string) => `zone:${group}`;

function DraggableDragItem({
  item,
  disabled,
  dimmed,
}: {
  item: DragDropItem;
  disabled: boolean;
  dimmed: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: item.id,
    disabled,
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : dimmed ? 0.5 : 1,
        zIndex: isDragging ? 50 : undefined,
      }
    : undefined;

  return (
    <Badge
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`px-3 py-2 text-sm select-none touch-none cursor-grab active:cursor-grabbing ${
        dimmed && !isDragging
          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 opacity-50"
          : "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 shadow-sm"
      }`}
    >
      <GripVertical className="w-3.5 h-3.5 mr-1.5 text-purple-400 dark:text-purple-500" />
      {item.text}
    </Badge>
  );
}

function DroppableGroup({
  group,
  isOver,
  children,
}: {
  group: string;
  isOver: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: zoneId(group) });
  return (
    <div
      ref={setNodeRef}
      className={`border-2 border-dashed rounded-lg p-4 min-h-[64px] transition-colors ${
        isOver
          ? "border-purple-500 bg-purple-50 dark:bg-purple-950/40"
          : "border-purple-200 dark:border-purple-900 hover:border-purple-300 dark:hover:border-purple-700"
      }`}
    >
      {children}
    </div>
  );
}

export function StepDragDrop({ step, locale, submittingAssignment, onSubmitAssignment }: StepComponentProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<DragDropItem | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const { items, groups } = useMemo(() => {
    const assignment = step?.assignments?.[0];
    const options = assignment?.options;
    if (!options) return { items: [] as DragDropItem[], groups: [] as string[] };
    try {
      const parsed: DragDropItem[] = JSON.parse(options);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { items: shuffleArray([...parsed]), groups: [...new Set(parsed.map((i) => i.group))] };
      }
    } catch { /* ignore */ }
    return { items: [] as DragDropItem[], groups: [] as string[] };
  }, [step?.assignments]);

  // Reset local state when step changes (React-render-time reset pattern)
  const [prevStepId, setPrevStepId] = useState(step?.id);
  if (step?.id !== prevStepId) {
    setAnswers({});
    setSubmitted(false);
    setSelectedItemId(null);
    setActiveItem(null);
    setDragOverId(null);
    setPrevStepId(step?.id);
  }

  const placeItem = useCallback((itemId: string, group: string) => {
    setAnswers((prev) => ({ ...prev, [itemId]: group }));
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const item = items.find((i) => i.id === event.active.id);
    setActiveItem(item ?? null);
  }, [items]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setDragOverId(event.over ? String(event.over.id) : null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveItem(null);
      setDragOverId(null);
      if (submitted) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const overId = String(over.id);
      if (overId === POOL_ID) {
        removeItem(String(active.id));
        return;
      }
      if (overId.startsWith("zone:")) {
        placeItem(String(active.id), overId.slice("zone:".length));
      }
    },
    [submitted, removeItem, placeItem],
  );

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

  const poolItems = items.filter((item) => !answers[item.id]);
  const poolOver = dragOverId === POOL_ID;
  const { setNodeRef: setPoolRef } = useDroppable({ id: POOL_ID });

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
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={() => {
                setActiveItem(null);
                setDragOverId(null);
              }}
            >
              <div className="space-y-6">
                <div
                  ref={setPoolRef}
                  className={`border-2 border-dashed rounded-lg p-3 transition-colors ${
                    poolOver
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-950/40"
                      : "border-purple-100 dark:border-purple-900"
                  }`}
                >
                  <p className="text-xs text-muted-foreground mb-2">{t("course.step.dragDropHint", locale)}</p>
                  {poolItems.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {poolItems.map((item) => (
                        <div
                          key={item.id}
                          className={submitted ? "cursor-default" : "cursor-pointer"}
                          onClick={() => {
                            if (!submitted) setSelectedItemId((prev) => (prev === item.id ? null : item.id));
                          }}
                        >
                          <DraggableDragItem item={item} disabled={submitted} dimmed={selectedItemId !== null && selectedItemId !== item.id} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">{t("course.step.placeAllItems", locale)}</p>
                  )}
                </div>
                {groups.map((group, gi) => {
                  const itemsInGroup = items.filter((item) => answers[item.id] === group);
                  const correctItemsInGroup = items.filter((item) => item.group === group && answers[item.id] === group);
                  return (
                    <DroppableGroup key={`${group}-${gi}`} group={group} isOver={dragOverId === zoneId(group)}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-purple-700 dark:text-purple-400">{group}</p>
                        {submitted && (
                          <Badge className={correctItemsInGroup.length === itemsInGroup.length && itemsInGroup.length > 0 ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"}>
                            {itemsInGroup.length > 0 ? `${correctItemsInGroup.length}/${itemsInGroup.length}` : "-"}
                          </Badge>
                        )}
                      </div>
                      <div
                        className="flex flex-wrap gap-2 min-h-[28px] cursor-pointer"
                        onClick={() => {
                          if (!submitted && selectedItemId) {
                            placeItem(selectedItemId, group);
                            setSelectedItemId(null);
                          }
                        }}
                      >
                        {itemsInGroup.map((item) => (
                          <div
                            key={item.id}
                            className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm select-none border ${
                              submitted
                                ? item.group === group
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800"
                                  : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
                                : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800"
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DraggableDragItem item={item} disabled={submitted} dimmed={false} />
                            {!submitted && (
                              <button
                                type="button"
                                aria-label={t("course.step.removeItem", locale)}
                                className="ml-1 text-muted-foreground hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-purple-300 rounded-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeItem(item.id);
                                }}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                        {itemsInGroup.length === 0 && (
                          <span className={`text-xs italic ${selectedItemId ? "text-purple-500" : "text-muted-foreground"}`}>
                            {t("course.step.dropHere", locale)}
                          </span>
                        )}
                      </div>
                    </DroppableGroup>
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
              <DragOverlay>
                {activeItem && (
                  <Badge className="px-3 py-2 text-sm select-none cursor-grabbing bg-purple-600 text-white border-purple-700 shadow-lg">
                    <GripVertical className="w-3.5 h-3.5 mr-1.5" />
                    {activeItem.text}
                  </Badge>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
