import { db } from "@/lib/db";
import { pushNotification } from "@/lib/sse";

export type NotificationType = "enrollment" | "completion" | "achievement" | "review" | "payment" | "system";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

export async function createNotification(input: CreateNotificationInput) {
  const notification = await db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link,
    },
  });

  pushNotification(input.userId, {
    id: notification.id,
    type: notification.type as NotificationType,
    title: notification.title,
    message: notification.message,
    read: notification.read,
    createdAt: notification.createdAt.getTime(),
    link: notification.link ?? undefined,
  });

  return notification;
}
