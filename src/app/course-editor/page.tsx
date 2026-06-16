import type { Metadata } from "next";
import dynamic from "next/dynamic";

const CourseEditorPage = dynamic(() => import("@/components/CourseEditorPage").then(m => ({ default: m.CourseEditorPage })), {
  loading: () => <EditorPageFallback />,
});

function EditorPageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Загрузка редактора курсов...</p>
      </div>
    </div>
  );
}

export const metadata: Metadata = {
  title: "Редактор курсов — Maestria",
  description: "Создание и редактирование интерактивных курсов на образовательной платформе Maestria. Панель управления контентом.",
};

export default function Page() {
  return <CourseEditorPage />;
}
