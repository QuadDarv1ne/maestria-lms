import type { Metadata } from "next";
import { PrivacyPage } from "@/components/PrivacyPage";
export const metadata: Metadata = {
  title: "Политика конфиденциальности — Maestria",
  description: "Политика конфиденциальности платформы Maestria. Условия обработки и защиты персональных данных пользователей.",
  openGraph: { title: "Политика конфиденциальности — Maestria", description: "Политика конфиденциальности платформы Maestria. Условия обработки и защиты персональных данных пользователей." },
};
export default function Page() {
  return <PrivacyPage />;
}
