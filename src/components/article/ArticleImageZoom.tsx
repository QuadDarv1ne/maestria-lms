"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";

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
 *
 * Uses event delegation: attaching a listener per image required reading
 * `img.width`, which is still `0` for lazy images that have not loaded yet,
 * so most article images silently stayed non-clickable.
 */
export function ArticleImageZoom({ targetSelector = ".article-content" }: ArticleImageZoomProps) {
  const [image, setImage] = useState<ZoomedImage | null>(null);
  const locale = useAppStore((s) => s.locale);

  useEffect(() => {
    const container = document.querySelector(targetSelector);
    if (!container) return;

    const onClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target || target.tagName !== "IMG") return;
      const img = target as HTMLImageElement;
      // Images wrapped in a link navigate instead of zooming.
      if (img.closest("a")) return;
      // Tiny inline icons/emoticons are not worth a lightbox.
      if (img.naturalWidth && img.naturalWidth < 120) return;
      setImage({ src: img.currentSrc || img.src, alt: img.alt || "" });
    };

    container.addEventListener("click", onClick);
    return () => container.removeEventListener("click", onClick);
  }, [targetSelector]);

  return (
    <Dialog open={Boolean(image)} onOpenChange={(open) => !open && setImage(null)}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[95vw] max-h-[95vh] w-auto bg-transparent border-0 p-0 shadow-none"
      >
        <DialogTitle className="sr-only">{image?.alt || t("article.image", locale)}</DialogTitle>
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
              aria-label={t("article.closeImage", locale)}
            >
              <X className="h-5 w-5" />
            </button>
          </figure>
        )}
      </DialogContent>
    </Dialog>
  );
}
