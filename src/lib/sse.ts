import { log } from "@/lib/logger";
import type { NotificationItem } from "./stores/notifications";

const clients = new Map<string, Set<ReadableStreamDefaultController>>();
const MAX_CONNECTIONS_PER_USER = 5;

// Periodic cleanup of empty client sets (every 5 minutes)
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    for (const [userId, userClients] of clients.entries()) {
      if (userClients.size === 0) {
        clients.delete(userId);
      }
    }
  }, 5 * 60 * 1000);
  cleanupInterval.unref?.(); // Don't keep Node.js alive
}

startCleanup();

function broadcastToClients(userId: string, data: string) {
  const userClients = clients.get(userId);
  if (!userClients) return;

  const encoder = new TextEncoder();
  const encoded = encoder.encode(`data: ${data}\n\n`);
  const failed: ReadableStreamDefaultController[] = [];

  for (const controller of userClients) {
    try {
      controller.enqueue(encoded);
    } catch (err) {
      log.warn("SSE broadcast failed, removing client", { error: err instanceof Error ? err.message : String(err) });
      failed.push(controller);
    }
  }

  for (const controller of failed) {
    userClients.delete(controller);
  }
}

export function addClient(userId: string, controller: ReadableStreamDefaultController) {
  let userClients = clients.get(userId);
  if (!userClients) {
    userClients = new Set();
    clients.set(userId, userClients);
  }

  // Enforce max connections per user to prevent resource exhaustion
  if (userClients.size >= MAX_CONNECTIONS_PER_USER) {
    // Close the oldest connection to make room
    const oldest = userClients.values().next().value;
    if (oldest) {
      try { oldest.close(); } catch { /* already closed */ }
      userClients.delete(oldest);
    }
  }

  userClients.add(controller);

  return () => {
    clients.get(userId)?.delete(controller);
    if (clients.get(userId)?.size === 0) {
      clients.delete(userId);
    }
  };
}

export function pushNotification(userId: string, notification: NotificationItem) {
  const data = JSON.stringify({ type: "notification", notification });
  broadcastToClients(userId, data);
}

export function pushUnreadCount(userId: string, count: number) {
  const data = JSON.stringify({ type: "unreadCount", count });
  broadcastToClients(userId, data);
}
