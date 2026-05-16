import { create } from "zustand";

// Типы для состояния приложения
interface UserData {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
}

interface NotificationItem {
  id: string;
  type: "enrollment" | "completion" | "achievement" | "review" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
  link?: string;
}

export type Theme = "light" | "dark" | "amber";
export type Locale = "ru" | "en" | "zh";
export type SortBy = "popular" | "new" | "rating" | "priceAsc" | "priceDesc";

// localStorage helpers
const FAVORITES_KEY = "maestria-favorites";
const NOTIFICATIONS_KEY = "maestria-notifications";
const THEME_KEY = "maestria-theme";
const LOCALE_KEY = "maestria-locale";

function loadFromLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function loadStringFromLocalStorage(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored || fallback;
  } catch {
    return fallback;
  }
}

function saveToLocalStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

function saveStringToLocalStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

interface AppState {
  // Навигация на основе хеша
  currentPage: string;
  // Данные пользователя
  user: UserData | null;
  // Состояние сайдбара
  sidebarOpen: boolean;
  // Состояние загрузки
  isLoading: boolean;
  // Фильтры курсов
  courseFilters: {
    category: string;
    search: string;
    level: string;
    sortBy: SortBy;
    freeOnly: boolean;
  };
  // Текущий просматриваемый курс
  currentCourseId: string | null;
  // Текущий просматриваемый урок
  currentLessonId: string | null;

  // Тема оформления
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Локализация
  locale: Locale;
  setLocale: (locale: Locale) => void;

  // Favorites (stored in localStorage)
  favorites: string[]; // array of course IDs
  toggleFavorite: (courseId: string) => void;
  isFavorite: (courseId: string) => boolean;

  // Notifications
  notifications: NotificationItem[];
  addNotification: (
    notification: Omit<NotificationItem, "id" | "createdAt">
  ) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  unreadNotificationsCount: () => number;

  // Действия
  navigate: (page: string) => void;
  setUser: (user: UserData | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setCourseFilters: (filters: Partial<AppState["courseFilters"]>) => void;
  setCurrentCourseId: (id: string | null) => void;
  setCurrentLessonId: (id: string | null) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentPage: "home",
  user: null,
  sidebarOpen: false,
  isLoading: false,
  courseFilters: {
    category: "",
    search: "",
    level: "",
    sortBy: "popular",
    freeOnly: false,
  },
  currentCourseId: null,
  currentLessonId: null,

  // ── Theme ──────────────────────────────────────────────────────────
  theme: loadStringFromLocalStorage(THEME_KEY, "light") as Theme,

  setTheme: (theme: Theme) => {
    saveStringToLocalStorage(THEME_KEY, theme);
    set({ theme });
  },

  // ── Locale ─────────────────────────────────────────────────────────
  locale: loadStringFromLocalStorage(LOCALE_KEY, "ru") as Locale,

  setLocale: (locale: Locale) => {
    saveStringToLocalStorage(LOCALE_KEY, locale);
    set({ locale });
  },

  // ── Favorites ───────────────────────────────────────────────────────
  favorites: loadFromLocalStorage<string[]>(FAVORITES_KEY, []),

  toggleFavorite: (courseId: string) => {
    const current = get().favorites;
    const updated = current.includes(courseId)
      ? current.filter((id) => id !== courseId)
      : [...current, courseId];
    saveToLocalStorage(FAVORITES_KEY, updated);
    set({ favorites: updated });
  },

  isFavorite: (courseId: string): boolean => {
    return get().favorites.includes(courseId);
  },

  // ── Notifications ───────────────────────────────────────────────────
  notifications: loadFromLocalStorage<NotificationItem[]>(NOTIFICATIONS_KEY, []),

  addNotification: (
    notification: Omit<NotificationItem, "id" | "createdAt">
  ) => {
    const newNotification: NotificationItem = {
      ...notification,
      id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
    };
    const updated = [newNotification, ...get().notifications];
    saveToLocalStorage(NOTIFICATIONS_KEY, updated);
    set({ notifications: updated });
  },

  markNotificationRead: (id: string) => {
    const updated = get().notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    saveToLocalStorage(NOTIFICATIONS_KEY, updated);
    set({ notifications: updated });
  },

  markAllNotificationsRead: () => {
    const updated = get().notifications.map((n) => ({ ...n, read: true }));
    saveToLocalStorage(NOTIFICATIONS_KEY, updated);
    set({ notifications: updated });
  },

  unreadNotificationsCount: (): number => {
    return get().notifications.filter((n) => !n.read).length;
  },

  // ── Navigation ──────────────────────────────────────────────────────
  navigate: (page: string) => {
    set({ currentPage: page });
    if (typeof window !== "undefined") {
      window.location.hash = page;
    }
  },

  setUser: (user: UserData | null) => {
    set({ user });
  },

  setSidebarOpen: (open: boolean) => {
    set({ sidebarOpen: open });
  },

  setIsLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },

  setCourseFilters: (filters: Partial<AppState["courseFilters"]>) => {
    set((state) => ({
      courseFilters: { ...state.courseFilters, ...filters },
    }));
  },

  setCurrentCourseId: (id: string | null) => {
    set({ currentCourseId: id });
  },

  setCurrentLessonId: (id: string | null) => {
    set({ currentLessonId: id });
  },

  logout: () => {
    set({
      user: null,
      currentPage: "home",
      sidebarOpen: false,
      currentCourseId: null,
      currentLessonId: null,
    });
  },
}));
