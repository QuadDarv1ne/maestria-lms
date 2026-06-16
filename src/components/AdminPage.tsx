"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield, Users, BookOpen, Plus, Flag, Settings, Clock, RefreshCw,
  ChevronLeft, ChevronRight, LayoutDashboard, ClipboardCheck,
  FileText, Wallet, LogOut, Menu,
} from "lucide-react";
import { toast } from "sonner";
import {
  demoReports,
} from "@/data/demo-data";
import type { ReportItem } from "@/data/demo-data";
import { useAdminCourses, useAdminUsers, useUpdateUserRole, useToggleUserStatus } from "@/hooks/useAdmin";
import { useQueryClient } from "@tanstack/react-query";
import type { UserRole } from "@/hooks/useAdmin";
import { AdminSkeleton } from "@/components/skeletons/AdminSkeleton";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { AdminTests } from "@/components/admin/AdminTests";
import { AdminMaterials } from "@/components/admin/AdminMaterials";
import { AdminFinance } from "@/components/admin/AdminFinance";
import { AdminCourses } from "@/components/admin/AdminCourses";
import { AdminReports } from "@/components/admin/AdminReports";
import { AdminLogs } from "@/components/admin/AdminLogs";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { getInitials } from "@/lib/utils";

type AdminTab = "dashboard" | "users" | "tests" | "materials" | "finance" | "courses" | "reports" | "logs" | "settings";

export function AdminPage() {
  const user = useAppStore((s) => s.user);
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const monthLabels = useMemo(() => [
    t("common.monthJan", locale), t("common.monthFeb", locale), t("common.monthMar", locale),
    t("common.monthApr", locale), t("common.monthMay", locale), t("common.monthJun", locale),
    t("common.monthJul", locale), t("common.monthAug", locale), t("common.monthSep", locale),
    t("common.monthOct", locale), t("common.monthNov", locale), t("common.monthDec", locale),
  ], [locale]);
  const dayLabels = useMemo(() => [
    t("common.dayMon", locale), t("common.dayTue", locale), t("common.dayWed", locale),
    t("common.dayThu", locale), t("common.dayFri", locale), t("common.daySat", locale),
    t("common.daySun", locale),
  ], [locale]);
  const queryClient = useQueryClient();
  const [reports] = useState<ReportItem[]>(demoReports);
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userPage, setUserPage] = useState(1);
  const userPageSize = 20;

  useEffect(() => {
    if (!user || user.role !== "admin") {
      toast.error(t("adminPage.roleUpdateError", locale));
      router.replace("/");
    }
  }, [user, router, locale]);

  const handleUserSearch = (value: string) => { setUserSearch(value); setUserPage(1); };
  const handleRoleFilter = (value: string) => { setUserRoleFilter(value); setUserPage(1); };

  const { data: coursesData, isLoading: coursesLoading } = useAdminCourses();
  const { data: usersData, isLoading: usersLoading } = useAdminUsers();
  const updateRole = useUpdateUserRole();
  const toggleStatus = useToggleUserStatus();

  const loading = coursesLoading || usersLoading;
  const courses = useMemo(() => coursesData?.courses ?? [], [coursesData?.courses]);
  const users = useMemo(() => usersData?.users ?? [], [usersData?.users]);

  const handleUserRoleChange = async (userId: string, role: UserRole) => {
    try {
      await updateRole.mutateAsync({ userId, role });
      toast.success(t("adminPage.roleUpdated", locale));
    } catch {
      toast.error(t("adminPage.roleUpdateError", locale));
    }
  };

  const handleUserStatusChange = async (userId: string, isActive: boolean) => {
    try {
      await toggleStatus.mutateAsync({ userId, isActive });
      toast.success(t(isActive ? "adminPage.userUnblocked" : "adminPage.userBlocked", locale));
    } catch {
      toast.error(t("adminPage.statusUpdateError", locale));
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin"] });
    toast.success(t("adminPage.dataUpdated", locale));
  };

  const totalStudents = useMemo(() => users.filter((u) => u.role === "student").length, [users]);
  const totalTeachers = useMemo(() => users.filter((u) => u.role === "teacher").length, [users]);
  const totalEnrollments = useMemo(() => courses.reduce((acc, c) => acc + c._count.enrollments, 0), [courses]);
  const avgRating = useMemo(() => courses.length > 0 ? (courses.reduce((a, c) => a + c.rating, 0) / courses.length).toFixed(1) : "0", [courses]);
  const totalRevenue = useMemo(() => courses.reduce((a, c) => a + c.price * c._count.enrollments, 0), [courses]);
  const pendingReports = useMemo(() => reports.filter((r) => r.status === "pending").length, [reports]);
  const activeUsers = useMemo(() => users.filter((u) => u.isActive).length, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !userSearch ||
        (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase())) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase());
      const matchesRole = userRoleFilter === "all" || u.role === userRoleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, userSearch, userRoleFilter]);

  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * userPageSize;
    return filteredUsers.slice(start, start + userPageSize);
  }, [filteredUsers, userPage]);

  const totalUserPages = Math.ceil(filteredUsers.length / userPageSize);

  if (!user || user.role !== "admin") return null;

  if (loading) {
    return <AdminSkeleton />;
  }

  const tabProps = {
    locale,
    courses,
    users,
    monthLabels,
    dayLabels,
    totalStudents,
    totalTeachers,
    totalEnrollments,
    avgRating,
    totalRevenue,
    pendingReports,
    activeUsers,
    userSearch,
    userRoleFilter,
    userPage,
    userPageSize,
    filteredUsers,
    totalUserPages,
    paginatedUsers,
    reports,
    handleUserSearch,
    handleRoleFilter,
    handleUserRoleChange,
    handleUserStatusChange,
    setUserPage,
  };

  const sidebarItems: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "dashboard", label: t("adminPage.tabDashboard", locale), icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: "users", label: t("adminPage.tabUsers", locale), icon: <Users className="w-5 h-5" />, badge: users.length },
    { id: "tests", label: t("adminPage.tabTests", locale), icon: <ClipboardCheck className="w-5 h-5" /> },
    { id: "materials", label: t("adminPage.tabMaterials", locale), icon: <FileText className="w-5 h-5" /> },
    { id: "finance", label: t("adminPage.tabFinance", locale), icon: <Wallet className="w-5 h-5" /> },
    { id: "courses", label: t("adminPage.tabCourses", locale), icon: <BookOpen className="w-5 h-5" />, badge: courses.length },
    { id: "reports", label: t("adminPage.tabReports", locale), icon: <Flag className="w-5 h-5" />, badge: pendingReports },
    { id: "logs", label: t("adminPage.tabLogs", locale), icon: <Clock className="w-5 h-5" /> },
    { id: "settings", label: t("adminPage.tabSettings", locale), icon: <Settings className="w-5 h-5" /> },
  ];

  const renderSidebar = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-700 to-violet-600 rounded-lg flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <h2 className="text-sm font-bold text-sidebar-foreground truncate">Maestria Admin</h2>
              <p className="text-[10px] text-sidebar-foreground/60 truncate">{t("adminPage.controlPanel", locale)}</p>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {sidebarItems.map((item) => (
          <button
            key={item.id}
            onClick={() => { setActiveTab(item.id); setMobileSidebarOpen(false); }}
            aria-label={item.label}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              activeTab === item.id
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            } ${sidebarCollapsed ? "justify-center" : ""}`}
          >
            {item.icon}
            {!sidebarCollapsed && (
              <>
                <span className="flex-1 text-left truncate">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge className="bg-primary/10 text-primary border-0 text-[10px] h-5 min-w-5 px-1.5">
                    {item.badge}
                  </Badge>
                )}
              </>
            )}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-2">
        {!sidebarCollapsed && (
          <div className="px-3 py-2 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-violet-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                {getInitials(user?.name, "AD")}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-medium truncate">{user?.name || "Admin"}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => router.push("/")}
          aria-label={t("adminPage.exitPanel", locale)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors ${sidebarCollapsed ? "justify-center" : ""}`}
        >
          <LogOut className="w-4 h-4" />
          {!sidebarCollapsed && <span>{t("adminPage.exitPanel", locale)}</span>}
        </button>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard": return <AdminDashboard {...tabProps} />;
      case "users": return <AdminUsers {...tabProps} />;
      case "tests": return <AdminTests {...tabProps} />;
      case "materials": return <AdminMaterials {...tabProps} />;
      case "finance": return <AdminFinance {...tabProps} />;
      case "courses": return <AdminCourses {...tabProps} />;
      case "reports": return <AdminReports {...tabProps} />;
      case "logs": return <AdminLogs {...tabProps} />;
      case "settings": return <AdminSettings {...tabProps} />;
      default: return null;
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)]">
      <aside
        aria-label="Admin sidebar"
        className={`hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 shrink-0 relative ${
          sidebarCollapsed ? "w-[68px]" : "w-[260px]"
        }`}
      >
        {renderSidebar()}
        <button
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!sidebarCollapsed}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute top-1/2 -translate-y-1/2 z-10 w-5 h-10 bg-sidebar-accent border border-sidebar-border rounded-r-md flex items-center justify-center hover:bg-sidebar-accent/80 transition-colors -right-[10px]"
        >
          {sidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
          <aside aria-label="Admin sidebar" className="absolute left-0 top-0 bottom-0 w-[260px] bg-sidebar border-r border-sidebar-border">
            {renderSidebar()}
          </aside>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" aria-label={t("adminPage.openMenu", locale)} className="lg:hidden" onClick={() => setMobileSidebarOpen(true)}>
                <Menu className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold">
                  {sidebarItems.find(s => s.id === activeTab)?.label || t("adminPage.tabDashboard", locale)}
                </h1>
                <p className="text-xs text-muted-foreground">{t("adminPage.managingMaestria", locale)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                {t("admin.refresh", locale)}
              </Button>
              <Button
                className="bg-blue-700 hover:bg-blue-800 text-white"
                size="sm"
                onClick={() => router.push("/course-editor")}
              >
                <Plus className="w-4 h-4 mr-1.5" />{t("admin.createCourse", locale)}
              </Button>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}
