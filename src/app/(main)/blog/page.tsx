import type { Metadata } from "next";
import { BlogPage } from "@/components/BlogPage";

export const metadata: Metadata = {
  title: "Блог — Maestria",
  description: "Статьи по информационным технологиям: разработка, тестирование, базы данных, ИИ, 3D-моделирование и многое другое.",
};

export default function Page() {
  return <BlogPage />;
}
