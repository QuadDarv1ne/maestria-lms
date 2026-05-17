import type { Metadata } from "next";
import { AdminPage } from "@/components/AdminPage";

export const metadata: Metadata = {
  title: "Панель администратора — Maestria",
  description: "Управление курсами, пользователями и статистикой платформы.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function Page() {
  return <AdminPage />;
}
