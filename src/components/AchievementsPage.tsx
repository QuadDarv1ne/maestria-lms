"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Footprints,
  BookOpen,
  GraduationCap,
  Zap,
  Play,
  TrendingUp,
  Trophy,
  Flame,
  UserPlus,
  MessageSquare,
  Code2,
  Terminal,
  Star,
  Crown,
  Lock,
  Award,
  Target,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

// ============ TYPES ============

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  bio: string | null;
  phone: string | null;
  twoFactorEnabled: boolean;
  createdAt: string;
  _count: {
    enrollments: number;
    reviews: number;
    certificates: number;
    teacherCourses: number;
  };
}

interface Enrollment {
  id: string;
  status: string;
  progress: number;
  enrolledAt: string;
  course: {
    id: string;
    title: string;
    image: string | null;
    level: string;
    categoryId: string | null;
  };
}

interface AchievementData {
  completedCodingAssignments: number;
  completedLessonsCount: number;
  totalUsers: number;
  userRegistrationOrder: number;
}

type AchievementStatus = "earned" | "in_progress" | "locked";

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  colorBg: string;
  colorBorder: string;
  colorText: string;
  category: string;
  categoryLabel: string;
  check: (data: AchievementCheckData) => {
    status: AchievementStatus;
    current: number;
    target: number;
  };
}

interface AchievementCheckData {
  enrollmentsCount: number;
  uniqueCategories: number;
  completedLessonsCount: number;
  has50Progress: boolean;
  completedCoursesCount: number;
  reviewsCount: number;
  codingAssignments: number;
  userRegistrationOrder: number;
  totalUsers: number;
  isTeacherOrAdmin: boolean;
  isRegistered: boolean;
  anyProgress: boolean;
}

// ============ ACHIEVEMENT DEFINITIONS ============

const achievements: Achievement[] = [
  // Обучение (Learning)
  {
    id: "first-step",
    title: "Первый шаг",
    description: "Записаться на первый курс",
    icon: Footprints,
    color: "blue",
    colorBg: "bg-blue-100",
    colorBorder: "border-blue-400",
    colorText: "text-blue-700",
    category: "learning",
    categoryLabel: "Обучение",
    check: (d) => ({
      status: d.enrollmentsCount >= 1 ? "earned" : "locked",
      current: Math.min(d.enrollmentsCount, 1),
      target: 1,
    }),
  },
  {
    id: "student",
    title: "Студент",
    description: "Записаться на 3 курса",
    icon: BookOpen,
    color: "violet",
    colorBg: "bg-violet-100",
    colorBorder: "border-violet-400",
    colorText: "text-violet-700",
    category: "learning",
    categoryLabel: "Обучение",
    check: (d) => ({
      status:
        d.enrollmentsCount >= 3
          ? "earned"
          : d.enrollmentsCount >= 1
            ? "in_progress"
            : "locked",
      current: Math.min(d.enrollmentsCount, 3),
      target: 3,
    }),
  },
  {
    id: "excellent",
    title: "Отличник",
    description: "Записаться на 5 курсов",
    icon: GraduationCap,
    color: "amber",
    colorBg: "bg-amber-100",
    colorBorder: "border-amber-400",
    colorText: "text-amber-700",
    category: "learning",
    categoryLabel: "Обучение",
    check: (d) => ({
      status:
        d.enrollmentsCount >= 5
          ? "earned"
          : d.enrollmentsCount >= 1
            ? "in_progress"
            : "locked",
      current: Math.min(d.enrollmentsCount, 5),
      target: 5,
    }),
  },
  {
    id: "multitalented",
    title: "На все руки",
    description: "Записаться на курсы из 3+ разных категорий",
    icon: Zap,
    color: "orange",
    colorBg: "bg-orange-100",
    colorBorder: "border-orange-400",
    colorText: "text-orange-700",
    category: "learning",
    categoryLabel: "Обучение",
    check: (d) => ({
      status:
        d.uniqueCategories >= 3
          ? "earned"
          : d.uniqueCategories >= 1
            ? "in_progress"
            : "locked",
      current: Math.min(d.uniqueCategories, 3),
      target: 3,
    }),
  },
  // Прогресс (Progress)
  {
    id: "start",
    title: "Начало положено",
    description: "Завершить первый шаг",
    icon: Play,
    color: "blue",
    colorBg: "bg-blue-100",
    colorBorder: "border-blue-400",
    colorText: "text-blue-700",
    category: "progress",
    categoryLabel: "Прогресс",
    check: (d) => ({
      status:
        d.completedLessonsCount >= 1
          ? "earned"
          : d.anyProgress
            ? "in_progress"
            : "locked",
      current: Math.min(d.completedLessonsCount, 1),
      target: 1,
    }),
  },
  {
    id: "halfway",
    title: "На полпути",
    description: "Достичь 50% прогресса в любом курсе",
    icon: TrendingUp,
    color: "violet",
    colorBg: "bg-violet-100",
    colorBorder: "border-violet-400",
    colorText: "text-violet-700",
    category: "progress",
    categoryLabel: "Прогресс",
    check: (d) => ({
      status: d.has50Progress ? "earned" : d.anyProgress ? "in_progress" : "locked",
      current: d.has50Progress ? 1 : d.anyProgress ? 0 : 0,
      target: 1,
    }),
  },
  {
    id: "finish-line",
    title: "Финишная прямая",
    description: "Завершить курс на 100%",
    icon: Trophy,
    color: "amber",
    colorBg: "bg-amber-100",
    colorBorder: "border-amber-400",
    colorText: "text-amber-700",
    category: "progress",
    categoryLabel: "Прогресс",
    check: (d) => ({
      status:
        d.completedCoursesCount >= 1
          ? "earned"
          : d.anyProgress
            ? "in_progress"
            : "locked",
      current: Math.min(d.completedCoursesCount, 1),
      target: 1,
    }),
  },
  {
    id: "marathoner",
    title: "Марафонец",
    description: "Завершить 3 курса",
    icon: Flame,
    color: "orange",
    colorBg: "bg-orange-100",
    colorBorder: "border-orange-400",
    colorText: "text-orange-700",
    category: "progress",
    categoryLabel: "Прогресс",
    check: (d) => ({
      status:
        d.completedCoursesCount >= 3
          ? "earned"
          : d.completedCoursesCount >= 1
            ? "in_progress"
            : "locked",
      current: Math.min(d.completedCoursesCount, 3),
      target: 3,
    }),
  },
  // Активность (Activity)
  {
    id: "newcomer",
    title: "Новичок",
    description: "Зарегистрироваться на платформе",
    icon: UserPlus,
    color: "blue",
    colorBg: "bg-blue-100",
    colorBorder: "border-blue-400",
    colorText: "text-blue-700",
    category: "activity",
    categoryLabel: "Активность",
    check: (d) => ({
      status: d.isRegistered ? "earned" : "locked",
      current: d.isRegistered ? 1 : 0,
      target: 1,
    }),
  },
  {
    id: "commentator",
    title: "Комментатор",
    description: "Оставить 3 отзыва",
    icon: MessageSquare,
    color: "violet",
    colorBg: "bg-violet-100",
    colorBorder: "border-violet-400",
    colorText: "text-violet-700",
    category: "activity",
    categoryLabel: "Активность",
    check: (d) => ({
      status:
        d.reviewsCount >= 3
          ? "earned"
          : d.reviewsCount >= 1
            ? "in_progress"
            : "locked",
      current: Math.min(d.reviewsCount, 3),
      target: 3,
    }),
  },
  {
    id: "coder",
    title: "Кодер",
    description: "Пройти практическое задание",
    icon: Code2,
    color: "amber",
    colorBg: "bg-amber-100",
    colorBorder: "border-amber-400",
    colorText: "text-amber-700",
    category: "activity",
    categoryLabel: "Активность",
    check: (d) => ({
      status:
        d.codingAssignments >= 1
          ? "earned"
          : d.anyProgress
            ? "in_progress"
            : "locked",
      current: Math.min(d.codingAssignments, 1),
      target: 1,
    }),
  },
  {
    id: "code-master",
    title: "Мастер кода",
    description: "Пройти 10 практических заданий",
    icon: Terminal,
    color: "orange",
    colorBg: "bg-orange-100",
    colorBorder: "border-orange-400",
    colorText: "text-orange-700",
    category: "activity",
    categoryLabel: "Активность",
    check: (d) => ({
      status:
        d.codingAssignments >= 10
          ? "earned"
          : d.codingAssignments >= 1
            ? "in_progress"
            : "locked",
      current: Math.min(d.codingAssignments, 10),
      target: 10,
    }),
  },
  // Особые (Special)
  {
    id: "pioneer",
    title: "Первооткрыватель",
    description: "Быть в числе первых 100 пользователей",
    icon: Star,
    color: "amber",
    colorBg: "bg-amber-100",
    colorBorder: "border-amber-400",
    colorText: "text-amber-700",
    category: "special",
    categoryLabel: "Особые",
    check: (d) => ({
      status: d.userRegistrationOrder <= 100 ? "earned" : "locked",
      current: d.userRegistrationOrder <= 100 ? 1 : 0,
      target: 1,
    }),
  },
  {
    id: "leader",
    title: "Лидер",
    description: "Получить роль преподавателя или администратора",
    icon: Crown,
    color: "violet",
    colorBg: "bg-violet-100",
    colorBorder: "border-violet-400",
    colorText: "text-violet-700",
    category: "special",
    categoryLabel: "Особые",
    check: (d) => ({
      status: d.isTeacherOrAdmin ? "earned" : "locked",
      current: d.isTeacherOrAdmin ? 1 : 0,
      target: 1,
    }),
  },
];

// ============ COMPONENT ============

export function AchievementsPage() {
  const { user, navigate } = useAppStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [achievementData, setAchievementData] = useState<AchievementData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        // Fetch user profile + enrollments
        const userRes = await fetch("/api/user");
        if (userRes.ok) {
          const userData = await userRes.json();
          setProfile(userData.user);
          setEnrollments(userData.enrollments || []);
        }

        // Fetch supplementary achievement data
        const achRes = await fetch("/api/achievements");
        if (achRes.ok) {
          const achData = await achRes.json();
          setAchievementData(achData);
        }
      } catch (e) {
        console.error("Ошибка загрузки данных достижений:", e);
        toast.error("Не удалось загрузить достижения");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Build check data from profile + enrollments + achievement data
  const checkData: AchievementCheckData = useMemo(() => {
    const enrollmentsCount = enrollments.length;
    const uniqueCategories = new Set(
      enrollments.map((e) => e.course.categoryId).filter(Boolean)
    ).size;
    const completedCoursesCount = enrollments.filter(
      (e) => e.status === "completed" || e.progress >= 100
    ).length;
    const has50Progress = enrollments.some((e) => e.progress >= 50);
    const anyProgress =
      enrollments.some((e) => e.progress > 0) ||
      (achievementData?.completedLessonsCount ?? 0) > 0;

    return {
      enrollmentsCount,
      uniqueCategories,
      completedLessonsCount: achievementData?.completedLessonsCount ?? 0,
      has50Progress,
      completedCoursesCount,
      reviewsCount: profile?._count?.reviews ?? 0,
      codingAssignments: achievementData?.completedCodingAssignments ?? 0,
      userRegistrationOrder: achievementData?.userRegistrationOrder ?? 999,
      totalUsers: achievementData?.totalUsers ?? 0,
      isTeacherOrAdmin:
        profile?.role === "teacher" || profile?.role === "admin",
      isRegistered: !!user,
      anyProgress,
    };
  }, [profile, enrollments, achievementData, user]);

  // Compute all achievement results
  const achievementResults = useMemo(() => {
    return achievements.map((ach) => {
      const result = ach.check(checkData);
      return { ...ach, ...result };
    });
  }, [checkData]);

  // Summary stats
  const totalAchievements = achievements.length;
  const earnedCount = achievementResults.filter(
    (a) => a.status === "earned"
  ).length;
  const overallProgress = Math.round((earnedCount / totalAchievements) * 100);

  // Category stats
  const categories = useMemo(() => {
    const cats = [
      { key: "learning", label: "Обучение", icon: BookOpen, color: "text-blue-700" },
      { key: "progress", label: "Прогресс", icon: TrendingUp, color: "text-violet-600" },
      { key: "activity", label: "Активность", icon: Flame, color: "text-amber-600" },
      { key: "special", label: "Особые", icon: Star, color: "text-orange-600" },
    ];
    return cats.map((cat) => {
      const catAchievements = achievementResults.filter(
        (a) => a.category === cat.key
      );
      const catEarned = catAchievements.filter(
        (a) => a.status === "earned"
      ).length;
      return {
        ...cat,
        earned: catEarned,
        total: catAchievements.length,
        progress:
          catAchievements.length > 0
            ? Math.round((catEarned / catAchievements.length) * 100)
            : 0,
      };
    });
  }, [achievementResults]);

  // Not logged in
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-violet-600 rounded-full flex items-center justify-center text-white mx-auto mb-6">
            <Award className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Достижения</h2>
          <p className="text-muted-foreground mb-6">
            Войдите в аккаунт, чтобы отслеживать свои достижения и прогресс на
            платформе Maestria
          </p>
          <Button
            className="bg-blue-700 hover:bg-blue-800 text-white"
            onClick={() => (window.location.hash = "login")}
          >
            Войти в аккаунт
          </Button>
        </div>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-40 bg-gray-200 rounded-xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-44 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-700 to-violet-600 rounded-lg flex items-center justify-center">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Достижения</h1>
            <p className="text-muted-foreground text-sm">
              Отслеживайте свой прогресс на платформе Maestria
            </p>
          </div>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="border-0 shadow-sm mb-6 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-700 via-violet-600 to-amber-500 p-[1px]">
          <div className="bg-white rounded-lg">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                {/* Main stat */}
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative w-20 h-20 flex-shrink-0">
                    <svg
                      className="w-20 h-20 -rotate-90"
                      viewBox="0 0 80 80"
                    >
                      <circle
                        cx="40"
                        cy="40"
                        r="34"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="6"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r="34"
                        fill="none"
                        stroke="url(#progressGradient)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 34}`}
                        strokeDashoffset={`${2 * Math.PI * 34 * (1 - overallProgress / 100)}`}
                        className="transition-all duration-1000"
                      />
                      <defs>
                        <linearGradient
                          id="progressGradient"
                          x1="0%"
                          y1="0%"
                          x2="100%"
                          y2="0%"
                        >
                          <stop offset="0%" stopColor="#1d4ed8" />
                          <stop offset="50%" stopColor="#7c3aed" />
                          <stop offset="100%" stopColor="#f59e0b" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-foreground">
                        {overallProgress}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">
                      {earnedCount} из {totalAchievements}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      достижений получено
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-medium text-amber-600">
                        {earnedCount > 0
                          ? "Продолжайте в том же духе!"
                          : "Начните обучение, чтобы получать достижения"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Category breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full md:w-auto">
                  {categories.map((cat) => (
                    <div
                      key={cat.key}
                      className="bg-gray-50 rounded-lg p-3 text-center min-w-[120px]"
                    >
                      <cat.icon className={`w-5 h-5 mx-auto mb-1 ${cat.color}`} />
                      <p className="text-sm font-semibold">
                        {cat.earned}/{cat.total}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {cat.label}
                      </p>
                      <Progress
                        value={cat.progress}
                        className="h-1.5 mt-2"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </div>
        </div>
      </Card>

      {/* Achievement Categories */}
      {[
        { key: "learning", label: "Обучение", icon: BookOpen, gradient: "from-blue-700 to-blue-800" },
        { key: "progress", label: "Прогресс", icon: TrendingUp, gradient: "from-violet-600 to-violet-700" },
        { key: "activity", label: "Активность", icon: Flame, gradient: "from-amber-500 to-amber-600" },
        { key: "special", label: "Особые", icon: Star, gradient: "from-orange-600 to-orange-700" },
      ].map((cat) => {
        const catAchievements = achievementResults.filter(
          (a) => a.category === cat.key
        );
        const catEarned = catAchievements.filter(
          (a) => a.status === "earned"
        ).length;

        return (
          <div key={cat.key} className="mb-8">
            {/* Category header */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-8 h-8 bg-gradient-to-br ${cat.gradient} rounded-lg flex items-center justify-center`}
              >
                <cat.icon className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-lg font-bold">{cat.label}</h2>
              <Badge
                variant="secondary"
                className="text-xs"
              >
                {catEarned}/{catAchievements.length}
              </Badge>
            </div>

            {/* Achievement cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {catAchievements.map((ach) => {
                const Icon = ach.icon;
                const isEarned = ach.status === "earned";
                const isInProgress = ach.status === "in_progress";
                const isLocked = ach.status === "locked";
                const progressPercent =
                  ach.target > 0
                    ? Math.round((ach.current / ach.target) * 100)
                    : 0;

                return (
                  <Card
                    key={ach.id}
                    className={`relative overflow-hidden transition-all duration-300 ${
                      isEarned
                        ? `border-2 ${ach.colorBorder} shadow-md`
                        : isInProgress
                          ? "border border-dashed border-gray-300 shadow-sm"
                          : "border-0 shadow-sm opacity-60"
                    }`}
                  >
                    {/* Earned glow effect */}
                    {isEarned && (
                      <div className="absolute top-0 right-0 w-20 h-20 opacity-10">
                        <div
                          className={`w-full h-full bg-gradient-to-bl ${
                            ach.color === "blue"
                              ? "from-blue-400"
                              : ach.color === "violet"
                                ? "from-violet-400"
                                : ach.color === "amber"
                                  ? "from-amber-400"
                                  : "from-orange-400"
                          } to-transparent`}
                        />
                      </div>
                    )}

                    <CardContent className="p-4">
                      {/* Icon + Badge */}
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            isEarned
                              ? ach.colorBg
                              : isInProgress
                                ? "bg-gray-100"
                                : "bg-gray-50"
                          }`}
                        >
                          {isLocked ? (
                            <Lock className="w-5 h-5 text-gray-400" />
                          ) : (
                            <Icon
                              className={`w-5 h-5 ${
                                isEarned
                                  ? ach.colorText
                                  : isInProgress
                                    ? "text-gray-500"
                                    : "text-gray-400"
                              }`}
                            />
                          )}
                        </div>
                        {isEarned ? (
                          <Badge className="bg-green-100 text-green-700 border-0 text-[10px] font-semibold">
                            <CheckIcon className="w-3 h-3 mr-0.5" />
                            Получено
                          </Badge>
                        ) : isInProgress ? (
                          <Badge className="bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-semibold">
                            В процессе
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-gray-400"
                          >
                            Недоступно
                          </Badge>
                        )}
                      </div>

                      {/* Title & Description */}
                      <h3
                        className={`font-semibold text-sm mb-1 ${
                          isLocked ? "text-gray-400" : "text-foreground"
                        }`}
                      >
                        {ach.title}
                      </h3>
                      <p
                        className={`text-xs mb-3 ${
                          isLocked
                            ? "text-gray-400"
                            : "text-muted-foreground"
                        }`}
                      >
                        {ach.description}
                      </p>

                      {/* Progress */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-medium ${
                              isEarned
                                ? ach.colorText
                                : "text-muted-foreground"
                            }`}
                          >
                            {ach.current}/{ach.target}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {progressPercent}%
                          </span>
                        </div>
                        <Progress
                          value={progressPercent}
                          className={`h-1.5 ${
                            isEarned
                              ? ""
                              : isInProgress
                                ? ""
                                : "opacity-40"
                          }`}
                        />
                      </div>

                      {/* Earned sparkle */}
                      {isEarned && (
                        <div className="absolute bottom-2 right-2">
                          <Sparkles className="w-4 h-4 text-amber-400" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Motivational footer */}
      <Card className="border-0 shadow-sm mt-4">
        <CardContent className="p-6 text-center">
          <Target className="w-8 h-8 text-violet-600 mx-auto mb-3" />
          <h3 className="font-semibold mb-1">
            {earnedCount === 0
              ? "Начните свой путь!"
              : earnedCount < 5
                ? "Хорошее начало!"
                : earnedCount < 10
                  ? "Впечатляющий прогресс!"
                  : "Вы настоящий мастер!"}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {earnedCount === 0
              ? "Запишитесь на первый курс, чтобы получить первое достижение"
              : `Вы уже получили ${earnedCount} из ${totalAchievements} достижений. ${
                  earnedCount < totalAchievements
                    ? "Продолжайте обучение, чтобы разблокировать новые!"
                    : "Вы собрали все достижения! Невероятно!"
                }`}
          </p>
          {earnedCount < totalAchievements && (
            <Button
              className="bg-blue-700 hover:bg-blue-800 text-white"
              onClick={() => navigate("catalog")}
            >
              Перейти к курсам
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Simple check icon inline component
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
