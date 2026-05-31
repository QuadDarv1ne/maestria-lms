import type { Metadata } from "next";
import { RulesPage } from "@/components/RulesPage";
export const metadata: Metadata = {
  title: "Правила платформы — Maestria",
  description: "Правила использования образовательной платформы Maestria. Требования к поведению пользователей и публикуемому контенту.",
  openGraph: { title: "Правила платформы — Maestria", description: "Правила использования образовательной платформы Maestria. Требования к поведению пользователей и публикуемому контенту." },
};
export default function Page() {
  return <RulesPage />;
}
