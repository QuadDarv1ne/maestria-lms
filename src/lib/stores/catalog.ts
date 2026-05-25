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
  setCourseFilters: (filters: Partial<CatalogSlice["courseFilters"]> | ((prev: CatalogSlice["courseFilters"]) => Partial<CatalogSlice["courseFilters"]>)) => void;
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

  setCourseFilters: (filters: Partial<CatalogSlice["courseFilters"]> | ((prev: CatalogSlice["courseFilters"]) => Partial<CatalogSlice["courseFilters"]>)) => {
    set((state) => {
      const updates = typeof filters === "function" ? filters(state.courseFilters) : filters;
      return {
        courseFilters: { ...state.courseFilters, ...updates },
      };
    });
  },

  setCurrentCourseId: (id: string | null) => {
    set({ currentCourseId: id });
  },

  setCurrentLessonId: (id: string | null) => {
    set({ currentLessonId: id });
  },
});
