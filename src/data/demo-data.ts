import type { Locale } from "@/lib/store";
import { t } from "@/lib/i18n";

export interface ReportItem {
  id: string;
  type: "content" | "user" | "bug" | "other";
  status: "pending" | "reviewed" | "resolved";
  userName: string;
  description: string; // i18n key
  params?: Record<string, string>; // {{name}} placeholders, values are i18n keys or raw text
  createdAt: string;
}

export interface ActivityLogItem {
  id: string;
  type: "user_register" | "course_create" | "course_publish" | "enrollment" | "payment" | "report" | "settings_change";
  description: string; // i18n key
  params?: Record<string, string>;
  userName: string;
  time: { amount: number; unit: "minute" | "hour" | "day" };
}

export interface TestResult {
  course: string; // i18n key
  passRate: number;
  avgScore: number;
  attempts: number;
  completions: number;
}

export interface MaterialProgress {
  course: string; // i18n key
  readPercent: number;
  avgMinutes: number;
  totalReaders: number;
  completed: number;
}

/**
 * Resolve a demo-data text entry: translates the key, then substitutes
 * {{name}} placeholders (values that are i18n keys are translated too;
 * raw values like "1 799 ₽" pass through as-is since t() returns them unchanged).
 */
export function translateDemoText(key: string, params: Record<string, string> | undefined, locale: Locale): string {
  let text = t(key, locale);
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{{${name}}}`, t(value, locale));
    }
  }
  return text;
}

export function formatDemoTime(time: { amount: number; unit: "minute" | "hour" | "day" }, locale: Locale): string {
  const key =
    time.unit === "minute" ? "admin.demo.minutesAgo"
    : time.unit === "hour" ? "admin.demo.hoursAgo"
    : "admin.demo.daysAgo";
  return t(key, locale).replace("{{n}}", String(time.amount));
}

export const demoReports: ReportItem[] = [
  { id: "r1", type: "content", status: "pending", userName: "Иван П.", description: "admin.demo.report1", params: { course: "admin.demo.coursePython" }, createdAt: "2026-05-15" },
  { id: "r2", type: "user", status: "pending", userName: "Анна К.", description: "admin.demo.report2", params: { course: "admin.demo.courseWeb" }, createdAt: "2026-05-14" },
  { id: "r3", type: "bug", status: "reviewed", userName: "Пётр С.", description: "admin.demo.report3", params: { course: "admin.demo.courseDataScience" }, createdAt: "2026-05-13" },
  { id: "r4", type: "content", status: "resolved", userName: "Мария Л.", description: "admin.demo.report4", params: { course: "admin.demo.courseCpp" }, createdAt: "2026-05-10" },
  { id: "r5", type: "bug", status: "pending", userName: "Дмитрий В.", description: "admin.demo.report5", params: { course: "admin.demo.courseAlgorithms" }, createdAt: "2026-05-09" },
];

export const demoActivityLog: ActivityLogItem[] = [
  { id: "al1", type: "user_register", description: "admin.demo.userRegistered", userName: "Алексей М.", time: { amount: 5, unit: "minute" } },
  { id: "al2", type: "enrollment", description: "admin.demo.enrolled", params: { course: "admin.demo.coursePython" }, userName: "Екатерина С.", time: { amount: 12, unit: "minute" } },
  { id: "al3", type: "payment", description: "admin.demo.paid", params: { course: "admin.demo.courseWeb", amount: "1 799 ₽" }, userName: "Дмитрий К.", time: { amount: 28, unit: "minute" } },
  { id: "al4", type: "course_create", description: "admin.demo.courseCreated", params: { course: "admin.demo.courseAlgorithms" }, userName: "Дуплей М.И.", time: { amount: 1, unit: "hour" } },
  { id: "al5", type: "course_publish", description: "admin.demo.coursePublished", params: { course: "admin.demo.courseLinux" }, userName: "Дуплей М.И.", time: { amount: 2, unit: "hour" } },
  { id: "al6", type: "report", description: "admin.demo.reportSubmitted", params: { course: "admin.demo.courseDataScience" }, userName: "Иван П.", time: { amount: 3, unit: "hour" } },
  { id: "al7", type: "user_register", description: "admin.demo.userRegistered", userName: "Ольга Н.", time: { amount: 4, unit: "hour" } },
  { id: "al8", type: "enrollment", description: "admin.demo.enrolled", params: { course: "admin.demo.courseSQL" }, userName: "Сергей В.", time: { amount: 5, unit: "hour" } },
  { id: "al9", type: "payment", description: "admin.demo.paid", params: { course: "admin.demo.courseReact", amount: "1 699 ₽" }, userName: "Наталья Р.", time: { amount: 6, unit: "hour" } },
  { id: "al10", type: "settings_change", description: "admin.demo.settingsUpdated", userName: "Дуплей М.И.", time: { amount: 1, unit: "day" } },
  { id: "al11", type: "enrollment", description: "admin.demo.enrolled", params: { course: "admin.demo.courseML" }, userName: "Виктор Б.", time: { amount: 1, unit: "day" } },
  { id: "al12", type: "payment", description: "admin.demo.paid", params: { course: "admin.demo.coursePython", amount: "2 499 ₽" }, userName: "Алина Т.", time: { amount: 1, unit: "day" } },
];

export const demoMonthlyRegistrations = [45, 62, 78, 95, 110, 128, 142, 155, 168, 185, 203, 218];
export const demoMonthlyRevenue = [32000, 45000, 58000, 72000, 85000, 98000, 112000, 125000, 138000, 152000, 168000, 185000];
export const demoMonthlyEnrollments = [120, 165, 210, 255, 298, 340, 385, 420, 460, 510, 565, 620];

export const demoTestCompletions = [42, 58, 35, 67, 52, 28, 31];
export const demoTestPassRate = [78, 82, 75, 88, 85, 72, 80];

export const demoReadingSessions = [156, 198, 142, 225, 188, 95, 72];
export const demoAvgReadingTime = [24, 28, 22, 32, 27, 18, 15];

export const demoTestResults: TestResult[] = [
  { course: "admin.demo.coursePython", passRate: 87, avgScore: 78, attempts: 342, completions: 298 },
  { course: "admin.demo.courseWeb", passRate: 72, avgScore: 65, attempts: 256, completions: 184 },
  { course: "admin.demo.courseDataScience", passRate: 65, avgScore: 58, attempts: 198, completions: 129 },
  { course: "admin.demo.courseReact", passRate: 80, avgScore: 72, attempts: 178, completions: 142 },
  { course: "admin.demo.courseSQL", passRate: 76, avgScore: 68, attempts: 156, completions: 119 },
  { course: "admin.demo.courseAlgorithms", passRate: 58, avgScore: 52, attempts: 289, completions: 168 },
  { course: "admin.demo.courseLinux", passRate: 82, avgScore: 74, attempts: 134, completions: 110 },
  { course: "admin.demo.courseML", passRate: 55, avgScore: 48, attempts: 167, completions: 92 },
];

export const demoMaterialProgress: MaterialProgress[] = [
  { course: "admin.demo.coursePython", readPercent: 78, avgMinutes: 32, totalReaders: 267, completed: 208 },
  { course: "admin.demo.courseWeb", readPercent: 65, avgMinutes: 45, totalReaders: 198, completed: 129 },
  { course: "admin.demo.courseDataScience", readPercent: 52, avgMinutes: 55, totalReaders: 156, completed: 81 },
  { course: "admin.demo.courseReact", readPercent: 71, avgMinutes: 38, totalReaders: 142, completed: 101 },
  { course: "admin.demo.courseSQL", readPercent: 68, avgMinutes: 28, totalReaders: 118, completed: 80 },
  { course: "admin.demo.courseAlgorithms", readPercent: 45, avgMinutes: 62, totalReaders: 189, completed: 85 },
  { course: "admin.demo.courseLinux", readPercent: 73, avgMinutes: 35, totalReaders: 98, completed: 72 },
  { course: "admin.demo.courseML", readPercent: 41, avgMinutes: 68, totalReaders: 134, completed: 55 },
];
