import type { Metadata } from "next";
import { EduInfoPage } from "@/components/EduInfoPage";
export const metadata: Metadata = {
  title: "Информация об образовательной деятельности — Maestria",
  description: "Информация об образовательной деятельности платформы Maestria. Сведения об организации, реализующей обучение.",
  openGraph: { title: "Информация об образовательной деятельности — Maestria", description: "Информация об образовательной деятельности платформы Maestria. Сведения об организации, реализующей обучение." },
};
export default function Page() {
  return <EduInfoPage />;
}
