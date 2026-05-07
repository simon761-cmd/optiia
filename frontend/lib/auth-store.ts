'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isHydrated: boolean;

  // Actions
  setAuth: (data: { accessToken: string; refreshToken: string; user: User }) => void;
  logout: () => void;
  setHydrated: () => void;
}

/**
 * Store d'authentification.
 * Persiste dans localStorage pour survivre aux rechargements de page.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isHydrated: false,

      setAuth: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, refreshToken, user }),

      logout: () =>
        set({ accessToken: null, refreshToken: null, user: null }),

      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'optiia-auth',
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

/** Helper rapide : retourne le token actuel (utilisable hors composants React). */
export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}