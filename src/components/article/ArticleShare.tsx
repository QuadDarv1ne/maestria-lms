"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Link2, Send, Share2 } from "lucide-react";

interface ArticleShareProps {
  title: string;
  /** Absolute or relative URL of the article. */
  url: string;
}

/**
 * Share row for the article: native share sheet (mobile), Telegram, VK and a
 * copy-link fallback with inline success feedback.
 */
export function ArticleShare({ title, url }: ArticleShareProps) {
  const [copied, setCopied] = useState(false);

  const absoluteUrl =
    typeof window !== "undefined" && url.startsWith("/")
      ? `${window.location.origin}${url}`
      : url;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (insecure context) — fall back to a prompt.
      window.prompt("Скопируйте ссылку", absoluteUrl);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: absoluteUrl });
        return;
      } catch {
        // User dismissed the sheet — fall through to copy.
      }
    }
    await handleCopy();
  };

  const encodedUrl = encodeURIComponent(absoluteUrl);
  const encodedTitle = encodeURIComponent(title);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-medium text-muted-foreground">Поделиться:</span>

      <Button variant="outline" size="sm" onClick={handleNativeShare}>
        <Share2 className="mr-1.5 h-4 w-4" />
        Поделиться
      </Button>

      <Button variant="outline" size="sm" asChild>
        <a
          href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Send className="mr-1.5 h-4 w-4" />
          Telegram
        </a>
      </Button>

      <Button variant="outline" size="sm" asChild>
        <a
          href={`https://vk.com/share.php?url=${encodedUrl}&title=${encodedTitle}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          VK
        </a>
      </Button>

      <Button variant="outline" size="sm" onClick={handleCopy}>
        {copied ? (
          <>
            <Check className="mr-1.5 h-4 w-4 text-green-600" />
            Скопировано
          </>
        ) : (
          <>
            <Link2 className="mr-1.5 h-4 w-4" />
            Ссылка
          </>
        )}
      </Button>
    </div>
  );
}
