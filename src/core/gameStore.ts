import { create } from 'zustand';
import type { GameState } from './types';
import { createNewGame } from './initialState';

interface GameStore {
  state: GameState | null;
  newGame: () => void;
  quitToTitle: () => void;
}

/** Holds the single serializable GameState. Systems (Phase 4+) mutate it through actions only. */
export const useGame = create<GameStore>((set) => ({
  state: null,
  newGame: () => set({ state: createNewGame() }),
  quitToTitle: () => set({ state: null }),
}));
