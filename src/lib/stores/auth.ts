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
}

export const createAuthSlice: StateCreator<AuthSlice, [], [], AuthSlice> = (set) => ({
  user: null,

  setUser: (user: UserData | null) => {
    set({ user });
  },
});
