import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

// Private and user-specific areas. Kept in one place: this list used to be
// copy-pasted per user-agent (in public/robots.txt), which is how /profile,
// /notifications, /achievements and /status ended up missing from every block.
const PRIVATE_PATHS = [
  "/api/",
  "/_next/",
  "/admin",
  "/teacher",
  "/course-editor",
  "/reset-password",
  "/payment/",
  "/lesson/",
  "/profile",
  "/notifications",
  "/achievements",
  "/status",
];

// Social crawlers need public pages but have no use for the private areas;
// the API prefix is enough to keep them out of the way.
const API_ONLY = ["/api/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "Googlebot", allow: "/", disallow: PRIVATE_PATHS, crawlDelay: 10 },
      { userAgent: "Yandex", allow: "/", disallow: PRIVATE_PATHS, crawlDelay: 10 },
      { userAgent: "Bingbot", allow: "/", disallow: PRIVATE_PATHS, crawlDelay: 10 },
      { userAgent: "Twitterbot", allow: "/", disallow: API_ONLY },
      { userAgent: "facebookexternalhit", allow: "/", disallow: API_ONLY },
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS, crawlDelay: 10 },
    ],
    sitemap: `${env.siteUrl}/sitemap.xml`,
    host: env.siteUrl,
  };
}
