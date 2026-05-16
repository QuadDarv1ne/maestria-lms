"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  User,
  BookOpen,
  Award,
  Settings,
  LogOut,
  Edit3,
  Save,
  Clock,
  CheckCircle2,
  Trophy,
  Flame,
  Bookmark,
  BookmarkCheck,
  Target,
  Activity,
} from "lucide-react";
import { toast } from "sonner";

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

// Генерация демо-данных для теплового графика (последние 16 недель)
function generateActivityData(): { date: string; count: number }[] {
  const data: { date: string; count: number }[] = [];
  const now = new Date();
  for (let i = 111; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    // Случайная активность: больше в будни, меньше в выходные
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const baseChance = isWeekend ? 0.3 : 0.6;
    const count = Math.random() < baseChance ? Math.floor(Math.random() * 5) + 1 : 0;
    data.push({ date: dateStr, count });
  }
  return data;
}

export function ProfilePage() {
  const { user, navigate, setUser, logout, favorites, toggleFavorite, isFavorite, locale } = useAppStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    bio: "",
    phone: "",
  });

  // Данные для теплового графика (демо)
  const activityData = useMemo(() => generateActivityData(), []);

  // Серия обучения (streak)
  const learningStreak = useMemo(() => {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const dayActivity = activityData.find((d) => d.date === dateStr);
      if (dayActivity && dayActivity.count > 0) {
        streak++;
      } else if (i > 0) {
        // Пропускаем сегодняшний день если ещё не было активности
        break;
      }
    }
    return streak;
  }, [activityData]);

  // Общая статистика
  const totalActivities = activityData.reduce((acc, d) => acc + d.count, 0);

  const levelLabels: Record<string, string> = {
    beginner: t("catalog.beginner", locale),
    intermediate: t("catalog.intermediate", locale),
    advanced: t("catalog.advanced", locale),
  };

  useEffect(() => {
    if (!user) {
      window.location.hash = "login";
      return;
    }
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/user");
        if (res.ok) {
          const data = await res.json();
          setProfile(data.user);
          setEnrollments(data.enrollments || []);
          setEditForm({
            name: data.user.name || "",
            bio: data.user.bio || "",
            phone: data.user.phone || "",
          });
        }
      } catch (e) {
        console.error("Ошибка загрузки профиля:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    try {
      const res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const data = await res.json();
        if (user) {
          setUser({
            ...user,
            name: data.user.name,
          });
        }
        setProfile((prev) =>
          prev ? { ...prev, ...data.user } : prev
        );
        toast.success("Профиль обновлён");
        setEditing(false);
      } else {
        const data = await res.json();
        toast.error(data.error || "Ошибка обновления");
      }
    } catch {
      toast.error("Ошибка обновления профиля");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      // ok
    }
    logout();
    navigate("home");
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold mb-2">
          Войдите в аккаунт для просмотра профиля
        </h2>
        <Button
          className="bg-blue-700 hover:bg-blue-800 text-white mt-4"
          onClick={() => (window.location.hash = "login")}
        >
          {t("nav.login", locale)}
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  const roleLabels: Record<string, string> = {
    admin: "Администратор",
    teacher: "Преподаватель",
    student: "Студент",
  };

  // Цвет для ячейки теплового графика
  const getActivityColor = (count: number): string => {
    if (count === 0) return "bg-muted/50";
    if (count <= 1) return "bg-green-200 dark:bg-green-900/60";
    if (count <= 2) return "bg-green-300 dark:bg-green-800/70";
    if (count <= 3) return "bg-green-400 dark:bg-green-700/80";
    return "bg-green-500 dark:bg-green-600";
  };

  // Месяцы для подписей
  const weekSize = 7;
  const totalWeeks = Math.ceil(activityData.length / weekSize);
  const monthLabels: { label: string; colSpan: number }[] = [];
  let currentMonth = -1;
  let spanCount = 0;

  activityData.forEach((d, _i) => {
    const month = new Date(d.date).getMonth();
    if (month !== currentMonth) {
      if (currentMonth !== -1) {
        monthLabels.push({ label: getMonthShort(currentMonth), colSpan: spanCount });
      }
      currentMonth = month;
      spanCount = 1;
    } else {
      spanCount++;
    }
  });
  if (currentMonth !== -1) {
    monthLabels.push({ label: getMonthShort(currentMonth), colSpan: spanCount });
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Заголовок профиля */}
      <Card className="border-0 shadow-sm mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-violet-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {user.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2) || "U"}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{profile?.name || user.name}</h1>
              <p className="text-muted-foreground">{profile?.email || user.email}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className="bg-violet-100 text-violet-700 border-0">
                  {roleLabels[profile?.role || user.role] || user.role}
                </Badge>
                {profile?.twoFactorEnabled && (
                  <Badge variant="outline" className="text-xs">
                    🔒 2FA
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  На платформе с{" "}
                  {profile?.createdAt
                    ? new Date(profile.createdAt).toLocaleDateString("ru-RU")
                    : "..."}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
                <Edit3 className="w-4 h-4 mr-2" />
                {editing ? "Отмена" : "Редактировать"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout} className="text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                {t("nav.logout", locale)}
              </Button>
            </div>
          </div>

          {/* Статистика */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            {[
              {
                label: "Курсов пройдено",
                value: profile?._count?.enrollments || 0,
                icon: <BookOpen className="w-5 h-5 text-blue-700" />,
              },
              {
                label: "Отзывов",
                value: profile?._count?.reviews || 0,
                icon: <User className="w-5 h-5 text-violet-600" />,
              },
              {
                label: "Сертификатов",
                value: profile?._count?.certificates || 0,
                icon: <Award className="w-5 h-5 text-amber-600" />,
              },
              {
                label: "Создано курсов",
                value: profile?._count?.teacherCourses || 0,
                icon: <Settings className="w-5 h-5 text-orange-600" />,
              },
              {
                label: "Серия обучения",
                value: `${learningStreak} дн.`,
                icon: <Flame className="w-5 h-5 text-red-500" />,
              },
            ].map((stat, i) => (
              <div key={i} className="bg-muted/50 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  {stat.icon}
                  <span className="text-xl font-bold">{stat.value}</span>
                </div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Редактирование профиля */}
      {editing && (
        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">Редактирование профиля</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Имя</Label>
                <Input
                  id="name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="bio">О себе</Label>
                <Textarea
                  id="bio"
                  value={editForm.bio}
                  onChange={(e) =>
                    setEditForm({ ...editForm, bio: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="phone">Телефон</Label>
                <Input
                  id="phone"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                />
              </div>
              <Button
                className="bg-blue-700 hover:bg-blue-800 text-white"
                onClick={handleSaveProfile}
              >
                <Save className="w-4 h-4 mr-2" />
                Сохранить
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Тепловой график активности */}
      <Card className="border-0 shadow-sm mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-600" />
                Активность обучения
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {totalActivities} активностей за последние 16 недель
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-semibold">{learningStreak} дней подряд</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <TooltipProvider delayDuration={200}>
              <div className="flex gap-[3px] min-w-[680px]">
                {Array.from({ length: totalWeeks }, (_, weekIdx) => (
                  <div key={weekIdx} className="flex flex-col gap-[3px]">
                    {Array.from({ length: weekSize }, (_, dayIdx) => {
                      const dataIdx = weekIdx * weekSize + dayIdx;
                      const dayData = activityData[dataIdx];
                      if (!dayData) return <div key={dayIdx} className="w-[12px] h-[12px]" />;
                      return (
                        <Tooltip key={dayIdx}>
                          <TooltipTrigger asChild>
                            <div
                              className={`w-[12px] h-[12px] rounded-[2px] ${getActivityColor(dayData.count)} transition-colors hover:ring-1 hover:ring-primary/30`}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <p className="font-medium">{dayData.date}</p>
                            <p className="text-muted-foreground">
                              {dayData.count > 0
                                ? `${dayData.count} ${dayData.count === 1 ? "активность" : "активностей"}`
                                : "Нет активности"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}
              </div>
            </TooltipProvider>
          </div>
          {/* Легенда */}
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <span>Меньше</span>
            <div className="w-[12px] h-[12px] rounded-[2px] bg-muted/50" />
            <div className="w-[12px] h-[12px] rounded-[2px] bg-green-200 dark:bg-green-900/60" />
            <div className="w-[12px] h-[12px] rounded-[2px] bg-green-300 dark:bg-green-800/70" />
            <div className="w-[12px] h-[12px] rounded-[2px] bg-green-400 dark:bg-green-700/80" />
            <div className="w-[12px] h-[12px] rounded-[2px] bg-green-500 dark:bg-green-600" />
            <span>Больше</span>
          </div>
        </CardContent>
      </Card>

      {/* Навыки */}
      <Card className="border-0 shadow-sm mb-6">
        <CardContent className="p-6">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-violet-600" />
            Навыки и компетенции
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: "Python", level: 72, color: "bg-blue-500" },
              { name: "Веб-разработка", level: 58, color: "bg-violet-500" },
              { name: "SQL / Базы данных", level: 45, color: "bg-amber-500" },
              { name: "Data Science", level: 30, color: "bg-green-500" },
              { name: "Linux / DevOps", level: 62, color: "bg-orange-500" },
              { name: "Алгоритмы", level: 40, color: "bg-red-500" },
            ].map((skill) => (
              <div key={skill.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium">{skill.name}</span>
                  <span className="text-muted-foreground">{skill.level}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${skill.color} rounded-full transition-all duration-700`}
                    style={{ width: `${skill.level}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Мои курсы / Закладки / Сертификаты / Достижения */}
      <Tabs defaultValue="enrollments">
        <TabsList>
          <TabsTrigger value="enrollments">
            <BookOpen className="w-4 h-4 mr-2" />
            Мои курсы
          </TabsTrigger>
          <TabsTrigger value="bookmarks">
            <Bookmark className="w-4 h-4 mr-2" />
            Закладки
            {favorites.length > 0 && (
              <Badge className="ml-1.5 bg-blue-100 text-blue-700 border-0 text-[10px] h-5 min-w-5 px-1">
                {favorites.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="certificates">
            <Award className="w-4 h-4 mr-2" />
            Сертификаты
          </TabsTrigger>
          <TabsTrigger value="achievements">
            <Trophy className="w-4 h-4 mr-2" />
            Достижения
          </TabsTrigger>
        </TabsList>

        <TabsContent value="enrollments" className="mt-4">
          {enrollments.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Вы ещё не записаны ни на один курс
              </h3>
              <p className="text-muted-foreground mb-4">
                Начните обучение прямо сейчас!
              </p>
              <Button
                className="bg-blue-700 hover:bg-blue-800 text-white"
                onClick={() => navigate("catalog")}
              >
                {t("nav.catalog", locale)}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enrollments.map((enrollment) => (
                <Card
                  key={enrollment.id}
                  className="cursor-pointer hover:shadow-md transition-shadow border-0 shadow-sm"
                  onClick={() => navigate(`course/${enrollment.course.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-violet-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">
                          {enrollment.course.title}
                        </h3>
                        <Badge
                          variant="outline"
                          className="text-[10px] mt-1"
                        >
                          {levelLabels[enrollment.course.level] || enrollment.course.level}
                        </Badge>
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>Прогресс</span>
                            <span>{enrollment.progress}%</span>
                          </div>
                          <Progress value={enrollment.progress} className="h-2" />
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {enrollment.status === "completed" ? (
                            <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Завершён
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px]">
                              <Clock className="w-3 h-3 mr-1" />
                              В процессе
                            </Badge>
                          )}
                          {/* Кнопка закладки */}
                          <button
                            className="ml-auto p-1 rounded hover:bg-muted transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(enrollment.course.id);
                            }}
                          >
                            {isFavorite(enrollment.course.id) ? (
                              <BookmarkCheck className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Bookmark className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="bookmarks" className="mt-4">
          {favorites.length === 0 ? (
            <div className="text-center py-12">
              <Bookmark className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Нет закладок
              </h3>
              <p className="text-muted-foreground mb-4">
                Сохраняйте интересные курсы, чтобы вернуться к ним позже
              </p>
              <Button
                className="bg-blue-700 hover:bg-blue-800 text-white"
                onClick={() => navigate("catalog")}
              >
                {t("nav.catalog", locale)}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {favorites.map((courseId) => (
                <Card
                  key={courseId}
                  className="cursor-pointer hover:shadow-md transition-shadow border-0 shadow-sm"
                  onClick={() => navigate(`course/${courseId}`)}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                      <BookmarkCheck className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">
                        Курс #{courseId.slice(0, 8)}
                      </h3>
                      <p className="text-xs text-muted-foreground">Из закладок</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(courseId);
                        toast.success("Закладка удалена");
                      }}
                    >
                      Убрать
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="certificates" className="mt-4">
          <div className="text-center py-12">
            <Award className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Сертификаты появятся после завершения курсов
            </h3>
          </div>
        </TabsContent>

        <TabsContent value="achievements" className="mt-4">
          <div className="text-center py-8">
            <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ваши достижения</h3>
            <p className="text-muted-foreground mb-4">
              Выполняйте задания, проходите курсы и получайте награды!
            </p>
            <Button
              className="bg-blue-700 hover:bg-blue-800 text-white"
              onClick={() => navigate("achievements")}
            >
              <Trophy className="w-4 h-4 mr-2" />
              Все достижения
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function getMonthShort(month: number): string {
  const months = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  return months[month] || "";
}

