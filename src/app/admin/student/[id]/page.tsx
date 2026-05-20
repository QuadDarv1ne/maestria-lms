"use client";


import { useSearchParams, useRouter } from "next/navigation";
import { useStudentStats } from "@/hooks/useAdmin";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { formatDate, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  User,
  BookOpen,
  CheckCircle2,
  Clock,
  Award,
  TrendingUp,
  Timer,
  BarChart3,
  DollarSign,
  MessageSquare,
  Activity,
} from "lucide-react";

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
}

const levelLabels: Record<string, string> = {
  beginner: "Начальный",
  intermediate: "Средний",
  advanced: "Продвинутый",
};

export default function StudentDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { locale } = useAppStore();
  const userId = searchParams.get("userId") || "";

  const { data, isLoading, error } = useStudentStats(userId);

  if (!userId) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h2 className="text-xl font-semibold mb-2">ID пользователя не указан</h2>
        <Button onClick={() => router.push("/admin")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад в админ-панель
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-muted rounded w-48" />
          <div className="h-32 bg-muted rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted rounded" />
            ))}
          </div>
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Ошибка загрузки данных</h2>
        <p className="text-muted-foreground mb-4">
          {(error as Error)?.message || "Не удалось загрузить статистику студента"}
        </p>
        <Button onClick={() => router.push("/admin")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад в админ-панель
        </Button>
      </div>
    );
  }

  const { user, enrollments, reviews, certificates, payments, stats } = data;

  const roleLabels: Record<string, string> = {
    admin: t("role.admin", locale),
    teacher: t("role.teacher", locale),
    student: t("role.student", locale),
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push("/admin")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад
        </Button>
        <div className="flex items-center gap-4 flex-1">
          <Avatar className="w-14 h-14">
            <AvatarImage src={user.image || ""} alt={user.name || ""} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-600 text-white text-lg font-bold">
              {user.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2) || "?? "}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold">{user.name || "Без имени"}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="bg-violet-100 text-violet-700 border-0 text-xs">
                {roleLabels[user.role] || user.role}
              </Badge>
              <Badge
                className={`border-0 text-xs ${
                  user.isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {user.isActive ? t("admin.active", locale) : t("admin.blocked", locale)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Регистрация:{" "}
                {formatDate(user.createdAt, locale)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          {
            label: t("admin.enrollments", locale),
            value: stats.totalCoursesEnrolled,
            icon: <BookOpen className="w-5 h-5 text-blue-600" />,
          },
          {
            label: t("profile.completed", locale),
            value: stats.completedCourses,
            icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
          },
          {
            label: t("profile.inProgress", locale),
            value: stats.inProgressCourses,
            icon: <Clock className="w-5 h-5 text-amber-600" />,
          },
          {
            label: t("profile.lessonsPassed", locale),
            value: `${stats.totalLessonsCompleted}/${stats.totalLessonsAvailable}`,
            icon: <BarChart3 className="w-5 h-5 text-violet-600" />,
          },
          {
            label: t("profile.totalTime", locale),
            value: formatTime(stats.totalTimeSpent),
            icon: <Timer className="w-5 h-5 text-purple-600" />,
          },
          {
            label: t("profile.avgScore", locale),
            value: stats.overallAvgScore ? `${stats.overallAvgScore}%` : "—",
            icon: <TrendingUp className="w-5 h-5 text-emerald-600" />,
          },
        ].map((stat, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                {stat.icon}
                <span className="text-xl font-bold">{stat.value}</span>
              </div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: t("profile.avgProgress", locale),
            value: `${stats.avgProgress}%`,
            icon: <TrendingUp className="w-5 h-5 text-blue-700" />,
          },
          {
            label: t("profile.reviews", locale),
            value: reviews.length,
            icon: <MessageSquare className="w-5 h-5 text-violet-600" />,
          },
          {
            label: t("profile.certificates", locale),
            value: certificates.length,
            icon: <Award className="w-5 h-5 text-amber-600" />,
          },
          {
            label: t("admin.recentActivity", locale),
            value: stats.recentProgress,
            icon: <Activity className="w-5 h-5 text-green-600" />,
          },
        ].map((stat, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                {stat.icon}
                <span className="text-xl font-bold">{stat.value}</span>
              </div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bio */}
      {user.bio && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">О студенте</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{user.bio}</p>
          </CardContent>
        </Card>
      )}

      {/* Enrollments */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-700" />
            Курсы и прогресс
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {enrollments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Студент ещё не записан ни на один курс
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Курс</TableHead>
                    <TableHead>Уровень</TableHead>
                    <TableHead>Преподаватель</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Прогресс</TableHead>
                    <TableHead>Уроки</TableHead>
                    <TableHead>Время</TableHead>
                    <TableHead>Ср. балл</TableHead>
                    <TableHead>Последняя активность</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollments.map((enrollment) => (
                    <TableRow key={enrollment.id}>
                      <TableCell className="font-medium text-sm max-w-[200px] truncate">
                        {enrollment.course.title}
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline" className="text-[10px]">
                          {levelLabels[enrollment.course.level] ||
                            enrollment.course.level}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {enrollment.course.teacher?.name || "—"}
                      </TableCell>
                      <TableCell>
                        {enrollment.status === "completed" ? (
                          <Badge className="bg-green-100 text-green-700 border-0 text-xs">
                            Завершён
                          </Badge>
                        ) : enrollment.progress === 0 ? (
                          <Badge className="bg-gray-100 text-gray-700 border-0 text-xs">
                            Не начат
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">
                            В процессе
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={enrollment.progress}
                            className="h-2 w-20"
                          />
                          <span className="text-xs font-medium">
                            {enrollment.progress}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {enrollment.completedLessons}/
                        {enrollment.totalLessons}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatTime(enrollment.totalTimeSpent)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {enrollment.avgScore !== null
                          ? `${enrollment.avgScore}%`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {enrollment.lastAccessed
                          ? formatDate(enrollment.lastAccessed, locale)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reviews */}
      {reviews.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-violet-600" />
              Отзывы
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Курс</TableHead>
                    <TableHead>Рейтинг</TableHead>
                    <TableHead>Комментарий</TableHead>
                    <TableHead>Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews.map((review) => (
                    <TableRow key={review.id}>
                      <TableCell className="font-medium text-sm">
                        {review.course.title}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {"★".repeat(review.rating)}
                          {"☆".repeat(5 - review.rating)}
                          <span className="text-xs text-muted-foreground ml-1">
                            ({review.rating})
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm max-w-[300px] truncate">
                        {review.comment || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(review.createdAt, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Certificates */}
      {certificates.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              Сертификаты
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Курс</TableHead>
                    <TableHead>Номер сертификата</TableHead>
                    <TableHead>Дата выдачи</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {certificates.map((cert) => (
                    <TableRow key={cert.id}>
                      <TableCell className="font-medium text-sm">
                        {cert.course.title}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {cert.certificateNumber}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(cert.issuedAt, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payments */}
      {payments.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Платежи
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Курс</TableHead>
                    <TableHead>Сумма</TableHead>
                    <TableHead>Метод</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium text-sm">
                        {payment.course.title}
                      </TableCell>
                      <TableCell className="text-sm font-semibold">
                        {formatNumber(payment.amount, locale)}{" "}
                        {payment.currency}
                      </TableCell>
                      <TableCell className="text-sm">
                        {payment.paymentMethod}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`border-0 text-xs ${
                            payment.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : payment.status === "pending"
                              ? "bg-yellow-100 text-yellow-700"
                              : payment.status === "refunded"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(payment.createdAt, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
