"use client";

import type { Locale } from "@/lib/stores/ui";
import type { AssignmentForm, QuizOption, MatchingPair, OrderingItem, DragDropItem } from "./types";
import { createEmptyQuizOption, createEmptyMatchingPair, createEmptyOrderingItem, createEmptyDragDropItem } from "./types";
import { t } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Check,
  X,
  FileText,
  HelpCircle,
  Code2,
  ArrowUpDown,
  Move,
  Upload,
  Pencil,
  Grip,
} from "lucide-react";

const ASSIGNMENT_TYPE_OPTIONS = [
  { value: "quiz", icon: HelpCircle, labelKey: "editor.assignment.quiz", descKey: "editor.assignment.quiz_desc" },
  { value: "text", icon: FileText, labelKey: "editor.assignment.text", descKey: "editor.assignment.text_desc" },
  { value: "coding", icon: Code2, labelKey: "editor.assignment.coding", descKey: "editor.assignment.coding_desc" },
  { value: "matching", icon: ArrowUpDown, labelKey: "editor.assignment.matching", descKey: "editor.assignment.matching_desc" },
  { value: "ordering", icon: Move, labelKey: "editor.assignment.ordering", descKey: "editor.assignment.ordering_desc" },
  { value: "essay", icon: Pencil, labelKey: "editor.assignment.essay", descKey: "editor.assignment.essay_desc" },
  { value: "file_upload", icon: Upload, labelKey: "editor.assignment.file_upload", descKey: "editor.assignment.file_upload_desc" },
  { value: "drag_drop", icon: Grip, labelKey: "editor.assignment.drag_drop", descKey: "editor.assignment.drag_drop_desc" },
];

function getTypeLabel(type: string, locale: Locale): string {
  const opt = ASSIGNMENT_TYPE_OPTIONS.find((o) => o.value === type);
  return t(opt?.labelKey || type, locale);
}

function SortableQuizOption({
  option,
  idx,
  onUpdate,
  onRemove,
  totalOptions,
  locale,
}: {
  option: QuizOption;
  idx: number;
  onUpdate: (patch: Partial<QuizOption>) => void;
  onRemove: () => void;
  totalOptions: number;
  locale: Locale;
}) {
  return (
    <div className="flex items-center gap-2 p-2 border rounded-lg bg-white">
      <span className="text-xs font-mono text-muted-foreground w-5">{idx + 1}.</span>
      <Input
        className="flex-1 h-8 text-sm"
        placeholder={t("editor.assignment.quiz_option_placeholder", locale)}
        value={option.text}
        onChange={(e) => onUpdate({ text: e.target.value })}
      />
      <Button
        variant={option.isCorrect ? "default" : "outline"}
        size="sm"
        className={`h-8 w-8 p-0 ${option.isCorrect ? "bg-green-600 hover:bg-green-700" : ""}`}
        onClick={() => onUpdate({ isCorrect: !option.isCorrect })}
      >
        <Check className="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
        disabled={totalOptions <= 2}
        onClick={onRemove}
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

function SortableMatchingPair({
  pair,
  idx,
  onUpdate,
  onRemove,
  totalPairs,
  locale,
}: {
  pair: MatchingPair;
  idx: number;
  onUpdate: (patch: Partial<MatchingPair>) => void;
  onRemove: () => void;
  totalPairs: number;
  locale: Locale;
}) {
  return (
    <div className="flex items-center gap-2 p-2 border rounded-lg bg-white">
      <span className="text-xs font-mono text-muted-foreground w-5">{idx + 1}.</span>
      <Input
        className="flex-1 h-8 text-sm"
        placeholder={t("editor.assignment.matching_left_placeholder", locale)}
        value={pair.left}
        onChange={(e) => onUpdate({ left: e.target.value })}
      />
      <span className="text-muted-foreground">↔</span>
      <Input
        className="flex-1 h-8 text-sm"
        placeholder={t("editor.assignment.matching_right_placeholder", locale)}
        value={pair.right}
        onChange={(e) => onUpdate({ right: e.target.value })}
      />
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
        disabled={totalPairs <= 2}
        onClick={onRemove}
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

function SortableOrderingItem({
  item,
  idx,
  onUpdate,
  onRemove,
  totalItems,
  locale,
}: {
  item: OrderingItem;
  idx: number;
  onUpdate: (patch: Partial<OrderingItem>) => void;
  onRemove: () => void;
  totalItems: number;
  locale: Locale;
}) {
  return (
    <div className="flex items-center gap-2 p-2 border rounded-lg bg-white">
      <Badge variant="secondary" className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold">
        {idx + 1}
      </Badge>
      <Input
        className="flex-1 h-8 text-sm"
        placeholder={t("editor.assignment.ordering_item_placeholder", locale)}
        value={item.text}
        onChange={(e) => onUpdate({ text: e.target.value })}
      />
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
        disabled={totalItems <= 2}
        onClick={onRemove}
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

function SortableDragDropItem({
  item,
  idx,
  onUpdate,
  onRemove,
  totalItems,
  locale,
}: {
  item: DragDropItem;
  idx: number;
  onUpdate: (patch: Partial<DragDropItem>) => void;
  onRemove: () => void;
  totalItems: number;
  locale: Locale;
}) {
  return (
    <div className="flex items-center gap-2 p-2 border rounded-lg bg-white">
      <Badge variant="secondary" className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold">
        {idx + 1}
      </Badge>
      <Input
        className="flex-1 h-8 text-sm"
        placeholder={t("editor.assignment.drag_item_placeholder", locale)}
        value={item.text}
        onChange={(e) => onUpdate({ text: e.target.value })}
      />
      <Input
        className="w-28 h-8 text-sm"
        placeholder={t("editor.assignment.drag_group_placeholder", locale)}
        value={item.group}
        onChange={(e) => onUpdate({ group: e.target.value })}
      />
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
        disabled={totalItems <= 2}
        onClick={onRemove}
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}

interface AssignmentEditorProps {
  assignment: AssignmentForm;
  locale: Locale;
  onUpdate: (patch: Partial<AssignmentForm>) => void;
  onRemove: () => void;
}

export function AssignmentEditor({ assignment, locale, onUpdate, onRemove }: AssignmentEditorProps) {
  const assignmentType = assignment.type;

  return (
    <Card className="border-2 border-blue-100">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {(() => {
              const Icon = ASSIGNMENT_TYPE_OPTIONS.find((o) => o.value === assignmentType)?.icon;
              return Icon ? <Icon className="w-5 h-5 text-blue-700" /> : null;
            })()}
            <Input
              className="flex-1 max-w-md h-8 text-sm font-normal"
              placeholder={t("editor.assignment.title_placeholder", locale)}
              value={assignment.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
            />
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{getTypeLabel(assignmentType, locale)}</Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={onRemove}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>{t("editor.assignment.description_label", locale)}</Label>
          <Textarea
            className="min-h-[80px] text-sm"
            placeholder={t("editor.assignment.description_placeholder", locale)}
            value={assignment.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            rows={3}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>{t("editor.assignment.type_label", locale)}</Label>
            <Select
              value={assignment.type}
              onValueChange={(v) => onUpdate({ type: v as AssignmentForm["type"] })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNMENT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.labelKey, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t("editor.assignment.points_label", locale)}</Label>
            <Input
              type="number"
              min={1}
              className="h-8 text-sm"
              value={assignment.points}
              onChange={(e) => onUpdate({ points: Number(e.target.value) || 10 })}
            />
          </div>
          <div className="space-y-1">
            <Label>{t("editor.assignment.max_attempts_label", locale)}</Label>
            <Input
              type="number"
              min={1}
              className="h-8 text-sm"
              value={assignment.maxAttempts || 3}
              onChange={(e) => onUpdate({ maxAttempts: Number(e.target.value) || 3 })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t("editor.assignment.time_limit_label", locale)}</Label>
              <p className="text-xs text-muted-foreground">{t("editor.assignment.time_limit_hint", locale)}</p>
            </div>
            <Input
              type="number"
              min={0}
              className="h-8 w-20 text-sm"
              value={assignment.timeLimit || 0}
              onChange={(e) => onUpdate({ timeLimit: Number(e.target.value) || 0 })}
            />
          </div>
        </div>

        {assignmentType === "quiz" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("editor.assignment.quiz_options_label", locale)}</Label>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  onUpdate({
                    quizOptions: [...(assignment.quizOptions || []), createEmptyQuizOption()],
                  })
                }
              >
                <Plus className="w-3 h-3 mr-1" />
                {t("editor.assignment.add_option", locale)}
              </Button>
            </div>
            <div className="space-y-1">
              {assignment.quizOptions?.map((option, idx) => (
                <SortableQuizOption
                  key={option.id}
                  option={option}
                  idx={idx}
                  locale={locale}
                  totalOptions={assignment.quizOptions?.length || 0}
                  onUpdate={(patch) => {
                    const updated = [...(assignment.quizOptions || [])];
                    updated[idx] = { ...updated[idx], ...patch };
                    onUpdate({ quizOptions: updated });
                  }}
                  onRemove={() => {
                    const updated = [...(assignment.quizOptions || [])];
                    updated.splice(idx, 1);
                    onUpdate({ quizOptions: updated });
                  }}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("editor.assignment.quiz_options_hint", locale)}
            </p>
          </div>
        )}

        {assignmentType === "matching" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("editor.assignment.matching_label", locale)}</Label>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  onUpdate({
                    matchingPairs: [...(assignment.matchingPairs || []), createEmptyMatchingPair()],
                  })
                }
              >
                <Plus className="w-3 h-3 mr-1" />
                {t("editor.assignment.add_pair", locale)}
              </Button>
            </div>
            <div className="space-y-1">
              {assignment.matchingPairs?.map((pair, idx) => (
                <SortableMatchingPair
                  key={pair.id}
                  pair={pair}
                  idx={idx}
                  locale={locale}
                  totalPairs={assignment.matchingPairs?.length || 0}
                  onUpdate={(patch) => {
                    const updated = [...(assignment.matchingPairs || [])];
                    updated[idx] = { ...updated[idx], ...patch };
                    onUpdate({ matchingPairs: updated });
                  }}
                  onRemove={() => {
                    const updated = [...(assignment.matchingPairs || [])];
                    updated.splice(idx, 1);
                    onUpdate({ matchingPairs: updated });
                  }}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("editor.assignment.matching_hint", locale)}
            </p>
          </div>
        )}

        {assignmentType === "ordering" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("editor.assignment.ordering_label", locale)}</Label>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  onUpdate({
                    orderingItems: [...(assignment.orderingItems || []), createEmptyOrderingItem()],
                  })
                }
              >
                <Plus className="w-3 h-3 mr-1" />
                {t("editor.assignment.add_item", locale)}
              </Button>
            </div>
            <div className="space-y-1">
              {assignment.orderingItems?.map((item, idx) => (
                <SortableOrderingItem
                  key={item.id}
                  item={item}
                  idx={idx}
                  locale={locale}
                  totalItems={assignment.orderingItems?.length || 0}
                  onUpdate={(patch) => {
                    const updated = [...(assignment.orderingItems || [])];
                    updated[idx] = { ...updated[idx], ...patch };
                    onUpdate({ orderingItems: updated });
                  }}
                  onRemove={() => {
                    const updated = [...(assignment.orderingItems || [])];
                    updated.splice(idx, 1);
                    onUpdate({ orderingItems: updated });
                  }}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("editor.assignment.ordering_hint", locale)}
            </p>
          </div>
        )}

        {/* Drag & Drop Items */}
        {assignmentType === "drag_drop" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("editor.assignment.drag_drop_label", locale)}</Label>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  onUpdate({
                    dragDropItems: [...(assignment.dragDropItems || []), createEmptyDragDropItem()],
                  })
                }
              >
                <Plus className="w-3 h-3 mr-1" />
                {t("editor.assignment.add_drag_item", locale)}
              </Button>
            </div>
            <div className="space-y-1">
              {assignment.dragDropItems?.map((item, idx) => (
                <SortableDragDropItem
                  key={item.id}
                  item={item}
                  idx={idx}
                  locale={locale}
                  totalItems={assignment.dragDropItems?.length || 0}
                  onUpdate={(patch) => {
                    const updated = [...(assignment.dragDropItems || [])];
                    updated[idx] = { ...updated[idx], ...patch };
                    onUpdate({ dragDropItems: updated });
                  }}
                  onRemove={() => {
                    const updated = [...(assignment.dragDropItems || [])];
                    updated.splice(idx, 1);
                    onUpdate({ dragDropItems: updated });
                  }}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("editor.assignment.drag_drop_hint", locale)}
            </p>
          </div>
        )}

        {(assignmentType === "text" || assignmentType === "coding" || assignmentType === "essay") && (
          <div className="space-y-1">
            <Label>{t("editor.assignment.correct_answer_label", locale)}</Label>
            <Textarea
              className="min-h-[100px] text-sm font-mono"
              placeholder={t("editor.assignment.correct_answer_placeholder", locale)}
              value={assignment.correctAnswer || ""}
              onChange={(e) => onUpdate({ correctAnswer: e.target.value })}
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              {t("editor.assignment.correct_answer_hint", locale)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
