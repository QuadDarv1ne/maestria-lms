import type { Metadata } from "next";
import { AgeRatingPage } from "@/components/AgeRatingPage";
export const metadata: Metadata = {
  title: "Возрастная классификация — Maestria",
  description: "Возрастная классификация информационной продукции образовательной платформы Maestria.",
  openGraph: { title: "Возрастная классификация — Maestria", description: "Возрастная классификация информационной продукции образовательной платформы Maestria." },
};
export default function Page() {
  return <AgeRatingPage />;
}
