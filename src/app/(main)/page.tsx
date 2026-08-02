"use client";

import { HomePage } from "@/components/HomePage";

/**
 * Root page (/) — HomePage.
 * The (main) layout provides Header, Footer, main landmark, page transitions
 * and auth dialogs; session is fetched globally in Providers.
 */
export default function Page() {
  return <HomePage />;
}
