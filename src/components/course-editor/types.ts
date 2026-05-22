export type LessonType = "video" | "text" | "coding" | "quiz" | "assignment" | "interactive";
export type AssignmentType = "quiz" | "coding" | "text" | "matching" | "ordering" | "file_upload" | "essay" | "drag_drop";
export type CourseLevel = "beginner" | "intermediate" | "advanced";
export type CourseVisibility = "public" | "private" | "unlisted";
export type SubmissionStatus = "draft" | "submitted" | "graded" | "failed";

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface OrderingItem {
  id: string;
  text: string;
  correctPosition: number;
}

export interface LessonForm {
  id: string;
  title: string;
  type: LessonType;
  duration: number;
  isFree: boolean;
  content: string;
  videoUrl: string;
  sortOrder: number;
  assignments: AssignmentForm[];
}

export interface AssignmentForm {
  id: string;
  title: string;
  type: AssignmentType;
  description: string;
  points: number;
  // Quiz-specific
  quizOptions?: QuizOption[];
  // Matching-specific
  matchingPairs?: MatchingPair[];
  // Ordering-specific
  orderingItems?: OrderingItem[];
  // General
  correctAnswer?: string;
  maxAttempts?: number;
  timeLimit?: number; // minutes
}

export interface ModuleForm {
  id: string;
  title: string;
  lessons: LessonForm[];
  isExpanded: boolean;
}

export interface CourseFormData {
  title: string;
  slug: string;
  shortDesc: string;
  description: string;
  categorySlug: string;
  level: CourseLevel;
  duration: string;
  price: number;
  oldPrice: number;
  hasCertificate: boolean;
  tags: string;
  modules: ModuleForm[];
  requirements: string[];
  whatYouLearn: string[];
  isPublished: boolean;
  isFeatured: boolean;
  // New settings
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  visibility: CourseVisibility;
  maxStudents: number;
  prerequisites: string[]; // course IDs
  language: string;
}

let _counter = 0;
export function uid() {
  return `temp-${Date.now()}-${++_counter}`;
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function createEmptyModule(): ModuleForm {
  return {
    id: uid(),
    title: "",
    lessons: [],
    isExpanded: true,
  };
}

export function createEmptyQuizOption(): QuizOption {
  return {
    id: uid(),
    text: "",
    isCorrect: false,
  };
}

export function createEmptyMatchingPair(): MatchingPair {
  return {
    id: uid(),
    left: "",
    right: "",
  };
}

export function createEmptyOrderingItem(): OrderingItem {
  return {
    id: uid(),
    text: "",
    correctPosition: 0,
  };
}

export function createEmptyAssignment(): AssignmentForm {
  return {
    id: uid(),
    title: "",
    type: "quiz",
    description: "",
    points: 10,
    quizOptions: [createEmptyQuizOption(), createEmptyQuizOption(), createEmptyQuizOption(), createEmptyQuizOption()],
    matchingPairs: [createEmptyMatchingPair(), createEmptyMatchingPair(), createEmptyMatchingPair()],
    orderingItems: [createEmptyOrderingItem(), createEmptyOrderingItem(), createEmptyOrderingItem()],
    maxAttempts: 3,
    timeLimit: 0,
  };
}

export function createEmptyLesson(sortOrder: number): LessonForm {
  return {
    id: uid(),
    title: "",
    type: "video",
    duration: 0,
    isFree: false,
    content: "",
    videoUrl: "",
    sortOrder,
    assignments: [],
  };
}

export const initialFormData: CourseFormData = {
  title: "",
  slug: "",
  shortDesc: "",
  description: "",
  categorySlug: "",
  level: "beginner",
  duration: "",
  price: 0,
  oldPrice: 0,
  hasCertificate: true,
  tags: "",
  modules: [],
  requirements: [""],
  whatYouLearn: [""],
  isPublished: false,
  isFeatured: false,
  // New settings
  startDate: "",
  endDate: "",
  visibility: "public",
  maxStudents: 0,
  prerequisites: [],
  language: "ru",
};
