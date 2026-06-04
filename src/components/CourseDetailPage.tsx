"use client";
import { useRouter } from "next/navigation";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { sanitizeContent } from "@/lib/sanitize";
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
  Loader2,
  CreditCard,
  Smartphone,
  Building,
  Heart,
  Share2,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";

import { ReviewForm } from "@/components/ReviewForm";
import { CourseImage } from "@/components/CourseImage";
import { formatDate, formatNumber, getInitials } from "@/lib/utils";
import { levelLabels, levelColors } from "@/lib/constants";
import { useCourse, useCourseReviews } from "@/hooks/useCourses";
import { useQueryClient } from "@tanstack/react-query";
import { CourseDetailSkeleton } from "@/components/skeletons/CourseDetailSkeleton";
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
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isFavorite = useAppStore((s) => s.isFavorite);
  const publishNotification = useAppStore((s) => s.publishNotification);
  const locale = useAppStore((s) => s.locale);
  const queryClient = useQueryClient();
  const [enrolling, setEnrolling] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>("sbp");

  const { data: courseData, isLoading } = useCourse(courseId);
  const { data: reviewsData } = useCourseReviews(courseId);

  const course = courseData?.course as CourseDetail | null | undefined;
  const reviews = (reviewsData?.reviews as ReviewItem[] | undefined) ?? [];
  const loading = isLoading;

  const favored = isFavorite(courseId);

  const invalidateCourse = () => {
    queryClient.invalidateQueries({ queryKey: ["course", courseId] });
    queryClient.invalidateQueries({ queryKey: ["course-reviews", courseId] });
  };

  const showEnrollmentNotification = () => {
    if (!user) return;
    publishNotification({
      type: "enrollment",
      title: t("notifications.type.enrollment", locale),
      message: t("course.enrollFree", locale),
      read: false,
      link: `course/${courseId}`,
    }, user.id);
  };

  const handleEnroll = async () => {
    if (!user) {
      router.push("?dialog=login");
      return;
    }
    setEnrolling(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod }),
      });
      const data = await res.json();

      if (res.ok) {
        if (data.requiresPayment && data.paymentId) {
          router.push(`/payment/${data.paymentId}`);
        } else {
          toast.success(data.message);
          showEnrollmentNotification();
          invalidateCourse();
        }
      } else {
        toast.error(data.error || t("common.error", locale));
      }
    } catch {
      toast.error(t("common.error", locale));
    } finally {
      setEnrolling(false);
    }
  };

  const handleToggleFavorite = () => {
    if (!user) {
      router.push("?dialog=login");
      return;
    }
    toggleFavorite(courseId);
    toast.success(favored ? t("profile.removeFromFavorites", locale) : t("profile.addToFavorites", locale));
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/course/${courseId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: course?.title, url });
      } catch { /* user cancelled share dialog — safe to ignore */ }
    } else {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        toast.error(t("common.error", locale));
        return;
      }
      toast.success(t("common.success", locale));
    }
  };

  if (loading) {
    return <CourseDetailSkeleton />;
  }

  if (!course) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold mb-2">{t("course.notFound", locale)}</h2>
        <Button variant="outline" onClick={() => router.push("/catalog")}>
          {t("course.backToCatalog", locale)}
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
      <section className="relative bg-gradient-to-br from-blue-800 to-violet-800 text-white overflow-hidden">
        {course.image && (
          <>
            <CourseImage
              src={course.image}
              alt={course.title}
              className="absolute inset-0 w-full h-full object-cover opacity-30"
              identifier={course.id}
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/80 to-violet-900/80" />
          </>
        )}
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10 -ml-4"
              onClick={() => router.push("/catalog")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("nav.catalog", locale)}
            </Button>
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={favored ? t("profile.removeFromFavorites", locale) : t("profile.addToFavorites", locale)}
                type="button"
                className="text-white hover:bg-white/10"
                onClick={handleToggleFavorite}
              >
                <Heart className={`w-5 h-5 ${favored ? "fill-red-400 text-red-400" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("profile.share", locale)}
                type="button"
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
                  {t(levelLabels[course.level], locale)}
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
                  {course.rating} ({course.reviewCount} {t("course.reviewsCount", locale)})
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {course.studentCount} {t("course.students", locale)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {course.duration || `${course.totalDuration} ${t("course.min", locale)}`}
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-4 h-4" />
                  {course.totalLessons} {t("course.lessons", locale)}
                </span>
                {course.hasCertificate && (
                  <span className="flex items-center gap-1">
                    <Award className="w-4 h-4" />
                    {t("common.certificate", locale)}
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
                          {t("course.progress", locale)}
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
                              router.push(`/course/${courseId}/lesson/${targetLessonId}`);
                            }
                          }}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          {course.enrollmentProgress === 0 ? t("course.startLearning", locale) : course.enrollmentProgress === 100 ? t("course.restart", locale) : t("course.continue", locale)}
                        </Button>
                        {course.enrollmentProgress === 100 && course.hasCertificate && (
                          <Button
                            variant="outline"
                            className="w-full border-amber-500 text-amber-700 hover:bg-amber-50"
                            onClick={() => router.push(`/certificate/${courseId}`)}
                          >
                            <FileCheck className="w-4 h-4 mr-2" />
                            {t("course.getCertificate", locale)}
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-4">
                        {course.price === 0 ? (
                          <span className="text-3xl font-bold text-green-600">
                            {t("course.free", locale)}
                          </span>
                        ) : (
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-3xl font-bold">
                                {formatNumber(course.price, locale)} ₽
                              </span>
                              {course.oldPrice && (
                                <span className="text-lg text-muted-foreground line-through">
                                  {formatNumber(course.oldPrice, locale)} ₽
                                </span>
                              )}
                            </div>
                            {course.oldPrice && (
                              <Badge className="mt-1 bg-red-100 text-red-700 border-0">
                                {t("course.discount", locale)}{" "}
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
                        <div className="space-y-2 mb-4" role="radiogroup" aria-label={t("course.paymentMethod", locale)}>
                          <p className="text-sm font-medium">{t("course.paymentMethod", locale)}</p>
                          {[
                            { id: "sbp", label: t("course.paymentSbp", locale), icon: <Smartphone className="w-4 h-4" /> },
                            { id: "yookassa", label: t("course.paymentYookassa", locale), icon: <CreditCard className="w-4 h-4" /> },
                            { id: "tinkoff", label: t("course.paymentTinkoff", locale), icon: <Building className="w-4 h-4" /> },
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
                        {enrolling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {enrolling
                          ? t("course.loading", locale)
                          : course.price === 0
                          ? t("course.enrollFree", locale)
                          : t("course.enrollPay", locale)}
                      </Button>
                    </div>
                  )}

                  <div className="mt-4 text-xs text-muted-foreground space-y-1">
                    <p>✅ {course.totalLessons} {t("course.lessons", locale)}</p>
                    <p>✅ {course.freeLessons} {t("course.free", locale)}</p>
                    <p>✅ {course.duration || `${course.totalDuration} ${t("course.min", locale)}`} {t("course.learning", locale)}</p>
                    {course.hasCertificate && <p>✅ {t("common.certificate", locale)}</p>}
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
                <h2 className="text-xl font-bold mb-4">{t("course.whatYouLearn", locale)}</h2>
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
              <h2 className="text-xl font-bold mb-4">{t("course.aboutCourse", locale)}</h2>
              <div className="prose prose-sm max-w-none text-muted-foreground" dangerouslySetInnerHTML={{ __html: sanitizeContent(course.description || "") }} />
            </div>

            {/* Требования */}
            {requirements.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4">{t("course.requirements", locale)}</h2>
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
                {t("course.curriculum", locale)} ({course.modules.length} {t("course.modules", locale)})
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
                            {module.lessons?.length || 0} {t("course.lessons", locale)}
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
                              role="button"
                              tabIndex={canAccess ? 0 : undefined}
                              className={`flex items-center gap-3 p-2 rounded-lg ${
                                canAccess
                                  ? "hover:bg-gray-50 cursor-pointer"
                                  : "opacity-60"
                              }`}
                              onClick={() => {
                                if (canAccess) {
                                  router.push(
                                    `course/${courseId}/lesson/${lesson.id}`
                                  );
                                } else {
                                  toast.error(t("course.step.enrollFirst", locale));
                                }
                              }}
                              onKeyDown={(e) => {
                                if (canAccess && (e.key === 'Enter' || e.key === ' ')) {
                                  e.preventDefault();
                                  router.push(`course/${courseId}/lesson/${lesson.id}`);
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
                                    {t("course.free", locale)}
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {lesson.duration} {t("course.min", locale)}
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
              <h2 className="text-xl font-bold mb-4">{t("course.instructor", locale)}</h2>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center text-violet-700 font-bold text-xl">
                    {getInitials(course.teacher?.name, "T")}
                  </div>
                  <div>
                    <h3 className="font-semibold">
                      {course.teacher?.name || t("common.instructor", locale)}
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
                  {t("course.reviews", locale)} ({reviewsData?.pagination?.total ?? course?.reviewCount ?? 0})
                </h2>
              </div>

              {/* Рейтинг-разбивка */}
              {reviews.length > 0 && (
                <Card className="border-0 shadow-sm mb-6">
                  <CardContent className="p-4">
                    <div className="flex gap-6">
                      <div className="text-center">
                        <div className="text-4xl font-bold">{course.rating}</div>
                        <div className="flex items-center gap-0.5 mt-1" aria-label={`${course.rating} out of 5`}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              aria-hidden="true"
                              className={`w-4 h-4 ${
                                i < Math.round(course.rating)
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {reviewsData?.pagination?.total ?? course?.reviewCount ?? 0} {t("course.reviewsCount", locale)}
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
                            {getInitials(review.user?.name, "U")}
                          </div>
                          <div className="flex-1">
                            <span className="text-sm font-medium">
                              {review.user?.name}
                            </span>
                            <div className="flex items-center gap-1" aria-label={`${review.rating} out of 5`}>
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  aria-hidden="true"
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
                              ? formatDate(review.createdAt, locale)
                              : ""}
                          </span>
                        </div>
                        {review.comment && (
                          <p className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: sanitizeContent(review.comment) }} />
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {t("course.noReviews", locale)}
                </p>
              )}

              {/* Форма отзыва */}
              {course.isEnrolled && (
                <div className="mt-6">
                  <ReviewForm
                    courseId={courseId}
                    onReviewSubmitted={() => invalidateCourse()}
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