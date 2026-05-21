import type { NotificationItem } from "./stores/notifications";

const clients = new Map<string, Set<ReadableStreamDefaultController>>();

export function addClient(userId: string, controller: ReadableStreamDefaultController) {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  const existing = clients.get(userId);
  if (existing) {
    existing.add(controller);
  } else {
    const set = new Set<ReadableStreamDefaultController>();
    set.add(controller);
    clients.set(userId, set);
  }

  return () => {
    clients.get(userId)?.delete(controller);
    if (clients.get(userId)?.size === 0) {
      clients.delete(userId);
    }
  };
}

export function pushNotification(userId: string, notification: NotificationItem) {
  const userClients = clients.get(userId);
  if (!userClients) return;

  const data = JSON.stringify({ type: "notification", notification });
  const encoder = new TextEncoder();

  for (const controller of userClients) {
    try {
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    } catch {
      userClients.delete(controller);
    }
  }
}

export function pushUnreadCount(userId: string, count: number) {
  const userClients = clients.get(userId);
  if (!userClients) return;

  const data = JSON.stringify({ type: "unreadCount", count });
  const encoder = new TextEncoder();

  for (const controller of userClients) {
    try {
      controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    } catch {
      userClients.delete(controller);
    }
  }
}
