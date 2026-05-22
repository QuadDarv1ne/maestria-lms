"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/stores/ui";
import type { AssignmentForm, QuizOption, MatchingPair, OrderingItem } from "./types";
import { uid, createEmptyQuizOption, createEmptyMatchingPair, createEmptyOrderingItem } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
  GripVertical,
  FileText,
  HelpCircle,
  Code2,
  ArrowUpDown,
  Move,
  Upload,
  Pencil,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const ASSIGNMENT_TYPE_OPTIONS = [
  { value: "quiz", label: "Тест", icon: HelpCircle, description: "Выбор правильного ответа" },
  { value: "text", label: "Текстовый ответ", icon: FileText, description: "Развёрнутый ответ студента" },
  { value: "coding", label: "Программирование", icon: Code2, description: "Написание и выполнение кода" },
  { value: "matching", label: "Сопоставление", icon: ArrowUpDown, description: "Соединение пар элементов" },
  { value: "ordering", label: "Упорядочивание", icon: Move, description: "Расстановка в правильном порядке" },
  { value: "essay", label: "Эссе", icon: Pencil, description: "Развёрнутый письменный ответ" },
  { value: "file_upload", label: "Загрузка файла", icon: Upload, description: "Прикрепление файла с работой" },
];

function SortableQuizOption({
  option,
  idx,
  onUpdate,
  onRemove,
  totalOptions,
}: {
  option: QuizOption;
  idx: number;
  onUpdate: (patch: Partial<QuizOption>) => void;
  onRemove: () => void;
  totalOptions: number;
}) {
  return (
    <div className="flex items-center gap-2 p-2 border rounded-lg bg-white">
      <span className="text-xs font-mono text-muted-foreground w-5">{idx + 1}.</span>
      <Input
        className="flex-1 h-8 text-sm"
        placeholder="Вариант ответа"
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
}: {
  pair: MatchingPair;
  idx: number;
  onUpdate: (patch: Partial<MatchingPair>) => void;
  onRemove: () => void;
  totalPairs: number;
}) {
  return (
    <div className="flex items-center gap-2 p-2 border rounded-lg bg-white">
      <span className="text-xs font-mono text-muted-foreground w-5">{idx + 1}.</span>
      <Input
        className="flex-1 h-8 text-sm"
        placeholder="Левый элемент"
        value={pair.left}
        onChange={(e) => onUpdate({ left: e.target.value })}
      />
      <span className="text-muted-foreground">↔</span>
      <Input
        className="flex-1 h-8 text-sm"
        placeholder="Правый элемент"
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
}: {
  item: OrderingItem;
  idx: number;
  onUpdate: (patch: Partial<OrderingItem>) => void;
  onRemove: () => void;
  totalItems: number;
}) {
  return (
    <div className="flex items-center gap-2 p-2 border rounded-lg bg-white">
      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
      <Badge variant="secondary" className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold">
        {idx + 1}
      </Badge>
      <Input
        className="flex-1 h-8 text-sm"
        placeholder="Элемент для сортировки"
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

interface AssignmentEditorProps {
  assignment: AssignmentForm;
  locale: Locale;
  onUpdate: (patch: Partial<AssignmentForm>) => void;
  onRemove: () => void;
}

export function AssignmentEditor({ assignment, locale, onUpdate, onRemove }: AssignmentEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const assignmentType = assignment.type;

  return (
    <Card className="border-2 border-blue-100">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {ASSIGNMENT_TYPE_OPTIONS.find((o) => o.value === assignmentType)?.icon && (
              // @ts-ignore
              ASSIGNMENT_TYPE_OPTIONS.find((o) => o.value === assignmentType)?.icon({ className: "w-5 h-5 text-blue-700" })
            )}
            <Input
              className="flex-1 max-w-md h-8 text-sm font-normal"
              placeholder="Название задания"
              value={assignment.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
            />
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{ASSIGNMENT_TYPE_OPTIONS.find((o) => o.value === assignmentType)?.label}</Badge>
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
        {/* Description */}
        <div className="space-y-1">
          <Label>Описание задания</Label>
          <Textarea
            className="min-h-[80px] text-sm"
            placeholder="Опишите что нужно сделать в задании"
            value={assignment.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            rows={3}
          />
        </div>

        {/* Settings row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Тип задания</Label>
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
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Баллы</Label>
            <Input
              type="number"
              min={1}
              className="h-8 text-sm"
              value={assignment.points}
              onChange={(e) => onUpdate({ points: Number(e.target.value) || 10 })}
            />
          </div>
          <div className="space-y-1">
            <Label>Макс. попыток</Label>
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
              <Label>Ограничение по времени</Label>
              <p className="text-xs text-muted-foreground">0 = без ограничения</p>
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

        {/* Quiz Options */}
        {assignmentType === "quiz" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Варианты ответов</Label>
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
                Добавить вариант
              </Button>
            </div>
            <div className="space-y-1">
              {assignment.quizOptions?.map((option, idx) => (
                <SortableQuizOption
                  key={option.id}
                  option={option}
                  idx={idx}
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
              Отметьте правильные варианты ответа зелёным цветом
            </p>
          </div>
        )}

        {/* Matching Pairs */}
        {assignmentType === "matching" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Пары для сопоставления</Label>
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
                Добавить пару
              </Button>
            </div>
            <div className="space-y-1">
              {assignment.matchingPairs?.map((pair, idx) => (
                <SortableMatchingPair
                  key={pair.id}
                  pair={pair}
                  idx={idx}
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
              Студент должен соединить элементы из левой колонки с элементами из правой
            </p>
          </div>
        )}

        {/* Ordering Items */}
        {assignmentType === "ordering" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Элементы для сортировки</Label>
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
                Добавить элемент
              </Button>
            </div>
            <div className="space-y-1">
              {assignment.orderingItems?.map((item, idx) => (
                <SortableOrderingItem
                  key={item.id}
                  item={item}
                  idx={idx}
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
              Расположите элементы в правильном порядке (сверху вниз)
            </p>
          </div>
        )}

        {/* Correct Answer for text/coding/essay */}
        {(assignmentType === "text" || assignmentType === "coding" || assignmentType === "essay") && (
          <div className="space-y-1">
            <Label>Правильный ответ / Пример решения</Label>
            <Textarea
              className="min-h-[100px] text-sm font-mono"
              placeholder="Введите правильный ответ или пример решения"
              value={assignment.correctAnswer || ""}
              onChange={(e) => onUpdate({ correctAnswer: e.target.value })}
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              Этот ответ будет использоваться для автоматической проверки (если применимо)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
