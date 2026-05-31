import type { Metadata } from "next";
import { CookiePage } from "@/components/CookiePage";
export const metadata: Metadata = {
  title: "Политика использования cookie — Maestria",
  description: "Политика использования файлов cookie и аналогичных технологий на платформе Maestria.",
  openGraph: { title: "Политика использования cookie — Maestria", description: "Политика использования файлов cookie и аналогичных технологий на платформе Maestria." },
};
export default function Page() {
  return <CookiePage />;
}
