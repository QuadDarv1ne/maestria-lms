"use client";

import React, { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Bookmark,
  BookmarkCheck,
  Target,
  MessageSquare,
  Loader2,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { AchievementsPage } from "@/components/AchievementsPage";

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
  };
}

interface Certificate {
  id: string;
  issuedAt: string;
  course: {
    id: string;
    title: string;
  };
}

export function ProfilePage() {
  const { user, navigate, setUser, logout, favorites, toggleFavorite, isFavorite, locale } = useAppStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    bio: "",
    phone: "",
    image: "",
  });

  // Course data for bookmarks (favorites stored as IDs need titles)
  const [bookmarkCourses, setBookmarkCourses] = useState<Record<string, string>>({});
  const [bookmarksLoading, setBookmarksLoading] = useState(false);

  useEffect(() => {
    if (favorites.length === 0) return;
    let cancelled = false;
    setBookmarksLoading(true);

    const fetchTitles = async () => {
      const titles: Record<string, string> = {};
      await Promise.all(
        favorites.map(async (courseId) => {
          try {
            const res = await fetch(`/api/courses/${courseId}`);
            if (res.ok) {
              const data = await res.json();
              titles[courseId] = data.course?.title || data.title || "";
            }
          } catch {
            // skip
          }
        })
      );
      if (!cancelled) {
        setBookmarkCourses(titles);
        setBookmarksLoading(false);
      }
    };
    fetchTitles();
    return () => { cancelled = true; };
  }, [favorites]);

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
          setCertificates(data.certificates || []);
          setEditForm({
            name: data.user.name || "",
            bio: data.user.bio || "",
            phone: data.user.phone || "",
            image: data.user.image || "",
          });
          setError(null);
        } else {
          setError("Не удалось загрузить профиль");
        }
      } catch (e) {
        console.error("Ошибка загрузки профиля:", e);
        setError("Ошибка сети. Проверьте подключение к интернету");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    setSaving(true);
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
            image: data.user.image,
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
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (profile) {
      setEditForm({
        name: profile.name || "",
        bio: profile.bio || "",
        phone: profile.phone || "",
        image: profile.image || "",
      });
    }
    setEditing(false);
  };

  const handleLogout = async () => {
    await signOut({ redirect: false });
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

  if (error) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">{error}</h2>
          <p className="text-muted-foreground mb-4">Попробуйте обновить страницу или войти заново</p>
          <Button
            className="bg-blue-700 hover:bg-blue-800 text-white"
            onClick={() => { setLoading(true); setError(null); window.location.reload(); }}
          >
            Повторить попытку
          </Button>
        </div>
      </div>
    );
  }

  const roleLabels: Record<string, string> = {
    admin: "Администратор",
    teacher: "Преподаватель",
    student: "Студент",
  };

  // Derived stats from real enrollment data
  const completedCount = enrollments.filter((e) => e.status === "completed").length;
  const inProgressCount = enrollments.filter((e) => e.status === "active" && e.progress > 0 && e.progress < 100).length;
  const avgProgress = enrollments.length > 0
    ? Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length)
    : 0;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Profile Header */}
      <Card className="border-0 shadow-sm mb-6">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <Avatar className="w-20 h-20">
              <AvatarImage src={profile?.image || user?.image || ""} alt={profile?.name || user?.name || ""} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-600 text-white text-2xl font-bold">
                {(profile?.name || user?.name)
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{profile?.name || user.name}</h1>
              <p className="text-muted-foreground">{profile?.email || user.email}</p>
              {profile?.bio && (
                <p className="text-sm text-muted-foreground mt-1 max-w-lg">{profile.bio}</p>
              )}
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
                    ? new Date(profile.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
                    : "..."}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
                <Edit3 className="w-4 h-4 mr-2" />
                {editing ? "Отмена" : "Редактировать"}
              </Button>
              <Button variant="destructive" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                {t("nav.logout", locale)}
              </Button>
            </div>
          </div>

          {/* Stats */}
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
                icon: <MessageSquare className="w-5 h-5 text-violet-600" />,
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
                label: "Средний прогресс",
                value: `${avgProgress}%`,
                icon: <Target className="w-5 h-5 text-green-600" />,
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

      {/* Edit Profile Form */}
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
              <div>
                <Label htmlFor="image">URL аватара</Label>
                <Input
                  id="image"
                  value={editForm.image}
                  onChange={(e) =>
                    setEditForm({ ...editForm, image: e.target.value })
                  }
                  placeholder="https://example.com/avatar.jpg"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="bg-blue-700 hover:bg-blue-800 text-white"
                  onClick={handleSaveProfile}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Сохранить
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleCancelEdit} disabled={saving}>
                  Отмена
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Summary (replaces fake heatmap) */}
      {enrollments.length > 0 && (
        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-blue-600" />
              Прогресс обучения
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{enrollments.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Всего курсов</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-amber-600">{inProgressCount}</p>
                <p className="text-xs text-muted-foreground mt-1">В процессе</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{completedCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Завершено</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-violet-600">{avgProgress}%</p>
                <p className="text-xs text-muted-foreground mt-1">Средний прогресс</p>
              </div>
            </div>
            {/* Course progress bars */}
            <div className="space-y-3">
              {enrollments
                .filter((e) => e.progress > 0)
                .slice(0, 6)
                .map((enrollment) => {
                  const colors = [
                    "bg-blue-500", "bg-violet-500", "bg-amber-500",
                    "bg-green-500", "bg-orange-500", "bg-red-500",
                  ];
                  const colorIndex = enrollment.course.title.length % colors.length;
                  return (
                    <div key={enrollment.id}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium truncate">{enrollment.course.title}</span>
                        <span className="text-muted-foreground ml-2">{enrollment.progress}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${colors[colorIndex]} rounded-full transition-all duration-700`}
                          style={{ width: `${enrollment.progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Old Skills card removed — replaced by progress summary above */}

      {/* Tabs: My Courses / Bookmarks / Certificates / Achievements */}
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
              {enrollments.map((enrollment) => {
                const isCompleted = enrollment.status === "completed";
                const progressColor = isCompleted
                  ? "bg-green-500"
                  : enrollment.progress > 50
                    ? "bg-blue-500"
                    : enrollment.progress > 0
                      ? "bg-amber-500"
                      : "bg-gray-300";

                return (
                  <Card
                    key={enrollment.id}
                    className="cursor-pointer hover:shadow-md transition-shadow border-0 shadow-sm"
                    onClick={() => navigate(`course/${enrollment.course.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white flex-shrink-0 ${isCompleted ? "bg-gradient-to-br from-green-500 to-emerald-600" : "bg-gradient-to-br from-blue-500 to-violet-600"}`}>
                          {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate">
                            {enrollment.course.title}
                          </h3>
                          <Badge variant="outline" className="text-[10px] mt-1">
                            {levelLabels[enrollment.course.level] || enrollment.course.level}
                          </Badge>
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>Прогресс</span>
                              <span className={isCompleted ? "text-green-600 font-medium" : ""}>{enrollment.progress}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                                style={{ width: `${enrollment.progress}%` }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {isCompleted ? (
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
                );
              })}
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
          ) : bookmarksLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {favorites.map((courseId) => (
                <Card key={courseId} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="animate-pulse flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {favorites.map((courseId) => {
                const title = bookmarkCourses[courseId];
                const isLoading = bookmarksLoading && !title;
                return (
                  <Card
                    key={courseId}
                    className="cursor-pointer hover:shadow-md transition-shadow border-0 shadow-sm"
                    onClick={() => !isLoading && navigate(`course/${courseId}`)}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                        <BookmarkCheck className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">
                          {isLoading ? "Загрузка..." : title || "Курс не найден"}
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
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="certificates" className="mt-4">
          {certificates.length === 0 ? (
            <div className="text-center py-12">
              <Award className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Сертификаты появятся после завершения курсов
              </h3>
              <p className="text-muted-foreground mb-4">
                Пройдите курс до конца, чтобы получить сертификат
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
              {certificates.map((cert) => (
                <Card
                  key={cert.id}
                  className="border-0 shadow-sm hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                        <Award className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">
                          {cert.course.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          Выдан {new Date(cert.issuedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="achievements" className="mt-4">
          <AchievementsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
