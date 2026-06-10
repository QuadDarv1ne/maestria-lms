import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const siteUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  try {
    // Получаем опубликованные курсы
    const courses = await db.course.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    });

    // Получаем опубликованные статьи
    const articles = await db.article.findMany({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    });

    // Основные страницы
    const staticPages = [
      { url: "/", lastmod: new Date().toISOString(), changefreq: "daily" as const, priority: 1 },
      { url: "/#catalog", lastmod: new Date().toISOString(), changefreq: "weekly" as const, priority: 0.9 },
      { url: "/#about", lastmod: new Date().toISOString(), changefreq: "monthly" as const, priority: 0.7 },
      { url: "/#achievements", lastmod: new Date().toISOString(), changefreq: "weekly" as const, priority: 0.8 },
      { url: "/#help", lastmod: new Date().toISOString(), changefreq: "monthly" as const, priority: 0.6 },
      { url: "/#terms", lastmod: new Date().toISOString(), changefreq: "yearly" as const, priority: 0.5 },
      { url: "/#privacy", lastmod: new Date().toISOString(), changefreq: "yearly" as const, priority: 0.5 },
    ];

    // Формируем sitemap
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticPages
    .map(
      (page) => `  <url>
    <loc>${siteUrl}${page.url}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
    )
    .join("\n")}
  ${courses
    .map(
      (course) => `  <url>
    <loc>${siteUrl}/#course/${course.slug}</loc>
    <lastmod>${course.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
    )
    .join("\n")}
  ${articles
    .map(
      (article) => `  <url>
    <loc>${siteUrl}/#article/${article.slug}</loc>
    <lastmod>${article.updatedAt.toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`
    )
    .join("\n")}
</urlset>`;

    return new NextResponse(sitemap, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Error generating sitemap:", error);
    
    // Fallback sitemap без курсов и статей
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1</priority>
  </url>
  <url>
    <loc>${siteUrl}/#catalog</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;

    return new NextResponse(fallbackSitemap, {
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  }
}
