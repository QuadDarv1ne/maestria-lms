import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { use } from "react";
import { StepViewerPage } from "@/components/StepViewerPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}): Promise<Metadata> {
  const { id, lessonId } = await params;
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://maestria.edu";
    const res = await fetch(`${siteUrl}/api/courses/${id}/lessons/${lessonId}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const lesson = await res.json();
      return {
        title: `${lesson.lesson?.title || "Просмотр урока"} — Maestria`,
        description: "Интерактивный урок на платформе Maestria",
        robots: {
          index: false,
          follow: false,
        },
      };
    }
  } catch {
    // Will fallback to notFound() below
  }
  notFound();
}

export default function Page({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId } = use(params);
  return <StepViewerPage courseId={id} lessonId={lessonId} />;
}
