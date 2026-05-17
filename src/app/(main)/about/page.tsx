import type { Metadata } from "next";
import { AboutPage } from "@/components/AboutPage";

export const metadata: Metadata = {
  title: "О платформе — Maestria",
  description: "Узнайте больше о Maestria — современной платформе для изучения программирования.",
};

export default function Page() {
  return <AboutPage />;
}
