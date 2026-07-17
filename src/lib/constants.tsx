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
  AlignLeft,
  ArrowUpDown,
  Upload,
  Pencil,
  Move,
  Blocks,
} from "lucide-react";

export const APP_VERSION = "3.6.0";

export const APP_NAME = "Maestria LMS";

export const CERTIFICATE_PREFIX = "MAE";

export const MS = {
  HOUR: 3600000,
  DAY: 86400000,
  THIRTY_DAYS: 2592000000,
} as const;

export const CONTACT = {
  phone: "+7 (915) 048-02-49",
  phoneTel: "+79150480249",
  email: "contact@maestro7it.com",
  personalEmail: "maksimqwe42@mail.ru",
  website: "https://maestro7it.com",
  ownerName: "Дуплей Максим Игоревич",
  vkVideoUrl: "https://live.vkvideo.ru/quadd4rv1n7",
  rutubeUrl: "https://rutube.ru/channel/4218729/",
} as const;

export const levelLabels: Record<string, string> = {
  beginner: "common.levelBeginner",
  intermediate: "common.levelIntermediate",
  advanced: "common.levelAdvanced",
};

export const levelColors: Record<string, string> = {
  beginner: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  intermediate: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  advanced: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
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
  payment: "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400",
  report: "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400",
  course_publish: "border-green-300 text-green-700 dark:border-green-700 dark:text-green-400",
  user_register: "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-400",
  enrollment: "border-violet-300 text-violet-700 dark:border-violet-700 dark:text-violet-400",
  course_create: "border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-400",
  settings_change: "border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-400",
};

interface IconEntry {
  icon: typeof Users;
  color: string;
}

const ACTIVITY_ICON_META: Record<string, IconEntry> = {
  user_register: { icon: Users, color: "text-green-600 dark:text-green-400" },
  enrollment: { icon: BookOpen, color: "text-blue-600 dark:text-blue-400" },
  payment: { icon: DollarSign, color: "text-emerald-600 dark:text-emerald-400" },
  course_create: { icon: Plus, color: "text-violet-600 dark:text-violet-400" },
  course_publish: { icon: CheckCircle2, color: "text-green-600 dark:text-green-400" },
  report: { icon: Flag, color: "text-red-600 dark:text-red-400" },
  settings_change: { icon: Settings, color: "text-gray-600 dark:text-gray-400" },
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
    interactive: <Blocks className={className} />,
    matching: <ArrowUpDown className={className} />,
    ordering: <Move className={className} />,
    file_upload: <Upload className={className} />,
    essay: <Pencil className={className} />,
    drag_drop: <AlignLeft className={className} />,
  };
  return icons[type] || <FileText className={className} />;
}
