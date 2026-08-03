"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAppStore, hydrateStore } from "@/lib/store";
import { useSSENotifications } from "@/hooks/useSSENotifications";
import { useServiceWorker } from "@/hooks/useServiceWorker";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";

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

/** Sync next-auth session into Zustand store */
function SessionSync() {
  const { data: session, status } = useSession();
  const setUser = useAppStore((s) => s.setUser);
  const setSessionReady = useAppStore((s) => s.setSessionReady);

  useEffect(() => {
    if (status === "loading") return;

    if (session?.user) {
      setUser({
        id: (session.user as { id?: string }).id || "",
        email: session.user.email || "",
        name: session.user.name || null,
        image: session.user.image || null,
        role: (session.user as { role?: string }).role || "student",
      });
    }
    setSessionReady();
  }, [session, status, setUser, setSessionReady]);

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
            staleTime: 30_000,
            retry: 2,
            refetchOnWindowFocus: true,
            refetchOnMount: true,
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
