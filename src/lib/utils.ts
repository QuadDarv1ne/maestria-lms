import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const localeMap: Record<string, string> = {
  ru: "ru-RU",
  en: "en-US",
  zh: "zh-CN",
};

export function formatDate(
  date: string | Date,
  locale: string = "ru",
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(localeMap[locale] || "ru-RU", options);
}

export function formatNumber(
  value: number,
  locale: string = "ru"
): string {
  return value.toLocaleString(localeMap[locale] || "ru-RU");
}

export function parsePagination(
  searchParams: URLSearchParams,
  options: { defaultLimit?: number; maxLimit?: number } = {},
) {
  const { defaultLimit = 20, maxLimit = 50 } = options;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(maxLimit, Math.max(1, parseInt(searchParams.get("limit") || String(defaultLimit), 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
