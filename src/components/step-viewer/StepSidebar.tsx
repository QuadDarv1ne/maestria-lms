"use client";

import { t } from "@/lib/i18n";
import { lessonTypeIcon } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, X, CheckCircle2, Lock, Trophy } from "lucide-react";
import { toast } from "sonner";
import type { Locale } from "@/lib/store";

interface LessonStructure {
  id: string;
  title: string;
  type: string;
  duration: number;
  isFree: boolean;
  sortOrder: number;
  completed: boolean;
}

interface ModuleStructure {
  id: string;
  title: string;
  sortOrder: number;
  lessons: LessonStructure[];
}

interface CourseStructure {
  id: string;
  title: string;
  modules: ModuleStructure[];
  totalLessons: number;
  completedLessons: number;
  progress: number;
}

interface StepSidebarProps {
  courseStructure: CourseStructure | null;
  courseId: string;
  lessonId: string;
  isEnrolled: boolean;
  locale: Locale;
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  onNavigate: (path: string) => void;
}

export function StepSidebar({
  courseStructure, courseId, lessonId, isEnrolled, locale,
  sidebarOpen, onCloseSidebar, onNavigate,
}: StepSidebarProps) {
  return (
    <>
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 lg:z-auto h-screen w-80 bg-white border-r shadow-lg lg:shadow-none transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden"
        }`}
      >
        <ScrollArea className="h-full">
          <div className="p-4 border-b bg-gradient-to-r from-blue-700 to-violet-700 text-white">
            <div className="flex items-center justify-between mb-3">
              <Button
                variant="ghost" size="sm"
                className="text-white hover:bg-white/10 -ml-2"
                onClick={() => onNavigate(`course/${courseId}`)}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                {t("course.step.backToCourse", locale)}
              </Button>
              <Button
                variant="ghost" size="icon"
                className="text-white hover:bg-white/10 lg:hidden"
                onClick={onCloseSidebar}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <h2 className="font-bold text-sm leading-tight mb-2 line-clamp-2">
              {courseStructure?.title || t("course.step.module", locale)}
            </h2>
            <div className="flex items-center gap-2 text-xs text-blue-100 mb-2">
              <span>{courseStructure?.completedLessons || 0} из {courseStructure?.totalLessons || 0} шагов</span>
              <span>•</span>
              <span>{courseStructure?.progress || 0}%</span>
            </div>
            <Progress value={courseStructure?.progress || 0} className="h-2 bg-white/20" />
          </div>

          <div className="p-2">
            {courseStructure?.modules.map((module, mIdx) => {
              const moduleCompleted = module.lessons.every((l) => l.completed);
              const moduleStarted = module.lessons.some((l) => l.completed);

              return (
                <div key={module.id} className="mb-2">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        moduleCompleted
                          ? "bg-green-100 text-green-700"
                          : moduleStarted
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {moduleCompleted ? <CheckCircle2 className="w-4 h-4" /> : mIdx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{module.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {module.lessons.length} {t("course.step.moduleLessons", locale)}
                        {moduleCompleted && ` • ${t("course.step.moduleCompleted", locale)}`}
                      </p>
                    </div>
                  </div>

                  {module.lessons.map((lesson) => {
                    const isActive = lesson.id === lessonId;
                    const isLocked = !lesson.isFree && !isEnrolled && !lesson.completed;

                    return (
                      <button
                        key={lesson.id}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-all ${
                          isActive
                            ? "bg-blue-50 border border-blue-200 text-blue-800 font-medium"
                            : lesson.completed
                            ? "hover:bg-green-50 text-green-700"
                            : isLocked
                            ? "opacity-50 cursor-not-allowed"
                            : "hover:bg-gray-50 text-gray-600"
                        }`}
                        onClick={() => {
                          if (isLocked) {
                            toast.error(t("course.step.enrollFirst", locale));
                            return;
                          }
                          onNavigate(`course/${courseId}/lesson/${lesson.id}`);
                          if (window.innerWidth < 1024) onCloseSidebar();
                        }}
                        disabled={isLocked && !isActive}
                      >
                        <div className="flex-shrink-0">
                          {lesson.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          ) : isLocked ? (
                            <Lock className="w-4 h-4 text-gray-400" />
                          ) : isActive ? (
                            <div className="w-4 h-4 rounded-full border-2 border-blue-500 flex items-center justify-center">
                              <div className="w-2 h-2 bg-blue-500 rounded-full" />
                            </div>
                          ) : (
                            lessonTypeIcon(lesson.type)
                          )}
                        </div>
                        <span className="flex-1 truncate">{lesson.title}</span>
                        {lesson.isFree && !lesson.completed && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 text-green-600 border-green-300 flex-shrink-0">
                            {t("common.free", locale)}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {courseStructure?.progress === 100 && (
            <div className="p-4 m-2 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200">
              <div className="text-center">
                <Trophy className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                <p className="font-bold text-amber-800 text-sm">{t("course.step.courseCompleted", locale)}</p>
                <p className="text-xs text-amber-600 mt-1">{t("course.step.courseCompletedDesc", locale)}</p>
              </div>
            </div>
          )}
        </ScrollArea>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onCloseSidebar}
        />
      )}
    </>
  );
}
