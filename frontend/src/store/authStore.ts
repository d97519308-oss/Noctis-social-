'use client';

import { create } from 'zustand';

interface User {
  id: string;
  username: string;
  email: string;
  profileImageUrl?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (token: string, refreshToken: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  login: (token: string, refreshToken: string, user: User) =>
    set({ token, refreshToken, user, isAuthenticated: true }),
  logout: () =>
    set({ token: null, refreshToken: null, user: null, isAuthenticated: false }),
  setUser: (user: User) => set({ user }),
}));
