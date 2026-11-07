import { CONFIG, BALANCE } from './config';
import { DATA } from '../data';
import type { GameState, PopulationId, ResourceId } from './types';

/** Builds a fresh GameState for "새 게임" from config + data (no hard-coded values here). */
export function createNewGame(): GameState {
  return {
    schema: 1,
    createdAt: new Date().toISOString(),
    clock: { gameMinutes: 0, speed: CONFIG.time.speeds[0], paused: false },
    resources: { ...(BALANCE.startingResources as Record<ResourceId, number>) },
    population: { ...(BALANCE.startingPopulation as Record<PopulationId, number>) },
    facilities: DATA.startingFacilities.map((f, i) => ({
      uid: `f${i + 1}`, defId: f.defId, level: 1, workers: 0, condition: 100, status: 'active', grid: f.grid,
    })),
    research: { active: null, progress: 0, completed: [] },
    unlocks: [],
    roster: DATA.startingRoster.map((charId) => ({ charId, level: 1, growth: {}, equipment: [] })),
    expedition: null,
    tutorial: { active: false, step: 0, completedHints: [], skipped: false },
    progress: { unlockedDifficulties: [...CONFIG.progress.initialUnlockedDifficulties], codex: {}, stats: {} },
  };
}
