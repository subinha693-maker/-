import { create } from 'zustand';

export type ScreenId =
  | 'title' | 'saveLoad' | 'main' | 'facilities' | 'population' | 'research' | 'squad' | 'recruit'
  | 'expeditionPrep' | 'expeditionMap' | 'battle' | 'result' | 'screenIndex' | 'regionMap' | 'regionManage';

interface RouterStore {
  screen: ScreenId;
  params: Record<string, unknown>;
  stack: { screen: ScreenId; params: Record<string, unknown> }[];
  go: (screen: ScreenId, params?: Record<string, unknown>) => void;
  replace: (screen: ScreenId, params?: Record<string, unknown>) => void;
  back: () => void;
  reset: (screen: ScreenId) => void;
}

/** Scene router: a stack of screens so "뒤로" always returns to where the player came from. */
export const useRouter = create<RouterStore>((set, get) => ({
  screen: 'title',
  params: {},
  stack: [],
  go: (screen, params = {}) => set((s) => ({ stack: [...s.stack, { screen: s.screen, params: s.params }], screen, params })),
  replace: (screen, params = {}) => set({ screen, params }),
  back: () => {
    const { stack } = get();
    if (!stack.length) return;
    const prev = stack[stack.length - 1];
    set({ stack: stack.slice(0, -1), screen: prev.screen, params: prev.params });
  },
  reset: (screen) => set({ screen, params: {}, stack: [] }),
}));
