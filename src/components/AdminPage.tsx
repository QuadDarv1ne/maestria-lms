"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  Users,
  BookOpen,
  BarChart3,
  Eye,
  Plus,
  Flag,
  TrendingUp,
  Settings,
  CheckCircle2,
  XCircle,
  DollarSign,
  Clock,
  Globe,
  Monitor,
  Activity,
  Server,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  ClipboardCheck,
  FileText,
  Wallet,
  LogOut,
  Menu,
  AlertTriangle,
  GraduationCap,
  Award,
  Timer,
  BookCheck,
  PieChart,
  UserCheck,
  UserX,
  Gift,
} from "lucide-react";
import { toast } from "sonner";
import { activityIcon, ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_COLORS } from "@/lib/constants";
import {
  demoReports,
  demoActivityLog,
  monthLabels,
  demoMonthlyRegistrations,
  demoMonthlyRevenue,
  demoMonthlyEnrollments,
  dayLabels,
  demoTestCompletions,
  demoTestPassRate,
  demoReadingSessions,
  demoAvgReadingTime,
  demoCategoryDistribution,
  demoTestResults,
  demoMaterialProgress,
} from "@/data/demo-data";
import type { ReportItem } from "@/data/demo-data";

// ═══════════════════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════════════════

interface AdminCourse {
  id: string;
  title: string;
  isPublished: boolean;
  price: number;
  rating: number;
  teacher: { name: string | null };
  category: { name: string } | null;
  _count: { enrollments: number; reviews: number; modules: number };
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  _count: { enrollments: number; teacherCourses: number; reviews: number };
}

type AdminTab = "dashboard" | "users" | "tests" | "materials" | "finance" | "courses" | "reports" | "logs" | "settings";

// ═══════════════════════════════════════════════════════════════════════════
// SVG КОМПОНЕНТЫ ГРАФИКОВ
// ═══════════════════════════════════════════════════════════════════════════

/** Линейный / Area график */
function LineChart({
  data,
  labels,
  color = "#4f46e5",
  fillOpacity = 0.1,
  height = 200,
  showDots = true,
  strokeWidth = 2.5,
}: {
  data: number[];
  labels: string[];
  color?: string;
  fillOpacity?: number;
  height?: number;
  showDots?: boolean;
  strokeWidth?: number;
}) {
  const width = 100;
  const padding = { top: 10, right: 5, bottom: 25, left: 5 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = Math.max(...data, 1);
  const minVal = Math.min(...data, 0);
  const range = maxVal - minVal || 1;

  const points = data.map((val, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - ((val - minVal) / range) * chartH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${padding.top + chartH} L${points[0].x},${padding.top + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {/* Горизонтальные линии сетки */}
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line
          key={ratio}
          x1={padding.left}
          y1={padding.top + chartH * (1 - ratio)}
          x2={width - padding.right}
          y2={padding.top + chartH * (1 - ratio)}
          stroke="currentColor"
          strokeOpacity={0.06}
          strokeWidth={0.5}
        />
      ))}

      {/* Заливка (area) */}
      <path d={areaPath} fill={color} fillOpacity={fillOpacity} />

      {/* Линия */}
      <path d={linePath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />

      {/* Точки */}
      {showDots && points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} stroke="white" strokeWidth={1.5} />
      ))}

      {/* Подписи осей */}
      {labels.map((label, i) => {
        const x = padding.left + (i / (labels.length - 1)) * chartW;
        return (
          <text key={i} x={x} y={height - 3} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 7 }}>
            {label}
          </text>
        );
      })}
    </svg>
  );
}

/** Столбчатый график */
function BarChart({
  data,
  labels,
  color = "#4f46e5",
  height = 200,
  showValues = true,
}: {
  data: number[];
  labels: string[];
  color?: string;
  height?: number;
  showValues?: boolean;
}) {
  const width = 100;
  const padding = { top: 15, right: 5, bottom: 25, left: 5 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = Math.max(...data, 1);
  const barWidth = (chartW / data.length) * 0.65;
  const gap = (chartW / data.length) * 0.35;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {/* Горизонтальные линии сетки */}
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <line
          key={ratio}
          x1={padding.left}
          y1={padding.top + chartH * (1 - ratio)}
          x2={width - padding.right}
          y2={padding.top + chartH * (1 - ratio)}
          stroke="currentColor"
          strokeOpacity={0.06}
          strokeWidth={0.5}
        />
      ))}

      {/* Столбцы */}
      {data.map((val, i) => {
        const barH = (val / maxVal) * chartH;
        const x = padding.left + (i / data.length) * chartW + gap / 2;
        const y = padding.top + chartH - barH;

        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              rx={1.5}
              fill={color}
              opacity={0.85}
              className="transition-opacity hover:opacity-100"
            />
            {showValues && (
              <text x={x + barWidth / 2} y={y - 3} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 6.5 }}>
                {val}
              </text>
            )}
          </g>
        );
      })}

      {/* Подписи */}
      {labels.map((label, i) => {
        const x = padding.left + (i / labels.length) * chartW + gap / 2 + barWidth / 2;
        return (
          <text key={i} x={x} y={height - 3} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 7 }}>
            {label}
          </text>
        );
      })}
    </svg>
  );
}

/** Кольцевая диаграмма (Donut) */
// Pure function to compute donut chart arcs — extracted to avoid react-hooks/immutability warning
function computeArcs(
  segments: { value: number; color: string; label?: string; name?: string }[],
  size: number,
  strokeWidth: number
) {
  const circumference = 2 * Math.PI * ((size - strokeWidth) / 2);
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;

  let offset = 0;
  return segments.map((seg) => {
    const segLength = (seg.value / total) * circumference;
    const arc = {
      ...seg,
      dashArray: `${segLength} ${circumference - segLength}`,
      dashOffset: -offset,
      percentage: ((seg.value / total) * 100).toFixed(0),
    };
    offset += segLength;
    return arc;
  });
}

function DonutChart({
  segments,
  size = 180,
  strokeWidth = 28,
  centerLabel,
  centerValue,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const arcs = computeArcs(segments, size, strokeWidth);
  const radius = (size - strokeWidth) / 2;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {/* Фоновый круг */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeOpacity={0.06} strokeWidth={strokeWidth} />

        {/* Сегменты */}
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={arc.dashArray}
            strokeDashoffset={arc.dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-all duration-700"
          />
        ))}

        {/* Центральный текст */}
        {centerValue && (
          <text x={size / 2} y={size / 2 - 6} textAnchor="middle" className="fill-foreground" style={{ fontSize: 20, fontWeight: 700 }}>
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text x={size / 2} y={size / 2 + 12} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10 }}>
            {centerLabel}
          </text>
        )}
      </svg>

      {/* Легенда */}
      <div className="space-y-2">
        {arcs.map((arc, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: arc.color }} />
            <span className="text-muted-foreground truncate">{arc.label}</span>
            <span className="font-semibold ml-auto">{arc.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Спарклайн (мини-график для KPI карточек) */
function Sparkline({ data, color = "#4f46e5", width = 80, height = 32 }: { data: number[]; color?: string; width?: number; height?: number }) {
  const maxVal = Math.max(...data, 1);
  const minVal = Math.min(...data, 0);
  const range = maxVal - minVal || 1;
  const padding = 2;

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = padding + (height - padding * 2) - ((val - minVal) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ГЛАВНЫЙ КОМПОНЕНТ АДМИН-ПАНЕЛИ
// ═══════════════════════════════════════════════════════════════════════════

export function AdminPage() {
  const { user, navigate } = useAppStore();
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports] = useState<ReportItem[]>(demoReports);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  // Load admin data on mount / user change
  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("home");
      return;
    }
    let cancelled = false;
    const loadData = async () => {
      try {
        const [coursesRes, usersRes] = await Promise.all([
          fetch("/api/admin/courses?limit=50"),
          fetch("/api/admin/users?limit=50"),
        ]);
        if (!cancelled) {
          if (coursesRes.ok) {
            const data = await coursesRes.json();
            setCourses(data.courses || []);
          }
          if (usersRes.ok) {
            const data = await usersRes.json();
            setUsers(data.users || []);
          }
        }
      } catch (e) {
        if (!cancelled) console.error("Ошибка загрузки данных:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [user, navigate]);

  // Обработчики
  const handleUserRoleChange = async (userId: string, role: string) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (res.ok) {
        toast.success("Роль пользователя обновлена");
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      }
    } catch {
      toast.error("Ошибка обновления роли");
    }
  };

  const handleUserStatusChange = async (userId: string, isActive: boolean) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, isActive }),
      });
      if (res.ok) {
        toast.success(isActive ? "Пользователь разблокирован" : "Пользователь заблокирован");
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isActive } : u)));
      }
    } catch {
      toast.error("Ошибка обновления статуса");
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [coursesRes, usersRes] = await Promise.all([
        fetch("/api/admin/courses?limit=50"),
        fetch("/api/admin/users?limit=50"),
      ]);
      if (coursesRes.ok) {
        const data = await coursesRes.json();
        setCourses(data.courses || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.users || []);
      }
    } catch (e) {
      console.error("Ошибка загрузки данных:", e);
    }
    setRefreshing(false);
    toast.success("Данные обновлены");
  };

  // Вычисляемые значения
  const totalStudents = users.filter((u) => u.role === "student").length;
  const totalTeachers = users.filter((u) => u.role === "teacher").length;
  const totalEnrollments = courses.reduce((acc, c) => acc + c._count.enrollments, 0);
  const avgRating = courses.length > 0 ? (courses.reduce((a, c) => a + c.rating, 0) / courses.length).toFixed(1) : "0";
  const totalRevenue = courses.reduce((a, c) => a + c.price * c._count.enrollments, 0);
  const pendingReports = reports.filter((r) => r.status === "pending").length;
  const activeUsers = users.filter((u) => u.isActive).length;

  // Фильтрация пользователей
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

  // Роутинг
  if (!user || user.role !== "admin") return null;

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-16 bg-muted rounded-xl" />
          <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-muted rounded-xl" />)}</div>
          <div className="h-64 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // НАВИГАЦИЯ САЙДБАРА
  // ═══════════════════════════════════════════════════════════════════════

  const sidebarItems: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "dashboard", label: "Дашборд", icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: "users", label: "Пользователи", icon: <Users className="w-5 h-5" />, badge: users.length },
    { id: "tests", label: "Тесты", icon: <ClipboardCheck className="w-5 h-5" /> },
    { id: "materials", label: "Материалы", icon: <FileText className="w-5 h-5" /> },
    { id: "finance", label: "Финансы", icon: <Wallet className="w-5 h-5" /> },
    { id: "courses", label: "Курсы", icon: <BookOpen className="w-5 h-5" />, badge: courses.length },
    { id: "reports", label: "Жалобы", icon: <Flag className="w-5 h-5" />, badge: pendingReports },
    { id: "logs", label: "Логи", icon: <Clock className="w-5 h-5" /> },
    { id: "settings", label: "Настройки", icon: <Settings className="w-5 h-5" /> },
  ];

  const renderSidebar = () => (
    <div className="flex flex-col h-full">
      {/* Логотип */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-700 to-violet-600 rounded-lg flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <h2 className="text-sm font-bold text-sidebar-foreground truncate">Maestria Admin</h2>
              <p className="text-[10px] text-muted-foreground">Панель управления v3.1</p>
            </div>
          )}
        </div>
      </div>

      {/* Навигация */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {sidebarItems.map((item) => (
          <button
            key={item.id}
            onClick={() => { setActiveTab(item.id); setMobileSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              activeTab === item.id
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            } ${sidebarCollapsed ? "justify-center" : ""}`}
            title={sidebarCollapsed ? item.label : undefined}
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

      {/* Нижняя часть сайдбара */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        {!sidebarCollapsed && (
          <div className="px-3 py-2 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-violet-600 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                {user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "AD"}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-medium truncate">{user?.name || "Admin"}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => navigate("home")}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors ${sidebarCollapsed ? "justify-center" : ""}`}
          title="Выйти из панели"
        >
          <LogOut className="w-4 h-4" />
          {!sidebarCollapsed && <span>Выйти из панели</span>}
        </button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // РЕНДЕР ТАБОВ
  // ═══════════════════════════════════════════════════════════════════════

  const renderTabContent = () => {
    switch (activeTab) {
      // ─── ДАШБОРД ─────────────────────────────────────────────────────
      case "dashboard":
        return (
          <div className="space-y-6">
            {/* KPI карточки */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: "Пользователей", value: users.length, icon: <Users className="w-5 h-5 text-blue-600" />, trend: "+18%", up: true, sparkData: [30, 35, 42, 48, 55, 62, 70, 78, 85, 92, 100, 110], sparkColor: "#4f46e5" },
                { label: "Студентов", value: totalStudents, icon: <GraduationCap className="w-5 h-5 text-violet-600" />, trend: "+22%", up: true, sparkData: [20, 25, 30, 35, 42, 48, 55, 60, 68, 75, 82, 90], sparkColor: "#7c3aed" },
                { label: "Курсов", value: courses.length, icon: <BookOpen className="w-5 h-5 text-blue-700" />, trend: "+2", up: true, sparkData: [8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 30, 34], sparkColor: "#1d4ed8" },
                { label: "Записей", value: totalEnrollments, icon: <BarChart3 className="w-5 h-5 text-purple-600" />, trend: "+12%", up: true, sparkData: [50, 65, 80, 95, 110, 128, 145, 160, 178, 195, 210, 230], sparkColor: "#9333ea" },
                { label: "Доход", value: `${(totalRevenue / 1000).toFixed(0)}K ₽`, icon: <DollarSign className="w-5 h-5 text-emerald-600" />, trend: "+24%", up: true, sparkData: [32, 45, 58, 72, 85, 98, 112, 125, 138, 152, 168, 185], sparkColor: "#10b981" },
                { label: "Ср. рейтинг", value: avgRating, icon: <TrendingUp className="w-5 h-5 text-amber-600" />, trend: "+0.2", up: true, sparkData: [3.2, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.0, 4.1, 4.2, 4.3, 4.5], sparkColor: "#f59e0b" },
              ].map((stat, i) => (
                <Card key={i} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      {stat.icon}
                      <Sparkline data={stat.sparkData} color={stat.sparkColor} />
                    </div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">{stat.label}</span>
                      <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${stat.up ? 'text-green-600' : 'text-red-600'}`}>
                        {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {stat.trend}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Графики: Регистрации + Записи */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-700" />
                      Регистрации пользователей
                    </CardTitle>
                    <Badge className="bg-green-100 text-green-700 border-0 text-xs">
                      <ArrowUpRight className="w-3 h-3 mr-1" />+18%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <LineChart data={demoMonthlyRegistrations} labels={monthLabels} color="#4f46e5" height={220} />
                  <div className="flex justify-between mt-3 text-xs text-muted-foreground">
                    <span>Всего за год: <strong className="text-foreground">{demoMonthlyRegistrations.reduce((a, b) => a + b, 0)}</strong></span>
                    <span>Ср. за месяц: <strong className="text-foreground">{Math.round(demoMonthlyRegistrations.reduce((a, b) => a + b, 0) / 12)}</strong></span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-violet-600" />
                      Записи на курсы
                    </CardTitle>
                    <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">
                      <ArrowUpRight className="w-3 h-3 mr-1" />+32%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <LineChart data={demoMonthlyEnrollments} labels={monthLabels} color="#7c3aed" height={220} fillOpacity={0.15} />
                  <div className="flex justify-between mt-3 text-xs text-muted-foreground">
                    <span>Всего за год: <strong className="text-foreground">{demoMonthlyEnrollments.reduce((a, b) => a + b, 0)}</strong></span>
                    <span>Ср. за месяц: <strong className="text-foreground">{Math.round(demoMonthlyEnrollments.reduce((a, b) => a + b, 0) / 12)}</strong></span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Вторая строка графиков */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Распределение по категориям */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-amber-600" />
                    Категории курсов
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DonutChart
                    segments={demoCategoryDistribution}
                    centerValue={courses.length.toString()}
                    centerLabel="курсов"
                    size={160}
                    strokeWidth={26}
                  />
                </CardContent>
              </Card>

              {/* Последние действия */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-600" />
                    Последние действия
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {demoActivityLog.slice(0, 6).map((item) => (
                        <div key={item.id} className="flex items-start gap-2.5">
                          <div className="mt-0.5 w-6 h-6 bg-muted rounded-md flex items-center justify-center shrink-0">
                            {activityIcon(item.type, "w-3.5 h-3.5")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate">{item.description}</p>
                            <p className="text-[10px] text-muted-foreground">{item.userName} · {item.timestamp}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Статус серверов */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Server className="w-5 h-5 text-green-600" />
                    Статус серверов
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { name: "Web-сервер", status: "online", latency: "12ms", uptime: "99.9%" },
                      { name: "API-сервер", status: "online", latency: "8ms", uptime: "99.8%" },
                      { name: "База данных", status: "online", latency: "3ms", uptime: "99.99%" },
                      { name: "CDN (РФ)", status: "online", latency: "5ms", uptime: "99.7%" },
                      { name: "Аутентификация", status: "online", latency: "15ms", uptime: "99.5%" },
                    ].map((server, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          <span className="text-sm">{server.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{server.latency}</span>
                          <span className="text-green-600 font-medium">{server.uptime}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      // ─── ПОЛЬЗОВАТЕЛИ ─────────────────────────────────────────────────
      case "users":
        return (
          <div className="space-y-6">
            {/* Статистика пользователей */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Всего пользователей", value: users.length, icon: <Users className="w-5 h-5 text-blue-600" />, bg: "bg-blue-50 dark:bg-blue-950/30" },
                { label: "Активных", value: activeUsers, icon: <UserCheck className="w-5 h-5 text-green-600" />, bg: "bg-green-50 dark:bg-green-950/30" },
                { label: "Заблокированных", value: users.length - activeUsers, icon: <UserX className="w-5 h-5 text-red-600" />, bg: "bg-red-50 dark:bg-red-950/30" },
                { label: "С 2FA", value: users.filter(u => u.twoFactorEnabled).length, icon: <Shield className="w-5 h-5 text-violet-600" />, bg: "bg-violet-50 dark:bg-violet-950/30" },
              ].map((stat, i) => (
                <Card key={i} className="border-0 shadow-sm">
                  <CardContent className={`p-4 ${stat.bg} rounded-xl`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold">{stat.value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                      </div>
                      {stat.icon}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Рост пользователей график */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-700" />
                  Рост базы пользователей
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LineChart data={demoMonthlyRegistrations} labels={monthLabels} color="#4f46e5" height={180} />
              </CardContent>
            </Card>

            {/* Распределение ролей */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-violet-600" />
                    Распределение ролей
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DonutChart
                    segments={[
                      { label: "Студенты", value: totalStudents, color: "#4f46e5" },
                      { label: "Преподаватели", value: totalTeachers, color: "#f59e0b" },
                      { label: "Администраторы", value: users.filter(u => u.role === "admin").length, color: "#7c3aed" },
                    ]}
                    centerValue={users.length.toString()}
                    centerLabel="пользователей"
                    size={160}
                    strokeWidth={26}
                  />
                </CardContent>
              </Card>

              {/* Активность по дням */}
              <Card className="border-0 shadow-sm lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-600" />
                    Активность пользователей по дням
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <BarChart data={[65, 78, 52, 89, 72, 38, 42]} labels={dayLabels} color="#10b981" height={180} />
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>Пик: <strong className="text-foreground">Чт (89)</strong></span>
                    <span>Среднее: <strong className="text-foreground">{Math.round([65, 78, 52, 89, 72, 38, 42].reduce((a, b) => a + b, 0) / 7)}</strong></span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Таблица пользователей */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <CardTitle className="text-base">Список пользователей</CardTitle>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-initial">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Поиск..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="pl-9 h-9 w-full sm:w-[200px]"
                      />
                    </div>
                    <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                      <SelectTrigger className="w-[140px] h-9">
                        <SelectValue placeholder="Роль" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все роли</SelectItem>
                        <SelectItem value="student">Студенты</SelectItem>
                        <SelectItem value="teacher">Преподаватели</SelectItem>
                        <SelectItem value="admin">Администраторы</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Пользователь</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Роль</TableHead>
                        <TableHead>2FA</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Курсов</TableHead>
                        <TableHead>Дата регистрации</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                {u.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "??"}
                              </div>
                              <span className="font-medium text-sm">{u.name || "Без имени"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{u.email}</TableCell>
                          <TableCell>
                            <Select value={u.role} onValueChange={(value) => handleUserRoleChange(u.id, value)}>
                              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="student">Студент</SelectItem>
                                <SelectItem value="teacher">Преподаватель</SelectItem>
                                <SelectItem value="admin">Администратор</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${u.twoFactorEnabled ? 'border-green-300 text-green-700' : 'border-gray-300 text-gray-500'}`}>
                              {u.twoFactorEnabled ? "Вкл" : "Выкл"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => handleUserStatusChange(u.id, !u.isActive)}
                              disabled={u.id === user?.id}
                              className="cursor-pointer disabled:cursor-not-allowed"
                            >
                              {u.isActive
                                ? <Badge className="bg-green-100 text-green-700 border-0 text-xs hover:bg-green-200 transition-colors">Активен</Badge>
                                : <Badge className="bg-red-100 text-red-700 border-0 text-xs hover:bg-red-200 transition-colors">Заблокирован</Badge>
                              }
                            </button>
                          </TableCell>
                          <TableCell className="text-sm">{u._count.enrollments}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(u.createdAt).toLocaleDateString("ru-RU")}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => navigate("profile")}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredUsers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            Пользователи не найдены
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="p-3 border-t text-xs text-muted-foreground flex justify-between">
                  <span>Найдено: {filteredUsers.length} из {users.length}</span>
                  <span>Страница 1 из 1</span>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      // ─── ТЕСТЫ ────────────────────────────────────────────────────────
      case "tests":
        return (
          <div className="space-y-6">
            {/* KPI по тестам */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Всего попыток", value: demoTestResults.reduce((a, t) => a + t.attempts, 0), icon: <ClipboardCheck className="w-5 h-5 text-blue-600" /> },
                { label: "Успешных", value: demoTestResults.reduce((a, t) => a + t.completions, 0), icon: <CheckCircle2 className="w-5 h-5 text-green-600" /> },
                { label: "Ср. проходной %", value: `${Math.round(demoTestResults.reduce((a, t) => a + t.passRate, 0) / demoTestResults.length)}%`, icon: <Award className="w-5 h-5 text-amber-600" /> },
                { label: "Ср. балл", value: Math.round(demoTestResults.reduce((a, t) => a + t.avgScore, 0) / demoTestResults.length), icon: <TrendingUp className="w-5 h-5 text-violet-600" /> },
              ].map((stat, i) => (
                <Card key={i} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">{stat.icon}<span className="text-xl font-bold">{stat.value}</span></div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Графики */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-blue-700" />
                    Прохождение тестов за неделю
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <BarChart data={demoTestCompletions} labels={dayLabels} color="#4f46e5" height={200} />
                  <div className="flex justify-between mt-3 text-xs text-muted-foreground">
                    <span>Всего: <strong className="text-foreground">{demoTestCompletions.reduce((a, b) => a + b, 0)}</strong></span>
                    <span>Ср. за день: <strong className="text-foreground">{Math.round(demoTestCompletions.reduce((a, b) => a + b, 0) / 7)}</strong></span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    Процент успешных прохождений
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LineChart data={demoTestPassRate} labels={dayLabels} color="#10b981" height={200} />
                  <div className="flex justify-between mt-3 text-xs text-muted-foreground">
                    <span>Мин: <strong className="text-foreground">{Math.min(...demoTestPassRate)}%</strong></span>
                    <span>Макс: <strong className="text-foreground">{Math.max(...demoTestPassRate)}%</strong></span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Таблица результатов по курсам */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-violet-600" />
                  Результаты тестов по курсам
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Курс</TableHead>
                        <TableHead>Проходной %</TableHead>
                        <TableHead>Ср. балл</TableHead>
                        <TableHead>Попыток</TableHead>
                        <TableHead>Успешно</TableHead>
                        <TableHead>Прогресс</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {demoTestResults.map((test, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-sm">{test.course}</TableCell>
                          <TableCell>
                            <span className={`font-semibold ${test.passRate >= 75 ? 'text-green-600' : test.passRate >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                              {test.passRate}%
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{test.avgScore}/100</TableCell>
                          <TableCell className="text-sm">{test.attempts}</TableCell>
                          <TableCell className="text-sm">{test.completions}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={test.passRate} className="h-2 flex-1" />
                              <span className="text-xs text-muted-foreground w-8">{test.passRate}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Распределение по сложности */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  Распределение тестов по сложности
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart
                  segments={[
                    { label: "Лёгкие (>80%)", value: 3, color: "#10b981" },
                    { label: "Средние (60-80%)", value: 3, color: "#f59e0b" },
                    { label: "Сложные (<60%)", value: 2, color: "#ef4444" },
                  ]}
                  centerValue="8"
                  centerLabel="тестов"
                  size={160}
                  strokeWidth={26}
                />
              </CardContent>
            </Card>
          </div>
        );

      // ─── МАТЕРИАЛЫ ────────────────────────────────────────────────────
      case "materials":
        return (
          <div className="space-y-6">
            {/* KPI по материалам */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Сессий чтения", value: demoReadingSessions.reduce((a, b) => a + b, 0), icon: <FileText className="w-5 h-5 text-blue-600" /> },
                { label: "Ср. время чтения", value: `${Math.round(demoAvgReadingTime.reduce((a, b) => a + b, 0) / 7)} мин`, icon: <Timer className="w-5 h-5 text-amber-600" /> },
                { label: "Завершено", value: demoMaterialProgress.reduce((a, m) => a + m.completed, 0), icon: <BookCheck className="w-5 h-5 text-green-600" /> },
                { label: "Ср. прогресс", value: `${Math.round(demoMaterialProgress.reduce((a, m) => a + m.readPercent, 0) / demoMaterialProgress.length)}%`, icon: <TrendingUp className="w-5 h-5 text-violet-600" /> },
              ].map((stat, i) => (
                <Card key={i} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">{stat.icon}<span className="text-xl font-bold">{stat.value}</span></div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Графики */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-700" />
                    Сессии чтения за неделю
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <BarChart data={demoReadingSessions} labels={dayLabels} color="#4f46e5" height={200} />
                  <div className="flex justify-between mt-3 text-xs text-muted-foreground">
                    <span>Всего: <strong className="text-foreground">{demoReadingSessions.reduce((a, b) => a + b, 0)}</strong></span>
                    <span>Пик: <strong className="text-foreground">Чт ({Math.max(...demoReadingSessions)})</strong></span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Timer className="w-5 h-5 text-amber-600" />
                    Среднее время чтения (мин)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LineChart data={demoAvgReadingTime} labels={dayLabels} color="#f59e0b" height={200} fillOpacity={0.12} />
                  <div className="flex justify-between mt-3 text-xs text-muted-foreground">
                    <span>Мин: <strong className="text-foreground">{Math.min(...demoAvgReadingTime)} мин</strong></span>
                    <span>Макс: <strong className="text-foreground">{Math.max(...demoAvgReadingTime)} мин</strong></span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Таблица прогресса чтения по курсам */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookCheck className="w-5 h-5 text-green-600" />
                  Прогресс прочитывания по курсам
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Курс</TableHead>
                        <TableHead>Прогресс чтения</TableHead>
                        <TableHead>Ср. время</TableHead>
                        <TableHead>Читателей</TableHead>
                        <TableHead>Дочитали</TableHead>
                        <TableHead>Визуально</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {demoMaterialProgress.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-sm">{item.course}</TableCell>
                          <TableCell>
                            <span className={`font-semibold ${item.readPercent >= 70 ? 'text-green-600' : item.readPercent >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                              {item.readPercent}%
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{item.avgTime}</TableCell>
                          <TableCell className="text-sm">{item.totalReaders}</TableCell>
                          <TableCell className="text-sm">{item.completed}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={item.readPercent} className="h-2 flex-1" />
                              <span className="text-xs text-muted-foreground w-8">{item.readPercent}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Динамика вовлечённости */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-violet-600" />
                  Динамика вовлечённости по месяцам
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LineChart data={[42, 48, 55, 62, 68, 75, 82, 88, 92, 95, 78, 85]} labels={monthLabels} color="#7c3aed" height={180} fillOpacity={0.15} />
                <div className="flex justify-between mt-3 text-xs text-muted-foreground">
                  <span>Тренд: <strong className="text-green-600">Рост +38%</strong></span>
                  <span>Ср. вовлечённость: <strong className="text-foreground">72%</strong></span>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      // ─── ФИНАНСЫ ──────────────────────────────────────────────────────
      case "finance":
        return (
          <div className="space-y-6">
            {/* Финансовые KPI */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Общий доход", value: `${totalRevenue.toLocaleString("ru-RU")} ₽`, icon: <DollarSign className="w-5 h-5 text-emerald-600" /> },
                { label: "Платных курсов", value: courses.filter(c => c.price > 0).length, icon: <BookOpen className="w-5 h-5 text-blue-600" /> },
                { label: "Бесплатных", value: courses.filter(c => c.price === 0).length, icon: <Gift className="w-5 h-5 text-amber-600" /> },
                { label: "Ср. чек", value: courses.filter(c => c.price > 0).length > 0 ? `${Math.round(courses.filter(c => c.price > 0).reduce((a, c) => a + c.price, 0) / courses.filter(c => c.price > 0).length).toLocaleString("ru-RU")} ₽` : "0 ₽", icon: <Wallet className="w-5 h-5 text-violet-600" /> },
              ].map((stat, i) => (
                <Card key={i} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">{stat.icon}<span className="text-xl font-bold">{stat.value}</span></div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* График дохода */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    Динамика дохода по месяцам
                  </CardTitle>
                  <Badge className="bg-green-100 text-green-700 border-0 text-xs">
                    <ArrowUpRight className="w-3 h-3 mr-1" />+42%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <LineChart data={demoMonthlyRevenue.map(v => v / 1000)} labels={monthLabels} color="#10b981" height={220} fillOpacity={0.15} strokeWidth={3} />
                <div className="flex justify-between mt-3 text-xs text-muted-foreground">
                  <span>Итого: <strong className="text-foreground">{(demoMonthlyRevenue.reduce((a, b) => a + b, 0) / 1000).toFixed(0)}K ₽</strong></span>
                  <span>Пик: <strong className="text-foreground">{(Math.max(...demoMonthlyRevenue) / 1000).toFixed(0)}K ₽ (Дек)</strong></span>
                </div>
              </CardContent>
            </Card>

            {/* Доход по категориям + Распределение */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-700" />
                    Доход по категориям
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(
                      courses.reduce((acc, c) => {
                        const cat = c.category?.name || "Без категории";
                        acc[cat] = (acc[cat] || 0) + c.price * c._count.enrollments;
                        return acc;
                      }, {} as Record<string, number>)
                    )
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 6)
                      .map(([cat, revenue]) => {
                        const maxRev = totalRevenue || 1;
                        return (
                          <div key={cat}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="truncate mr-2">{cat}</span>
                              <span className="font-medium shrink-0">{revenue.toLocaleString("ru-RU")} ₽</span>
                            </div>
                            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-700" style={{ width: `${(revenue / maxRev) * 100}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    {totalRevenue === 0 && <p className="text-sm text-muted-foreground">Нет данных</p>}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-violet-600" />
                    Бесплатные vs Платные
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DonutChart
                    segments={[
                      { label: "Платные", value: courses.filter(c => c.price > 0).length || 1, color: "#4f46e5" },
                      { label: "Бесплатные", value: courses.filter(c => c.price === 0).length || 1, color: "#10b981" },
                    ]}
                    centerValue={courses.length.toString()}
                    centerLabel="курсов"
                    size={160}
                    strokeWidth={26}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        );

      // ─── КУРСЫ ────────────────────────────────────────────────────────
      case "courses":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Всего курсов", value: courses.length, icon: <BookOpen className="w-5 h-5 text-blue-600" /> },
                { label: "Опубликованных", value: courses.filter(c => c.isPublished).length, icon: <CheckCircle2 className="w-5 h-5 text-green-600" /> },
                { label: "Черновиков", value: courses.filter(c => !c.isPublished).length, icon: <FileText className="w-5 h-5 text-amber-600" /> },
                { label: "Ср. рейтинг", value: avgRating, icon: <TrendingUp className="w-5 h-5 text-violet-600" /> },
              ].map((stat, i) => (
                <Card key={i} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">{stat.icon}<span className="text-xl font-bold">{stat.value}</span></div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Название</TableHead>
                        <TableHead>Категория</TableHead>
                        <TableHead>Преподаватель</TableHead>
                        <TableHead>Цена</TableHead>
                        <TableHead>Рейтинг</TableHead>
                        <TableHead>Студентов</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {courses.map((course) => (
                        <TableRow key={course.id}>
                          <TableCell className="font-medium text-sm max-w-[200px] truncate">{course.title}</TableCell>
                          <TableCell className="text-sm">{course.category?.name || "—"}</TableCell>
                          <TableCell className="text-sm">{course.teacher?.name || "—"}</TableCell>
                          <TableCell className="text-sm">
                            {course.price === 0 ? <Badge className="bg-green-100 text-green-700 border-0 text-xs">Бесплатно</Badge> : `${course.price.toLocaleString("ru-RU")} ₽`}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{course.rating > 0 ? course.rating.toFixed(1) : "—"}</TableCell>
                          <TableCell className="text-sm">{course._count.enrollments}</TableCell>
                          <TableCell>
                            {course.isPublished
                              ? <Badge className="bg-green-100 text-green-700 border-0 text-xs">Опубликован</Badge>
                              : <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs">Черновик</Badge>
                            }
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => navigate(`course/${course.id}`)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Популярные курсы */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-700" />
                  Топ курсов по записям
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[...courses].sort((a, b) => b._count.enrollments - a._count.enrollments).slice(0, 8).map((course, i) => (
                    <div key={course.id} className="flex items-center gap-3">
                      <span className={`text-sm font-bold w-7 text-center ${i < 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{course.title}</p>
                        <p className="text-xs text-muted-foreground">{course._count.enrollments} студентов</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">{course.rating.toFixed(1)}</Badge>
                    </div>
                  ))}
                  {courses.length === 0 && <p className="text-sm text-muted-foreground">Нет данных</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      // ─── ЖАЛОБЫ ───────────────────────────────────────────────────────
      case "reports":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 bg-red-50 dark:bg-red-950/30 rounded-xl">
                  <p className="text-3xl font-bold text-red-600">{reports.filter(r => r.status === "pending").length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Ожидают рассмотрения</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl">
                  <p className="text-3xl font-bold text-amber-600">{reports.filter(r => r.status === "reviewed").length}</p>
                  <p className="text-xs text-muted-foreground mt-1">В работе</p>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 bg-green-50 dark:bg-green-950/30 rounded-xl">
                  <p className="text-3xl font-bold text-green-600">{reports.filter(r => r.status === "resolved").length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Решено</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Тип</TableHead>
                        <TableHead>Заявитель</TableHead>
                        <TableHead>Описание</TableHead>
                        <TableHead>Дата</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {report.type === "content" ? "Контент" : report.type === "user" ? "Пользователь" : report.type === "bug" ? "Ошибка" : "Другое"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{report.userName}</TableCell>
                          <TableCell className="text-sm max-w-[300px] truncate">{report.description}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{report.createdAt}</TableCell>
                          <TableCell>
                            {report.status === "pending" ? <Badge className="bg-red-100 text-red-700 border-0 text-xs">Ожидает</Badge> :
                             report.status === "reviewed" ? <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs">Рассматривается</Badge> :
                             <Badge className="bg-green-100 text-green-700 border-0 text-xs">Решено</Badge>}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => toast.success("Жалоба отмечена как рассмотренная")}>
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => toast.success("Жалоба отклонена")}>
                                <XCircle className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      // ─── ЛОГИ ─────────────────────────────────────────────────────────
      case "logs":
        return (
          <div className="space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    Журнал действий платформы
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">{demoActivityLog.length} записей</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {demoActivityLog.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors">
                        <div className="w-9 h-9 bg-background rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                          {activityIcon(item.type, "w-4 h-4")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.userName} · {item.timestamp}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] shrink-0 ${ACTIVITY_TYPE_COLORS[item.type] || "border-gray-300 text-gray-700"}`}
                        >
                          {ACTIVITY_TYPE_LABELS[item.type] || item.type}
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      // ─── НАСТРОЙКИ ────────────────────────────────────────────────────
      case "settings":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Globe className="w-5 h-5 text-blue-700" />Платформа</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { title: "Режим обслуживания", desc: "Временно отключить доступ для пользователей", action: "Выключен", color: "default" },
                    { title: "Регистрация пользователей", desc: "Разрешить регистрацию на платформе", action: "Открыта", color: "green" },
                    { title: "Модерация курсов", desc: "Публиковать курсы только после проверки", action: "Включена", color: "blue" },
                    { title: "Email-уведомления", desc: "Отправлять уведомления о действиях", action: "Включены", color: "blue" },
                    { title: "Двухфакторная аутентификация", desc: "Требовать 2FA для администраторов", action: "Включена", color: "green" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <Button
                        size="sm"
                        variant={item.color === "default" ? "outline" : undefined}
                        className={item.color === "green" ? "bg-green-600 hover:bg-green-700 text-white" : item.color === "blue" ? "bg-blue-700 hover:bg-blue-800 text-white" : undefined}
                        onClick={() => toast.success(`${item.title}: ${item.action}`)}
                      >
                        {item.action}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Monitor className="w-5 h-5 text-violet-600" />Система</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {[
                    { label: "Версия платформы", value: "v3.1.0" },
                    { label: "Next.js", value: "16.1.1" },
                    { label: "React", value: "19.0.0" },
                    { label: "База данных", value: "SQLite + Prisma", special: true },
                    { label: "Регион серверов", value: "Российская Федерация" },
                    { label: "Лицензия контента", value: "CC BY-SA 4.0" },
                    { label: "Кастомный курсор", value: "Активен", special: true },
                    { label: "Темы оформления", value: "3 (light / dark / amber)" },
                    { label: "Локализации", value: "3 (ru / en / zh)" },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="text-muted-foreground">{item.label}</span>
                      {item.special ? (
                        <span className="font-medium text-green-600 flex items-center gap-1"><Zap className="w-3 h-3" />{item.value}</span>
                      ) : (
                        <span className="font-medium">{item.value}</span>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Опасная зона */}
            <Card className="border-2 border-red-200 dark:border-red-900/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                  Опасная зона
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Очистить кэш платформы</p>
                    <p className="text-xs text-muted-foreground">Удалить все кэшированные данные</p>
                  </div>
                  <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => toast.info("Кэш очищен")}>
                    Очистить
                  </Button>
                </div>
                <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Сбросить тестовые данные</p>
                    <p className="text-xs text-muted-foreground">Удалить все демо-данные из базы</p>
                  </div>
                  <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => toast.info("Тестовые данные сброшены")}>
                    Сбросить
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ФИНАЛЬНЫЙ РЕНДЕР
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="flex min-h-[calc(100vh-8rem)]">
      {/* Сайдбар — десктоп */}
      <aside
        className={`hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 shrink-0 ${
          sidebarCollapsed ? "w-[68px]" : "w-[260px]"
        }`}
      >
        {renderSidebar()}
        {/* Кнопка сворачивания */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute top-1/2 -translate-y-1/2 z-10 w-5 h-10 bg-sidebar-accent border border-sidebar-border rounded-r-md flex items-center justify-center hover:bg-sidebar-accent/80 transition-colors"
          style={{ left: sidebarCollapsed ? "63px" : "255px" }}
        >
          {sidebarCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Сайдбар — мобильный */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[260px] bg-sidebar border-r border-sidebar-border">
            {renderSidebar()}
          </aside>
        </div>
      )}

      {/* Основной контент */}
      <div className="flex-1 overflow-auto">
        {/* Верхняя панель */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileSidebarOpen(true)}>
                <Menu className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold">
                  {sidebarItems.find(s => s.id === activeTab)?.label || "Дашборд"}
                </h1>
                <p className="text-xs text-muted-foreground">Управление Maestria</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
                Обновить
              </Button>
              <Button
                className="bg-blue-700 hover:bg-blue-800 text-white"
                size="sm"
                onClick={() => navigate("course-editor")}
              >
                <Plus className="w-4 h-4 mr-1.5" />Создать курс
              </Button>
            </div>
          </div>
        </div>

        {/* Контент */}
        <div className="p-4 sm:p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}
