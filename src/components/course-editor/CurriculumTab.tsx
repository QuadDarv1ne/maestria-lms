"use client";

import { useMemo } from "react";
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
  Video, FileText, Code, HelpCircle, ClipboardList,
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
}

export function CurriculumTab({
  form, locale, onSetActiveTab,
  onAddModule, onRemoveModule, onMoveModule, onUpdateModule, onToggleModuleExpand,
  onAddLesson, onRemoveLesson, onMoveLesson, onUpdateLesson,
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

  const LESSON_TYPE_OPTIONS = [
    { value: "video", label: t("courseEditor.typeVideo", locale), icon: Video },
    { value: "text", label: t("courseEditor.typeText", locale), icon: FileText },
    { value: "coding", label: t("courseEditor.typeCoding", locale), icon: Code },
    { value: "quiz", label: t("courseEditor.typeQuiz", locale), icon: HelpCircle },
    { value: "assignment", label: t("courseEditor.typeAssignment", locale), icon: ClipboardList },
  ];

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
            <div className="space-y-3">
              {form.modules.map((mod, mIdx) => (
                <Collapsible
                  key={mod.id}
                  open={mod.isExpanded}
                  onOpenChange={() => onToggleModuleExpand(mIdx)}
                >
                  <div className="border rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 p-3 bg-gray-50">
                      <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0 cursor-grab" />
                      <span className="w-7 h-7 bg-violet-100 text-violet-700 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {mIdx + 1}
                      </span>
                      <CollapsibleTrigger asChild>
                        <Input
                          className="flex-1 h-8 text-sm font-medium bg-transparent border-0 shadow-none focus-visible:ring-1 px-2"
                          placeholder={t("courseEditor.moduleName", locale).replace("{number}", String(mIdx + 1))}
                          value={mod.title}
                          onChange={(e) => onUpdateModule(mIdx, { title: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </CollapsibleTrigger>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost" size="sm" className="h-7 w-7 p-0"
                          disabled={mIdx === 0}
                          onClick={(e) => { e.stopPropagation(); onMoveModule(mIdx, "up"); }}
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-7 w-7 p-0"
                          disabled={mIdx === form.modules.length - 1}
                          onClick={(e) => { e.stopPropagation(); onMoveModule(mIdx, "down"); }}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => { e.stopPropagation(); onRemoveModule(mIdx); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <CollapsibleContent>
                      <div className="p-3 space-y-2">
                        {mod.lessons.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            {t("courseEditor.noLessonsInModule", locale)}
                          </p>
                        ) : (
                          mod.lessons.map((lesson, lIdx) => (
                            <div key={lesson.id} className="border rounded-lg p-3 bg-white">
                              <div className="flex items-center gap-2 mb-3">
                                <GripVertical className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
                                  {mIdx + 1}.{lIdx + 1}
                                </span>
                                {lessonTypeIcon(lesson.type)}
                                <Input
                                  className="flex-1 h-7 text-sm border-0 shadow-none focus-visible:ring-1 px-1"
                                  placeholder={t("courseEditor.lessonName", locale).replace("{number}", String(lIdx + 1))}
                                  value={lesson.title}
                                  onChange={(e) => onUpdateLesson(mIdx, lIdx, { title: e.target.value })}
                                />
                                <Button
                                  variant="ghost" size="sm" className="h-6 w-6 p-0"
                                  disabled={lIdx === 0}
                                  onClick={() => onMoveLesson(mIdx, lIdx, "up")}
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost" size="sm" className="h-6 w-6 p-0"
                                  disabled={lIdx === mod.lessons.length - 1}
                                  onClick={() => onMoveLesson(mIdx, lIdx, "down")}
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => onRemoveLesson(mIdx, lIdx)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">{t("courseEditor.type", locale)}</Label>
                                  <Select
                                    value={lesson.type}
                                    onValueChange={(v) => onUpdateLesson(mIdx, lIdx, { type: v as LessonForm["type"] })}
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
                                    onChange={(e) => onUpdateLesson(mIdx, lIdx, { duration: Number(e.target.value) || 0 })}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">{t("courseEditor.freeLabel", locale)}</Label>
                                  <div className="h-8 flex items-center">
                                    <Switch
                                      checked={lesson.isFree}
                                      onCheckedChange={(v) => onUpdateLesson(mIdx, lIdx, { isFree: v })}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">{t("courseEditor.sortOrder", locale)}</Label>
                                  <Input
                                    type="number" min={1} className="h-8 text-xs"
                                    value={lesson.sortOrder}
                                    onChange={(e) => onUpdateLesson(mIdx, lIdx, { sortOrder: Number(e.target.value) || 1 })}
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
                                    onChange={(e) => onUpdateLesson(mIdx, lIdx, { content: e.target.value })}
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
                                      onChange={(e) => onUpdateLesson(mIdx, lIdx, { videoUrl: e.target.value })}
                                    />
                                    <VideoUploadButton
                                      locale={locale}
                                      onUpload={(url) => onUpdateLesson(mIdx, lIdx, { videoUrl: url })}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                        <Button
                          variant="outline" size="sm"
                          className="w-full border-dashed text-muted-foreground hover:text-blue-700 hover:border-blue-300"
                          onClick={() => onAddLesson(mIdx)}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          {t("courseEditor.addLesson", locale)}
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
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
