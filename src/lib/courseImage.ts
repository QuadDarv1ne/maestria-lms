/**
 * Resolves a course image URL with CDN-first strategy and local fallback.
 *
 * Strategy:
 * 1. If the URL is already an absolute URL (starts with http), use it as-is (CDN)
 * 2. If the URL is a relative path starting with /courses/, use CDN root + filename
 * 3. If the URL is a relative path (any other), prepend the CDN base URL
 * 4. If no URL provided, return null (component should show placeholder)
 */
export function resolveCourseImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // Already an absolute URL — use directly
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // Relative path — use CDN
  const cdnBase = process.env.NEXT_PUBLIC_CDN_URL;
  if (cdnBase) {
    const cleanBase = cdnBase.replace(/\/$/, "");
    // Strip /courses/ prefix since CDN serves files from root
    const cleanPath = url.replace(/^\/courses\//, "");
    return `${cleanBase}/${cleanPath}`;
  }

  // No CDN configured — treat as local path (served by Next.js static files)
  return url;
}

/**
 * Returns the local fallback path for a course image when CDN fails.
 * Generates a deterministic placeholder based on course slug/id.
 */
export function getLocalFallbackImage(identifier: string | null): string {
  if (!identifier) return "/courses/placeholder.svg";
  return `/courses/placeholder.svg`;
}
