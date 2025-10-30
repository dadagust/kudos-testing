import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface AuthTokensState {
  accessToken: string | null;
  refreshToken: string | null;
  setTokens: (access: string, refresh: string) => void;
  clearTokens: () => void;
}

type PersistedAuthTokensState = Pick<AuthTokensState, 'accessToken' | 'refreshToken'>;

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
      setTokens: (access, refresh) => set({ accessToken: access, refreshToken: refresh }),
      clearTokens: () => set({ accessToken: null, refreshToken: null }),
    }),
    {
      name: 'kudos-staff-auth',
      storage: createStorage(),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
