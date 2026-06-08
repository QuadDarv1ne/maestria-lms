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
  locale: string = "ru",
  options?: Intl.NumberFormatOptions
): string {
  return value.toLocaleString(localeMap[locale] || "ru-RU", options);
}

export function parsePagination(
  searchParams: URLSearchParams,
  options: { defaultLimit?: number; maxLimit?: number } = {},
) {
  const { defaultLimit = 20, maxLimit = 50 } = options;
  const rawPage = parseInt(searchParams.get("page") || "1", 10);
  const rawLimit = parseInt(searchParams.get("limit") || String(defaultLimit), 10);
  const page = Number.isNaN(rawPage) ? 1 : Math.max(1, rawPage);
  const limit = Number.isNaN(rawLimit)
    ? defaultLimit
    : Math.min(maxLimit, Math.max(1, rawLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * Extract initials from a name (e.g., "John Doe" → "JD").
 * Returns up to 2 characters, uppercase. Falls back to given fallback string.
 */
export function getInitials(name: string | null | undefined, fallback = "?"): string {
  if (!name?.trim()) return fallback;
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || fallback;
}
