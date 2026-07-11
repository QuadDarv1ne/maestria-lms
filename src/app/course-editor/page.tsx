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
        <p className="text-sm text-muted-foreground" aria-busy="true">...</p>
      </div>
    </div>
  );
}

export const metadata: Metadata = {
  title: "Course Editor — Maestria",
  description: "Create and edit interactive courses on the Maestria educational platform. Content management panel.",
};

export default function Page() {
  return <CourseEditorPage />;
}
