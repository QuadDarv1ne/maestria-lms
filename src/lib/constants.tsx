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
  Shield,
  Trash2,
  Ban,
  RefreshCw,
  Database,
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
  inn: "503234333170",
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

// ─── Audit trail actions ────────────────────────────────────────────────────
// Keyed by the dotted identifiers in AUDIT_ACTIONS (src/lib/audit-log.ts).

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "user.role_change": "adminAudit.actionUserRole",
  "user.status_change": "adminAudit.actionUserStatus",
  "user.update": "adminAudit.actionUserUpdate",
  "course.create": "adminAudit.actionCourseCreate",
  "course.update": "adminAudit.actionCourseUpdate",
  "course.publish": "adminAudit.actionCoursePublish",
  "course.unpublish": "adminAudit.actionCourseUnpublish",
  "course.delete": "adminAudit.actionCourseDelete",
  "category.create": "adminAudit.actionCategoryCreate",
  "category.update": "adminAudit.actionCategoryUpdate",
  "category.delete": "adminAudit.actionCategoryDelete",
  "promo_code.create": "adminAudit.actionPromoCreate",
  "promo_code.update": "adminAudit.actionPromoUpdate",
  "promo_code.delete": "adminAudit.actionPromoDelete",
  "promo_code.deactivate": "adminAudit.actionPromoDeactivate",
  "payment.refund": "adminAudit.actionRefund",
  "submission.grade": "adminAudit.actionGrade",
  "settings.update": "adminAudit.actionSettings",
  "feature_flag.update": "adminAudit.actionFeatureFlag",
  "cache.clear": "adminAudit.actionCacheClear",
  "backup.create": "adminAudit.actionBackup",
  "audit_log.purge": "adminAudit.actionAuditPurge",
};

export const AUDIT_ACTION_COLORS: Record<string, string> = {
  "payment.refund": "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400",
  "course.delete": "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400",
  "category.delete": "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400",
  "promo_code.delete": "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400",
  "audit_log.purge": "border-red-300 text-red-700 dark:border-red-700 dark:text-red-400",
  "course.publish": "border-green-300 text-green-700 dark:border-green-700 dark:text-green-400",
  "user.role_change": "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400",
  "user.status_change": "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400",
};

const AUDIT_ACTION_ICON_META: Record<string, IconEntry> = {
  "user.role_change": { icon: Shield, color: "text-amber-600 dark:text-amber-400" },
  "user.status_change": { icon: Shield, color: "text-amber-600 dark:text-amber-400" },
  "user.update": { icon: Users, color: "text-blue-600 dark:text-blue-400" },
  "course.create": { icon: Plus, color: "text-violet-600 dark:text-violet-400" },
  "course.update": { icon: Pencil, color: "text-violet-600 dark:text-violet-400" },
  "course.publish": { icon: CheckCircle2, color: "text-green-600 dark:text-green-400" },
  "course.unpublish": { icon: FileText, color: "text-gray-600 dark:text-gray-400" },
  "course.delete": { icon: Trash2, color: "text-red-600 dark:text-red-400" },
  "category.create": { icon: Plus, color: "text-violet-600 dark:text-violet-400" },
  "category.update": { icon: Pencil, color: "text-violet-600 dark:text-violet-400" },
  "category.delete": { icon: Trash2, color: "text-red-600 dark:text-red-400" },
  "promo_code.create": { icon: Plus, color: "text-emerald-600 dark:text-emerald-400" },
  "promo_code.update": { icon: Pencil, color: "text-emerald-600 dark:text-emerald-400" },
  "promo_code.delete": { icon: Trash2, color: "text-red-600 dark:text-red-400" },
  "promo_code.deactivate": { icon: Ban, color: "text-gray-600 dark:text-gray-400" },
  "payment.refund": { icon: DollarSign, color: "text-emerald-600 dark:text-emerald-400" },
  "submission.grade": { icon: ClipboardList, color: "text-blue-600 dark:text-blue-400" },
  "settings.update": { icon: Settings, color: "text-gray-600 dark:text-gray-400" },
  "feature_flag.update": { icon: Flag, color: "text-amber-600 dark:text-amber-400" },
  "cache.clear": { icon: RefreshCw, color: "text-gray-600 dark:text-gray-400" },
  "backup.create": { icon: Database, color: "text-blue-600 dark:text-blue-400" },
  "audit_log.purge": { icon: Trash2, color: "text-red-600 dark:text-red-400" },
};

export function auditActionIcon(action: string, className = "w-4 h-4"): ReactNode {
  const entry = AUDIT_ACTION_ICON_META[action];
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
