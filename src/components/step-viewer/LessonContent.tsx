"use client";

import { useCallback, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { detectContentFormat, prepareLessonHtml } from "@/lib/lesson-content";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/store";

interface LessonContentProps {
  content: string | null | undefined;
  locale: Locale;
  className?: string;
}

interface ZoomedImage {
  src: string;
  alt: string;
}

/** Рекурсивно собирает текст из React-узлов (для копирования кода). */
function nodeToText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join("");
  if (typeof node === "object" && "props" in node) {
    return nodeToText((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

function MarkdownCodeBlock({ children, locale }: { children?: ReactNode; locale: Locale }) {
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => nodeToText(children).replace(/\n$/, ""), [children]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard может быть недоступен (не-secure context) — молча игнорируем
    }
  }, [text]);

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={t("course.step.copyCode", locale)}
        className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-border bg-background/90 px-2 py-1 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? t("course.step.codeCopied", locale) : t("course.step.copyCode", locale)}
      </button>
      <pre>{children}</pre>
    </div>
  );
}

/**
 * Универсальный рендерер учебного контента шага.
 *
 * Поддерживает три формата, которые встречаются в курсах:
 * - HTML (импорт из Stepik, редактор с разметкой): санитизируется и выводится как есть;
 * - Markdown (GFM: таблицы, списки, код, изображения) — через react-markdown;
 * - простой текст — с сохранением переносов строк.
 *
 * Дополнительно: клик по изображению открывает его в лайтбоксе,
 * широкие таблицы прокручиваются по горизонтали.
 */
export function LessonContent({ content, locale, className }: LessonContentProps) {
  const value = content ?? "";
  const format = useMemo(() => detectContentFormat(value), [value]);
  const html = useMemo(
    () => (format === "html" ? prepareLessonHtml(value) : ""),
    [format, value],
  );
  const [zoomed, setZoomed] = useState<ZoomedImage | null>(null);

  const handleContentClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target || target.tagName !== "IMG") return;
    const img = target as HTMLImageElement;
    if (!img.src) return;
    setZoomed({ src: img.currentSrc || img.src, alt: img.alt || "" });
  }, []);

  if (!value.trim()) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {t("course.step.loadingContent", locale)}
      </p>
    );
  }

  if (format === "html") {
    return (
      <>
        <div
          className={cn("prose prose-sm max-w-none lesson-content", className)}
          onClick={handleContentClick}
          // HTML прошёл sanitizeContent: опасные теги и атрибуты вырезаны
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <ImageLightbox image={zoomed} onClose={() => setZoomed(null)} locale={locale} />
      </>
    );
  }

  if (format === "markdown") {
    return (
      <>
        <div
          className={cn("prose prose-sm max-w-none lesson-content", className)}
          onClick={handleContentClick}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => {
                const isExternal = !!href && /^https?:\/\//i.test(href);
                return (
                  <a
                    href={href}
                    {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    {children}
                  </a>
                );
              },
              img: ({ src, alt }) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={typeof src === "string" ? src : undefined}
                  alt={alt ?? ""}
                  loading="lazy"
                  decoding="async"
                  className="cursor-zoom-in rounded-lg border border-border"
                />
              ),
              table: ({ children }) => (
                <div className="lesson-table-scroll">
                  <table>{children}</table>
                </div>
              ),
              pre: ({ children }) => <MarkdownCodeBlock locale={locale}>{children}</MarkdownCodeBlock>,
            }}
          >
            {value}
          </ReactMarkdown>
        </div>
        <ImageLightbox image={zoomed} onClose={() => setZoomed(null)} locale={locale} />
      </>
    );
  }

  return (
    <div className={cn("prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed", className)}>
      {value}
    </div>
  );
}

function ImageLightbox({
  image,
  onClose,
  locale,
}: {
  image: ZoomedImage | null;
  onClose: () => void;
  locale: Locale;
}) {
  return (
    <Dialog open={!!image} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-5xl border-0 bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">
          {image?.alt || t("course.step.zoomImage", locale)}
        </DialogTitle>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.src}
            alt={image.alt}
            className="mx-auto max-h-[85vh] w-auto max-w-full rounded-lg object-contain"
          />
        )}
        {image?.alt && (
          <p className="mt-2 text-center text-sm text-white/80">{image.alt}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
