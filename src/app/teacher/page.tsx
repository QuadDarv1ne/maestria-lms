import type { Metadata } from "next";
import { TeacherDashboard } from "@/components/TeacherDashboard";

export const metadata: Metadata = {
  title: "Панель преподавателя — Maestria",
  description: "Управление курсами и студентами",
};

export default function TeacherPage() {
  return <TeacherDashboard />;
}
