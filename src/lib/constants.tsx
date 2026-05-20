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
  Play,
  FileText,
  Code2,
  HelpCircle,
  ClipboardList,
} from "lucide-react";

export const levelLabels: Record<string, string> = {
  beginner: "common.levelBeginner",
  intermediate: "common.levelIntermediate",
  advanced: "common.levelAdvanced",
};

export const levelColors: Record<string, string> = {
  beginner: "bg-blue-100 text-blue-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced: "bg-red-100 text-red-700",
};

export interface CategoryOption {
  slug: string;
  labelKey: string;
  icon: string;
}

export const CATEGORIES: CategoryOption[] = [
  { slug: "python", labelKey: "common.categoryPython", icon: "🐍" },
  { slug: "web-development", labelKey: "common.categoryWebDev", icon: "🌐" },
  { slug: "roblox", labelKey: "common.categoryRoblox", icon: "🎮" },
  { slug: "cpp-csharp", labelKey: "common.categoryCppCsharp", icon: "⚡" },
  { slug: "data-science", labelKey: "common.categoryDataScience", icon: "📊" },
  { slug: "mobile-development", labelKey: "common.categoryMobileDev", icon: "📱" },
];

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  user_register: "common.activityRegister",
  course_create: "common.activityCreate",
  course_publish: "common.activityPublish",
  enrollment: "common.activityEnroll",
  payment: "common.activityPay",
  report: "common.activityReport",
  settings_change: "common.activitySettings",
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

// ─── Lesson type icons ──────────────────────────────────────────────────────

export function lessonTypeIcon(type: string, className = "w-4 h-4"): ReactNode {
  const icons: Record<string, ReactNode> = {
    video: <Play className={className} />,
    text: <FileText className={className} />,
    coding: <Code2 className={className} />,
    quiz: <HelpCircle className={className} />,
    assignment: <ClipboardList className={className} />,
  };
  return icons[type] || <FileText className={className} />;
}
