import type { Metadata } from "next";
import React, { use } from "react";
import { CertificatePage } from "@/components/CertificatePage";

export const metadata: Metadata = {
  title: "Сертификат — Maestria",
  description: "Сертификат об окончании курса на платформе Maestria",
};

export default function Page({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = use(params);
  return <CertificatePage courseId={courseId} />;
}
