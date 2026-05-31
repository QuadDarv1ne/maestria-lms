import type { Metadata } from "next";
import { CourseEditorPage } from "@/components/CourseEditorPage";

export const metadata: Metadata = {
  title: "Редактор курсов — Maestria",
  description: "Создание и редактирование интерактивных курсов на образовательной платформе Maestria. Панель управления контентом.",
};

export default function Page() {
  return <CourseEditorPage />;
}
