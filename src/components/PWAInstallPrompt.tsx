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
import type { Locale } from "@/lib/store";
import { useAppStore } from "@/lib/store";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const locale = useAppStore((s) => s.locale);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return; // Already installed, don't show prompt
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
        console.log("User accepted the install prompt");
      }

      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      console.error("Install prompt error:", error);
    }
  };

  const handleClose = () => {
    setShowPrompt(false);
  };

  // Don't show if already installed or prompt not available
  if (!showPrompt || !deferredPrompt) {
    return null;
  }

  const titles: Record<Locale, string> = {
    ru: "Установить приложение",
    en: "Install App",
    zh: "安装应用",
  };

  const descriptions: Record<Locale, string> = {
    ru: "Установите Maestria на ваше устройство для быстрого доступа и работы оффлайн.",
    en: "Install Maestria on your device for quick access and offline work.",
    zh: "在您的设备上安装 Maestria 以快速访问和离线工作。",
  };

  const installButtons: Record<Locale, string> = {
    ru: "Установить",
    en: "Install",
    zh: "安装",
  };

  const laterButtons: Record<Locale, string> = {
    ru: "Напомнить позже",
    en: "Remind me later",
    zh: "以后再说",
  };

  return (
    <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <DialogTitle className="text-xl">{titles[locale]}</DialogTitle>
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
            {descriptions[locale]}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-4 py-4">
          <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center">
            <Download className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">
              {locale === "ru"
                ? "Быстрый доступ к курсам и уведомлениям"
                : locale === "zh"
                  ? "快速访问课程和通知"
                  : "Quick access to courses and notifications"}
            </p>
          </div>
        </div>
        <DialogFooter className="sm:justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>
            {laterButtons[locale]}
          </Button>
          <Button onClick={handleInstall}>
            {installButtons[locale]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
