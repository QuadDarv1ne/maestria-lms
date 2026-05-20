"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
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

function formatTime(seconds: number, locale?: string): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const h = locale === "en" ? "h" : locale === "zh" ? "小时" : "ч";
  const m = locale === "en" ? "m" : locale === "zh" ? "分钟" : "м";
  if (hours > 0) return `${hours}${h} ${minutes}${m}`;
  return `${minutes}${m}`;
}

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

interface EnrollmentDetail extends Enrollment {
  totalLessons: number;
  completedLessons: number;
  totalTimeSpent: number;
  lastAccessed: string | null;
  avgScore: number | null;
}

interface Certificate {
  id: string;
  issuedAt: string;
  course: {
    id: string;
    title: string;
  };
}

interface CourseModuleData {
  lessons?: { id: string }[];
}
interface ProgressData {
  lessonId: string;
  completed: boolean;
  timeSpent?: number;
  score?: number | null;
  lastAccessed: string;
}

export function ProfilePage() {
  const { user, navigate, setUser, logout, favorites, toggleFavorite, isFavorite, locale } = useAppStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollmentDetails, setEnrollmentDetails] = useState<EnrollmentDetail[]>([]);
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
      navigate("login");
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

          // Fetch detailed enrollment stats using progress data
          if (data.enrollments?.length > 0 && data.progress) {
            // Build a map of lessonId -> courseId by fetching course details
            const courseLessonsMap: Record<string, string[]> = {};
            await Promise.all(
              data.enrollments.map(async (enrollment: Enrollment) => {
                try {
                  const courseRes = await fetch(`/api/courses/${enrollment.course.id}`);
                  if (courseRes.ok) {
                    const courseData = await courseRes.json();
                    const course = courseData.course || courseData;
                    const lessonIds = course.modules?.flatMap((mod: CourseModuleData) =>
                      mod.lessons?.map((l) => l.id) || []
                    ) || [];
                    courseLessonsMap[enrollment.course.id] = lessonIds;
                  }
                } catch { /* skip */ }
              })
            );

            const details = data.enrollments.map((enrollment: Enrollment) => {
              const courseLessonIds = courseLessonsMap[enrollment.course.id] || [];
              const courseProgress: ProgressData[] = data.progress.filter((p: ProgressData) =>
                courseLessonIds.includes(p.lessonId)
              );
              const completedLessons = courseProgress.filter((p: ProgressData) => p.completed).length;
              const totalTimeSpent = courseProgress.reduce((sum: number, p: ProgressData) => sum + (p.timeSpent || 0), 0);
              const scores = courseProgress.map((p: ProgressData) => p.score).filter((s): s is number => s != null);
              const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
              const lastAccessed = courseProgress.length > 0
                ? [...courseProgress].sort((a: ProgressData, b: ProgressData) =>
                    new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
                  )[0].lastAccessed
                : null;

              return {
                ...enrollment,
                totalLessons: courseLessonIds.length,
                completedLessons,
                totalTimeSpent,
                lastAccessed,
                avgScore,
              };
            });
            setEnrollmentDetails(details);
          }

          setError(null);
        } else {
          setError(t("profile.failedToLoad", locale));
        }
      } catch (e) {
        console.error("Ошибка загрузки профиля:", e);
        setError(t("profile.networkError", locale));
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user, locale, navigate]);

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
        toast.success(t("profile.profileUpdated", locale));
        setEditing(false);
      } else {
        const data = await res.json();
        toast.error(data.error || t("profile.updateError", locale));
      }
    } catch {
      toast.error(t("profile.updateError", locale));
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
          {t("profile.loginToAccessProfile", locale)}
        </h2>
        <Button
          className="bg-blue-700 hover:bg-blue-800 text-white mt-4"
          onClick={() => navigate("login")}
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
          <p className="text-muted-foreground mb-4">{t("profile.tryReload", locale)}</p>
          <Button
            className="bg-blue-700 hover:bg-blue-800 text-white"
            onClick={() => { setLoading(true); setError(null); window.location.reload(); }}
          >
            {t("profile.retryAttempt", locale)}
          </Button>
        </div>
      </div>
    );
  }

  const roleLabels: Record<string, string> = {
    admin: t("role.admin", locale),
    teacher: t("role.teacher", locale),
    student: t("role.student", locale),
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
                  {t("profile.since", locale)}{" "}
                  {profile?.createdAt
                    ? formatDate(profile.createdAt, locale)
                    : "..."}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
                <Edit3 className="w-4 h-4 mr-2" />
                {editing ? t("profile.cancel", locale) : t("profile.edit", locale)}
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
                label: t("profile.coursesCompleted", locale),
                value: completedCount,
                icon: <BookOpen className="w-5 h-5 text-blue-700" />,
              },
              {
                label: t("profile.reviews", locale),
                value: profile?._count?.reviews || 0,
                icon: <MessageSquare className="w-5 h-5 text-violet-600" />,
              },
              {
                label: t("profile.certificates", locale),
                value: profile?._count?.certificates || 0,
                icon: <Award className="w-5 h-5 text-amber-600" />,
              },
              {
                label: t("profile.coursesCreated", locale),
                value: profile?._count?.teacherCourses || 0,
                icon: <Settings className="w-5 h-5 text-orange-600" />,
              },
              {
                label: t("profile.avgProgress", locale),
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
            <h2 className="text-lg font-semibold mb-4">{t("profile.editProfile", locale)}</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">{t("profile.name", locale)}</Label>
                <Input
                  id="name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="bio">{t("profile.bio", locale)}</Label>
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
                <Label htmlFor="phone">{t("profile.phone", locale)}</Label>
                <Input
                  id="phone"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="image">{t("profile.avatarUrl", locale)}</Label>
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
                      {t("profile.saving", locale)}
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {t("profile.save", locale)}
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleCancelEdit} disabled={saving}>
                  {t("profile.cancel", locale)}
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
              {t("profile.enrollmentsProgress", locale)}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-700">{enrollments.length}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("profile.totalCoursesLabel", locale)}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-amber-600">{inProgressCount}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("profile.inProgress", locale)}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{completedCount}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("profile.completed", locale)}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-violet-600">{avgProgress}%</p>
                <p className="text-xs text-muted-foreground mt-1">{t("profile.avgProgress", locale)}</p>
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
            {t("profile.myCoursesTab", locale)}
          </TabsTrigger>
          <TabsTrigger value="bookmarks">
            <Bookmark className="w-4 h-4 mr-2" />
            {t("profile.bookmarksTab", locale)}
            {favorites.length > 0 && (
              <Badge className="ml-1.5 bg-blue-100 text-blue-700 border-0 text-[10px] h-5 min-w-5 px-1">
                {favorites.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="certificates">
            <Award className="w-4 h-4 mr-2" />
            {t("profile.certificatesTab", locale)}
          </TabsTrigger>
          <TabsTrigger value="achievements">
            <Trophy className="w-4 h-4 mr-2" />
            {t("profile.achievementsTab", locale)}
          </TabsTrigger>
          <TabsTrigger value="statistics">
            <Activity className="w-4 h-4 mr-2" />
            {t("profile.statisticsTab", locale)}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="enrollments" className="mt-4">
          {enrollments.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {t("profile.noCoursesYet", locale)}
              </h3>
              <p className="text-muted-foreground mb-4">
                {t("profile.startLearningNow", locale)}
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
                            {t(levelLabels[enrollment.course.level] || enrollment.course.level, locale)}
                          </Badge>
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>{t("profile.courseProgress", locale)}</span>
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
                                {t("profile.completed", locale)}
                              </Badge>
                            ) : (
                              <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px]">
                                <Clock className="w-3 h-3 mr-1" />
                                {t("profile.inProgress", locale)}
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
                {t("profile.noBookmarks", locale)}
              </h3>
              <p className="text-muted-foreground mb-4">
                {t("profile.saveCoursesForLater", locale)}
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
                          {isLoading ? t("profile.loading", locale) : title || t("profile.courseNotFound", locale)}
                        </h3>
                        <p className="text-xs text-muted-foreground">{t("profile.fromBookmarks", locale)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(courseId);
                          toast.success(t("profile.bookmarkRemoved", locale));
                        }}
                      >
                        {t("profile.removeBookmark", locale)}
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
                {t("profile.noCertificates", locale)}
              </h3>
              <p className="text-muted-foreground mb-4">
                {t("profile.completeCourseToGetCert", locale)}
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
                          Выдан {formatDate(cert.issuedAt, locale)}
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

        <TabsContent value="statistics" className="mt-4">
          {enrollmentDetails.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {t("profile.statsWillAppear", locale)}
              </h3>
              <p className="text-muted-foreground mb-4">
                {t("profile.startCoursesToSeeStats", locale)}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Overall Summary */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <h3 className="font-semibold flex items-center gap-2 mb-4">
                    <Activity className="w-5 h-5 text-blue-600" />
                    {t("profile.totalStats", locale)}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-muted/50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-blue-700">
                        {enrollmentDetails.reduce((s, e) => s + e.completedLessons, 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{t("profile.lessonsPassed", locale)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-amber-600">
                        {formatTime(enrollmentDetails.reduce((s, e) => s + e.totalTimeSpent, 0), locale)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{t("profile.totalTime", locale)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {enrollmentDetails.filter(e => e.avgScore !== null).length > 0
                          ? `${Math.round(
                              enrollmentDetails
                                .filter(e => e.avgScore !== null)
                                .reduce((s, e) => s + (e.avgScore || 0), 0) /
                              enrollmentDetails.filter(e => e.avgScore !== null).length
                            )}%`
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{t("profile.avgScore", locale)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-violet-600">
                        {enrollmentDetails.reduce((s, e) => s + e.totalLessons, 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{t("profile.totalLessons", locale)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Per-Course Stats */}
              {enrollmentDetails.map((detail) => {
                const colors = [
                  "bg-blue-500", "bg-violet-500", "bg-amber-500",
                  "bg-green-500", "bg-orange-500", "bg-red-500",
                ];
                const colorIndex = detail.course.title.length % colors.length;

                return (
                  <Card key={detail.id} className="border-0 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="font-semibold text-base">{detail.course.title}</h4>
                          <Badge
                            className={`mt-1 border-0 text-xs ${
                              detail.status === "completed"
                                ? "bg-green-100 text-green-700"
                                : detail.progress === 0
                                ? "bg-gray-100 text-gray-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {detail.status === "completed"
                              ? t("profile.completed", locale)
                              : detail.progress === 0
                              ? t("profile.notStarted", locale)
                              : t("profile.inProgress", locale)}
                          </Badge>
                        </div>
                        <span className="text-2xl font-bold">{detail.progress}%</span>
                      </div>

                      <div className="h-2 bg-muted rounded-full overflow-hidden mb-4">
                        <div
                          className={`h-full ${colors[colorIndex]} rounded-full transition-all duration-700`}
                          style={{ width: `${detail.progress}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-muted/50 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold">
                            {detail.completedLessons}/{detail.totalLessons}
                          </p>
                          <p className="text-xs text-muted-foreground">{t("profile.totalLessons", locale)}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold">
                            {formatTime(detail.totalTimeSpent, locale)}
                          </p>
                          <p className="text-xs text-muted-foreground">{t("profile.time", locale)}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold">
                            {detail.avgScore !== null ? `${detail.avgScore}%` : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">{t("profile.avgScore", locale)}</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold">
                            {detail.lastAccessed
                              ? formatDate(detail.lastAccessed, locale)
                              : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">{t("profile.lastActivity", locale)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
