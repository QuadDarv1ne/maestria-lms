import type { StateCreator } from "zustand";

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch { /* ignore */ }
}

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
