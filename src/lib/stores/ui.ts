import type { StateCreator } from "zustand";

export type Theme = "light" | "dark" | "amber";
export type Locale = "ru" | "en" | "zh";

function loadString(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function saveString(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch { /* ignore */ }
}

export interface UISlice {
  theme: Theme;
  locale: Locale;
  sidebarOpen: boolean;
  isLoading: boolean;
  currentPage: string;
  setTheme: (theme: Theme) => void;
  setLocale: (locale: Locale) => void;
  setSidebarOpen: (open: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  navigate: (page: string) => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  theme: loadString("maestria-theme", "light") as Theme,
  locale: loadString("maestria-locale", "ru") as Locale,
  sidebarOpen: false,
  isLoading: false,
  currentPage: "home",

  setTheme: (theme: Theme) => {
    saveString("maestria-theme", theme);
    set({ theme });
  },

  setLocale: (locale: Locale) => {
    saveString("maestria-locale", locale);
    set({ locale });
  },

  setSidebarOpen: (open: boolean) => {
    set({ sidebarOpen: open });
  },

  setIsLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  navigate: (page: string) => {
    set({ currentPage: page });
    if (typeof window !== "undefined") {
      window.location.hash = page;
    }
  },
});
