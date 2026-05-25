import { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const SITE_URL = env.siteUrl;

// Pages that should always be in sitemap
const STATIC_PAGES: MetadataRoute.Sitemap = [
  {
    url: SITE_URL,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 1,
  },
  {
    url: `${SITE_URL}/catalog`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    url: `${SITE_URL}/about`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.5,
  },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const courses = await db.course.findMany({
    where: {
      isPublished: true,
      visibility: "public",
    },
    select: {
      slug: true,
      updatedAt: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  const courseEntries: MetadataRoute.Sitemap = courses.map((course) => ({
    url: `${SITE_URL}/course/${course.slug}`,
    lastModified: course.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...STATIC_PAGES, ...courseEntries];
}
