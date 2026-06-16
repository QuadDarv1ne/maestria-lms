import type { Metadata } from "next";
import dynamic from "next/dynamic";

const AdminPage = dynamic(() => import("@/components/AdminPage").then(m => ({ default: m.AdminPage })), {
  loading: () => <AdminPageFallback />,
});

function AdminPageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Загрузка панели администратора...</p>
      </div>
    </div>
  );
}

export const metadata: Metadata = {
  title: "Панель администратора — Maestria",
  description: "Управление курсами, пользователями и статистикой платформы.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function Page() {
  return <AdminPage />;
}
