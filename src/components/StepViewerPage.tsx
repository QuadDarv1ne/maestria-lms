"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { t, useLocale } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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
  ChevronRight,
  Menu,
  Send,
  RotateCcw,
  Lightbulb,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";

import { StepSidebar } from "@/components/step-viewer/StepSidebar";

// ==================== TYPES ====================

interface StepData {
  id: string;
  title: string;
  type: "video" | "text" | "coding" | "quiz" | "assignment";
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
  assignments: AssignmentData[];
  progress: ProgressData | null;
  prevStepId: string | null;
  nextStepId: string | null;
}

interface AssignmentData {
  id: string;
  title: string;
  description: string;
  type: string;
  options: string | null;
  correctAnswer: string | null;
  points: number;
}

interface ProgressData {
  id: string;
  completed: boolean;
  score: number | null;
  timeSpent: number;
}

interface CourseStructure {
  id: string;
  title: string;
  modules: ModuleStructure[];
  totalLessons: number;
  completedLessons: number;
  progress: number;
}

interface ModuleStructure {
  id: string;
  title: string;
  sortOrder: number;
  lessons: LessonStructure[];
}

interface LessonStructure {
  id: string;
  title: string;
  type: string;
  duration: number;
  isFree: boolean;
  sortOrder: number;
  completed: boolean;
}

// ==================== MAIN COMPONENT ====================

const stepTypeColors: Record<string, string> = {
  video: "bg-blue-100 text-blue-700",
  text: "bg-violet-100 text-violet-700",
  coding: "bg-amber-100 text-amber-700",
  quiz: "bg-orange-100 text-orange-700",
  assignment: "bg-indigo-100 text-indigo-700",
};

// ==================== MAIN COMPONENT ====================

export function StepViewerPage({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}) {
  const { navigate, user } = useAppStore();
  const { locale } = useLocale();
  const [step, setStep] = useState<StepData | null>(null);
  const [courseStructure, setCourseStructure] = useState<CourseStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Quiz state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<Record<string, boolean>>({});
  const [quizResults, setQuizResults] = useState<Record<string, boolean>>({});

  // Coding state
  const [codeValue, setCodeValue] = useState("");
  const [codeOutput, setCodeOutput] = useState("");
  const [codeSubmitted, setCodeSubmitted] = useState(false);

  // Assignment state
  const [assignmentAnswer, setAssignmentAnswer] = useState("");
  const [assignmentSubmitted, setAssignmentSubmitted] = useState(false);

  // Load step data
  useEffect(() => {
    let cancelled = false;
    const fetchStep = async () => {
      setLoading(true);
      setQuizSubmitted({});
      setQuizResults({});
      setSelectedAnswers({});
      setCodeValue("");
      setCodeOutput("");
      setCodeSubmitted(false);
      setAssignmentAnswer("");
      setAssignmentSubmitted(false);
      try {
        const res = await fetch(`/api/courses/${courseId}/lessons/${lessonId}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setStep(data.lesson);
          }
        } else {
          const data = await res.json();
          if (!cancelled) {
            toast.error(data.error || t("course.step.errorAccess", locale));
            navigate(`course/${courseId}`);
          }
        }
      } catch (e) {
        if (!cancelled) {
          console.error(t("course.step.errorLoad", locale), e);
          toast.error(t("course.step.errorLoad", locale));
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
    };
  }, [courseId, lessonId, navigate, locale]);

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
    const fetchStructure = async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}`);
        if (res.ok) {
          const data = await res.json();
          const course = data.course;
          // Calculate progress
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
      } catch (e) {
        if (!cancelled) {
          console.error(t("course.step.errorLoad", locale), e);
          toast.error(t("course.step.errorLoad", locale));
        }
      }
    };
    fetchStructure();
    return () => {
      cancelled = true;
    };
  }, [courseId, locale, step?.completed]);

  // Complete step handler
  const handleComplete = useCallback(async () => {
    if (!user || !step) return;
    setCompleting(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/lessons/${lessonId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completed: true,
          timeSpent: step.duration || 5,
        }),
      });
      if (res.ok) {
        toast.success(t("course.step.completed", locale), {
          description: step.nextStepId ? t("course.step.completedDesc", locale) : t("course.step.courseCompletedDesc", locale),
        });
        setStep((prev) => prev ? { ...prev, completed: true } : prev);
        // Update structure
        setCourseStructure((prev) => {
          if (!prev) return prev;
          const completedLessons = prev.completedLessons + 1;
          return {
            ...prev,
            completedLessons,
            progress: Math.round((completedLessons / prev.totalLessons) * 100),
          };
        });
        // Auto-navigate to next step after short delay
        if (step.nextStepId) {
          navigationTimerRef.current = setTimeout(() => {
            navigate(`course/${courseId}/lesson/${step.nextStepId}`);
          }, 1200);
        }
      }
    } catch {
      toast.error(t("course.step.errorProgress", locale));
    } finally {
      setCompleting(false);
    }
  }, [user, step, courseId, lessonId, navigate, locale]);

  // Submit quiz answer
  const handleQuizSubmit = useCallback((assignmentId: string) => {
    if (!step) return;
    const assignment = step.assignments.find((a) => a.id === assignmentId);
    if (!assignment) return;

    const selected = selectedAnswers[assignmentId];
    if (!selected) {
      toast.error(t("course.step.selectAnswer", locale));
      return;
    }

    const isCorrect = assignment.correctAnswer === selected;
    setQuizSubmitted((prev) => ({ ...prev, [assignmentId]: true }));
    setQuizResults((prev) => ({ ...prev, [assignmentId]: isCorrect }));

    if (isCorrect) {
      toast.success(`${t("course.step.correct", locale)} 🎉`);
    } else {
      toast.error(`${t("course.step.incorrect", locale)}. ${t("course.step.tryAgain", locale)}.`);
    }
  }, [step, selectedAnswers, locale]);

  // Reset quiz
  const handleQuizReset = useCallback((assignmentId: string) => {
    setQuizSubmitted((prev) => ({ ...prev, [assignmentId]: false }));
    setQuizResults((prev) => ({ ...prev, [assignmentId]: false }));
    setSelectedAnswers((prev) => {
      const next = { ...prev };
      delete next[assignmentId];
      return next;
    });
  }, []);

  // Submit code
  const handleCodeSubmit = useCallback(() => {
    if (!codeValue.trim()) {
      toast.error(t("course.step.writeCodeFirst", locale));
      return;
    }
    setCodeSubmitted(true);
    setCodeOutput("// Выполнение кода...\n> Hello, World!\n> Программа завершена успешно");
    toast.success(t("course.step.codeSent", locale));
  }, [codeValue, locale]);

  // Submit assignment
  const handleAssignmentSubmit = useCallback(() => {
    if (!assignmentAnswer.trim()) {
      toast.error(t("course.step.writeAnswerFirst", locale));
      return;
    }
    setAssignmentSubmitted(true);
    toast.success(t("course.step.answerSent", locale));
  }, [assignmentAnswer, locale]);

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">{t("course.step.notFound", locale)}</h2>
          <Button variant="outline" onClick={() => navigate(`course/${courseId}`)}>
            {t("course.step.backToCourse", locale)}
          </Button>
        </div>
      </div>
    );
  }

  const isEnrolled = !!(step.isFree || user);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <StepSidebar
        courseStructure={courseStructure}
        courseId={courseId}
        lessonId={lessonId}
        isEnrolled={isEnrolled}
        locale={locale}
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        onNavigate={navigate}
      />

      {/* ==================== MAIN CONTENT ==================== */}
      <main className="flex-1 min-w-0">
        {/* Top Navigation Bar */}
        <div className="bg-white border-b sticky top-0 z-30">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:flex"
                onClick={() => navigate(`course/${courseId}`)}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                {t("course.step.toCourse", locale)}
              </Button>
            </div>

            {/* Step progress indicator */}
            <div className="flex items-center gap-2">
              {currentStepIndex >= 0 && (
                <span className="text-xs text-muted-foreground">
                  {t("course.step.stepXofY", locale).replace("{{current}}", String(currentStepIndex + 1)).replace("{{total}}", String(flatSteps.length))}
                </span>
              )}
              <Badge className={stepTypeColors[step.type] || "bg-gray-100 text-gray-700"}>
                {t(`course.step.type.${step.type}`, locale)}
              </Badge>
              {step.completed && (
                <Badge className="bg-green-100 text-green-700 border-0">
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

          {/* Thin progress bar */}
          <div className="h-1 bg-gray-100">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-500"
              style={{
                width: `${courseStructure?.progress || 0}%`,
              }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
            <span className="hover:text-foreground cursor-pointer" onClick={() => navigate(`course/${courseId}`)}>
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

          {/* ==================== STEP TYPE: VIDEO ==================== */}
          {step.type === "video" && (
            <Card className="border-0 shadow-sm mb-6 overflow-hidden">
              <CardContent className="p-0">
                <div className="bg-gray-900 aspect-video flex items-center justify-center relative group">
                  {step.videoUrl ? (
                    <iframe
                      src={step.videoUrl}
                      className="w-full h-full"
                      allowFullScreen
                      title={step.title}
                    />
                  ) : (
                    <div className="text-center text-white">
                      <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-white/20 transition-colors cursor-pointer">
                        <Play className="w-10 h-10 ml-1" />
                      </div>
                      <p className="text-lg font-medium mb-1">{t("course.step.videoLesson", locale)}</p>
                      <p className="text-sm opacity-50">{t("course.step.clickToPlay", locale)}</p>
                    </div>
                  )}
                  {/* Video progress overlay */}
                  {step.completed && (
                    <div className="absolute top-3 right-3 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {t("course.step.watched", locale)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ==================== STEP TYPE: TEXT ==================== */}
          {step.type === "text" && (
            <Card className="border-0 shadow-sm mb-6">
              <CardContent className="p-6 md:p-8">
                <div className="flex items-center gap-2 mb-4 text-sm text-violet-600">
                  <FileText className="w-4 h-4" />
                  <span className="font-medium">{t("course.step.theory", locale)}</span>
                </div>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed">
                  {step.content || t("course.step.loadingContent", locale)}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ==================== STEP TYPE: CODING ==================== */}
          {step.type === "coding" && (
            <div className="space-y-4 mb-6">
              {/* Theory part */}
              {step.content && (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-3 text-sm text-amber-600">
                      <Lightbulb className="w-4 h-4" />
                      <span className="font-medium">{t("course.step.theory", locale)}</span>
                    </div>
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                      {step.content}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Code editor */}
              <Card className="border-0 shadow-sm overflow-hidden">
                <div className="bg-gray-900 px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-gray-300 font-medium">{t("course.step.codeEditor", locale)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                </div>
                <CardContent className="p-0">
                  <Textarea
                    className="font-mono text-sm bg-gray-900 text-green-400 border-0 rounded-none min-h-[200px] resize-y focus-visible:ring-0 focus-visible:ring-offset-0"
                    placeholder={t("course.step.codePlaceholder", locale)}
                    value={codeValue}
                    onChange={(e) => setCodeValue(e.target.value)}
                    disabled={codeSubmitted}
                  />
                </CardContent>
              </Card>

              {/* Code output */}
              {codeSubmitted && (
                <Card className="border-0 shadow-sm overflow-hidden">
                  <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
                    <span className="text-sm text-gray-300 font-medium">{t("course.step.executionResult", locale)}</span>
                    <Badge className="bg-green-500/20 text-green-400 border-0 text-xs">
                      {t("course.step.success", locale)}
                    </Badge>
                  </div>
                  <CardContent className="p-0">
                    <pre className="p-4 text-sm text-green-400 font-mono bg-gray-900 whitespace-pre-wrap">
                      {codeOutput}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Code actions */}
              <div className="flex items-center gap-2">
                <Button
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleCodeSubmit}
                  disabled={codeSubmitted}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {codeSubmitted ? t("course.step.sent", locale) : t("course.step.submitCode", locale)}
                </Button>
                {codeSubmitted && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCodeSubmitted(false);
                      setCodeOutput("");
                    }}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {t("course.step.tryAgain", locale)}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ==================== STEP TYPE: QUIZ ==================== */}
          {step.type === "quiz" && (
            <div className="space-y-4 mb-6">
              {/* Theory part */}
              {step.content && (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-6">
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap mb-4">
                      {step.content}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Quiz questions */}
              {step.assignments?.map((assignment, aIdx) => {
                let options: string[] = [];
                if (assignment.options) {
                  try {
                    options = JSON.parse(assignment.options);
                  } catch {
                    options = [];
                  }
                }
                const isSubmitted = quizSubmitted[assignment.id];
                const isCorrect = quizResults[assignment.id];

                return (
                  <Card
                    key={assignment.id}
                    className={`border-0 shadow-sm overflow-hidden transition-all ${
                      isSubmitted
                        ? isCorrect
                          ? "ring-2 ring-green-400"
                          : "ring-2 ring-red-400"
                        : ""
                    }`}
                  >
                    <div
                      className={`px-4 py-3 flex items-center justify-between ${
                        isSubmitted
                          ? isCorrect
                            ? "bg-green-50"
                            : "bg-red-50"
                          : "bg-orange-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <HelpCircle className={`w-4 h-4 ${isSubmitted ? (isCorrect ? "text-green-600" : "text-red-600") : "text-orange-600"}`} />
                        <span className="font-medium text-sm">
                          {t("course.step.question", locale)} {aIdx + 1}
                        </span>
                      </div>
                      {isSubmitted && (
                        <Badge className={`${isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"} border-0 text-xs`}>
                          {isCorrect ? t("course.step.correct", locale) : t("course.step.incorrect", locale)}
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-6">
                      <h4 className="font-semibold mb-2">{assignment.title}</h4>
                      {assignment.description && (
                        <p className="text-sm text-muted-foreground mb-4">
                          {assignment.description}
                        </p>
                      )}

                      {/* Answer options */}
                      <div className="space-y-2">
                        {options.map((opt, optIdx) => {
                          const isSelected = selectedAnswers[assignment.id] === opt;
                          const isCorrectOption = assignment.correctAnswer === opt;

                          let optionClass = "border-gray-200 hover:bg-gray-50 cursor-pointer";
                          if (isSubmitted) {
                            if (isCorrectOption) {
                              optionClass = "border-green-400 bg-green-50";
                            } else if (isSelected && !isCorrect) {
                              optionClass = "border-red-400 bg-red-50";
                            } else {
                              optionClass = "border-gray-200 opacity-60";
                            }
                          } else if (isSelected) {
                            optionClass = "border-blue-500 bg-blue-50";
                          }

                          return (
                            <label
                              key={optIdx}
                              className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${optionClass} ${
                                isSubmitted ? "cursor-default" : "cursor-pointer"
                              }`}
                            >
                              <div
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                  isSelected
                                    ? isSubmitted
                                      ? isCorrectOption
                                        ? "border-green-500 bg-green-500"
                                        : "border-red-500 bg-red-500"
                                      : "border-blue-500 bg-blue-500"
                                    : "border-gray-300"
                                }`}
                              >
                                {isSelected && (
                                  <div className="w-2 h-2 bg-white rounded-full" />
                                )}
                              </div>
                              <span className="text-sm">{opt}</span>
                              {isSubmitted && isCorrectOption && (
                                <CheckCircle2 className="w-4 h-4 text-green-600 ml-auto" />
                              )}
                            </label>
                          );
                        })}
                      </div>

                      {/* Quiz actions */}
                      <div className="flex items-center gap-2 mt-4">
                        {!isSubmitted ? (
                          <Button
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                            onClick={() => handleQuizSubmit(assignment.id)}
                            disabled={!selectedAnswers[assignment.id]}
                          >
                            <Send className="w-4 h-4 mr-2" />
                            {t("course.step.answer", locale)}
                          </Button>
                        ) : (
                          <>
                            {!isCorrect && (
                              <Button
                                variant="outline"
                                onClick={() => handleQuizReset(assignment.id)}
                              >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                {t("course.step.tryAgain", locale)}
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* If no assignments */}
              {(!step.assignments || step.assignments.length === 0) && (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-8 text-center">
                    <HelpCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">{t("course.step.noQuestions", locale)}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ==================== STEP TYPE: ASSIGNMENT ==================== */}
          {step.type === "assignment" && (
            <div className="space-y-4 mb-6">
              {/* Assignment description */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3 text-sm text-indigo-600">
                    <PenTool className="w-4 h-4" />
                    <span className="font-medium">{t("course.step.practicalAssignment", locale)}</span>
                  </div>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                    {step.content || t("course.step.loadingContent", locale)}
                  </div>
                </CardContent>
              </Card>

              {/* Answer input */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <h4 className="font-semibold mb-3">{t("course.step.yourAnswer", locale)}</h4>
                  <Textarea
                    placeholder={t("course.step.answerPlaceholder", locale)}
                    className="min-h-[120px] resize-y"
                    value={assignmentAnswer}
                    onChange={(e) => setAssignmentAnswer(e.target.value)}
                    disabled={assignmentSubmitted}
                  />
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={handleAssignmentSubmit}
                      disabled={assignmentSubmitted}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {assignmentSubmitted ? t("course.step.sent", locale) : t("course.step.submitAnswer", locale)}
                    </Button>
                    {assignmentSubmitted && (
                      <Badge className="bg-blue-100 text-blue-700 border-0">
                        {t("course.step.awaitingReview", locale)}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ==================== BOTTOM NAVIGATION ==================== */}
          <Separator className="my-8" />

          <div className="flex items-center justify-between gap-4">
            {/* Previous Step */}
            <Button
              variant="outline"
              disabled={!step.prevStepId}
              onClick={() =>
                step.prevStepId &&
                navigate(`course/${courseId}/lesson/${step.prevStepId}`)
              }
              className="flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">{t("course.step.prev", locale)}</span>
              <span className="sm:hidden">{t("course.step.back", locale)}</span>
            </Button>

            {/* Complete / Continue */}
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
                <Badge className="bg-green-100 text-green-700 border-0 px-4 py-2">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {t("course.step.completed", locale)}
                </Badge>
              )}
            </div>

            {/* Next Step */}
            <Button
              variant="outline"
              disabled={!step.nextStepId}
              onClick={() =>
                step.nextStepId &&
                navigate(`course/${courseId}/lesson/${step.nextStepId}`)
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
                        : "bg-gray-200"
                    }`}
                    onClick={() => navigate(`course/${courseId}/lesson/${s.id}`)}
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
