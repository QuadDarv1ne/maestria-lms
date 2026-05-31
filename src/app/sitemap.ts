import { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

const SITE_URL = env.siteUrl;

// Pages that should always be in sitemap
const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
  { url: `${SITE_URL}/catalog`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
  { url: `${SITE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE_URL}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
  { url: `${SITE_URL}/help`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  { url: `${SITE_URL}/terms`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
  { url: `${SITE_URL}/privacy`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
  { url: `${SITE_URL}/offer`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
  { url: `${SITE_URL}/refund`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
  { url: `${SITE_URL}/rules`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
  { url: `${SITE_URL}/license`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
  { url: `${SITE_URL}/personal-data`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
  { url: `${SITE_URL}/edu-info`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
  { url: `${SITE_URL}/cookies`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
  { url: `${SITE_URL}/age-rating`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const courses = await db.course.findMany({
    where: { isPublished: true, visibility: "public" },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const courseEntries: MetadataRoute.Sitemap = courses.map((course) => ({
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

  const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${SITE_URL}/blog/${article.slug}`,
    lastModified: article.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...STATIC_PAGES, ...courseEntries, ...articleEntries];
}
