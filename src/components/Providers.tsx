"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAppStore, hydrateStore } from "@/lib/store";
import { useSSENotifications } from "@/hooks/useSSENotifications";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { loadLocale } from "@/lib/i18n";
import { log } from "@/lib/logger";

function ThemeAndLocaleSync() {
  const theme = useAppStore((s) => s.theme);
  const locale = useAppStore((s) => s.locale);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove("light", "dark", "amber");
    html.classList.add(theme);
    html.setAttribute("lang", locale);
    html.style.colorScheme = theme === "amber" ? "light dark" : theme;
  }, [theme, locale]);

  useEffect(() => {
    loadLocale(locale).catch((err) => log.warn("Locale load failed", { error: String(err) }));
  }, [locale]);

  return null;
}

function SSENotificationsSync() {
  useSSENotifications();
  return null;
}

function ServiceWorkerSync() {
  useServiceWorker();
  return null;
}

function SessionSync() {
  const setUser = useAppStore((s) => s.setUser);

  useEffect(() => {
    let cancelled = false;
    const loadSession = async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const session = await res.json();
          if (session?.user && !cancelled) {
            setUser({
              id: session.user.id || "",
              email: session.user.email || "",
              name: session.user.name || null,
              image: session.user.image || null,
              role: session.user.role || "student",
            });
          }
        }
      } catch (error: unknown) {
        log.debug("Session load skipped for unauthenticated user", { error: error instanceof Error ? error.message : String(error) });
      }
    };

    loadSession();
    return () => { cancelled = true; };
  }, [setUser]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    hydrateStore();
  }, []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <SessionSync />
        <ThemeAndLocaleSync />
        <SSENotificationsSync />
        <ServiceWorkerSync />
        <PWAInstallPrompt />
        {children}
      </SessionProvider>
    </QueryClientProvider>
  );
}
