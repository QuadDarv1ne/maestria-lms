import type { StateCreator } from "zustand";
import { load, save } from "@/lib/storage";

export interface NotificationItem {
  id: string;
  type: "enrollment" | "completion" | "achievement" | "review" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
  link?: string;
}

export interface NotificationsSlice {
  notifications: NotificationItem[];
  addNotification: (notification: Omit<NotificationItem, "id" | "createdAt">) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  unreadNotificationsCount: () => number;
  publishNotification: (notification: Omit<NotificationItem, "id" | "createdAt">, userId: string) => Promise<void>;
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

  publishNotification: async (notification, userId) => {
    const newNotification: NotificationItem = {
      ...notification,
      id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
    };
    const updated = [newNotification, ...get().notifications];
    save("maestria-notifications", updated);
    set({ notifications: updated });

    try {
      await fetch("/api/notifications/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, notification: newNotification }),
      });
    } catch {
      // SSE publish is best-effort
    }
  },
});
