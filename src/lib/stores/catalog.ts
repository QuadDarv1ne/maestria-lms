import type { StateCreator } from "zustand";

export type SortBy = "popular" | "new" | "rating" | "priceAsc" | "priceDesc";

export interface CatalogSlice {
  courseFilters: {
    category: string;
    search: string;
    level: string;
    sortBy: SortBy;
    freeOnly: boolean;
  };
  currentCourseId: string | null;
  currentLessonId: string | null;
  setCourseFilters: (filters: Partial<CatalogSlice["courseFilters"]>) => void;
  setCurrentCourseId: (id: string | null) => void;
  setCurrentLessonId: (id: string | null) => void;
}

export const createCatalogSlice: StateCreator<CatalogSlice, [], [], CatalogSlice> = (set) => ({
  courseFilters: {
    category: "",
    search: "",
    level: "",
    sortBy: "popular",
    freeOnly: false,
  },
  currentCourseId: null,
  currentLessonId: null,

  setCourseFilters: (filters: Partial<CatalogSlice["courseFilters"]>) => {
    set((state) => ({
      courseFilters: { ...state.courseFilters, ...filters },
    }));
  },

  setCurrentCourseId: (id: string | null) => {
    set({ currentCourseId: id });
  },

  setCurrentLessonId: (id: string | null) => {
    set({ currentLessonId: id });
  },
});
