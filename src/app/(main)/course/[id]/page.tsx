import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { use } from "react";
import { CourseDetailPage } from "@/components/CourseDetailPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://maestria.edu";
    const res = await fetch(`${siteUrl}/api/courses/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      notFound();
    }
    const course = await res.json();
    return {
      title: `${course.title} — Maestria`,
      description: course.description,
    };
  } catch {
    notFound();
  }
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CourseDetailPage courseId={id} />;
}
