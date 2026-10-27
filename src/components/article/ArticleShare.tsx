"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Link2, Send, Share2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";

interface ArticleShareProps {
  title: string;
  /** Relative URL of the article, used by the copy-link fallback. */
  url: string;
  /**
   * Absolute URL resolved on the server. Share targets (Telegram, VK) need a
   * fully qualified URL, and deriving it from `window.location.origin` during
   * render produced different markup on server vs client (hydration mismatch).
   */
  canonicalUrl: string;
}

/**
 * Share row for the article: native share sheet (mobile), Telegram, VK and a
 * copy-link fallback with inline success feedback.
 */
export function ArticleShare({ title, url, canonicalUrl }: ArticleShareProps) {
  const [copied, setCopied] = useState(false);
  const locale = useAppStore((s) => s.locale);

  const shareUrl = canonicalUrl || url;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("article.copyLinkPrompt", locale), shareUrl);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl });
        return;
      } catch {
        // User dismissed the sheet — fall through to copy.
      }
    }
    await handleCopy();
  };

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm font-medium text-muted-foreground">
        {t("article.share", locale)}:
      </span>

      <Button variant="outline" size="sm" onClick={handleNativeShare}>
        <Share2 className="mr-1.5 h-4 w-4" />
        {t("article.share", locale)}
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
            {t("article.linkCopied", locale)}
          </>
        ) : (
          <>
            <Link2 className="mr-1.5 h-4 w-4" />
            {t("article.shareLink", locale)}
          </>
        )}
      </Button>
    </div>
  );
}
