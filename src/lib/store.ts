import { create } from "zustand";
import type { Theme, Locale } from "./stores/ui";
import type { SortBy } from "./stores/catalog";
import { createUISlice, type UISlice } from "./stores/ui";
import { createAuthSlice, type AuthSlice, type UserData } from "./stores/auth";
import { createCatalogSlice, type CatalogSlice } from "./stores/catalog";
import { createFavoritesSlice, type FavoritesSlice } from "./stores/favorites";
import {
  createNotificationsSlice,
  type NotificationsSlice,
  type NotificationItem,
} from "./stores/notifications";

type AppStore = AuthSlice & UISlice & CatalogSlice & FavoritesSlice & NotificationsSlice & {
  logout: () => void;
};

export const useAppStore = create<AppStore>()((set, get, api) => {
  const auth = createAuthSlice(set, get, api);
  const ui = createUISlice(set, get, api);
  const catalog = createCatalogSlice(set, get, api);
  const favorites = createFavoritesSlice(set, get, api);
  const notifications = createNotificationsSlice(set, get, api);

  return {
    ...auth,
    ...ui,
    ...catalog,
    ...favorites,
    ...notifications,
    logout: () => {
      if (typeof window !== "undefined") {
        try {
          // Clear all Maestria-related localStorage keys
          const keysToRemove = [
            "maestria-theme",
            "maestria-locale",
            "maestria-favorites",
            "maestria-notifications",
            "maestria-catalog-filters",
          ];
          for (const key of keysToRemove) {
            localStorage.removeItem(key);
          }
        } catch {
          /* safe to ignore */
        }
      }
      set({
        user: null,
        sessionReady: false,
        sidebarOpen: false,
        currentCourseId: null,
        currentLessonId: null,
        favorites: [],
        notifications: [],
        courseFilters: { category: "", search: "", level: "", sortBy: "popular", freeOnly: false },
      });
    },
  };
});

export function hydrateStore() {
  const store = useAppStore.getState();
  store.hydrate();
  store.hydrateFavorites();
  store.hydrateNotifications();
}

export type { Theme, Locale, SortBy, UserData, NotificationItem };