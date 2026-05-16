"use client";

import React, { useState } from "react";
import { resolveCourseImageUrl, getLocalFallbackImage } from "@/lib/courseImage";

interface CourseImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  identifier?: string; // course id or slug for fallback
  loading?: "lazy" | "eager";
}

/**
 * Course image component with CDN-first loading and local fallback.
 * Tries the CDN URL first; if it fails, falls back to a local static file.
 */
export function CourseImage({
  src,
  alt,
  className = "",
  identifier,
  loading = "lazy",
}: CourseImageProps) {
  const [failed, setFailed] = useState(false);

  const cdnUrl = resolveCourseImageUrl(src);
  const fallbackUrl = getLocalFallbackImage(identifier ?? null);

  // If no URL at all, render nothing (parent should show placeholder)
  if (!cdnUrl && !fallbackUrl) return null;

  const finalSrc = (failed ? fallbackUrl : cdnUrl) as string;

  return (
    <img
      src={finalSrc}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => setFailed(true)}
    />
  );
}
