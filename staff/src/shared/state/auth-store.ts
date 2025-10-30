import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { UserProfile } from '@/entities/user';

interface AuthTokensState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: UserProfile | null) => void;
  clearTokens: () => void;
}

type PersistedAuthTokensState = Pick<
  AuthTokensState,
  'accessToken' | 'refreshToken' | 'user'
>;

const createStorage = () =>
  createJSONStorage<PersistedAuthTokensState>(() => {
    if (typeof window === 'undefined') {
      const memoryStorage: Record<string, string> = {};

      return {
        getItem: (name: string) => memoryStorage[name] ?? null,
        setItem: (name: string, value: string) => {
          memoryStorage[name] = value;
        },
        removeItem: (name: string) => {
          delete memoryStorage[name];
        },
      };
    }

    return window.localStorage;
  });

export const useAuthStore = create<AuthTokensState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (access, refresh) => set({ accessToken: access, refreshToken: refresh }),
      setUser: (user) => set({ user }),
      clearTokens: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: 'kudos-staff-auth',
      storage: createStorage(),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
);
