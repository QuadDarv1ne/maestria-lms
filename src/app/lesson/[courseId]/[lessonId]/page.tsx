import type { Metadata } from "next";
import { use } from "react";
import { LessonPage } from "@/components/LessonPage";

export const metadata: Metadata = {
  title: "Урок — Maestria",
  description: "Интерактивный урок на платформе Maestria",
  robots: {
    index: false,
    follow: false,
  },
};

export default function Page({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = use(params);
  return <LessonPage courseId={courseId} lessonId={lessonId} />;
}
