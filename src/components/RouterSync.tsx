"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setRouterPush } from "@/lib/stores/ui";

/**
 * Подключает Next.js useRouter к Zustand store.
 * После этого все вызовы navigate() из любого компонента
 * будут пушить в Next.js router вместо window.location.hash.
 */
export function RouterSync() {
  const router = useRouter();

  useEffect(() => {
    setRouterPush((path: string) => router.push(path));
  }, [router]);

  return null;
}
