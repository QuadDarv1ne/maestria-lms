"use client";
import { useRouter } from "next/navigation";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BookOpen, Users, TrendingUp, Star, Plus, GraduationCap,
  Clock, RefreshCw, BarChart3, ExternalLink,
} from "lucide-react";
import { getInitials } from "@/lib/utils";

interface TeacherCourse {
  id: string;
  title: string;
  slug: string;
  isPublished: boolean;
  rating: number;
  category: { name: string; slug: string } | null;
  enrolledStudents: number;
  completedStudents: number;
  totalEnrollments: number;
  averageProgress: number;
  recentEnrollments: {
    userId: string;
    name: string | null;
    email: string;
    image: string | null;
    progress: number;
    enrolledAt: string;
  }[];
  moduleCount: number;
  reviewCount: number;
}

interface TeacherStats {
  totalCourses: number;
  totalStudents: number;
  totalCompleted: number;
  avgCompletionRate: number;
  avgProgress: number;
  totalRevenue: number;
  recentStudents: number;
  publishedCourses: number;
}

export function TeacherDashboard() {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const locale = useAppStore((s) => s.locale);
  const [courses, setCourses] = useState<TeacherCourse[]>([]);
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher/stats", { signal });
      if (!res.ok) {
        if (res.status === 403) {
          router.push("/");
          return;
        }
        throw new Error("Failed to load stats");
      }
      const data = await res.json();
      setCourses(data.courses);
      setStats(data.stats);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(t("teacher.loadError", locale));
    } finally {
      setLoading(false);
    }
  }, [locale, router]);

  useEffect(() => {
    if (!user || (user.role !== "teacher" && user.role !== "admin")) {
      router.push("/");
      return;
    }
    const controller = new AbortController();
    fetchStats(controller.signal);
    return () => {
      controller.abort();
    };
  }, [user, fetchStats, router]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 animate-pulse">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-100 dark:bg-gray-800 rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-gray-100 dark:bg-gray-800 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={() => fetchStats()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {t("admin.refresh", locale)}
        </Button>
      </div>
    );
  }

  const kpiCards = stats
    ? [
        {
          label: t("teacher.myCourses", locale),
          value: `${stats.publishedCourses}/${stats.totalCourses}`,
          icon: <BookOpen className="w-5 h-5 text-blue-600" />,
          bg: "bg-blue-50 dark:bg-blue-950/30",
        },
        {
          label: t("teacher.totalStudents", locale),
          value: stats.totalStudents,
          icon: <Users className="w-5 h-5 text-green-600" />,
          bg: "bg-green-50 dark:bg-green-950/30",
        },
        {
          label: t("teacher.avgCompletion", locale),
          value: `${stats.avgCompletionRate}%`,
          icon: <GraduationCap className="w-5 h-5 text-violet-600" />,
          bg: "bg-violet-50 dark:bg-violet-950/30",
        },
        {
          label: t("teacher.avgProgress", locale),
          value: `${stats.avgProgress}%`,
          icon: <TrendingUp className="w-5 h-5 text-amber-600" />,
          bg: "bg-amber-50 dark:bg-amber-950/30",
        },
      ]
    : [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-green-700 to-teal-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                {t("teacher.dashboardTitle", locale)}
              </h1>
              <p className="text-muted-foreground text-sm">
                {t("teacher.dashboardSubtitle", locale)}{user.name ? `, ${user.name}` : ""}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchStats()}
          >
            <RefreshCw className="w-4 h-4 mr-1.5" />
            {t("admin.refresh", locale)}
          </Button>
          <Button
            size="sm"
            onClick={() => router.push("/course-editor")}
            className="bg-green-700 hover:bg-green-800 text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {t("admin.createCourse", locale)}
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {kpiCards.map((kpi, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className={`p-4 ${kpi.bg} rounded-xl`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
                  </div>
                  {kpi.icon}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-700" />
              {t("teacher.myCourses", locale)}
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              {courses.length} {t("courseEditor.coursesCount", locale)}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {courses.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">
                {t("teacher.noCourses", locale)}
              </p>
              <Button
                onClick={() => router.push("/course-editor")}
                className="bg-green-700 hover:bg-green-800 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("admin.createCourse", locale)}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table aria-label={t("teacher.coursesTable", locale)}>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("adminPage.thCourse", locale)}</TableHead>
                    <TableHead>{t("adminPage.userRoleStudents", locale)}</TableHead>
                    <TableHead>{t("teacher.completed", locale)}</TableHead>
                    <TableHead>{t("teacher.avgProgress", locale)}</TableHead>
                    <TableHead>{t("adminPage.thRating", locale)}</TableHead>
                    <TableHead>{t("teacher.status", locale)}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courses.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm">{course.title}</span>
                          {course.category && (
                            <p className="text-xs text-muted-foreground">{course.category.name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{course.enrolledStudents}</TableCell>
                      <TableCell className="text-sm">{course.completedStudents}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={course.averageProgress} aria-valuemin={0} aria-valuemax={100} aria-label={`${course.title} progress: ${course.averageProgress}%`}>
                            <div
                              className={`h-full rounded-full ${
                                course.averageProgress >= 70
                                  ? "bg-green-500"
                                  : course.averageProgress >= 40
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                              }`}
                              style={{ width: `${course.averageProgress}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {course.averageProgress}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          <span className="text-sm">{course.rating.toFixed(1)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            course.isPublished
                              ? "bg-green-50 text-green-700 border-green-200 text-xs"
                              : "bg-gray-100 text-gray-500 border-gray-200 text-xs"
                          }
                        >
                          {course.isPublished
                            ? t("courseEditor.published", locale)
                            : t("courseEditor.draft", locale)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t("teacher.viewCourse", locale)}
                          onClick={() => router.push(`/course/${course.slug || course.id}`)}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {courses.filter((c) => c.recentEnrollments.length > 0).length > 0 && (
        <Card className="border-0 shadow-sm mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-5 h-5 text-violet-700" />
              {t("teacher.recentActivity", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {courses
                .flatMap((c) =>
                  c.recentEnrollments.map((e) => ({ ...e, courseTitle: c.title, courseSlug: c.slug }))
                )
                .sort(
                  (a, b) =>
                    new Date(b.enrolledAt).getTime() - new Date(a.enrolledAt).getTime()
                )
                .slice(0, 10)
                .map((activity) => (
                  <div
                    key={`${activity.userId}-${activity.courseSlug}`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                      {getInitials(activity.name, "?")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {activity.name || activity.email}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {t("teacher.enrolledTo", locale)} {activity.courseTitle}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${activity.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{activity.progress}%</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      aria-label={t("teacher.viewStudentStats", locale)}
                      onClick={() => router.push(`/admin/student/${activity.userId}`)}
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
