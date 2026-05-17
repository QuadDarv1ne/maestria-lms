import type { Metadata } from "next";
import React, { use } from "react";
import { StepViewerPage } from "@/components/StepViewerPage";

export const metadata: Metadata = {
  title: "Просмотр урока — Maestria",
  description: "Интерактивный урок на платформе Maestria",
  robots: {
    index: false,
    follow: false,
  },
};

export default function Page({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId } = use(params);
  return <StepViewerPage courseId={id} lessonId={lessonId} />;
}
