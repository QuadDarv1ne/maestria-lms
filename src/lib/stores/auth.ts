import type { StateCreator } from "zustand";

export interface UserData {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
}

export interface AuthSlice {
  user: UserData | null;
  setUser: (user: UserData | null) => void;
  logout: () => void;
}

export const createAuthSlice: StateCreator<AuthSlice, [], [], AuthSlice> = (set) => ({
  user: null,

  setUser: (user: UserData | null) => {
    set({ user });
  },

  logout: () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("maestria-favorites");
        window.localStorage.removeItem("maestria-notifications");
      } catch { /* safe to ignore */ }
    }
    set({
      user: null,
    });
  },
});
