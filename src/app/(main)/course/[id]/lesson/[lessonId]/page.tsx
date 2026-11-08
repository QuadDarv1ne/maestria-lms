import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { use } from "react";
import { db } from "@/lib/db";
import { StepViewerPage } from "@/components/StepViewerPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}): Promise<Metadata> {
  const { id: courseParam, lessonId } = await params;

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      title: true,
      module: { select: { courseId: true, course: { select: { title: true } } } },
    },
  });

  if (!lesson) notFound();

  // Param may be a slug — resolve to UUID before comparing with DB courseId
  let resolvedCourseId: string | null = null;

  if (lesson.module.courseId === courseParam) {
    resolvedCourseId = lesson.module.courseId;
  } else {
    const slugMatch = await db.course.findFirst({
      where: { slug: courseParam },
      select: { id: true },
    });
    resolvedCourseId = slugMatch?.id ?? null;
  }

  if (!resolvedCourseId || resolvedCourseId !== lesson.module.courseId) notFound();

  const title = `${lesson.title} — ${lesson.module.course.title} | Maestria`;
  const description = `Lesson "${lesson.title}" of ${lesson.module.course.title} on the Maestria platform`;

  return {
    title,
    description,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function Page({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId } = use(params);
  return <StepViewerPage courseId={id} lessonId={lessonId} />;
}
