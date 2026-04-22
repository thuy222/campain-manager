import { create } from "zustand";

export type User = {
  id: string;
  email: string;
  name: string;
  created_at: string;
};

type AuthState = {
  user: User | null;
  setUser: (user: User | null) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clear: () => set({ user: null }),
}));
