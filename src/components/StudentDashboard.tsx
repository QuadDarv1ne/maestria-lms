"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen, PlayCircle, Clock, Trophy, Flame,
  ArrowRight, CheckCircle2, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ContinueCourse {
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  progress: number;
  nextLesson: { id: string; title: string } | null;
  lastAccessed: string | null;
}

interface WeeklyActivity {
  day: string;
  date: string;
  minutes: number;
  isToday: boolean;
}

interface ActivityStats {
  weeklyMinutes: number;
  weeklyLessons: number;
  streak: number;
  totalHours: number;
  coursesCompleted: number;
  weeklyActivity: WeeklyActivity[];
  continueCourses: ContinueCourse[];
}

function getDayShort(date: Date, locale: string): string {
  const days: Record<string, string[]> = {
    ru: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
    en: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    zh: ["日", "一", "二", "三", "四", "五", "六"],
  };
  return (days[locale] || days.en)[date.getDay()];
}

export function StudentDashboard() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const user = useAppStore((s) => s.user);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;

    async function fetchDashboard() {
      try {
        const res = await fetch("/api/user/progress-summary");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setStats(data.data || data);
        }
      } catch {
        // Graceful: dashboard won't show if API fails
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchDashboard();
    return () => { cancelled = true; };
  }, [user]);

  const maxMinutes = useMemo(() => {
    if (!stats?.weeklyActivity?.length) return 60;
    return Math.max(60, ...stats.weeklyActivity.map((d) => d.minutes));
  }, [stats]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 mb-8">
        <div className="h-32 bg-muted rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const hasActivity = stats.weeklyMinutes > 0 || stats.streak > 0;

  return (
    <div className="space-y-6 mb-8">
      {/* Continue Learning */}
      {stats.continueCourses && stats.continueCourses.length > 0 && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-linear-to-r from-blue-600 via-violet-600 to-purple-600 p-5 text-white">
              <div className="flex items-center gap-2 mb-1">
                <PlayCircle className="w-5 h-5" />
                <h3 className="font-semibold text-sm">{t("profile.continueLearning", locale)}</h3>
              </div>
              <p className="text-xs text-white/70">{t("profile.continueLearningHint", locale)}</p>
            </div>
            <div className="p-4 space-y-3">
              {stats.continueCourses.slice(0, 3).map((course) => (
                <button
                  key={course.courseId}
                  onClick={() => {
                    if (course.nextLesson) {
                      router.push(`/course/${course.courseId}/lesson/${course.nextLesson.id}`);
                    } else {
                      router.push(`/course/${course.courseSlug || course.courseId}`);
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-linear-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{course.courseTitle}</p>
                    {course.nextLesson && (
                      <p className="text-xs text-muted-foreground truncate">
                        {t("profile.nextLesson", locale)}: {course.nextLesson.title}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Progress value={course.progress} className="h-1.5 flex-1" />
                      <span className="text-xs font-medium text-muted-foreground w-8 text-right">
                        {course.progress}%
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickStat
          icon={<Flame className="w-4 h-4" />}
          iconColor="text-orange-500"
          iconBg="bg-orange-50 dark:bg-orange-950/30"
          value={stats.streak > 0 ? `${stats.streak}` : "0"}
          unit={t("profile.daysStreak", locale)}
        />
        <QuickStat
          icon={<Clock className="w-4 h-4" />}
          iconColor="text-blue-500"
          iconBg="bg-blue-50 dark:bg-blue-950/30"
          value={stats.weeklyMinutes >= 60
            ? `${(stats.weeklyMinutes / 60).toFixed(1)}`
            : `${stats.weeklyMinutes}`}
          unit={stats.weeklyMinutes >= 60 ? t("common.hoursAbbrev", locale) : t("common.minutesAbbrev", locale)}
        />
        <QuickStat
          icon={<CheckCircle2 className="w-4 h-4" />}
          iconColor="text-green-500"
          iconBg="bg-green-50 dark:bg-green-950/30"
          value={`${stats.weeklyLessons}`}
          unit={t("profile.lessonsThisWeek", locale)}
        />
        <QuickStat
          icon={<Trophy className="w-4 h-4" />}
          iconColor="text-amber-500"
          iconBg="bg-amber-50 dark:bg-amber-950/30"
          value={`${stats.coursesCompleted}`}
          unit={t("profile.coursesCompletedUnit", locale)}
        />
      </div>

      {/* Weekly Activity Chart */}
      {hasActivity && stats.weeklyActivity && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-violet-600" />
                <h3 className="font-semibold text-sm">{t("profile.weeklyActivity", locale)}</h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {stats.weeklyMinutes >= 60
                  ? `${(stats.weeklyMinutes / 60).toFixed(1)} ${t("common.hoursAbbrev", locale)}`
                  : `${stats.weeklyMinutes} ${t("common.minutesAbbrev", locale)}`}
                {" "}{t("profile.thisWeek", locale)}
              </span>
            </div>

            {/* Bar chart */}
            <div className="flex items-end justify-between gap-1 h-24">
              {stats.weeklyActivity.map((day, idx) => {
                const height = day.minutes > 0
                  ? Math.max(8, (day.minutes / maxMinutes) * 100)
                  : 4;
                return (
                  <div key={idx} className="flex flex-col items-center flex-1 gap-1">
                    <div
                      className={cn(
                        "w-full max-w-[32px] rounded-t-md transition-all",
                        day.isToday
                          ? "bg-linear-to-t from-violet-600 to-blue-500"
                          : day.minutes > 0
                            ? "bg-violet-200 dark:bg-violet-800"
                            : "bg-muted",
                      )}
                      style={{ height: `${height}%` }}
                      title={`${day.date}: ${day.minutes} ${t("common.minutesAbbrev", locale)}`}
                    />
                    <span className={cn(
                      "text-[10px]",
                      day.isToday ? "font-bold text-violet-600" : "text-muted-foreground",
                    )}>
                      {day.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function QuickStat({
  icon, iconColor, iconBg, value, unit,
}: {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  value: string;
  unit: string;
}) {
  return (
    <div className={cn("rounded-lg p-3 flex items-center gap-3", iconBg)}>
      <div className={cn("shrink-0", iconColor)}>{icon}</div>
      <div>
        <p className="text-lg font-bold leading-tight">{value}</p>
        <p className="text-[10px] text-muted-foreground leading-tight">{unit}</p>
      </div>
    </div>
  );
}
