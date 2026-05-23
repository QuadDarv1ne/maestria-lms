"use client";

import { useRouter } from "next/navigation";
import { useAppStore } from "./store";

export { hashToPath } from "./stores/ui";

// Хук для нового кода (опционально, для будущих компонентов)
export function useAppRouter() {
  const router = useRouter();
  const navigate = useAppStore((s) => s.navigate);
  return { router, navigate };
}
