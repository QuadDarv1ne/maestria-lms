import type { Metadata } from "next";
import { AchievementsPage } from "@/components/AchievementsPage";

export const metadata: Metadata = {
  title: "Достижения — Maestria",
  description: "Ваши достижения и награды на платформе Maestria.",
};

export default function Page() {
  return <AchievementsPage />;
}
