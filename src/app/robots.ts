import { env } from "@/lib/env";

const SITE_URL = env.siteUrl;

export function generateRobotsTxt() {
  return `User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
}
