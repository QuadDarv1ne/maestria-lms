import type { ReactNode } from "react";
import {
  Users,
  BookOpen,
  DollarSign,
  Plus,
  CheckCircle2,
  Flag,
  Settings,
  Activity,
} from "lucide-react";

export const levelLabels: Record<string, string> = {
  beginner: "Начинающий",
  intermediate: "Средний",
  advanced: "Продвинутый",
};

export const levelColors: Record<string, string> = {
  beginner: "bg-blue-100 text-blue-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced: "bg-red-100 text-red-700",
};

export interface CategoryOption {
  slug: string;
  label: string;
  icon: string;
}

export const CATEGORIES: CategoryOption[] = [
  { slug: "python", label: "Программирование на Python", icon: "🐍" },
  { slug: "web-development", label: "Веб-разработка", icon: "🌐" },
  { slug: "roblox", label: "Создание игр в Roblox", icon: "🎮" },
  { slug: "cpp-csharp", label: "C++/C#", icon: "⚡" },
  { slug: "data-science", label: "Data Science", icon: "📊" },
  { slug: "mobile-development", label: "Мобильная разработка", icon: "📱" },
];

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  user_register: "Регистрация",
  course_create: "Создание",
  course_publish: "Публикация",
  enrollment: "Запись",
  payment: "Оплата",
  report: "Жалоба",
  settings_change: "Настройки",
};

export const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  payment: "border-emerald-300 text-emerald-700",
  report: "border-red-300 text-red-700",
  course_publish: "border-green-300 text-green-700",
  user_register: "border-blue-300 text-blue-700",
  enrollment: "border-violet-300 text-violet-700",
  course_create: "border-purple-300 text-purple-700",
  settings_change: "border-gray-300 text-gray-700",
};

interface IconEntry {
  icon: typeof Users;
  color: string;
}

const ACTIVITY_ICON_META: Record<string, IconEntry> = {
  user_register: { icon: Users, color: "text-green-600" },
  enrollment: { icon: BookOpen, color: "text-blue-600" },
  payment: { icon: DollarSign, color: "text-emerald-600" },
  course_create: { icon: Plus, color: "text-violet-600" },
  course_publish: { icon: CheckCircle2, color: "text-green-600" },
  report: { icon: Flag, color: "text-red-600" },
  settings_change: { icon: Settings, color: "text-gray-600" },
};

export function activityIcon(type: string, className = "w-3.5 h-3.5"): ReactNode {
  const entry = ACTIVITY_ICON_META[type];
  if (!entry) return <Activity className={`${className} text-gray-500`} />;
  const Icon = entry.icon;
  return <Icon className={`${className} ${entry.color}`} />;
}
