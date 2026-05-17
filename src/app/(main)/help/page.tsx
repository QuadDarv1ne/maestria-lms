import type { Metadata } from "next";
import { HelpPage } from "@/components/HelpPage";

export const metadata: Metadata = {
  title: "Помощь — Maestria",
  description: "Часто задаваемые вопросы и поддержка для пользователей Maestria.",
};

export default function Page() {
  return <HelpPage />;
}
