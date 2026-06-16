"use client";
import { useRouter } from "next/navigation";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { log } from "@/lib/logger";
import type { Locale } from "@/lib/stores/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { lessonTypeIcon } from "@/lib/constants";
import { LessonSkeleton } from "@/components/skeletons/LessonSkeleton";
import { StepVideo } from "@/components/step-viewer/StepVideo";
import { StepText } from "@/components/step-viewer/StepText";
import { StepCoding } from "@/components/step-viewer/StepCoding";
import { StepQuiz } from "@/components/step-viewer/StepQuiz";
import type { StepData } from "@/components/step-viewer/StepTypes";

function lessonTypeLabel(type: string, locale: Locale): string {
  const map: Record<string, string> = {
    video: "lesson.typeVideo",
    text: "lesson.typeText",
    coding: "lesson.typeCoding",
    quiz: "lesson.typeQuiz",
    assignment: "lesson.typeAssignment",
  };
  return t(map[type] || type, locale);
}

interface AssignmentItem {
  id: string;
  title: string;
  description: string;
  type: string;
  points: number;
  correctAnswer?: string | null;
  options?: string | null;
}

interface LessonProgress {
  completed: boolean;
  score?: number | null;
  timeSpent: number;
}

interface LessonData {
  id: string;
  title: string;
  type: string;
  content: string | null;
  videoUrl: string | null;
  duration: number;
  isFree: boolean;
  sortOrder: number;
  completed: boolean;
  module: {
    id: string;
    title: string;
    courseId: string;
    sortOrder: number;
  };
  assignments: AssignmentItem[];
  progress: LessonProgress | null;
  prevStepId: string | null;
  nextStepId: string | null;
}

export function LessonPage({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}) {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const locale = useAppStore((s) => s.locale);
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [submittingAssignment, setSubmittingAssignment] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchLesson = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/courses/${courseId}/lessons/${lessonId}`
        );
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setLesson(data.lesson);
          }
        } else {
          let errorMessage = t("course.step.errorAccess", locale);
          try {
            const data = await res.json();
            errorMessage = data.error || errorMessage;
          } catch {
            // Response may not be JSON
          }
          if (!cancelled) {
            toast.error(errorMessage);
            router.push(`/course/${courseId}`);
          }
        }
      } catch (e: unknown) {
        log.error(t("course.step.errorLoad", locale), { courseId, lessonId, error: e instanceof Error ? e.message : String(e) });
        if (!cancelled) toast.error(t("course.step.errorLoad", locale));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchLesson();
    return () => { cancelled = true; };
  }, [courseId, lessonId, locale, router]);

  const handleStepComplete = useCallback(async () => {
    if (!user || !lesson) return;
    setCompleting(true);
    try {
      const res = await fetch(
        `/api/courses/${courseId}/lessons/${lessonId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            completed: true,
            timeSpent: lesson.duration || 5,
          }),
        }
      );
      if (res.ok) {
        toast.success(t("course.step.markedComplete", locale));
        setLesson((prev) =>
          prev ? { ...prev, completed: true } : prev
        );
      } else {
        const error = await res.json().catch(() => null);
        toast.error(error?.error || t("course.step.errorProgress", locale));
      }
    } catch {
      toast.error(t("course.step.errorProgress", locale));
    } finally {
      setCompleting(false);
    }
  }, [user, lesson, courseId, lessonId, locale]);

  const handleSubmitAssignment = useCallback(async (assignmentId: string, answer: unknown) => {
    if (!user) return null;
    setSubmittingAssignment(true);
    try {
      const res = await fetch(
        `/api/courses/${courseId}/lessons/${lessonId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId,
            answer,
            timeSpent: lesson?.duration || 5,
          }),
        }
      );
      if (res.ok) {
        toast.success(t("course.step.codeSent", locale));
        return await res.json();
      }
      toast.error(t("course.step.errorProgress", locale));
      return null;
    } catch {
      toast.error(t("course.step.errorProgress", locale));
      return null;
    } finally {
      setSubmittingAssignment(false);
    }
  }, [user, courseId, lessonId, lesson?.duration, locale]);

  if (loading) return <LessonSkeleton />;

  if (!lesson) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold mb-2">{t("course.step.lessonNotFound", locale)}</h2>
        <Button variant="outline" onClick={() => router.push(`/course/${courseId}`)}>
          {t("course.step.backToCourse", locale)}
        </Button>
      </div>
    );
  }

  const stepData: StepData = {
    id: lesson.id,
    title: lesson.title,
    type: lesson.type as StepData["type"],
    content: lesson.content,
    videoUrl: lesson.videoUrl,
    duration: lesson.duration,
    isFree: lesson.isFree,
    sortOrder: lesson.sortOrder,
    completed: lesson.completed,
    module: {
      id: lesson.module.id,
      title: lesson.module.title,
      courseId: lesson.module.courseId,
      sortOrder: 0,
    },
    assignments: lesson.assignments.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      type: a.type,
      options: a.options ?? null,
      correctAnswer: a.correctAnswer ?? null,
      points: a.points,
    })),
    progress: lesson.progress ? {
      id: "",
      completed: lesson.progress.completed,
      score: lesson.progress.score ?? null,
      timeSpent: lesson.progress.timeSpent,
    } : null,
    prevStepId: lesson.prevStepId,
    nextStepId: lesson.nextStepId,
  };

  const commonProps = {
    step: stepData,
    locale,
    submittingAssignment,
    onSubmitAssignment: handleSubmitAssignment,
    onStepComplete: handleStepComplete,
  };

  const renderStepContent = () => {
    switch (lesson.type) {
      case "video":
        return <StepVideo {...commonProps} />;
      case "text":
      case "assignment":
        return <StepText {...commonProps} />;
      case "coding":
        return <StepCoding {...commonProps} />;
      case "quiz":
        return <StepQuiz {...commonProps} />;
      default:
        return lesson.content ? (
          <div className="prose prose-sm max-w-none whitespace-pre-wrap">
            {lesson.content}
          </div>
        ) : null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {/* Навигация урока */}
      <nav className="bg-white dark:bg-card border-b sticky top-16 z-40" aria-label={t("course.step.sidebarNav", locale)}>
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("course.step.backToCourse", locale)}
            onClick={() => router.push(`/course/${courseId}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("course.step.toCourse", locale)}
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {lessonTypeLabel(lesson.type, locale)}
            </Badge>
            {lesson.completed && (
              <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-0">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {t("course.step.completed", locale)}
              </Badge>
            )}
          </div>
        </div>
      </nav>

      {/* Содержимое урока */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-1">
            {t("course.step.module", locale)} {lesson.module?.title}
          </p>
          <h1 className="text-2xl font-bold mb-2">{lesson.title}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {lesson.duration} {t("common.min", locale)}
            </span>
            <span className="flex items-center gap-1">
              {lessonTypeIcon(lesson.type)}
              {lessonTypeLabel(lesson.type, locale)}
            </span>
          </div>
        </div>

        {renderStepContent()}

        {/* Действия */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            disabled={!lesson.prevStepId}
            aria-label={t("course.step.prev", locale)}
            onClick={() =>
              lesson.prevStepId &&
              router.push(`/course/${courseId}/lesson/${lesson.prevStepId}`)
            }
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("course.step.prev", locale)}
          </Button>

          <div className="flex items-center gap-2">
            {!lesson.completed && (
              <Button
                className="bg-blue-700 hover:bg-blue-800 text-white"
                onClick={handleStepComplete}
                disabled={completing}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {completing ? t("course.step.saving", locale) : t("course.step.markComplete", locale)}
              </Button>
            )}
          </div>

          <Button
            variant="outline"
            disabled={!lesson.nextStepId}
            aria-label={t("course.step.next", locale)}
            onClick={() =>
              lesson.nextStepId &&
              router.push(`/course/${courseId}/lesson/${lesson.nextStepId}`)
            }
          >
            {t("course.step.next", locale)}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
