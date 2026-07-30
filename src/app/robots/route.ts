import { env } from "@/lib/env";

const SITE_URL = env.siteUrl;

export async function GET() {
  const robots = `# Maestria LMS — Robots.txt
# https://www.robotstxt.org/

# Allow major search engines full access to content
User-agent: Googlebot
Allow: /
Disallow: /api/
Disallow: /_next/
Disallow: /admin
Disallow: /teacher
Disallow: /course-editor
Disallow: /reset-password
Disallow: /payment/
Disallow: /lesson/

User-agent: Bingbot
Allow: /
Disallow: /api/
Disallow: /_next/
Disallow: /admin
Disallow: /teacher
Disallow: /course-editor
Disallow: /reset-password
Disallow: /payment/
Disallow: /lesson/

User-agent: Twitterbot
Allow: /
Disallow: /api/

User-agent: facebookexternalhit
Allow: /
Disallow: /api/

# Allow Yandex for Russian market
User-agent: Yandex
Allow: /
Disallow: /api/
Disallow: /_next/
Disallow: /admin
Disallow: /teacher
Disallow: /course-editor
Disallow: /reset-password
Disallow: /payment/
Disallow: /lesson/

# Default rules for all other bots
User-agent: *
Allow: /
Disallow: /api/
Disallow: /_next/
Disallow: /admin
Disallow: /teacher
Disallow: /course-editor
Disallow: /reset-password
Disallow: /payment/
Disallow: /lesson/

# Crawl delay for polite crawling
Crawl-Delay: 10

# Sitemaps
Sitemap: ${SITE_URL}/sitemap.xml
`;

  return new Response(robots, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
