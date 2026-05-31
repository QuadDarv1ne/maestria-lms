import type { StateCreator } from "zustand";
import { loadString, saveString } from "@/lib/storage";

export type Theme = "light" | "dark" | "amber";
export type Locale = "ru" | "en" | "zh";

const VALID_THEMES: readonly Theme[] = ["light", "dark", "amber"] as const;
const VALID_LOCALES: readonly Locale[] = ["ru", "en", "zh"] as const;

function validateTheme(value: string): Theme {
  return VALID_THEMES.includes(value as Theme) ? (value as Theme) : "light";
}

function validateLocale(value: string): Locale {
  return VALID_LOCALES.includes(value as Locale) ? (value as Locale) : "ru";
}

function setLocaleCookie(locale: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `maestria-locale=${locale}; Path=/; SameSite=Lax; Max-Age=31536000`;
}

export interface UISlice {
  theme: Theme;
  locale: Locale;
  sidebarOpen: boolean;
  isLoading: boolean;
  setTheme: (theme: Theme) => void;
  setLocale: (locale: Locale) => void;
  setSidebarOpen: (open: boolean) => void;
  setIsLoading: (loading: boolean) => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  theme: validateTheme(loadString("maestria-theme", "light")),
  locale: validateLocale(loadString("maestria-locale", "ru")),
  sidebarOpen: false,
  isLoading: false,

  setTheme: (theme: Theme) => {
    saveString("maestria-theme", theme);
    set({ theme });
  },

  setLocale: (locale: Locale) => {
    saveString("maestria-locale", locale);
    setLocaleCookie(locale);
    set({ locale });
  },

  setSidebarOpen: (open: boolean) => {
    set({ sidebarOpen: open });
  },

  setIsLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
});
