import type { Metadata } from "next";
import { LicensePage } from "@/components/LicensePage";
export const metadata: Metadata = {
  title: "Лицензионное соглашение — Maestria",
  description: "Лицензионное соглашение на использование контента образовательной платформы Maestria (CC BY-SA 4.0).",
  openGraph: { title: "Лицензионное соглашение — Maestria", description: "Лицензионное соглашение на использование контента образовательной платформы Maestria (CC BY-SA 4.0)." },
};
export default function Page() {
  return <LicensePage />;
}
