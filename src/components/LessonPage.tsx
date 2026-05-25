"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { log } from "@/lib/logger";
import type { Locale } from "@/lib/stores/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { lessonTypeIcon } from "@/lib/constants";
import { LessonSkeleton } from "@/components/skeletons/LessonSkeleton";

function LessonVideo({ src }: { src: string }) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const locale = useAppStore((s) => s.locale);

  if (error) {
    return (
      <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center mb-4">
        <div className="text-center text-white">
          <Play className="w-16 h-16 mx-auto mb-2 opacity-50" />
          <p className="text-sm opacity-50">{t("lesson.videoError", locale)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative bg-black rounded-lg overflow-hidden mb-4">
      {!loaded && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse flex items-center justify-center">
          <Play className="w-12 h-12 text-white/30" />
        </div>
      )}
      <video
        src={src}
        controls
        preload="metadata"
        className="w-full aspect-video"
        onLoadedData={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
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
  };
  assignments: AssignmentItem[];
  progress: LessonProgress | null;
  prevStepId: string | null;
  nextStepId: string | null;
}

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

export function LessonPage({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}) {
  const navigate = useAppStore((s) => s.navigate);
  const user = useAppStore((s) => s.user);
  const locale = useAppStore((s) => s.locale);
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  useEffect(() => {
    setQuizAnswers({});
    setQuizSubmitted(false);
  }, [lessonId]);

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
          let errorMessage = t("lesson.accessError", locale);
          try {
            const data = await res.json();
            errorMessage = data.error || errorMessage;
          } catch {
            // Response may not be JSON, use default message
          }
          if (!cancelled) {
            toast.error(errorMessage);
            navigate(`course/${courseId}`);
          }
        }
      } catch (e: unknown) {
        log.error(t("profile.errorLoadingLesson", locale), { courseId, lessonId, error: e instanceof Error ? e.message : String(e) });
        if (!cancelled) toast.error(t("profile.errorLoadingLesson", locale));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    fetchLesson();
    return () => { cancelled = true; };
  }, [courseId, lessonId, navigate, locale]);

  const handleQuizSubmit = () => {
    const scores: Record<string, boolean> = {};
    lesson?.assignments.forEach((assignment) => {
      const parsed = assignment.correctAnswer
        ? parseInt(assignment.correctAnswer, 10)
        : -1;
      const correctIndex = Number.isNaN(parsed) ? -1 : parsed;
      scores[assignment.id] =
        correctIndex >= 0 && quizAnswers[assignment.id] === correctIndex;
    });
    setQuizSubmitted(true);

    const correctCount = Object.values(scores).filter(Boolean).length;
    const total = Object.keys(scores).length;
    if (total > 0) {
      toast.success(`${t("lesson.quizCorrectAnswers", locale)} ${correctCount}/${total}`);
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    setCompleting(true);
    try {
      const res = await fetch(
        `/api/courses/${courseId}/lessons/${lessonId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            completed: true,
            timeSpent: lesson?.duration || 5,
          }),
        }
      );
      if (res.ok) {
        toast.success(t("lesson.markedCompleted", locale));
        setLesson((prev) =>
          prev ? { ...prev, completed: true } : prev
        );
      }
    } catch {
      toast.error(t("lesson.progressUpdateError", locale));
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return <LessonSkeleton />;
  }

  if (!lesson) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold mb-2">{t("lesson.notFound", locale)}</h2>
        <Button variant="outline" onClick={() => navigate(`course/${courseId}`)}>
          {t("lesson.backToCourse", locale)}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Навигация урока */}
      <div className="bg-white border-b sticky top-16 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`course/${courseId}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("lesson.toCourse", locale)}
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {lessonTypeLabel(lesson.type, locale)}
            </Badge>
            {lesson.completed && (
              <Badge className="bg-green-100 text-green-700 border-0">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {t("lesson.completed", locale)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Содержимое урока */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-1">
            {t("lesson.module", locale)} {lesson.module?.title}
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

        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="p-6">
            {/* Видеоурок */}
            {lesson.type === "video" && (
              <div>
                {lesson.videoUrl ? (
                  <LessonVideo src={lesson.videoUrl} />
                ) : (
                  <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center mb-4">
                    <div className="text-center text-white">
                      <Play className="w-16 h-16 mx-auto mb-2 opacity-50" />
                      <p className="text-sm opacity-50">{t("lesson.videoNotLoaded", locale)}</p>
                    </div>
                  </div>
                )}
                {lesson.content && (
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                    {lesson.content}
                  </div>
                )}
              </div>
            )}

            {/* Текстовый урок */}
            {(lesson.type === "text" || lesson.type === "assignment") && (
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                {lesson.content || t("lesson.contentLoading", locale)}
              </div>
            )}

            {/* Практика / Кодинг */}
            {lesson.type === "coding" && (
              <div>
                {lesson.content && (
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap mb-4">
                    {lesson.content}
                  </div>
                )}
                <div className="bg-gray-900 rounded-lg p-4 text-sm text-green-400 font-mono">
                  <p className="text-gray-500 mb-2">{t("lesson.writeCodeHere", locale)}</p>
                  <p className="text-gray-500">{t("lesson.forExample", locale)}</p>
                  <p>print(&quot;Hello, World!&quot;)</p>
                </div>
              </div>
            )}

            {/* Тест */}
            {lesson.type === "quiz" && (
              <div>
                {lesson.content && (
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap mb-4">
                    {lesson.content}
                  </div>
                )}
                {lesson.assignments?.map((assignment: AssignmentItem) => {
                  let options: string[] = [];
                  try {
                    if (assignment.options) {
                      options = JSON.parse(assignment.options);
                    }
                  } catch {
                    // invalid JSON
                  }

                  const parsed = assignment.correctAnswer
                    ? parseInt(assignment.correctAnswer, 10)
                    : -1;
                  const correctIndex = Number.isNaN(parsed) ? -1 : parsed;

                  return (
                    <Card key={assignment.id} className="mb-3 border shadow-sm">
                      <CardContent className="p-4">
                        <h4 className="font-semibold mb-2">
                          {assignment.title}
                        </h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          {assignment.description}
                        </p>
                        {options.length > 0 && (
                          <div className="space-y-2">
                            {options.map((opt: string, i: number) => {
                              const isSelected = quizAnswers[assignment.id] === i;
                              const isCorrect = i === correctIndex;
                              let optionStyle = "border cursor-pointer hover:bg-gray-50";
                              if (quizSubmitted) {
                                if (isCorrect) {
                                  optionStyle = "border-green-500 bg-green-50 dark:bg-green-900/20 cursor-default";
                                } else if (isSelected && !isCorrect) {
                                  optionStyle = "border-red-500 bg-red-50 dark:bg-red-900/20 cursor-default";
                                } else {
                                  optionStyle = "border opacity-50 cursor-default";
                                }
                              }
                              return (
                                <label
                                  key={i}
                                  className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${optionStyle}`}
                                >
                                  <input
                                    type="radio"
                                    name={`quiz-${assignment.id}`}
                                    className="accent-blue-700"
                                    checked={isSelected}
                                    onChange={() => {
                                      if (!quizSubmitted) {
                                        setQuizAnswers((prev) => ({
                                          ...prev,
                                          [assignment.id]: i,
                                        }));
                                      }
                                    }}
                                    disabled={quizSubmitted}
                                  />
                                  <span className="text-sm flex-1">{opt}</span>
                                  {quizSubmitted && isCorrect && (
                                    <span className="text-green-600 text-xs font-medium">✓</span>
                                  )}
                                  {quizSubmitted && isSelected && !isCorrect && (
                                    <span className="text-red-600 text-xs font-medium">✗</span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                {lesson.assignments?.length > 0 && (
                  <div className="flex gap-2 mt-4">
                    {!quizSubmitted && (
                      <Button
                        className="bg-blue-700 hover:bg-blue-800 text-white"
                        onClick={handleQuizSubmit}
                        disabled={Object.keys(quizAnswers).length === 0}
                      >
                        {t("lesson.checkAnswers", locale)}
                      </Button>
                    )}
                    {quizSubmitted && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setQuizSubmitted(false);
                          setQuizAnswers({});
                        }}
                      >
                        {t("lesson.tryAgain", locale)}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Действия */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            disabled={!lesson.prevStepId}
            onClick={() =>
              lesson.prevStepId &&
              navigate(`course/${courseId}/lesson/${lesson.prevStepId}`)
            }
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("lesson.previousStep", locale)}
          </Button>

          <div className="flex items-center gap-2">
            {!lesson.completed && (
              <Button
                className="bg-blue-700 hover:bg-blue-800 text-white"
                onClick={handleComplete}
                disabled={completing}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {completing ? t("common.saving", locale) : t("lesson.markComplete", locale)}
              </Button>
            )}
          </div>

          <Button
            variant="outline"
            disabled={!lesson.nextStepId}
            onClick={() =>
              lesson.nextStepId &&
              navigate(`course/${courseId}/lesson/${lesson.nextStepId}`)
            }
          >
            {t("lesson.nextStep", locale)}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
