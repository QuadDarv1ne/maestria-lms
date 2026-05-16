"use client";

import React, { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Play,
  Clock,
  FileText,
  Code2,
  HelpCircle,
  PenTool,
} from "lucide-react";
import { toast } from "sonner";

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
  assignments: any[];
  progress: any;
  prevLessonId: string | null;
  nextLessonId: string | null;
}

const lessonTypeIcons: Record<string, React.ReactNode> = {
  video: <Play className="w-4 h-4" />,
  text: <FileText className="w-4 h-4" />,
  coding: <Code2 className="w-4 h-4" />,
  quiz: <HelpCircle className="w-4 h-4" />,
  assignment: <PenTool className="w-4 h-4" />,
};

const lessonTypeLabels: Record<string, string> = {
  video: "Видеоурок",
  text: "Текстовый урок",
  coding: "Практика",
  quiz: "Тест",
  assignment: "Задание",
};

export function LessonPage({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}) {
  const { navigate, user } = useAppStore();
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    const fetchLesson = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/courses/${courseId}/lessons/${lessonId}`
        );
        if (res.ok) {
          const data = await res.json();
          setLesson(data.lesson);
        } else {
          const data = await res.json();
          toast.error(data.error || "Ошибка доступа к уроку");
          navigate(`course/${courseId}`);
        }
      } catch (e) {
        console.error("Ошибка загрузки урока:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchLesson();
  }, [courseId, lessonId, navigate]);

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
        toast.success("Урок отмечен как пройденный");
        setLesson((prev) =>
          prev ? { ...prev, completed: true } : prev
        );
      }
    } catch (e) {
      toast.error("Ошибка обновления прогресса");
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/2" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold mb-2">Урок не найден</h2>
        <Button variant="outline" onClick={() => navigate(`course/${courseId}`)}>
          Вернуться к курсу
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
            К курсу
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {lessonTypeLabels[lesson.type] || lesson.type}
            </Badge>
            {lesson.completed && (
              <Badge className="bg-green-100 text-green-700 border-0">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Пройден
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Содержимое урока */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-1">
            Модуль: {lesson.module?.title}
          </p>
          <h1 className="text-2xl font-bold mb-2">{lesson.title}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {lesson.duration} мин
            </span>
            <span className="flex items-center gap-1">
              {lessonTypeIcons[lesson.type]}
              {lessonTypeLabels[lesson.type]}
            </span>
          </div>
        </div>

        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="p-6">
            {/* Видеоурок */}
            {lesson.type === "video" && (
              <div>
                <div className="bg-gray-900 rounded-lg aspect-video flex items-center justify-center mb-4">
                  <div className="text-center text-white">
                    <Play className="w-16 h-16 mx-auto mb-2 opacity-50" />
                    <p className="text-sm opacity-50">Видеоурок</p>
                    {lesson.videoUrl && (
                      <p className="text-xs opacity-30 mt-1">{lesson.videoUrl}</p>
                    )}
                  </div>
                </div>
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
                {lesson.content || "Содержимое урока загружается..."}
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
                  <p className="text-gray-500 mb-2"># Напишите ваш код здесь</p>
                  <p className="text-gray-500"># Например:</p>
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
                {lesson.assignments?.map((assignment: any) => (
                  <Card key={assignment.id} className="mb-3 border shadow-sm">
                    <CardContent className="p-4">
                      <h4 className="font-semibold mb-2">
                        {assignment.title}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        {assignment.description}
                      </p>
                      {assignment.options && (
                        <div className="space-y-2">
                          {JSON.parse(assignment.options).map(
                            (opt: string, i: number) => (
                              <label
                                key={i}
                                className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-gray-50"
                              >
                                <input
                                  type="radio"
                                  name={`quiz-${assignment.id}`}
                                  className="accent-blue-700"
                                />
                                <span className="text-sm">{opt}</span>
                              </label>
                            )
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Действия */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            disabled={!lesson.prevLessonId}
            onClick={() =>
              lesson.prevLessonId &&
              navigate(`course/${courseId}/lesson/${lesson.prevLessonId}`)
            }
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Предыдущий
          </Button>

          <div className="flex items-center gap-2">
            {!lesson.completed && (
              <Button
                className="bg-blue-700 hover:bg-blue-800 text-white"
                onClick={handleComplete}
                disabled={completing}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {completing ? "Сохранение..." : "Отметить как пройденный"}
              </Button>
            )}
          </div>

          <Button
            variant="outline"
            disabled={!lesson.nextLessonId}
            onClick={() =>
              lesson.nextLessonId &&
              navigate(`course/${courseId}/lesson/${lesson.nextLessonId}`)
            }
          >
            Следующий
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
