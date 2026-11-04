import type { Metadata } from "next";
import { use } from "react";
import { CertificateVerifyPage } from "@/components/CertificateVerifyPage";

export const metadata: Metadata = {
  title: "Проверка сертификата — Maestria",
  description: "Проверка подлинности сертификата об окончании курса на платформе Maestria",
};

export default function Page({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = use(params);
  return <CertificateVerifyPage certificateNumber={number} />;
}
