import type { Locale } from "@/lib/store";

export interface StepData {
  id: string;
  title: string;
  type: "video" | "text" | "coding" | "quiz" | "assignment" | "matching" | "ordering" | "essay" | "file_upload" | "drag_drop";
  content: string | null;
  videoUrl: string | null;
  duration: number;
  isFree: boolean;
  sortOrder: number;
  completed: boolean;
  module: {
    id: string;
    title: string;
    courseId: string;
    sortOrder: number;
  };
  assignments: AssignmentData[];
  progress: ProgressData | null;
  prevStepId: string | null;
  nextStepId: string | null;
}

export interface AssignmentData {
  id: string;
  title: string;
  description: string;
  type: string;
  options: string | null;
  correctAnswer: string | null;
  points: number;
}

export interface ProgressData {
  id: string;
  completed: boolean;
  score: number | null;
  timeSpent: number;
}

export interface StepComponentProps {
  step: StepData;
  locale: Locale;
  submittingAssignment: boolean;
  onSubmitAssignment: (assignmentId: string, answer: unknown) => Promise<unknown>;
  onStepComplete: () => void;
}

export function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
