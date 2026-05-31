import type { Metadata } from "next";
import { PersonalDataConsentPage } from "@/components/PersonalDataConsentPage";
export const metadata: Metadata = {
  title: "Согласие на обработку персональных данных — Maestria",
  description: "Согласие на обработку персональных данных пользователей образовательной платформы Maestria.",
  openGraph: { title: "Согласие на обработку персональных данных — Maestria", description: "Согласие на обработку персональных данных пользователей образовательной платформы Maestria." },
};
export default function Page() {
  return <PersonalDataConsentPage />;
}
