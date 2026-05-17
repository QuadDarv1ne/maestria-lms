import type { Metadata } from "next";
import { ProfilePage } from "@/components/ProfilePage";

export const metadata: Metadata = {
  title: "Мой профиль — Maestria",
  description: "Управляйте своими курсами, прогрессом и настройками аккаунта.",
};

export default function Page() {
  return <ProfilePage />;
}
