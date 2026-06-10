"use client";

import { useEffect } from "react";

export function useServiceWorker() {
  useEffect(() => {
    // Check if service workers are supported
    if (!("serviceWorker" in navigator)) {
      console.log("Service workers are not supported");
      return;
    }

    // Register the service worker
    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        console.log("Service Worker registered successfully:", registration);

        // Check for updates periodically
        setInterval(async () => {
          const newRegistration = await navigator.serviceWorker.ready;
          await newRegistration.update();
        }, 6 * 60 * 60 * 1000); // Check every 6 hours

        // Handle updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New content is available, show update notification
              console.log("New content available, please refresh.");
            }
          });
        });
      } catch (error) {
        console.error("Service Worker registration failed:", error);
      }
    };

    registerSW();

    // Handle messages from service worker
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data.type === "CACHE_UPDATED") {
        console.log("Cache updated:", event.data.payload);
      }
    });
  }, []);
}
