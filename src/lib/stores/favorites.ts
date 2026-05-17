import type { StateCreator } from "zustand";
import { load, save } from "@/lib/storage";

export interface FavoritesSlice {
  favorites: string[];
  toggleFavorite: (courseId: string) => void;
  isFavorite: (courseId: string) => boolean;
}

export const createFavoritesSlice: StateCreator<FavoritesSlice, [], [], FavoritesSlice> = (set, get) => ({
  favorites: load<string[]>("maestria-favorites", []),

  toggleFavorite: (courseId: string) => {
    const current = get().favorites;
    const updated = current.includes(courseId)
      ? current.filter((id) => id !== courseId)
      : [...current, courseId];
    save("maestria-favorites", updated);
    set({ favorites: updated });
  },

  isFavorite: (courseId: string): boolean => {
    return get().favorites.includes(courseId);
  },
});
