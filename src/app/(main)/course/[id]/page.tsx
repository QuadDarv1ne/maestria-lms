import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { use } from "react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { CourseDetailPage } from "@/components/CourseDetailPage";

const SITE_URL = env.siteUrl;

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
  const description = course.shortDesc || course.description?.slice(0, 160) || `${course.title} course on the Maestria platform`;
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

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CourseDetailPage courseId={id} />;
}
