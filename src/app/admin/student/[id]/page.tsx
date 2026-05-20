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

const timeUnits: Record<string, { h: string; m: string }> = {
  ru: { h: "ч", m: "м" },
  en: { h: "h", m: "m" },
  zh: { h: "小时", m: "分钟" },
};

function formatTime(seconds: number, locale: string): string {
  const units = timeUnits[locale] || timeUnits.en;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}${units.h} ${minutes}${units.m}`;
  return `${minutes}${units.m}`;
}

export default function StudentDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { locale } = useAppStore();
  const userId = searchParams.get("userId") || "";

  const { data, isLoading, error } = useStudentStats(userId);

  const levelLabels: Record<string, string> = {
    beginner: t("admin.levelBeginner", locale),
    intermediate: t("admin.levelIntermediate", locale),
    advanced: t("admin.levelAdvanced", locale),
  };

  const roleLabels: Record<string, string> = {
    admin: t("role.admin", locale),
    teacher: t("role.teacher", locale),
    student: t("role.student", locale),
  };

  if (!userId) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h2 className="text-xl font-semibold mb-2">{t("admin.studentDetail.noUserId", locale)}</h2>
        <Button onClick={() => router.push("/admin")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("admin.studentDetail.backToAdmin", locale)}
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
        <h2 className="text-xl font-semibold mb-2">{t("admin.studentDetail.loadError", locale)}</h2>
        <p className="text-muted-foreground mb-4">
          {(error as Error)?.message || t("admin.studentDetail.loadErrorMsg", locale)}
        </p>
        <Button onClick={() => router.push("/admin")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("admin.studentDetail.backToAdmin", locale)}
        </Button>
      </div>
    );
  }

  const { user, enrollments, reviews, certificates, payments, stats } = data;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push("/admin")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("admin.studentDetail.back", locale)}
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
            <h1 className="text-xl font-bold">{user.name || t("admin.studentDetail.noName", locale)}</h1>
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
                {t("admin.studentDetail.registration", locale)}:{" "}
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
            value: formatTime(stats.totalTimeSpent, locale),
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
            <CardTitle className="text-base">{t("admin.studentDetail.aboutStudent", locale)}</CardTitle>
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
            {t("admin.studentDetail.coursesProgress", locale)}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {enrollments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {t("admin.studentDetail.noEnrollments", locale)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.studentDetail.course", locale)}</TableHead>
                    <TableHead>{t("admin.studentDetail.level", locale)}</TableHead>
                    <TableHead>{t("admin.studentDetail.teacher", locale)}</TableHead>
                    <TableHead>{t("admin.studentDetail.status", locale)}</TableHead>
                    <TableHead>{t("admin.studentDetail.progress", locale)}</TableHead>
                    <TableHead>{t("admin.studentDetail.lessons", locale)}</TableHead>
                    <TableHead>{t("admin.studentDetail.time", locale)}</TableHead>
                    <TableHead>{t("admin.studentDetail.avgScore", locale)}</TableHead>
                    <TableHead>{t("admin.studentDetail.lastActivity", locale)}</TableHead>
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
                        {enrollment.course.teacher?.name || t("admin.studentDetail.teacherNone", locale)}
                      </TableCell>
                      <TableCell>
                        {enrollment.status === "completed" ? (
                          <Badge className="bg-green-100 text-green-700 border-0 text-xs">
                            {t("admin.studentDetail.completed", locale)}
                          </Badge>
                        ) : enrollment.progress === 0 ? (
                          <Badge className="bg-gray-100 text-gray-700 border-0 text-xs">
                            {t("admin.studentDetail.notStarted", locale)}
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">
                            {t("admin.studentDetail.inProgress", locale)}
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
                        {formatTime(enrollment.totalTimeSpent, locale)}
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
              {t("admin.studentDetail.reviews", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.studentDetail.course", locale)}</TableHead>
                    <TableHead>{t("admin.studentDetail.rating", locale)}</TableHead>
                    <TableHead>{t("admin.studentDetail.comment", locale)}</TableHead>
                    <TableHead>{t("admin.studentDetail.date", locale)}</TableHead>
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
              {t("admin.studentDetail.certificates", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.studentDetail.course", locale)}</TableHead>
                    <TableHead>{t("admin.studentDetail.certificateNumber", locale)}</TableHead>
                    <TableHead>{t("admin.studentDetail.issueDate", locale)}</TableHead>
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
              {t("admin.studentDetail.payments", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.studentDetail.course", locale)}</TableHead>
                    <TableHead>{t("admin.studentDetail.amount", locale)}</TableHead>
                    <TableHead>{t("admin.studentDetail.method", locale)}</TableHead>
                    <TableHead>{t("admin.studentDetail.status", locale)}</TableHead>
                    <TableHead>{t("admin.studentDetail.date", locale)}</TableHead>
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
