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
