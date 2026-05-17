import type { StateCreator } from "zustand";
import { loadString, saveString } from "@/lib/storage";

export type Theme = "light" | "dark" | "amber";
export type Locale = "ru" | "en" | "zh";

// Маппинг hash-роутов → Next.js paths (перенесено сюда для устранения circular dependency)
const ROUTE_MAP: Record<string, string> = {
  home: "/",
  catalog: "/catalog",
  profile: "/profile",
  admin: "/admin",
  about: "/about",
  achievements: "/achievements",
  notifications: "/notifications",
  "course-editor": "/course-editor",
  terms: "/terms",
  privacy: "/privacy",
  "personal-data": "/personal-data",
  offer: "/offer",
  refund: "/refund",
  "edu-info": "/edu-info",
  rules: "/rules",
  license: "/license",
  "age-rating": "/age-rating",
  cookies: "/cookies",
  help: "/help",
};

export function hashToPath(hash: string): string {
  if (hash.startsWith("course/") && hash.includes("/lesson/")) {
    const [, courseId, , lessonId] = hash.split("/");
    return `/course/${courseId}/lesson/${lessonId}`;
  }
  if (hash.startsWith("course/")) {
    const [, courseId] = hash.split("/");
    return `/course/${courseId}`;
  }
  if (hash.startsWith("lesson-simple/")) {
    const [, courseId, lessonId] = hash.split("/");
    return `/lesson/${courseId}/${lessonId}`;
  }
  if (hash.startsWith("certificate/")) {
    const [, courseId] = hash.split("/");
    return `/certificate/${courseId}`;
  }
  return ROUTE_MAP[hash] || "/";
}

// Мост между Zustand и Next.js router
let _routerPush: ((path: string) => void) | null = null;

export function setRouterPush(push: (path: string) => void) {
  _routerPush = push;
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
      // Auth dialogs — через search params
      if (page === "login" || page === "register" || page === "forgot-password") {
        const url = new URL(window.location.href);
        url.searchParams.set("dialog", page);
        window.history.pushState({}, "", url.toString());
        return;
      }
      // Динамические роуты через Next.js router bridge
      const path = hashToPath(page);
      if (_routerPush) {
        _routerPush(path);
      } else {
        window.location.hash = page; // fallback для SSR / до инициализации
      }
    }
  },
});
