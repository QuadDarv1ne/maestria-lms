"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { log } from "@/lib/logger";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const locale = useAppStore((s) => s.locale);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        log.info("User accepted the PWA install prompt");
      }

      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      log.error("PWA install prompt error", { error });
    }
  };

  const handleClose = () => {
    setShowPrompt(false);
  };

  if (!showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <DialogTitle className="text-xl">{t("pwa.installTitle", locale)}</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">{t("common.close", locale)}</span>
            </Button>
          </div>
          <DialogDescription className="text-base">
            {t("pwa.installDesc", locale)}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-4 py-4">
          <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center">
            <Download className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">
              {t("pwa.quickAccess", locale)}
            </p>
          </div>
        </div>
        <DialogFooter className="sm:justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            {t("pwa.remindLater", locale)}
          </Button>
          <Button onClick={handleInstall}>
            {t("pwa.installNow", locale)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
