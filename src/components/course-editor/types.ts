export interface LessonForm {
  id: string;
  title: string;
  type: "video" | "text" | "coding" | "quiz" | "assignment";
  duration: number;
  isFree: boolean;
  content: string;
  videoUrl: string;
  sortOrder: number;
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
  level: "beginner" | "intermediate" | "advanced";
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
};
