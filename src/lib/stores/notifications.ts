import type { StateCreator } from "zustand";
import { load, save } from "@/lib/storage";

export interface NotificationItem {
  id: string;
  type: "enrollment" | "completion" | "achievement" | "review" | "payment" | "system";
  title: string;
  message: string;
  read: boolean;
  createdAt: number;
  link?: string;
}

export interface NotificationsSlice {
  notifications: NotificationItem[];
  setNotifications: (notifications: NotificationItem[]) => void;
  addNotification: (notification: NotificationItem) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  unreadNotificationsCount: () => number;
  fetchNotifications: () => Promise<void>;
  publishNotification: (notification: Omit<NotificationItem, "id" | "createdAt">, userId: string) => Promise<void>;
}

export const createNotificationsSlice: StateCreator<NotificationsSlice, [], [], NotificationsSlice> = (set, get) => ({
  notifications: load<NotificationItem[]>("maestria-notifications", []),

  setNotifications: (notifications) => {
    save("maestria-notifications", notifications);
    set({ notifications });
  },

  addNotification: (notification) => {
    const existing = get().notifications;
    if (existing.some((n) => n.id === notification.id)) return;
    const updated = [notification, ...existing];
    save("maestria-notifications", updated);
    set({ notifications: updated });
  },

  markNotificationRead: (id: string) => {
    const updated = get().notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    save("maestria-notifications", updated);
    set({ notifications: updated });

    fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    }).catch((err) => console.error("Failed to mark notification as read on server:", err));
  },

  markAllNotificationsRead: () => {
    const updated = get().notifications.map((n) => ({ ...n, read: true }));
    save("maestria-notifications", updated);
    set({ notifications: updated });

    Promise.all(
      get().notifications.map((n) =>
        fetch(`/api/notifications/${n.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ read: true }),
        }).catch((err) => console.error("Failed to mark notification as read on server:", err))
      )
    ).catch((err) => console.error("Failed to mark all notifications as read:", err));
  },

  unreadNotificationsCount: (): number => {
    return get().notifications.filter((n) => !n.read).length;
  },

  fetchNotifications: async () => {
    try {
      const res = await fetch("/api/notifications?limit=100");
      if (!res.ok) return;
      const data = await res.json();
      if (data.notifications) {
        save("maestria-notifications", data.notifications);
        set({ notifications: data.notifications });
      }
    } catch (err) {
      console.error("Failed to fetch notifications from server, using cached data:", err);
      // fallback to local storage
    }
  },

  publishNotification: async (notification, userId) => {
    try {
      const res = await fetch("/api/notifications/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...notification }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.notification) {
          get().addNotification({
            id: data.notification.id,
            type: data.notification.type,
            title: data.notification.title,
            message: data.notification.message,
            read: false,
            createdAt: new Date(data.notification.createdAt).getTime(),
            link: data.notification.link ?? undefined,
          });
        }
      }
    } catch {
      // fallback: create locally
      const fallback: NotificationItem = {
        ...notification,
        id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        createdAt: Date.now(),
      };
      const updated = [fallback, ...get().notifications];
      save("maestria-notifications", updated);
      set({ notifications: updated });
    }
  },
});
