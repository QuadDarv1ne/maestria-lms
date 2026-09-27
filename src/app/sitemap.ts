import { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const SITE_URL = env.siteUrl;

// Pages that should always be in sitemap
const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: SITE_URL, changeFrequency: "daily", priority: 1 },
  { url: `${SITE_URL}/catalog`, changeFrequency: "daily", priority: 0.9 },
  { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE_URL}/blog`, changeFrequency: "weekly", priority: 0.6 },
  { url: `${SITE_URL}/help`, changeFrequency: "monthly", priority: 0.3 },
  { url: `${SITE_URL}/terms`, changeFrequency: "monthly", priority: 0.2 },
  { url: `${SITE_URL}/privacy`, changeFrequency: "monthly", priority: 0.2 },
  { url: `${SITE_URL}/offer`, changeFrequency: "monthly", priority: 0.2 },
  { url: `${SITE_URL}/refund`, changeFrequency: "monthly", priority: 0.2 },
  { url: `${SITE_URL}/rules`, changeFrequency: "monthly", priority: 0.2 },
  { url: `${SITE_URL}/license`, changeFrequency: "monthly", priority: 0.2 },
  { url: `${SITE_URL}/personal-data`, changeFrequency: "monthly", priority: 0.2 },
  { url: `${SITE_URL}/edu-info`, changeFrequency: "monthly", priority: 0.2 },
  { url: `${SITE_URL}/cookies`, changeFrequency: "monthly", priority: 0.2 },
  { url: `${SITE_URL}/age-rating`, changeFrequency: "monthly", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Gracefully handle missing DATABASE_URL during build
  let courseEntries: MetadataRoute.Sitemap = [];
  let articleEntries: MetadataRoute.Sitemap = [];

  try {
    const courses = await db.course.findMany({
      where: { isPublished: true, visibility: "public" },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    courseEntries = courses.map((course: { slug: string; updatedAt: Date }) => ({
      url: `${SITE_URL}/course/${course.slug}`,
      lastModified: course.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    const articles = await db.article.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    articleEntries = articles.map((article: { slug: string; updatedAt: Date }) => ({
      url: `${SITE_URL}/blog/${article.slug}`,
      lastModified: article.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  } catch {
    // Database not available (e.g., during build) — return static pages only
  }

  return [...STATIC_PAGES, ...courseEntries, ...articleEntries];
}
