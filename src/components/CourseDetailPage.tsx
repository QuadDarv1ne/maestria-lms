"use client";

import React, { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Star,
  Clock,
  BookOpen,
  Users,
  Award,
  Play,
  Lock,
  CheckCircle2,
  ArrowLeft,
  CreditCard,
  Smartphone,
  Building,
  Heart,
  Share2,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";

interface LessonItem {
  id: string;
  title: string;
  type: string;
  duration: number;
  isFree: boolean;
  completed?: boolean;
  content?: string | null;
  videoUrl?: string | null;
}

interface ModuleItem {
  id: string;
  title: string;
  description?: string | null;
  sortOrder: number;
  lessons?: LessonItem[];
}

interface ReviewItem {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  user?: { name: string | null; image: string | null };
}
import { ReviewForm } from "@/components/ReviewForm";

interface CourseDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDesc: string | null;
  image: string | null;
  price: number;
  oldPrice: number | null;
  currency: string;
  level: string;
  duration: string | null;
  isFeatured: boolean;
  hasCertificate: boolean;
  rating: number;
  reviewCount: number;
  studentCount: number;
  tags: string | null;
  requirements: string | null;
  whatYouLearn: string | null;
  teacher: {
    id: string;
    name: string | null;
    image: string | null;
    bio: string | null;
  };
  category: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    color: string | null;
  };
  modules: ModuleItem[];
  reviews: ReviewItem[];
  totalLessons: number;
  totalDuration: number;
  freeLessons: number;
  isEnrolled: boolean;
  enrollmentStatus: string | null;
  enrollmentProgress: number;
}

export function CourseDetailPage({ courseId }: { courseId: string }) {
  const { navigate, user, toggleFavorite, isFavorite, addNotification } = useAppStore();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("sbp");
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewPagination, setReviewPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  const favored = isFavorite(courseId);

  const levelLabels: Record<string, string> = {
    beginner: "Начинающий",
    intermediate: "Средний",
    advanced: "Продвинутый",
  };

  const levelColors: Record<string, string> = {
    beginner: "bg-blue-100 text-blue-700",
    intermediate: "bg-amber-100 text-amber-700",
    advanced: "bg-red-100 text-red-700",
  };

  // Load course and reviews on mount / courseId change
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      try {
        const [courseRes, reviewsRes] = await Promise.all([
          fetch(`/api/courses/${courseId}`),
          fetch(`/api/courses/${courseId}/reviews?page=1&limit=10`),
        ]);
        if (!cancelled) {
          if (courseRes.ok) {
            const data = await courseRes.json();
            setCourse(data.course);
          }
          if (reviewsRes.ok) {
            const data = await reviewsRes.json();
            setReviews(data.reviews || []);
            setReviewPagination(data.pagination || { page: 1, total: 0, totalPages: 0 });
          }
        }
      } catch (e) {
        if (!cancelled) {
          console.error("Ошибка загрузки:", e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [courseId]);

  const refetchCourse = async () => {
    const courseRes = await fetch(`/api/courses/${courseId}`);
    if (courseRes.ok) {
      const courseData = await courseRes.json();
      setCourse(courseData.course);
    }
  };

  const showEnrollmentNotification = () => {
    addNotification({
      type: "enrollment",
      title: "Запись на курс",
      message: `Вы записались на курс "${course?.title}"`,
      read: false,
      link: `course/${courseId}`,
    });
  };

  const handleEnroll = async () => {
    if (!user) {
      window.location.hash = "login";
      return;
    }
    setEnrolling(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/enroll`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        if (data.requiresPayment) {
          const payRes = await fetch("/api/payments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ courseId, paymentMethod }),
          });
          const payData = await payRes.json();

          if (payRes.ok && payData.payment) {
            const confirmRes = await fetch(`/api/payments/${payData.payment.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "completed" }),
            });

            if (confirmRes.ok) {
              toast.success("Оплата прошла успешно! Вы записаны на курс.");
              showEnrollmentNotification();
              await refetchCourse();
            }
          }
        } else {
          toast.success(data.message);
          showEnrollmentNotification();
          await refetchCourse();
        }
      } else {
        toast.error(data.error || "Ошибка записи на курс");
      }
    } catch {
      toast.error("Произошла ошибка");
    } finally {
      setEnrolling(false);
    }
  };

  const handleToggleFavorite = () => {
    if (!user) {
      window.location.hash = "login";
      return;
    }
    toggleFavorite(courseId);
    toast.success(favored ? "Удалено из избранного" : "Добавлено в избранное");
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}#course/${courseId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: course?.title, url });
      } catch { /* user cancelled share dialog — safe to ignore */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Ссылка скопирована в буфер обмена");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold mb-2">Курс не найден</h2>
        <Button variant="outline" onClick={() => navigate("catalog")}>
          Вернуться в каталог
        </Button>
      </div>
    );
  }

  // Безопасный парсинг JSON с fallback
  function safeJsonParse<T>(str: string | null, fallback: T): T {
    if (!str) return fallback;
    try {
      return JSON.parse(str) as T;
    } catch {
      return fallback;
    }
  }

  const requirements = safeJsonParse<string[]>(course.requirements, []);
  const whatYouLearn = safeJsonParse<string[]>(course.whatYouLearn, []);

  // Rating breakdown
  const ratingBreakdown = [5, 4, 3, 2, 1].map(star => {
    const count = reviews.filter((r: ReviewItem) => r.rating === star).length;
    const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0;
    return { star, count, pct };
  });

  return (
    <div>
      {/* Заголовок курса */}
      <section className="bg-gradient-to-br from-blue-800 to-violet-800 text-white">
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10 -ml-4"
              onClick={() => navigate("catalog")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Каталог
            </Button>
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                onClick={handleToggleFavorite}
              >
                <Heart className={`w-5 h-5 ${favored ? "fill-red-400 text-red-400" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
                onClick={handleShare}
              >
                <Share2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-white/20 text-white border-0">
                  {course.category?.name}
                </Badge>
                <Badge className={levelColors[course.level]}>
                  {levelLabels[course.level]}
                </Badge>
              </div>
              <h1 className="text-2xl md:text-4xl font-bold mb-3">
                {course.title}
              </h1>
              {course.shortDesc && (
                <p className="text-blue-100 text-lg mb-4">
                  {course.shortDesc}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-4 text-sm text-blue-100">
                <span className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  {course.rating} ({course.reviewCount} отзывов)
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {course.studentCount} студентов
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {course.duration || `${course.totalDuration} мин`}
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-4 h-4" />
                  {course.totalLessons} уроков
                </span>
                {course.hasCertificate && (
                  <span className="flex items-center gap-1">
                    <Award className="w-4 h-4" />
                    Сертификат
                  </span>
                )}
              </div>
            </div>

            {/* Карточка записи */}
            <div className="lg:col-span-1">
              <Card className="border-0 shadow-xl">
                <CardContent className="p-6">
                  {course.isEnrolled ? (
                    <div>
                      <div className="mb-4">
                        <p className="text-sm text-muted-foreground mb-1">
                          Прогресс обучения
                        </p>
                        <Progress
                          value={course.enrollmentProgress}
                          className="h-3"
                        />
                        <p className="text-sm font-semibold mt-1">
                          {course.enrollmentProgress}%
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Button
                          className="w-full bg-blue-700 hover:bg-blue-800 text-white"
                          onClick={() => {
                            let targetLessonId = "";
                            for (const mod of course.modules) {
                              for (const les of mod.lessons || []) {
                                if (!les.completed) {
                                  targetLessonId = les.id;
                                  break;
                                }
                              }
                              if (targetLessonId) break;
                            }
                            if (!targetLessonId && course.modules[0]?.lessons?.[0]) {
                              targetLessonId = course.modules[0].lessons[0].id;
                            }
                            if (targetLessonId) {
                              navigate(`course/${courseId}/lesson/${targetLessonId}`);
                            }
                          }}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          {course.enrollmentProgress === 0 ? "Начать обучение" : course.enrollmentProgress === 100 ? "Пройти заново" : "Продолжить обучение"}
                        </Button>
                        {course.enrollmentProgress === 100 && course.hasCertificate && (
                          <Button
                            variant="outline"
                            className="w-full border-amber-500 text-amber-700 hover:bg-amber-50"
                            onClick={() => navigate(`certificate/${courseId}`)}
                          >
                            <FileCheck className="w-4 h-4 mr-2" />
                            Получить сертификат
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-4">
                        {course.price === 0 ? (
                          <span className="text-3xl font-bold text-green-600">
                            Бесплатно
                          </span>
                        ) : (
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-3xl font-bold">
                                {course.price.toLocaleString("ru-RU")} ₽
                              </span>
                              {course.oldPrice && (
                                <span className="text-lg text-muted-foreground line-through">
                                  {course.oldPrice.toLocaleString("ru-RU")} ₽
                                </span>
                              )}
                            </div>
                            {course.oldPrice && (
                              <Badge className="mt-1 bg-red-100 text-red-700 border-0">
                                Скидка{" "}
                                {Math.round(
                                  ((course.oldPrice - course.price) /
                                    course.oldPrice) *
                                    100
                                )}
                                %
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      {course.price > 0 && (
                        <div className="space-y-2 mb-4">
                          <p className="text-sm font-medium">Способ оплаты:</p>
                          {[
                            { id: "sbp", label: "СБП", icon: <Smartphone className="w-4 h-4" /> },
                            { id: "yookassa", label: "ЮKassa", icon: <CreditCard className="w-4 h-4" /> },
                            { id: "tinkoff", label: "Тинькофф", icon: <Building className="w-4 h-4" /> },
                          ].map((method) => (
                            <label
                              key={method.id}
                              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border ${
                                paymentMethod === method.id
                                  ? "border-blue-500 bg-blue-50"
                                  : "border-gray-200"
                              }`}
                            >
                              <input
                                type="radio"
                                name="payment"
                                value={method.id}
                                checked={paymentMethod === method.id}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="accent-blue-700"
                              />
                              {method.icon}
                              <span className="text-sm">{method.label}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      <Button
                        className="w-full bg-blue-700 hover:bg-blue-800 text-white"
                        size="lg"
                        onClick={handleEnroll}
                        disabled={enrolling}
                      >
                        {enrolling
                          ? "Загрузка..."
                          : course.price === 0
                          ? "Записаться бесплатно"
                          : "Оплатить и записаться"}
                      </Button>
                    </div>
                  )}

                  <div className="mt-4 text-xs text-muted-foreground space-y-1">
                    <p>✅ {course.totalLessons} уроков</p>
                    <p>✅ {course.freeLessons} бесплатных уроков</p>
                    <p>✅ {course.duration || `${course.totalDuration} мин`} обучения</p>
                    {course.hasCertificate && <p>✅ Сертификат по окончании</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Содержание курса */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Чему вы научитесь */}
            {whatYouLearn.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4">Чему вы научитесь</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {whatYouLearn.map((item: string, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Описание */}
            <div>
              <h2 className="text-xl font-bold mb-4">О курсе</h2>
              <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                {course.description}
              </div>
            </div>

            {/* Требования */}
            {requirements.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4">Требования</h2>
                <ul className="space-y-2">
                  {requirements.map((req: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-muted-foreground">•</span>
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Программа курса */}
            <div>
              <h2 className="text-xl font-bold mb-4">
                Программа курса ({course.modules.length} модулей)
              </h2>
              <Accordion type="multiple" className="space-y-2">
                {course.modules.map((module: ModuleItem, mIdx: number) => (
                  <AccordionItem
                    key={module.id}
                    value={module.id}
                    className="border rounded-lg px-4"
                  >
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-3 text-left">
                        <span className="w-8 h-8 bg-violet-100 text-violet-700 rounded-lg flex items-center justify-center text-sm font-semibold">
                          {mIdx + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-sm">{module.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {module.lessons?.length || 0} уроков
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-1 pb-2">
                        {module.lessons?.map((lesson: LessonItem, _lIdx: number) => {
                          const canAccess =
                            lesson.isFree || course.isEnrolled;
                          return (
                            <div
                              key={lesson.id}
                              className={`flex items-center gap-3 p-2 rounded-lg ${
                                canAccess
                                  ? "hover:bg-gray-50 cursor-pointer"
                                  : "opacity-60"
                              }`}
                              onClick={() => {
                                if (canAccess) {
                                  navigate(
                                    `course/${courseId}/lesson/${lesson.id}`
                                  );
                                } else {
                                  toast.error("Запишитесь на курс для доступа к уроку");
                                }
                              }}
                            >
                              {lesson.completed ? (
                                <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
                              ) : canAccess ? (
                                <Play className="w-5 h-5 text-violet-600 flex-shrink-0" />
                              ) : (
                                <Lock className="w-5 h-5 text-gray-400 flex-shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">
                                  {lesson.title}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {lesson.isFree && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] text-green-600 border-green-300"
                                  >
                                    Бесплатно
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {lesson.duration} мин
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {/* Преподаватель */}
            <div>
              <h2 className="text-xl font-bold mb-4">Преподаватель</h2>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center text-violet-700 font-bold text-xl">
                    {course.teacher?.name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2) || "T"}
                  </div>
                  <div>
                    <h3 className="font-semibold">
                      {course.teacher?.name || "Преподаватель"}
                    </h3>
                    {course.teacher?.bio && (
                      <p className="text-sm text-muted-foreground mt-1 max-w-md">
                        {course.teacher.bio}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Отзывы */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">
                  Отзывы ({reviewPagination.total || course.reviewCount})
                </h2>
              </div>

              {/* Рейтинг-разбивка */}
              {reviews.length > 0 && (
                <Card className="border-0 shadow-sm mb-6">
                  <CardContent className="p-4">
                    <div className="flex gap-6">
                      <div className="text-center">
                        <div className="text-4xl font-bold">{course.rating}</div>
                        <div className="flex items-center gap-0.5 mt-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < Math.round(course.rating)
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {reviewPagination.total || course.reviewCount} отзывов
                        </p>
                      </div>
                      <div className="flex-1 space-y-1">
                        {ratingBreakdown.map(({ star, count, pct }) => (
                          <div key={star} className="flex items-center gap-2 text-sm">
                            <span className="w-3 text-right">{star}</span>
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-400 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-8 text-xs text-muted-foreground text-right">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Список отзывов */}
              {reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review: ReviewItem) => (
                    <Card key={review.id} className="border-0 shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-semibold">
                            {review.user?.name
                              ?.split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2) || "U"}
                          </div>
                          <div className="flex-1">
                            <span className="text-sm font-medium">
                              {review.user?.name}
                            </span>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3 h-3 ${
                                    i < review.rating
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-gray-300"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {review.createdAt
                              ? new Date(review.createdAt).toLocaleDateString("ru-RU")
                              : ""}
                          </span>
                        </div>
                        {review.comment && (
                          <p className="text-sm text-muted-foreground">
                            {review.comment}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Пока нет отзывов. Будьте первым!
                </p>
              )}

              {/* Форма отзыва */}
              {course.isEnrolled && (
                <div className="mt-6">
                  <ReviewForm
                    courseId={courseId}
                    onReviewSubmitted={async () => {
                      // Refetch course and reviews after new review
                      const [courseRes, reviewsRes] = await Promise.all([
                        fetch(`/api/courses/${courseId}`),
                        fetch(`/api/courses/${courseId}/reviews?page=1&limit=10`),
                      ]);
                      if (courseRes.ok) {
                        const d = await courseRes.json();
                        setCourse(d.course);
                      }
                      if (reviewsRes.ok) {
                        const d = await reviewsRes.json();
                        setReviews(d.reviews || []);
                        setReviewPagination(d.pagination || { page: 1, total: 0, totalPages: 0 });
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
