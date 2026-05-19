"use client";

import React, { useState, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { lessonTypeIcon } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ArrowLeft,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  BookOpen,
  FileText,
  Video,
  Code,
  HelpCircle,
  ClipboardList,
  CheckCircle2,
  Clock,
  Award,
  Star,
  Users,
  Save,
  Send,
  Eye,
  Settings,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import { levelLabels, levelColors, CATEGORIES } from "@/lib/constants";

import type { Locale } from "@/lib/store";

function VideoUploadButton({ onUpload, locale }: { onUpload: (url: string) => void; locale: Locale }) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "lessons");

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }
      const data = await res.json();
      onUpload(data.url);
      toast.success(t("courseEditor.videoUploaded", locale));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("courseEditor.uploadError", locale));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <>
      <input
        type="file"
        accept="video/*"
        onChange={handleFile}
        disabled={uploading}
        className="hidden"
        id="video-upload"
      />
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs shrink-0"
        disabled={uploading}
        onClick={() => document.getElementById("video-upload")?.click()}
      >
        {uploading ? "..." : t("courseEditor.upload", locale)}
      </Button>
    </>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface LessonForm {
  id: string;
  title: string;
  type: "video" | "text" | "coding" | "quiz" | "assignment";
  duration: number;
  isFree: boolean;
  content: string;
  videoUrl: string;
  sortOrder: number;
}

interface ModuleForm {
  id: string;
  title: string;
  lessons: LessonForm[];
  isExpanded: boolean;
}

interface CourseFormData {
  title: string;
  slug: string;
  shortDesc: string;
  description: string;
  categorySlug: string;
  level: "beginner" | "intermediate" | "advanced";
  duration: string;
  price: number;
  oldPrice: number;
  hasCertificate: boolean;
  tags: string;
  modules: ModuleForm[];
  requirements: string[];
  whatYouLearn: string[];
  isPublished: boolean;
  isFeatured: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _counter = 0;
function uid() {
  return `temp-${Date.now()}-${++_counter}`;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const CATEGORY_OPTIONS = CATEGORIES;



// ─── Initial State ───────────────────────────────────────────────────────────

function createEmptyModule(): ModuleForm {
  return {
    id: uid(),
    title: "",
    lessons: [],
    isExpanded: true,
  };
}

function createEmptyLesson(sortOrder: number): LessonForm {
  return {
    id: uid(),
    title: "",
    type: "video",
    duration: 0,
    isFree: false,
    content: "",
    videoUrl: "",
    sortOrder,
  };
}

const initialFormData: CourseFormData = {
  title: "",
  slug: "",
  shortDesc: "",
  description: "",
  categorySlug: "",
  level: "beginner",
  duration: "",
  price: 0,
  oldPrice: 0,
  hasCertificate: true,
  tags: "",
  modules: [],
  requirements: [""],
  whatYouLearn: [""],
  isPublished: false,
  isFeatured: false,
};

// ─── Component ───────────────────────────────────────────────────────────────

export function CourseEditorPage() {
  const { navigate, user } = useAppStore();
  const locale = useAppStore((s) => s.locale);
  const [activeTab, setActiveTab] = useState("basic");

  const LEVEL_OPTIONS = [
    { value: "beginner", label: t("common.level.beginner", locale) },
    { value: "intermediate", label: t("common.level.intermediate", locale) },
    { value: "advanced", label: t("common.level.advanced", locale) },
  ];

  const LESSON_TYPE_OPTIONS = [
    { value: "video", label: t("courseEditor.typeVideo", locale), icon: Video },
    { value: "text", label: t("courseEditor.typeText", locale), icon: FileText },
    { value: "coding", label: t("courseEditor.typeCoding", locale), icon: Code },
    { value: "quiz", label: t("courseEditor.typeQuiz", locale), icon: HelpCircle },
    { value: "assignment", label: t("courseEditor.typeAssignment", locale), icon: ClipboardList },
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
          navigate("admin");
        } else {
          toast.error(data.error || t("courseEditor.saveError", locale));
        }
      } catch {
        toast.error(t("courseEditor.saveErrorGeneric", locale));
      } finally {
        setSaving(false);
      }
    },
    [form, navigate, locale]
  );

  // ─── Computed values for preview ─────────────────────────────────────────

  const totalLessons = form.modules.reduce(
    (acc, m) => acc + m.lessons.length,
    0
  );
  const totalDuration = form.modules.reduce(
    (acc, m) =>
      acc + m.lessons.reduce((la, l) => la + (l.duration || 0), 0),
    0
  );
  const freeLessons = form.modules.reduce(
    (acc, m) => acc + m.lessons.filter((l) => l.isFree).length,
    0
  );
  const categoryLabel =
    CATEGORY_OPTIONS.find((c) => c.slug === form.categorySlug)?.label || "";

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
                onClick={() => navigate("admin")}
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
            <TabsTrigger value="curriculum">
              <BookOpen className="w-4 h-4 mr-1.5" />
              {t("courseEditor.tabCurriculum", locale)}
            </TabsTrigger>
            <TabsTrigger value="additional">
              <GraduationCap className="w-4 h-4 mr-1.5" />
              {t("courseEditor.tabAdditional", locale)}
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="w-4 h-4 mr-1.5" />
              {t("courseEditor.tabPreview", locale)}
            </TabsTrigger>
          </TabsList>

          {/* ─── Tab 1: Basic Info ──────────────────────────────────────── */}
          <TabsContent value="basic">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left column */}
              <div className="space-y-6">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-700" />
                      {t("courseEditor.sectionCourseInfo", locale)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">{t("courseEditor.fieldTitle", locale)}</Label>
                      <Input
                        id="title"
                        placeholder={t("courseEditor.titlePlaceholder", locale)}
                        value={form.title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slug">{t("courseEditor.slugLabel", locale)}</Label>
                      <Input
                        id="slug"
                        placeholder="python-beginners"
                        value={form.slug}
                        onChange={(e) => updateField("slug", e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("courseEditor.autoSlug", locale)}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shortDesc">{t("courseEditor.fieldShortDesc", locale)}</Label>
                      <Input
                        id="shortDesc"
                        placeholder={t("courseEditor.shortDescPlaceholder", locale)}
                        maxLength={200}
                        value={form.shortDesc}
                        onChange={(e) =>
                          updateField("shortDesc", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">{t("courseEditor.fieldFullDesc", locale)}</Label>
                      <Textarea
                        id="description"
                        placeholder={t("courseEditor.descriptionPlaceholder", locale)}
                        rows={7}
                        value={form.description}
                        onChange={(e) =>
                          updateField("description", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tags">{t("courseEditor.fieldTags", locale)}</Label>
                      <Input
                        id="tags"
                        placeholder={t("courseEditor.tagsPlaceholder", locale)}
                        value={form.tags}
                        onChange={(e) => updateField("tags", e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right column */}
              <div className="space-y-6">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-violet-600" />
                      {t("courseEditor.categoryAndLevel", locale)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t("courseEditor.fieldCategory", locale)}</Label>
                      <Select
                        value={form.categorySlug}
                        onValueChange={(v) => updateField("categorySlug", v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("courseEditor.categoryPlaceholder", locale)} />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORY_OPTIONS.map((cat) => (
                            <SelectItem key={cat.slug} value={cat.slug}>
                              <span className="mr-2">{cat.icon}</span>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("courseEditor.fieldLevel", locale)}</Label>
                      <Select
                        value={form.level}
                        onValueChange={(v) =>
                          updateField(
                            "level",
                            v as CourseFormData["level"]
                          )
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEVEL_OPTIONS.map((lvl) => (
                            <SelectItem key={lvl.value} value={lvl.value}>
                              {lvl.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duration">{t("courseEditor.fieldDuration", locale)}</Label>
                      <Input
                        id="duration"
                        placeholder={t("courseEditor.durationPlaceholder", locale)}
                        value={form.duration}
                        onChange={(e) =>
                          updateField("duration", e.target.value)
                        }
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Star className="w-5 h-5 text-amber-500" />
                      {t("courseEditor.priceAndCertificate", locale)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price">{t("courseEditor.fieldPrice", locale)}</Label>
                        <Input
                          id="price"
                          type="number"
                          min={0}
                          value={form.price}
                          onChange={(e) =>
                            updateField(
                              "price",
                              Number(e.target.value) || 0
                            )
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="oldPrice">{t("courseEditor.fieldOldPrice", locale)}</Label>
                        <Input
                          id="oldPrice"
                          type="number"
                          min={0}
                          placeholder={t("courseEditor.optional", locale)}
                          value={form.oldPrice || ""}
                          onChange={(e) =>
                            updateField(
                              "oldPrice",
                              Number(e.target.value) || 0
                            )
                          }
                        />
                      </div>
                    </div>
                    {form.price === 0 && (
                      <Badge className="bg-green-100 text-green-700 border-0">
                        {t("courseEditor.freeCourse", locale)}
                      </Badge>
                    )}
                    {form.oldPrice > form.price && form.price > 0 && (
                      <Badge className="bg-red-100 text-red-700 border-0">
                        {t("courseEditor.discountPercent", locale).replace("{percent}", String(Math.round(
                          ((form.oldPrice - form.price) / form.oldPrice) * 100
                        )))}
                      </Badge>
                    )}
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>{t("courseEditor.fieldCertificate", locale)}</Label>
                        <p className="text-xs text-muted-foreground">
                          {t("courseEditor.certificateHint", locale)}
                        </p>
                      </div>
                      <Switch
                        checked={form.hasCertificate}
                        onCheckedChange={(v) =>
                          updateField("hasCertificate", v)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>{t("courseEditor.fieldRecommended", locale)}</Label>
                        <p className="text-xs text-muted-foreground">
                          {t("courseEditor.recommendedHint", locale)}
                        </p>
                      </div>
                      <Switch
                        checked={form.isFeatured}
                        onCheckedChange={(v) =>
                          updateField("isFeatured", v)
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-end mt-6">
              <Button
                className="bg-blue-700 hover:bg-blue-800 text-white"
                onClick={() => setActiveTab("curriculum")}
              >
                 {t("courseEditor.nextCurriculum", locale)}
                <ChevronDown className="w-4 h-4 ml-1 rotate-[-90deg]" />
              </Button>
            </div>
          </TabsContent>

          {/* ─── Tab 2: Curriculum ───────────────────────────────────────── */}
          <TabsContent value="curriculum">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-700" />
                    Программа курса
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addModule}
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
                      onClick={addModule}
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
                        onOpenChange={() => toggleModuleExpand(mIdx)}
                      >
                        <div className="border rounded-lg overflow-hidden">
                          {/* Module header */}
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
                                onChange={(e) =>
                                  updateModule(mIdx, {
                                    title: e.target.value,
                                  })
                                }
                                onClick={(e) => e.stopPropagation()}
                              />
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                disabled={mIdx === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveModule(mIdx, "up");
                                }}
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                disabled={mIdx === form.modules.length - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveModule(mIdx, "down");
                                }}
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeModule(mIdx);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Module content (lessons) */}
                          <CollapsibleContent>
                            <div className="p-3 space-y-2">
                              {mod.lessons.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                  {t("courseEditor.noLessonsInModule", locale)}
                                </p>
                              ) : (
                                mod.lessons.map((lesson, lIdx) => (
                                  <div
                                    key={lesson.id}
                                    className="border rounded-lg p-3 bg-white"
                                  >
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
                                        onChange={(e) =>
                                          updateLesson(mIdx, lIdx, {
                                            title: e.target.value,
                                          })
                                        }
                                      />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        disabled={lIdx === 0}
                                        onClick={() =>
                                          moveLesson(mIdx, lIdx, "up")
                                        }
                                      >
                                        <ChevronUp className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        disabled={
                                          lIdx === mod.lessons.length - 1
                                        }
                                        onClick={() =>
                                          moveLesson(mIdx, lIdx, "down")
                                        }
                                      >
                                        <ChevronDown className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={() =>
                                          removeLesson(mIdx, lIdx)
                                        }
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                      <div className="space-y-1">
                                        <Label className="text-xs">
                                          {t("courseEditor.type", locale)}
                                        </Label>
                                        <Select
                                          value={lesson.type}
                                          onValueChange={(v) =>
                                            updateLesson(mIdx, lIdx, {
                                              type: v as LessonForm["type"],
                                            })
                                          }
                                        >
                                          <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {LESSON_TYPE_OPTIONS.map(
                                              (opt) => (
                                                <SelectItem
                                                  key={opt.value}
                                                  value={opt.value}
                                                >
                                                  {opt.label}
                                                </SelectItem>
                                              )
                                            )}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">
                                          {t("courseEditor.durationLabel", locale)}
                                        </Label>
                                        <Input
                                          type="number"
                                          min={0}
                                          className="h-8 text-xs"
                                          value={lesson.duration || ""}
                                          onChange={(e) =>
                                            updateLesson(mIdx, lIdx, {
                                              duration:
                                                Number(e.target.value) || 0,
                                            })
                                          }
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">
                                          {t("courseEditor.freeLabel", locale)}
                                        </Label>
                                        <div className="h-8 flex items-center">
                                          <Switch
                                            checked={lesson.isFree}
                                            onCheckedChange={(v) =>
                                              updateLesson(mIdx, lIdx, {
                                                isFree: v,
                                              })
                                            }
                                          />
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">
                                          {t("courseEditor.sortOrder", locale)}
                                        </Label>
                                        <Input
                                          type="number"
                                          min={1}
                                          className="h-8 text-xs"
                                          value={lesson.sortOrder}
                                          onChange={(e) =>
                                            updateLesson(mIdx, lIdx, {
                                              sortOrder:
                                                Number(e.target.value) || 1,
                                            })
                                          }
                                        />
                                      </div>
                                    </div>
                                    {(lesson.type === "text" ||
                                      lesson.type === "coding" ||
                                      lesson.type === "assignment") && (
                                      <div className="mt-3 space-y-1">
                                        <Label className="text-xs">
                                          {t("courseEditor.fieldLessonContent", locale)}
                                        </Label>
                                        <Textarea
                                          className="text-xs min-h-[80px]"
                                          placeholder={t("courseEditor.lessonContentPlaceholder", locale)}
                                          value={lesson.content}
                                          onChange={(e) =>
                                            updateLesson(mIdx, lIdx, {
                                              content: e.target.value,
                                            })
                                          }
                                          rows={4}
                                        />
                                      </div>
                                    )}
                                    {lesson.type === "video" && (
                                      <div className="mt-3 space-y-1">
                                        <Label className="text-xs">
                                          {t("courseEditor.fieldVideoUrl", locale)}
                                        </Label>
                                        <div className="flex gap-2">
                                          <Input
                                            className="h-8 text-xs flex-1"
                                            placeholder="https://..."
                                            value={lesson.videoUrl}
                                            onChange={(e) =>
                                              updateLesson(mIdx, lIdx, {
                                                videoUrl: e.target.value,
                                              })
                                            }
                                          />
                                          <VideoUploadButton
                                            locale={locale}
                                            onUpload={(url) =>
                                              updateLesson(mIdx, lIdx, {
                                                videoUrl: url,
                                              })
                                            }
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full border-dashed text-muted-foreground hover:text-blue-700 hover:border-blue-300"
                                onClick={() => addLesson(mIdx)}
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

            {/* Navigation */}
            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={() => setActiveTab("basic")}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                {t("common.back", locale)}
              </Button>
              <Button
                className="bg-blue-700 hover:bg-blue-800 text-white"
                onClick={() => setActiveTab("preview")}
              >
                {t("courseEditor.nextPreview", locale)}
                <ChevronDown className="w-4 h-4 ml-1 rotate-[-90deg]" />
              </Button>
            </div>
          </TabsContent>

          {/* ─── Tab 4: Preview ───────────────────────────────────────────── */}
          <TabsContent value="preview">
            <div className="space-y-4">
              {/* Preview banner */}
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-4 flex items-center gap-3">
                  <Eye className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-800">
                    {t("courseEditor.previewBanner", locale)}
                  </p>
                </CardContent>
              </Card>

              {/* Course preview — mimics CourseDetailPage layout */}
              <div className="rounded-xl overflow-hidden">
                {/* Hero section */}
                <section className="bg-gradient-to-br from-blue-800 to-violet-800 text-white">
                  <div className="container mx-auto px-6 py-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      <div className="lg:col-span-2">
                        <div className="flex items-center gap-2 mb-3">
                          {form.categorySlug && (
                            <Badge className="bg-white/20 text-white border-0">
                              {categoryLabel}
                            </Badge>
                          )}
                          <Badge className={levelColors[form.level]}>
                            {levelLabels[form.level]}
                          </Badge>
                          {form.isPublished ? (
                            <Badge className="bg-green-500/20 text-green-200 border-0 text-xs">
                              {t("common.published", locale)}
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-500/20 text-yellow-200 border-0 text-xs">
                              {t("common.draft", locale)}
                            </Badge>
                          )}
                        </div>
                        <h1 className="text-2xl md:text-4xl font-bold mb-3">
                          {form.title || t("courseEditor.fieldTitleFallback", locale)}
                        </h1>
                        {form.shortDesc && (
                          <p className="text-blue-100 text-lg mb-4">
                            {form.shortDesc}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-4 text-sm text-blue-100">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {form.duration || t("courseEditor.minutes", locale).replace("{count}", String(totalDuration))}
                          </span>
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-4 h-4" />
                            {t("courseEditor.totalLessons", locale).replace("{count}", String(totalLessons))}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {t("courseEditor.zeroStudents", locale)}
                          </span>
                          {form.hasCertificate && (
                            <span className="flex items-center gap-1">
                              <Award className="w-4 h-4" />
                              {t("common.certificate", locale)}
                            </span>
                          )}
                        </div>
                        {form.tags && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {form.tags
                              .split(",")
                              .filter(Boolean)
                              .map((tag, i) => (
                                <Badge
                                  key={i}
                                  className="bg-white/10 text-white/80 border-0 text-xs"
                                >
                                  {tag.trim()}
                                </Badge>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Price card */}
                      <div className="lg:col-span-1">
                        <Card className="border-0 shadow-xl">
                          <CardContent className="p-6">
                            <div className="mb-4">
                              {form.price === 0 ? (
                                <span className="text-3xl font-bold text-green-600">
                                  {t("courseCard.free", locale)}
                                </span>
                              ) : (
                                <div>
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold">
                                      {formatNumber(form.price, locale)} ₽
                                    </span>
                                    {form.oldPrice > form.price && (
                                      <span className="text-lg text-muted-foreground line-through">
                                        {formatNumber(form.oldPrice, locale)}{" "}
                                        ₽
                                      </span>
                                    )}
                                  </div>
                                  {form.oldPrice > form.price &&
                                    form.price > 0 && (
                                      <Badge className="mt-1 bg-red-100 text-red-700 border-0">
                                        {t("courseEditor.discountPercent", locale).replace("{percent}", String(Math.round(
                                          ((form.oldPrice - form.price) /
                                            form.oldPrice) *
                                            100
                                        )))}
                                      </Badge>
                                    )}
                                </div>
                              )}
                            </div>
                            <div className="mt-4 text-xs text-muted-foreground space-y-1">
                              <p>
                                ✅ {t("courseEditor.lessonsCount", locale).replace("{count}", String(totalLessons))}
                              </p>
                              <p>
                                ✅ {t("courseEditor.freeLessons", locale).replace("{count}", String(freeLessons))}
                              </p>
                              <p>
                                ✅ {t("courseEditor.learningDuration", locale).replace("{duration}", form.duration || t("courseEditor.minutes", locale).replace("{count}", String(totalDuration)))}
                              </p>
                              {form.hasCertificate && (
                                <p>✅ {t("courseEditor.certificateCompletion", locale)}</p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Content section */}
                <div className="container mx-auto px-6 py-8 bg-white">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                      {/* What you'll learn */}
                      {form.whatYouLearn.filter(Boolean).length > 0 && (
                        <div>
                          <h2 className="text-xl font-bold mb-4">
                            {t("courseEditor.sectionWhatYouLearnPreview", locale)}
                          </h2>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {form.whatYouLearn
                              .filter(Boolean)
                              .map((item, i) => (
                                <div
                                  key={i}
                                  className="flex items-start gap-2"
                                >
                                  <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                  <span className="text-sm">{item}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Description */}
                      {form.description && (
                        <div>
                          <h2 className="text-xl font-bold mb-4">{t("courseEditor.sectionAboutCourse", locale)}</h2>
                          <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                            {form.description}
                          </div>
                        </div>
                      )}

                      {/* Requirements */}
                      {form.requirements.filter(Boolean).length > 0 && (
                        <div>
                          <h2 className="text-xl font-bold mb-4">
                            {t("courseEditor.sectionRequirements", locale)}
                          </h2>
                          <ul className="space-y-2">
                            {form.requirements
                              .filter(Boolean)
                              .map((req, i) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-2 text-sm text-muted-foreground"
                                >
                                  <span>•</span>
                                  {req}
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}

                      {/* Curriculum */}
                      {form.modules.length > 0 && (
                        <div>
                          <h2 className="text-xl font-bold mb-4">
                            {t("courseEditor.programWithCount", locale).replace("{count}", String(form.modules.length))}
                          </h2>
                          <div className="space-y-2">
                            {form.modules.map((mod, mIdx) => (
                              <div
                                key={mod.id}
                                className="border rounded-lg p-4"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="w-8 h-8 bg-violet-100 text-violet-700 rounded-lg flex items-center justify-center text-sm font-semibold">
                                    {mIdx + 1}
                                  </span>
                                  <div>
                                    <p className="font-semibold text-sm">
                                      {mod.title ||
                                        t("courseEditor.moduleName", locale).replace("{number}", String(mIdx + 1))}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {t("courseEditor.lessonsCountInModule", locale).replace("{count}", String(mod.lessons.length))}
                                    </p>
                                  </div>
                                </div>
                                {mod.lessons.length > 0 && (
                                  <div className="mt-3 ml-11 space-y-1">
                                    {mod.lessons.map((lesson, lIdx) => (
                                      <div
                                        key={lesson.id}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                                      >
                                        {lessonTypeIcon(lesson.type)}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm truncate">
                                            {lesson.title ||
                                              t("courseEditor.lessonName", locale).replace("{number}", String(lIdx + 1))}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {lesson.isFree && (
                                            <Badge
                                              variant="outline"
                                              className="text-[10px] text-green-600 border-green-300"
                                            >
                                              {t("courseCard.free", locale)}
                                            </Badge>
                                          )}
                                          <span className="text-xs text-muted-foreground">
                                            {t("courseEditor.minutes", locale).replace("{count}", String(lesson.duration))}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Teacher */}
                      <div>
                          <h2 className="text-xl font-bold mb-4">
                            {t("courseEditor.sectionInstructor", locale)}
                          </h2>
                        <Card className="border-0 shadow-sm">
                          <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center text-violet-700 font-bold text-xl">
                              {user?.name
                                ?.split(" ")
                                .map((n) => n[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2) || "T"}
                            </div>
                            <div>
                              <h3 className="font-semibold">
                                {user?.name || t("courseEditor.sectionInstructor", locale)}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {t("courseEditor.authorLabel", locale)}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-4 pb-8">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("additional")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {t("courseEditor.backToEdit", locale)}
                </Button>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => navigate("admin")}
                    className="text-muted-foreground"
                  >
                    {t("common.cancel", locale)}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-blue-200 text-blue-700 hover:bg-blue-50"
                    onClick={() => handleSave(false)}
                    disabled={saving}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? t("common.saving", locale) : t("courseEditor.saveDraft", locale)}
                  </Button>
                  <Button
                    className="bg-blue-700 hover:bg-blue-800 text-white"
                    onClick={() => handleSave(true)}
                    disabled={saving}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {saving ? t("common.publishing", locale) : t("courseEditor.publish", locale)}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
