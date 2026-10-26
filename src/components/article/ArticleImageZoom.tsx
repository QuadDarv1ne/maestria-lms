"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface ZoomedImage {
  src: string;
  alt: string;
}

interface ArticleImageZoomProps {
  /** Container selector that holds the rendered article HTML. */
  targetSelector?: string;
}

/**
 * Makes every image inside the article body clickable and opens it in a
 * full-screen lightbox. Keeps the native `alt` text as the caption.
 */
export function ArticleImageZoom({ targetSelector = ".article-content" }: ArticleImageZoomProps) {
  const [image, setImage] = useState<ZoomedImage | null>(null);

  useEffect(() => {
    const container = document.querySelector(targetSelector);
    if (!container) return;

    const images = Array.from(container.querySelectorAll("img"));
    const handlers: Array<{ el: HTMLImageElement; fn: (e: Event) => void }> = [];

    for (const img of images) {
      // Decorative or tiny icons are not worth zooming into.
      if (img.closest("a") || img.width < 120) continue;
      img.style.cursor = "zoom-in";
      const fn = () => setImage({ src: img.currentSrc || img.src, alt: img.alt || "" });
      img.addEventListener("click", fn);
      handlers.push({ el: img, fn });
    }

    return () => {
      for (const { el, fn } of handlers) el.removeEventListener("click", fn);
    };
  }, [targetSelector]);

  return (
    <Dialog open={Boolean(image)} onOpenChange={(open) => !open && setImage(null)}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[95vw] max-h-[95vh] w-auto bg-transparent border-0 p-0 shadow-none"
      >
        <DialogTitle className="sr-only">{image?.alt || "Изображение статьи"}</DialogTitle>
        {image && (
          <figure className="relative flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.src}
              alt={image.alt}
              className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
            />
            {image.alt && (
              <figcaption className="max-w-2xl text-center text-sm text-white/90 drop-shadow">
                {image.alt}
              </figcaption>
            )}
            <button
              type="button"
              onClick={() => setImage(null)}
              className="absolute -top-2 right-0 translate-x-1/2 -translate-y-1/2 rounded-full bg-black/70 p-2 text-white transition hover:bg-black"
              aria-label="Закрыть изображение"
            >
              <X className="h-5 w-5" />
            </button>
          </figure>
        )}
      </DialogContent>
    </Dialog>
  );
}
