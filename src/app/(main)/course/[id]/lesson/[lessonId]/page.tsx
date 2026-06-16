import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { use } from "react";
import { db } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}): Promise<Metadata> {
  const { id, lessonId } = await params;
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      title: true,
      module: { select: { courseId: true, course: { select: { title: true } } } },
    },
  });

  if (!lesson || lesson.module.courseId !== id) notFound();

  const title = `${lesson.title} — ${lesson.module.course.title} | Maestria`;
  const description = `Урок "${lesson.title}" курса ${lesson.module.course.title} на платформе Maestria`;

  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
    },
  };
}

import { StepViewerPage } from "@/components/StepViewerPage";

export default function Page({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId } = use(params);
  return <StepViewerPage courseId={id} lessonId={lessonId} />;
}
