import type { Metadata } from "next";
import { OfferPage } from "@/components/OfferPage";
export const metadata: Metadata = {
  title: "Договор оферты — Maestria",
  description: "Публичная оферта на заключение договора возмездного оказания образовательных услуг платформы Maestria.",
  openGraph: { title: "Договор оферты — Maestria", description: "Публичная оферта на заключение договора возмездного оказания образовательных услуг платформы Maestria." },
};
export default function Page() {
  return <OfferPage />;
}
