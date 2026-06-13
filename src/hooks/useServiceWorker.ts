"use client";

import { useEffect } from "react";

export function useServiceWorker() {
  useEffect(() => {
    // Check if service workers are supported
    if (!("serviceWorker" in navigator)) {
      console.log("Service workers are not supported");
      return;
    }

    let updateInterval: ReturnType<typeof setInterval> | undefined;

    const registerSWAsync = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        // Check for updates periodically
        updateInterval = setInterval(async () => {
          const newRegistration = await navigator.serviceWorker.ready;
          await newRegistration.update();
        }, 6 * 60 * 60 * 1000);

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              console.log("New content available, please refresh.");
            }
          });
        });
      } catch (error) {
        console.error("Service Worker registration failed:", error);
      }
    };

    registerSWAsync();

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "CACHE_UPDATED") {
        console.log("Cache updated:", event.data.payload);
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);

    return () => {
      if (updateInterval) clearInterval(updateInterval);
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, []);
}
