"use client";
import { useRouter } from "next/navigation";

import { useState, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, ChevronDown, BookOpen, Eye, Settings, Save, Send, Calendar,
} from "lucide-react";
import { toast } from "sonner";

import { CurriculumTab } from "@/components/course-editor/CurriculumTab";
import { BasicTab } from "@/components/course-editor/BasicTab";
import { PreviewTab } from "@/components/course-editor/PreviewTab";
import { SettingsTab } from "@/components/course-editor/SettingsTab";
import {
  type CourseFormData, type ModuleForm, type LessonForm,
  slugify, createEmptyModule, createEmptyLesson, initialFormData,
} from "@/components/course-editor/types";

export function CourseEditorPage() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const locale = useAppStore((s) => s.locale);
  const [activeTab, setActiveTab] = useState("basic");

  const LEVEL_OPTIONS = [
    { value: "beginner", label: t("common.level.beginner", locale) },
    { value: "intermediate", label: t("common.level.intermediate", locale) },
    { value: "advanced", label: t("common.level.advanced", locale) },
  ];
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CourseFormData>(initialFormData);

  // ─── Field updaters ──────────────────────────────────────────────────────

  const updateField = useCallback(
    <K extends keyof CourseFormData>(key: K, value: CourseFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleTitleChange = useCallback((title: string) => {
    setForm((prev) => ({
      ...prev,
      title,
      slug: prev.slug === slugify(prev.title) ? slugify(title) : prev.slug,
    }));
  }, []);

  // ─── Module / Lesson operations ──────────────────────────────────────────

  const addModule = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      modules: [...prev.modules, createEmptyModule()],
    }));
  }, []);

  const removeModule = useCallback((moduleIdx: number) => {
    setForm((prev) => ({
      ...prev,
      modules: prev.modules.filter((_, i) => i !== moduleIdx),
    }));
  }, []);

  const moveModule = useCallback(
    (moduleIdx: number, direction: "up" | "down") => {
      setForm((prev) => {
        const arr = [...prev.modules];
        const target = direction === "up" ? moduleIdx - 1 : moduleIdx + 1;
        if (target < 0 || target >= arr.length) return prev;
        [arr[moduleIdx], arr[target]] = [arr[target], arr[moduleIdx]];
        return { ...prev, modules: arr };
      });
    },
    []
  );

  const updateModule = useCallback(
    (moduleIdx: number, patch: Partial<ModuleForm>) => {
      setForm((prev) => ({
        ...prev,
        modules: prev.modules.map((m, i) =>
          i === moduleIdx ? { ...m, ...patch } : m
        ),
      }));
    },
    []
  );

  const toggleModuleExpand = useCallback((moduleIdx: number) => {
    setForm((prev) => ({
      ...prev,
      modules: prev.modules.map((m, i) =>
        i === moduleIdx ? { ...m, isExpanded: !m.isExpanded } : m
      ),
    }));
  }, []);

  const addLesson = useCallback((moduleIdx: number) => {
    setForm((prev) => ({
      ...prev,
      modules: prev.modules.map((m, i) =>
        i === moduleIdx
          ? {
              ...m,
              lessons: [
                ...m.lessons,
                createEmptyLesson(m.lessons.length + 1),
              ],
            }
          : m
      ),
    }));
  }, []);

  const removeLesson = useCallback(
    (moduleIdx: number, lessonIdx: number) => {
      setForm((prev) => ({
        ...prev,
        modules: prev.modules.map((m, i) =>
          i === moduleIdx
            ? {
                ...m,
                lessons: m.lessons
                  .filter((_, li) => li !== lessonIdx)
                  .map((l, li) => ({ ...l, sortOrder: li + 1 })),
              }
            : m
        ),
      }));
    },
    []
  );

  const moveLesson = useCallback(
    (moduleIdx: number, lessonIdx: number, direction: "up" | "down") => {
      setForm((prev) => ({
        ...prev,
        modules: prev.modules.map((m, i) => {
          if (i !== moduleIdx) return m;
          const arr = [...m.lessons];
          const target =
            direction === "up" ? lessonIdx - 1 : lessonIdx + 1;
          if (target < 0 || target >= arr.length) return m;
          [arr[lessonIdx], arr[target]] = [arr[target], arr[lessonIdx]];
          return { ...m, lessons: arr.map((l, li) => ({ ...l, sortOrder: li + 1 })) };
        }),
      }));
    },
    []
  );

  const reorderModules = useCallback(
    (sourceIdx: number, destIdx: number) => {
      if (sourceIdx === destIdx) return;
      setForm((prev) => {
        const arr = [...prev.modules];
        const [moved] = arr.splice(sourceIdx, 1);
        arr.splice(destIdx, 0, moved);
        return { ...prev, modules: arr };
      });
    },
    []
  );

  const reorderLessons = useCallback(
    (moduleIdx: number, sourceIdx: number, destIdx: number) => {
      if (sourceIdx === destIdx) return;
      setForm((prev) => ({
        ...prev,
        modules: prev.modules.map((m, i) => {
          if (i !== moduleIdx) return m;
          const arr = [...m.lessons];
          const [moved] = arr.splice(sourceIdx, 1);
          arr.splice(destIdx, 0, moved);
          return {
            ...m,
            lessons: arr.map((l, li) => ({ ...l, sortOrder: li + 1 })),
          };
        }),
      }));
    },
    []
  );

  const updateLesson = useCallback(
    (
      moduleIdx: number,
      lessonIdx: number,
      patch: Partial<LessonForm>
    ) => {
      setForm((prev) => ({
        ...prev,
        modules: prev.modules.map((m, i) =>
          i === moduleIdx
            ? {
                ...m,
                lessons: m.lessons.map((l, li) =>
                  li === lessonIdx ? { ...l, ...patch } : l
                ),
              }
            : m
        ),
      }));
    },
    []
  );

  // ─── Save / Publish ──────────────────────────────────────────────────────

  const handleSave = useCallback(
    async (publish: boolean) => {
      if (!form.title.trim()) {
        toast.error(t("courseEditor.titleRequired", locale));
        setActiveTab("basic");
        return;
      }
      if (!form.description.trim() || form.description.trim().length < 10) {
        toast.error(t("courseEditor.descriptionTooShort", locale));
        setActiveTab("basic");
        return;
      }
      if (!form.categorySlug) {
        toast.error(t("courseEditor.selectCategory", locale));
        setActiveTab("basic");
        return;
      }

      setSaving(true);
      try {
        const body: Record<string, unknown> = {
          title: form.title.trim(),
          slug: form.slug.trim() || slugify(form.title),
          image: form.image || undefined,
          description: form.description.trim(),
          shortDesc: form.shortDesc.trim() || undefined,
          level: form.level,
          duration: form.duration.trim() || undefined,
          price: Number(form.price) || 0,
          oldPrice: form.oldPrice > 0 ? Number(form.oldPrice) : undefined,
          hasCertificate: form.hasCertificate,
          tags: form.tags.trim() || undefined,
          requirements: JSON.stringify(
            form.requirements.filter((r) => r.trim())
          ),
          whatYouLearn: JSON.stringify(
            form.whatYouLearn.filter((w) => w.trim())
          ),
          isPublished: publish,
          isFeatured: form.isFeatured,
          categorySlug: form.categorySlug,
          // New settings
          startDate: form.startDate || undefined,
          endDate: form.endDate || undefined,
          visibility: form.visibility,
          maxStudents: form.maxStudents > 0 ? form.maxStudents : undefined,
          prerequisites: form.prerequisites.length > 0 ? JSON.stringify(form.prerequisites) : undefined,
          language: form.language,
          modules: form.modules.map((m, mIdx) => ({
            title: m.title.trim() || t("courseEditor.moduleName", locale).replace("{number}", String(mIdx + 1)),
            sortOrder: mIdx + 1,
            lessons: m.lessons.map((l, lIdx) => ({
              title: l.title.trim() || t("courseEditor.lessonName", locale).replace("{number}", String(lIdx + 1)),
              type: l.type,
              duration: Number(l.duration) || 0,
              isFree: l.isFree,
              content: l.content.trim() || undefined,
              videoUrl: l.videoUrl.trim() || undefined,
              sortOrder: lIdx + 1,
              assignments: l.assignments.length > 0 ? l.assignments.map((a) => {
                const aData: Record<string, unknown> = {
                  title: a.title.trim() || "",
                  description: a.description.trim() || "",
                  type: a.type,
                  points: Number(a.points) || 10,
                  maxAttempts: a.maxAttempts ? Number(a.maxAttempts) : null,
                };
                if (a.type === "quiz" && a.quizOptions?.length) {
                  aData.options = JSON.stringify(a.quizOptions.map((o) => o.text));
                  aData.correctAnswer = JSON.stringify(
                    a.quizOptions.map((o, i) => o.isCorrect ? i : -1).filter((i) => i >= 0)
                  );
                } else if (a.type === "matching" && a.matchingPairs?.length) {
                  const pairs = a.matchingPairs.map((p) => ({ left: p.left, right: p.right }));
                  aData.options = JSON.stringify(pairs);
                  aData.correctAnswer = JSON.stringify(pairs);
                } else if (a.type === "ordering" && a.orderingItems?.length) {
                  aData.options = JSON.stringify(a.orderingItems.map((o) => o.text));
                  aData.correctAnswer = JSON.stringify(a.orderingItems.map((o) => o.text));
                } else if (a.type === "drag_drop" && a.dragDropItems?.length) {
                  aData.options = JSON.stringify(a.dragDropItems.map((d) => ({ id: d.id, text: d.text, group: d.group })));
                  aData.correctAnswer = JSON.stringify(
                    Object.fromEntries(a.dragDropItems.map((d) => [d.id, d.group]))
                  );
                }
                return aData;
              }) : undefined,
            })),
          })),
        };

        const res = await fetch("/api/admin/courses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();

        if (res.ok) {
          toast.success(
            publish
              ? t("courseEditor.coursePublished", locale)
              : t("courseEditor.draftSaved", locale)
          );
          router.push("/admin");
        } else {
          toast.error(data.error || t("courseEditor.saveError", locale));
        }
      } catch {
        toast.error(t("courseEditor.saveErrorGeneric", locale));
      } finally {
        setSaving(false);
      }
    },
    [form, locale, router]
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-gradient-to-r from-blue-800 to-violet-700 text-white">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                className="text-white hover:bg-white/10 -ml-2"
                onClick={() => router.push("/admin")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t("common.back", locale)}
              </Button>
              <Separator orientation="vertical" className="h-6 bg-white/30" />
              <div>
                <h1 className="text-xl md:text-2xl font-bold">
                  {t("courseEditor.createCourse", locale)}
                </h1>
                <p className="text-blue-200 text-sm">
                   {t("courseEditor.editorPanel", locale)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 bg-transparent"
                onClick={() => handleSave(false)}
                disabled={saving}
              >
                <Save className="w-4 h-4 mr-2" />
                {t("common.save", locale)}
              </Button>
              <Button
                className="bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => handleSave(true)}
                disabled={saving}
              >
                <Send className="w-4 h-4 mr-2" />
                {t("courseEditor.publish", locale)}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="basic">
              <Settings className="w-4 h-4 mr-1.5" />
              {t("courseEditor.tabBasic", locale)}
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Calendar className="w-4 h-4 mr-1.5" />
              {t("courseEditor.tabSettings", locale)}
            </TabsTrigger>
            <TabsTrigger value="curriculum">
              <BookOpen className="w-4 h-4 mr-1.5" />
              {t("courseEditor.tabCurriculum", locale)}
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="w-4 h-4 mr-1.5" />
              {t("courseEditor.tabPreview", locale)}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <BasicTab
              form={form}
              locale={locale}
              levelOptions={LEVEL_OPTIONS}
              onUpdateField={updateField}
              onTitleChange={handleTitleChange}
              onNextTab={() => setActiveTab("settings")}
            />
            <div className="flex justify-end mt-6">
              <Button
                className="bg-blue-700 hover:bg-blue-800 text-white"
                onClick={() => setActiveTab("settings")}
              >
                {t("common.next", locale)}: {t("courseEditor.tabSettings", locale)}
                <ChevronDown className="w-4 h-4 ml-1 rotate-[-90deg]" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <SettingsTab
              form={form}
              locale={locale}
              onUpdateField={updateField}
            />
            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setActiveTab("basic")}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                {t("common.back", locale)}
              </Button>
              <Button
                className="bg-blue-700 hover:bg-blue-800 text-white"
                onClick={() => setActiveTab("curriculum")}
              >
                {t("common.next", locale)}: {t("courseEditor.tabCurriculum", locale)}
                <ChevronDown className="w-4 h-4 ml-1 rotate-[-90deg]" />
              </Button>
            </div>
          </TabsContent>

          {/* ─── Tab 2: Curriculum ───────────────────────────────────────── */}
          <TabsContent value="curriculum">
            <CurriculumTab
              form={form}
              locale={locale}
              onSetActiveTab={setActiveTab}
              onAddModule={addModule}
              onRemoveModule={removeModule}
              onMoveModule={moveModule}
              onUpdateModule={updateModule}
              onToggleModuleExpand={toggleModuleExpand}
              onAddLesson={addLesson}
              onRemoveLesson={removeLesson}
              onMoveLesson={moveLesson}
              onUpdateLesson={updateLesson}
              onReorderModules={reorderModules}
              onReorderLessons={reorderLessons}
            />
          </TabsContent>

          <TabsContent value="preview">
            <PreviewTab
              form={form}
              locale={locale}
              user={user}
              saving={saving}
              onSave={handleSave}
              onBackToEdit={() => setActiveTab("curriculum")}
              onNavigate={(p) => router.push("/" + p)}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
