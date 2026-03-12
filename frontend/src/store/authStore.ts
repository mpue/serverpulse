import { create } from 'zustand';
import type { User } from '../types/api';

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  setAuth: (user, token) => set({ user, token }),
  setToken: (token) => set({ token }),
  logout: () => set({ user: null, token: null }),
}));
