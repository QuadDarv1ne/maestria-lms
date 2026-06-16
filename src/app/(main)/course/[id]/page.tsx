import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { use } from "react";
import { db } from "@/lib/db";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://maestria.edu";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const course = await db.course.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: {
      title: true,
      description: true,
      shortDesc: true,
      image: true,
      slug: true,
      rating: true,
      reviewCount: true,
      studentCount: true,
      category: { select: { name: true } },
    },
  });

  if (!course) notFound();

  const title = `${course.title} — Maestria`;
  const description = course.shortDesc || course.description?.slice(0, 160) || `Курс ${course.title} на платформе Maestria`;
  const url = `${SITE_URL}/course/${course.slug || id}`;
  const ogImage = course.image || `${SITE_URL}/og/course-default.png`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Maestria",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: course.title,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: url,
    },
  };
}

import { CourseDetailPage } from "@/components/CourseDetailPage";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CourseDetailPage courseId={id} />;
}
