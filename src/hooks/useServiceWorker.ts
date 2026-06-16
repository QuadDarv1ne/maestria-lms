"use client";

import { useEffect } from "react";
import { log } from "@/lib/logger";

export function useServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      log.debug("Service workers are not supported");
      return;
    }

    let updateInterval: ReturnType<typeof setInterval> | undefined;

    const registerSWAsync = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        updateInterval = setInterval(async () => {
          const newRegistration = await navigator.serviceWorker.ready;
          await newRegistration.update();
        }, 6 * 60 * 60 * 1000);

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              log.debug("New content available, please refresh.");
            }
          });
        });
      } catch (error) {
        log.error("Service Worker registration failed:", { error: error instanceof Error ? error.message : String(error) });
      }
    };

    registerSWAsync();

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "CACHE_UPDATED") {
        log.debug("Cache updated:", event.data.payload);
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);

    return () => {
      if (updateInterval) clearInterval(updateInterval);
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, []);
}
