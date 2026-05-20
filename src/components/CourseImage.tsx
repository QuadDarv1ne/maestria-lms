"use client";

import { useState } from "react";
import Image from "next/image";
import { resolveCourseImageUrl, getLocalFallbackImage } from "@/lib/courseImage";

interface CourseImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  identifier?: string;
  loading?: "lazy" | "eager";
}

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

  if (!cdnUrl && !fallbackUrl) return null;

  const finalSrc = failed ? (fallbackUrl ?? null) : (cdnUrl ?? null);
  if (!finalSrc) return null;

  return (
    <Image
      src={finalSrc}
      alt={alt}
      fill
      className={className}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      loading={loading}
      onError={() => setFailed(true)}
    />
  );
}
