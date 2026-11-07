import { DATA } from '../data';
import type { GameState } from '../core/types';

// PHASE 2 scope: only what is needed to store and resume an expedition.
// Node generation, movement and events are PHASE 6.

export function startExpedition(s: GameState, difficulty: number, members: string[]): GameState {
  return {
    ...s,
    expedition: {
      difficulty, members: [...members], reinforcements: [],
      map: { kind: 'sample', columns: DATA.sampleMap.columns.length }, // placeholder until PHASE 6 map generation
      currentNode: null, path: [], relics: [], buffs: [],
      outpost: { hp: 100, maxHp: 100 }, // placeholder value
    },
  };
}

export function endExpedition(s: GameState): GameState {
  return { ...s, expedition: null };
}
