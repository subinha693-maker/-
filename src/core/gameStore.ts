import { create } from 'zustand';
import type { GameState } from './types';
import { createNewGame } from './initialState';

interface GameStore {
  state: GameState | null;
  /** Runtime-only flags (never saved). */
  inBattle: boolean;
  lastSavedAt: string | null;
  newGame: () => void;
  loadState: (s: GameState) => void;
  quitToTitle: () => void;
  setInBattle: (v: boolean) => void;
  markSaved: (at: string) => void;
  /** Applies an immutable update to the game state. */
  mutate: (fn: (s: GameState) => GameState) => void;
  setSpeed: (speed: number) => void;
  setPaused: (paused: boolean) => void;
}

/** Holds the single serializable GameState. Systems mutate it through actions only. */
export const useGame = create<GameStore>((set) => ({
  state: null,
  inBattle: false,
  lastSavedAt: null,
  newGame: () => set({ state: createNewGame(), inBattle: false, lastSavedAt: null }),
  loadState: (s) => set({ state: s, inBattle: false }),
  quitToTitle: () => set({ state: null, inBattle: false, lastSavedAt: null }),
  setInBattle: (v) => set({ inBattle: v }),
  markSaved: (at) => set({ lastSavedAt: at }),
  mutate: (fn) => set((g) => (g.state ? { state: fn(g.state) } : g)),
  setSpeed: (speed) => set((g) => (g.state ? { state: { ...g.state, clock: { ...g.state.clock, speed, paused: false } } } : g)),
  setPaused: (paused) => set((g) => (g.state ? { state: { ...g.state, clock: { ...g.state.clock, paused } } } : g)),
}));
