import type { Metadata } from "next";
import { cookies } from "next/headers";
import dynamic from "next/dynamic";
import { t } from "@/lib/i18n";

const AdminPage = dynamic(() => import("@/components/AdminPage").then(m => ({ default: m.AdminPage })), {
  loading: () => <AdminPageFallback />,
});

function AdminPageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground" aria-busy="true">...</p>
      </div>
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  let locale: "ru" | "en" | "zh" = "ru";
  try {
    const cookieStore = await cookies();
    const value = cookieStore.get("maestria-locale")?.value;
    if (value === "en" || value === "zh" || value === "ru") locale = value;
  } catch { /* static generation fallback */ }
  return {
    title: t("meta.adminTitle", locale),
    description: t("meta.adminDescription", locale),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function Page() {
  return <AdminPage />;
}
