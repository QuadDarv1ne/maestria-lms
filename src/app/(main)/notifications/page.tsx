import type { Metadata } from "next";
import { NotificationsPage } from "@/components/NotificationsPage";

export const metadata: Metadata = {
  title: "Уведомления — Maestria",
  description: "Просмотр уведомлений и оповещений платформы Maestria.",
};

export default function Page() {
  return <NotificationsPage />;
}
