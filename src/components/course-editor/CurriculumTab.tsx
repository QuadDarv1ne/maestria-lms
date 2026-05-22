"use client";

import { useMemo, useState, useCallback } from "react";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { t } from "@/lib/i18n";
import { lessonTypeIcon } from "@/lib/constants";
import type { Locale } from "@/lib/stores/ui";
import type { CourseFormData, ModuleForm, LessonForm } from "./types";
import { VideoUploadButton } from "./VideoUploadButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, GripVertical, BookOpen,
  Video, FileText, Code, HelpCircle, ClipboardList, GripHorizontal,
} from "lucide-react";

interface CurriculumTabProps {
  form: CourseFormData;
  locale: Locale;
  onSetActiveTab: (tab: string) => void;
  onAddModule: () => void;
  onRemoveModule: (idx: number) => void;
  onMoveModule: (idx: number, direction: "up" | "down") => void;
  onUpdateModule: (idx: number, patch: Partial<ModuleForm>) => void;
  onToggleModuleExpand: (idx: number) => void;
  onAddLesson: (moduleIdx: number) => void;
  onRemoveLesson: (moduleIdx: number, lessonIdx: number) => void;
  onMoveLesson: (moduleIdx: number, lessonIdx: number, direction: "up" | "down") => void;
  onUpdateLesson: (moduleIdx: number, lessonIdx: number, patch: Partial<LessonForm>) => void;
  onReorderModules: (sourceIdx: number, destIdx: number) => void;
  onReorderLessons: (moduleIdx: number, sourceIdx: number, destIdx: number) => void;
}

function SortableModule({
  module,
  idx,
  locale,
  isDragging,
  ...props
}: {
  module: ModuleForm;
  idx: number;
  locale: Locale;
  isDragging: boolean;
  onRemoveModule: (idx: number) => void;
  onMoveModule: (idx: number, direction: "up" | "down") => void;
  onUpdateModule: (idx: number, patch: Partial<ModuleForm>) => void;
  onToggleModuleExpand: (idx: number) => void;
  onAddLesson: (moduleIdx: number) => void;
  onRemoveLesson: (moduleIdx: number, lessonIdx: number) => void;
  onMoveLesson: (moduleIdx: number, lessonIdx: number, direction: "up" | "down") => void;
  onUpdateLesson: (moduleIdx: number, lessonIdx: number, patch: Partial<LessonForm>) => void;
  onReorderLessons: (moduleIdx: number, sourceIdx: number, destIdx: number) => void;
  totalModules: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const { onReorderLessons: handleReorderLessons } = props;

  const handleLessonDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        setActiveLessonId(null);
        return;
      }
      const oldIdx = module.lessons.findIndex((l) => l.id === active.id);
      const newIdx = module.lessons.findIndex((l) => l.id === over.id);
      if (oldIdx !== -1 && newIdx !== -1) {
        handleReorderLessons(idx, oldIdx, newIdx);
      }
      setActiveLessonId(null);
    },
    [module.lessons, idx, handleReorderLessons]
  );

  const dragSensor = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  return (
    <div ref={setNodeRef} style={style}>
      <Collapsible
        open={module.isExpanded}
        onOpenChange={() => props.onToggleModuleExpand(idx)}
      >
        <div className="border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 p-3 bg-gray-50">
            <button
              className="cursor-grab active:cursor-grabbing touch-none"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
            <span className="w-7 h-7 bg-violet-100 text-violet-700 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0">
              {idx + 1}
            </span>
            <CollapsibleTrigger asChild>
              <Input
                className="flex-1 h-8 text-sm font-medium bg-transparent border-0 shadow-none focus-visible:ring-1 px-2"
                placeholder={t("courseEditor.moduleName", locale).replace("{number}", String(idx + 1))}
                value={module.title}
                onChange={(e) => props.onUpdateModule(idx, { title: e.target.value })}
                onClick={(e) => e.stopPropagation()}
              />
            </CollapsibleTrigger>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost" size="sm" className="h-7 w-7 p-0"
                disabled={idx === 0}
                onClick={(e) => { e.stopPropagation(); props.onMoveModule(idx, "up"); }}
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost" size="sm" className="h-7 w-7 p-0"
                disabled={idx === props.totalModules - 1}
                onClick={(e) => { e.stopPropagation(); props.onMoveModule(idx, "down"); }}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={(e) => { e.stopPropagation(); props.onRemoveModule(idx); }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <CollapsibleContent>
            <div className="p-3 space-y-2">
              {module.lessons.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t("courseEditor.noLessonsInModule", locale)}
                </p>
              ) : (
                <DndContext
                  sensors={dragSensor}
                  collisionDetection={closestCenter}
                  onDragStart={(e: DragStartEvent) => setActiveLessonId(e.active.id as string)}
                  onDragEnd={handleLessonDragEnd}
                >
                  <SortableContext
                    items={module.lessons.map((l) => l.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {module.lessons.map((lesson, lIdx) => (
                      <SortableLesson
                        key={lesson.id}
                        lesson={lesson}
                        moduleIdx={idx}
                        lessonIdx={lIdx}
                        locale={locale}
                        isDragging={activeLessonId === lesson.id}
                        totalLessons={module.lessons.length}
                        onRemoveLesson={props.onRemoveLesson}
                        onMoveLesson={props.onMoveLesson}
                        onUpdateLesson={props.onUpdateLesson}
                      />
                    ))}
                  </SortableContext>
                  <DragOverlay>
                    {activeLessonId ? (
                      <div className="border rounded-lg p-3 bg-white shadow-lg">
                        <div className="flex items-center gap-2">
                          <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {module.lessons.find((l) => l.id === activeLessonId)?.title || t("courseEditor.lessonName", locale).replace("{number}", "0")}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              )}
              <Button
                variant="outline" size="sm"
                className="w-full border-dashed text-muted-foreground hover:text-blue-700 hover:border-blue-300"
                onClick={() => props.onAddLesson(idx)}
              >
                <Plus className="w-4 h-4 mr-1" />
                {t("courseEditor.addLesson", locale)}
              </Button>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}

function SortableLesson({
  lesson,
  moduleIdx,
  lessonIdx,
  locale,
  isDragging,
  totalLessons,
  onRemoveLesson,
  onMoveLesson,
  onUpdateLesson,
}: {
  lesson: LessonForm;
  moduleIdx: number;
  lessonIdx: number;
  locale: Locale;
  isDragging: boolean;
  totalLessons: number;
  onRemoveLesson: (moduleIdx: number, lessonIdx: number) => void;
  onMoveLesson: (moduleIdx: number, lessonIdx: number, direction: "up" | "down") => void;
  onUpdateLesson: (moduleIdx: number, lessonIdx: number, patch: Partial<LessonForm>) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const LESSON_TYPE_OPTIONS = [
    { value: "video", label: t("courseEditor.typeVideo", locale), icon: Video },
    { value: "text", label: t("courseEditor.typeText", locale), icon: FileText },
    { value: "coding", label: t("courseEditor.typeCoding", locale), icon: Code },
    { value: "quiz", label: t("courseEditor.typeQuiz", locale), icon: HelpCircle },
    { value: "assignment", label: t("courseEditor.typeAssignment", locale), icon: ClipboardList },
  ];

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg p-3 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <button
          className="cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        </button>
        <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
          {moduleIdx + 1}.{lessonIdx + 1}
        </span>
        {lessonTypeIcon(lesson.type)}
        <Input
          className="flex-1 h-7 text-sm border-0 shadow-none focus-visible:ring-1 px-1"
          placeholder={t("courseEditor.lessonName", locale).replace("{number}", String(lessonIdx + 1))}
          value={lesson.title}
          onChange={(e) => onUpdateLesson(moduleIdx, lessonIdx, { title: e.target.value })}
        />
        <Button
          variant="ghost" size="sm" className="h-6 w-6 p-0"
          disabled={lessonIdx === 0}
          onClick={() => onMoveLesson(moduleIdx, lessonIdx, "up")}
        >
          <ChevronUp className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost" size="sm" className="h-6 w-6 p-0"
          disabled={lessonIdx === totalLessons - 1}
          onClick={() => onMoveLesson(moduleIdx, lessonIdx, "down")}
        >
          <ChevronDown className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
          onClick={() => onRemoveLesson(moduleIdx, lessonIdx)}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">{t("courseEditor.type", locale)}</Label>
          <Select
            value={lesson.type}
            onValueChange={(v) => onUpdateLesson(moduleIdx, lessonIdx, { type: v as LessonForm["type"] })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LESSON_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("courseEditor.durationLabel", locale)}</Label>
          <Input
            type="number" min={0} className="h-8 text-xs"
            value={lesson.duration || ""}
            onChange={(e) => onUpdateLesson(moduleIdx, lessonIdx, { duration: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("courseEditor.freeLabel", locale)}</Label>
          <div className="h-8 flex items-center">
            <Switch
              checked={lesson.isFree}
              onCheckedChange={(v) => onUpdateLesson(moduleIdx, lessonIdx, { isFree: v })}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("courseEditor.sortOrder", locale)}</Label>
          <Input
            type="number" min={1} className="h-8 text-xs"
            value={lesson.sortOrder}
            onChange={(e) => onUpdateLesson(moduleIdx, lessonIdx, { sortOrder: Number(e.target.value) || 1 })}
          />
        </div>
      </div>
      {(lesson.type === "text" || lesson.type === "coding" || lesson.type === "assignment") && (
        <div className="mt-3 space-y-1">
          <Label className="text-xs">{t("courseEditor.fieldLessonContent", locale)}</Label>
          <Textarea
            className="text-xs min-h-[80px]"
            placeholder={t("courseEditor.lessonContentPlaceholder", locale)}
            value={lesson.content}
            onChange={(e) => onUpdateLesson(moduleIdx, lessonIdx, { content: e.target.value })}
            rows={4}
          />
        </div>
      )}
      {lesson.type === "video" && (
        <div className="mt-3 space-y-1">
          <Label className="text-xs">{t("courseEditor.fieldVideoUrl", locale)}</Label>
          <div className="flex gap-2">
            <Input
              className="h-8 text-xs flex-1"
              placeholder="https://..."
              value={lesson.videoUrl}
              onChange={(e) => onUpdateLesson(moduleIdx, lessonIdx, { videoUrl: e.target.value })}
            />
            <VideoUploadButton
              locale={locale}
              onUpload={(url) => onUpdateLesson(moduleIdx, lessonIdx, { videoUrl: url })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function CurriculumTab({
  form, locale, onSetActiveTab,
  onAddModule, onRemoveModule, onMoveModule, onUpdateModule, onToggleModuleExpand,
  onAddLesson, onRemoveLesson, onMoveLesson, onUpdateLesson,
  onReorderModules, onReorderLessons,
}: CurriculumTabProps) {
  const totalLessons = useMemo(
    () => form.modules.reduce((sum, m) => sum + m.lessons.length, 0),
    [form.modules]
  );

  const totalDuration = useMemo(
    () => form.modules.reduce(
      (sum, m) => sum + m.lessons.reduce((s, l) => s + l.duration, 0),
      0
    ),
    [form.modules]
  );

  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleModuleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveModuleId(null);
      if (!over || active.id === over.id) return;

      const oldIdx = form.modules.findIndex((m) => m.id === active.id);
      const newIdx = form.modules.findIndex((m) => m.id === over.id);
      if (oldIdx !== -1 && newIdx !== -1) {
        onReorderModules(oldIdx, newIdx);
      }
    },
    [form.modules, onReorderModules]
  );

  return (
    <>
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-700" />
              {t("courseEditor.tabCurriculum", locale)}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={onAddModule}
              className="text-blue-700 border-blue-200 hover:bg-blue-50"
            >
              <Plus className="w-4 h-4 mr-1" />
              {t("courseEditor.addModule", locale)}
            </Button>
          </div>
          {form.modules.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {t("courseEditor.modulesCount", locale)
                .replace("{count}", String(form.modules.length))
                .replace("{lessons}", String(totalLessons))
                .replace("{duration}", String(totalDuration))
                .replace("{min}", t("common.min", locale))}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {form.modules.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">
                {t("courseEditor.noModules", locale)}
              </p>
              <Button
                onClick={onAddModule}
                className="bg-blue-700 hover:bg-blue-800 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("courseEditor.addFirstModule", locale)}
              </Button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={(e: DragStartEvent) => setActiveModuleId(e.active.id as string)}
              onDragEnd={handleModuleDragEnd}
            >
              <SortableContext
                items={form.modules.map((m) => m.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {form.modules.map((mod, mIdx) => (
                    <SortableModule
                      key={mod.id}
                      module={mod}
                      idx={mIdx}
                      locale={locale}
                      isDragging={activeModuleId === mod.id}
                      totalModules={form.modules.length}
                      onRemoveModule={onRemoveModule}
                      onMoveModule={onMoveModule}
                      onUpdateModule={onUpdateModule}
                      onToggleModuleExpand={onToggleModuleExpand}
                      onAddLesson={onAddLesson}
                      onRemoveLesson={onRemoveLesson}
                      onMoveLesson={onMoveLesson}
                      onUpdateLesson={onUpdateLesson}
                      onReorderLessons={onReorderLessons}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeModuleId ? (
                  <div className="border rounded-lg p-3 bg-white shadow-lg">
                    <div className="flex items-center gap-2">
                      <GripHorizontal className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {form.modules.find((m) => m.id === activeModuleId)?.title || t("courseEditor.moduleName", locale).replace("{number}", "0")}
                      </span>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={() => onSetActiveTab("basic")}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t("common.back", locale)}
        </Button>
        <Button
          className="bg-blue-700 hover:bg-blue-800 text-white"
          onClick={() => onSetActiveTab("preview")}
        >
          {t("courseEditor.nextPreview", locale)}
          <ChevronDown className="w-4 h-4 ml-1 rotate-[-90deg]" />
        </Button>
      </div>
    </>
  );
}
