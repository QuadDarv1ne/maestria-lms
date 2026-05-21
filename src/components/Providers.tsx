"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { useSSENotifications } from "@/hooks/useSSENotifications";

function ThemeAndLocaleSync() {
  const { theme, locale } = useAppStore();

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove("light", "dark", "amber");
    if (theme !== "light") {
      html.classList.add(theme);
    }
    html.setAttribute("lang", locale);
  }, [theme, locale]);

  return null;
}

function SSENotificationsSync() {
  useSSENotifications();
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
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
        <ThemeAndLocaleSync />
        <SSENotificationsSync />
        {children}
      </SessionProvider>
    </QueryClientProvider>
  );
}
