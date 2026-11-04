import type { Metadata } from "next";
import { CertificateVerifyPage } from "@/components/CertificateVerifyPage";

export const metadata: Metadata = {
  title: "Проверка сертификата — Maestria",
  description: "Проверка подлинности сертификата об окончании курса на платформе Maestria",
};

export default function Page() {
  return <CertificateVerifyPage />;
}
