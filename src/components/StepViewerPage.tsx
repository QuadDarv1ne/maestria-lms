"use client";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { t, useLocale } from "@/lib/i18n";
import { log } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  ChevronRight,
  Menu,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";

import { StepSidebar } from "@/components/step-viewer/StepSidebar";
import type { StepData, CourseStructure, ModuleStructure, LessonStructure } from "@/components/step-viewer/StepTypes";

const LazyStepVideo = dynamic(() => import("@/components/step-viewer/StepVideo").then(m => m.StepVideo), { ssr: false });
const LazyStepText = dynamic(() => import("@/components/step-viewer/StepText").then(m => m.StepText), { ssr: false });
const LazyStepCoding = dynamic(() => import("@/components/step-viewer/StepCoding").then(m => m.StepCoding), { ssr: false });
const LazyStepQuiz = dynamic(() => import("@/components/step-viewer/StepQuiz").then(m => m.StepQuiz), { ssr: false });
const LazyStepAssignment = dynamic(() => import("@/components/step-viewer/StepAssignment").then(m => m.StepAssignment), { ssr: false });
const LazyStepMatching = dynamic(() => import("@/components/step-viewer/StepMatching").then(m => m.StepMatching), { ssr: false });
const LazyStepOrdering = dynamic(() => import("@/components/step-viewer/StepOrdering").then(m => m.StepOrdering), { ssr: false });
const LazyStepEssay = dynamic(() => import("@/components/step-viewer/StepEssay").then(m => m.StepEssay), { ssr: false });
const LazyStepFileUpload = dynamic(() => import("@/components/step-viewer/StepFileUpload").then(m => m.StepFileUpload), { ssr: false });
const LazyStepDragDrop = dynamic(() => import("@/components/step-viewer/StepDragDrop").then(m => m.StepDragDrop), { ssr: false });

// ==================== CONSTANTS ====================

const stepTypeColors: Record<string, string> = {
  video: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  text: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400",
  coding: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  quiz: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
  assignment: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400",
  matching: "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400",
  ordering: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400",
  essay: "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400",
  file_upload: "bg-slate-100 dark:bg-slate-900/30 text-slate-700 dark:text-slate-400",
  drag_drop: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
};

// ==================== MAIN COMPONENT ====================

export function StepViewerPage({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}) {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const { locale } = useLocale();
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const [step, setStep] = useState<StepData | null>(null);
  const [courseStructure, setCourseStructure] = useState<CourseStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Submit assignment to server
  const [submittingAssignment, setSubmittingAssignment] = useState(false);

  const submitAssignment = useCallback(async (assignmentId: string, answer: unknown) => {
    if (!step) return null;
    setSubmittingAssignment(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/assignments/${assignmentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || t("course.step.errorLoad", locale));
        return null;
      }
      return data;
    } catch {
      toast.error(t("course.step.errorLoad", locale));
      return null;
    } finally {
      setSubmittingAssignment(false);
    }
  }, [courseId, step, locale]);

  // Complete step handler
  const handleComplete = useCallback(async () => {
    if (!user || !step) return;
    setCompleting(true);
    try {
      const body: Record<string, unknown> = {
        completed: true,
        timeSpent: step.duration || 5,
      };
      const res = await fetch(`/api/courses/${courseId}/lessons/${lessonId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success(t("course.step.completed", locale), {
          description: step.nextStepId ? t("course.step.completedDesc", locale) : t("course.step.courseCompletedDesc", locale),
        });
        setStep((prev) => prev ? { ...prev, completed: true } : prev);
        setCourseStructure((prev) => {
          if (!prev) return prev;
          const completedLessons = prev.completedLessons + 1;
          return {
            ...prev,
            completedLessons,
            progress: Math.round((completedLessons / prev.totalLessons) * 100),
          };
        });
        if (step.nextStepId) {
          navigationTimerRef.current = setTimeout(() => {
            router.push(`/course/${courseId}/lesson/${step.nextStepId}`);
          }, 1200);
        }
      }
    } catch {
      toast.error(t("course.step.errorProgress", locale));
    } finally {
      setCompleting(false);
    }
  }, [user, step, courseId, lessonId, locale, router]);

  // Load step data
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const fetchStep = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/courses/${courseId}/lessons/${lessonId}`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setStep(data.lesson);
          }
        } else {
          let errorMessage = t("course.step.errorAccess", localeRef.current);
          try {
            const data = await res.json();
            errorMessage = data.error || errorMessage;
          } catch {
            // Response may not be JSON, use default message
          }
          if (!cancelled) {
            toast.error(errorMessage);
            router.push(`/course/${courseId}`);
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          log.error(t("course.step.errorLoad", localeRef.current), { error: e instanceof Error ? e.message : String(e) });
          toast.error(t("course.step.errorLoad", localeRef.current));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    fetchStep();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [courseId, lessonId, router]);

  // Cleanup navigation timer on unmount
  useEffect(() => {
    return () => {
      if (navigationTimerRef.current) {
        clearTimeout(navigationTimerRef.current);
      }
    };
  }, []);

  // Load course structure for sidebar
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const fetchStructure = async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          const course = data.course;
          let totalLessons = 0;
          let completedLessons = 0;
          const modules: ModuleStructure[] = (course.modules || []).map((m: ModuleStructure) => {
            const lessons: LessonStructure[] = (m.lessons || []).map((l: LessonStructure & { completed?: boolean }) => {
              totalLessons++;
              if (l.completed) completedLessons++;
              return {
                id: l.id,
                title: l.title,
                type: l.type,
                duration: l.duration,
                isFree: l.isFree,
                sortOrder: l.sortOrder,
                completed: l.completed,
              };
            });
            return {
              id: m.id,
              title: m.title,
              sortOrder: m.sortOrder,
              lessons,
            };
          });
          if (!cancelled) {
            setCourseStructure({
              id: course.id,
              title: course.title,
              modules,
              totalLessons,
              completedLessons,
              progress: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
            });
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          log.error(t("course.step.errorLoad", localeRef.current), { error: e instanceof Error ? e.message : String(e) });
          toast.error(t("course.step.errorLoad", localeRef.current));
        }
      }
    };
    fetchStructure();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [courseId]);

  // Build flat step list for navigation
  const flatSteps = useMemo(() => {
    if (!courseStructure) return [];
    return courseStructure.modules.flatMap((m) =>
      m.lessons.map((l) => ({
        ...l,
        moduleId: m.id,
        moduleTitle: m.title,
      }))
    );
  }, [courseStructure]);

  const currentStepIndex = useMemo(
    () => flatSteps.findIndex((s) => s.id === lessonId),
    [flatSteps, lessonId]
  );

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <p className="text-muted-foreground">{t("common.loading", locale)}</p>
        </div>
      </div>
    );
  }

  if (!step) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">{t("course.step.notFound", locale)}</h2>
          <Button variant="outline" onClick={() => router.push(`/course/${courseId}`)}>
            {t("course.step.backToCourse", locale)}
          </Button>
        </div>
      </div>
    );
  }

  const isEnrolled = !!(step.isFree || user);

  const stepProps = {
    step,
    locale,
    submittingAssignment,
    onSubmitAssignment: submitAssignment,
    onStepComplete: handleComplete,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background flex">
      <StepSidebar
        courseStructure={courseStructure}
        courseId={courseId}
        lessonId={lessonId}
        isEnrolled={isEnrolled}
        locale={locale}
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
      />

      <main className="flex-1 min-w-0">
        {/* Top Navigation Bar */}
        <div className="bg-white dark:bg-card border-b sticky top-0 z-30">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label={t("nav.openMenu", locale)}
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:flex"
                onClick={() => router.push(`/course/${courseId}`)}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                {t("course.step.toCourse", locale)}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {currentStepIndex >= 0 && (
                <span className="text-xs text-muted-foreground">
                  {t("course.step.stepXofY", locale).replace("{{current}}", String(currentStepIndex + 1)).replace("{{total}}", String(flatSteps.length))}
                </span>
              )}
              <Badge className={stepTypeColors[step.type]}>
                {t(`course.step.type.${step.type}`, locale)}
              </Badge>
              {step.completed && (
                <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-0">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {t("course.step.completed", locale)}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {step.duration} {t("common.min", locale)}
              </span>
            </div>
          </div>

          <div className="h-1 bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-500"
              style={{ width: `${courseStructure?.progress || 0}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
            <span className="hover:text-foreground cursor-pointer" onClick={() => router.push(`/course/${courseId}`)}>
              {courseStructure?.title || t("course.step.module", locale)}
            </span>
            <ChevronRight className="w-3 h-3" />
            <span>{step.module?.title}</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">{step.title}</span>
          </div>

          {/* Step Title */}
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">{step.title}</h1>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">
                {t(`course.step.type.${step.type}`, locale)}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {step.duration} {t("common.min", locale)}
              </span>
            </div>
          </div>

          {/* Step Type Content */}
          {step.type === "video" && <LazyStepVideo {...stepProps} />}
          {step.type === "text" && <LazyStepText {...stepProps} />}
          {step.type === "coding" && <LazyStepCoding {...stepProps} />}
          {step.type === "quiz" && <LazyStepQuiz {...stepProps} />}
          {step.type === "assignment" && <LazyStepAssignment {...stepProps} />}
          {step.type === "matching" && <LazyStepMatching {...stepProps} />}
          {step.type === "ordering" && <LazyStepOrdering {...stepProps} />}
          {step.type === "essay" && <LazyStepEssay {...stepProps} />}
          {step.type === "file_upload" && <LazyStepFileUpload {...stepProps} />}
          {step.type === "drag_drop" && <LazyStepDragDrop {...stepProps} />}

          {/* Bottom Navigation */}
          <Separator className="my-8" />

          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              disabled={!step.prevStepId}
              onClick={() =>
                step.prevStepId &&
                router.push(`/course/${courseId}/lesson/${step.prevStepId}`)
              }
              className="flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{t("course.step.prev", locale)}</span>
              <span className="sm:hidden">{t("course.step.back", locale)}</span>
            </Button>

            <div className="flex items-center gap-2">
              {!step.completed && (
                <Button
                  className="bg-blue-700 hover:bg-blue-800 text-white"
                  onClick={handleComplete}
                  disabled={completing}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {completing ? t("course.step.saving", locale) : t("course.step.saveAndComplete", locale)}
                </Button>
              )}
              {step.completed && (
                <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-0 px-4 py-2">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {t("course.step.completed", locale)}
                </Badge>
              )}
            </div>

            <Button
              variant="outline"
              disabled={!step.nextStepId}
              onClick={() =>
                step.nextStepId &&
                router.push(`/course/${courseId}/lesson/${step.nextStepId}`)
              }
              className="flex-shrink-0"
            >
              <span className="hidden sm:inline">{t("course.step.next", locale)}</span>
              <span className="sm:hidden">{t("course.step.continue", locale)}</span>
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Step position indicator */}
          {currentStepIndex >= 0 && flatSteps.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-1">
                {flatSteps.map((s, idx) => (
                  <button
                    key={s.id}
                    className={`h-2 flex-1 rounded-full transition-all ${
                      idx === currentStepIndex
                        ? "bg-blue-600"
                        : s.completed
                        ? "bg-green-400"
                        : "bg-gray-200 dark:bg-gray-700"
                    }`}
                    onClick={() => router.push(`/course/${courseId}/lesson/${s.id}`)}
                    title={s.title}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                <span>{t("course.step.start", locale)}</span>
                <span>{t("course.step.end", locale)}</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
