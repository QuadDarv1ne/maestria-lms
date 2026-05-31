import type { Metadata } from "next";
import { TermsPage } from "@/components/TermsPage";
export const metadata: Metadata = {
  title: "Пользовательское соглашение — Maestria",
  description: "Пользовательское соглашение образовательной платформы Maestria. Условия использования сервиса, права и обязанности сторон.",
  openGraph: { title: "Пользовательское соглашение — Maestria", description: "Пользовательское соглашение образовательной платформы Maestria. Условия использования сервиса, права и обязанности сторон." },
};
export default function Page() {
  return <TermsPage />;
}
