import type { Metadata } from "next";
import { CatalogPage } from "@/components/CatalogPage";

export const metadata: Metadata = {
  title: "Каталог курсов — Maestria",
  description: "34+ интерактивных курсов по программированию, веб-разработке, Roblox и Data Science. Учитесь в своём темпе.",
};

export default function Page() {
  return <CatalogPage />;
}
