import { create } from 'zustand';

/** Runtime-only tutorial UI state. The persistent part (step, skipped...) lives in GameState.tutorial. */
interface TutorialRuntime {
  line: number;
  promptOpen: boolean;          // "튜토리얼을 진행할까요?" before the first step
  signals: Record<string, unknown>;
  trainingParty: string[];
  set: (p: Partial<Omit<TutorialRuntime, 'set'>>) => void;
}
export const useTutorialRuntime = create<TutorialRuntime>((set) => ({
  line: 0, promptOpen: false, signals: {}, trainingParty: [],
  set: (p) => set(p),
}));
