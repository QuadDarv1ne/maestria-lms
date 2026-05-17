import type { StateCreator } from "zustand";

export interface NotificationItem {
  id: string;
  type: "enrollment" | "completion" | "achievement" | "review" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
  link?: string;
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch { /* ignore */ }
}

export interface NotificationsSlice {
  notifications: NotificationItem[];
  addNotification: (notification: Omit<NotificationItem, "id" | "createdAt">) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  unreadNotificationsCount: () => number;
}

export const createNotificationsSlice: StateCreator<NotificationsSlice, [], [], NotificationsSlice> = (set, get) => ({
  notifications: load<NotificationItem[]>("maestria-notifications", []),

  addNotification: (notification) => {
    const newNotification: NotificationItem = {
      ...notification,
      id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
    };
    const updated = [newNotification, ...get().notifications];
    save("maestria-notifications", updated);
    set({ notifications: updated });
  },

  markNotificationRead: (id: string) => {
    const updated = get().notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    save("maestria-notifications", updated);
    set({ notifications: updated });
  },

  markAllNotificationsRead: () => {
    const updated = get().notifications.map((n) => ({ ...n, read: true }));
    save("maestria-notifications", updated);
    set({ notifications: updated });
  },

  unreadNotificationsCount: (): number => {
    return get().notifications.filter((n) => !n.read).length;
  },
});
