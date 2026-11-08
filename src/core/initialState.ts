import { CONFIG, BALANCE } from './config';
import { DATA } from '../data';
import type { CharacterInstance, GameState, PopulationId, ResourceId } from './types';

export const newAgent = (charId: string): CharacterInstance => ({ charId, level: 1, phase: 1, capBonus: 0, skillLevel: 1, traits: [], merit: 0, growth: {}, equipment: [] });

/** Builds a fresh GameState for "새 게임" from config + data (no hard-coded values here). */
export function createNewGame(): GameState {
  return {
    schema: 2,
    createdAt: new Date().toISOString(),
    clock: { gameMinutes: 0, speed: CONFIG.time.speeds[0], paused: false },
    resources: { ...(BALANCE.startingResources as Record<ResourceId, number>) },
    population: { ...(BALANCE.startingPopulation as Record<PopulationId, number>) },
    facilities: DATA.startingFacilities.map((f, i) => ({
      uid: `f${i + 1}`, defId: f.defId, level: 1, workers: f.workers, condition: 100, status: 'active', grid: f.grid, job: null,
    })),
    research: { active: null, progress: 0, completed: [] },
    unlocks: [],
    roster: DATA.startingRoster.map(newAgent),
    inventory: {},
    expedition: null,
    tutorial: { active: false, step: 0, completedHints: [], skipped: false },
    progress: { unlockedDifficulties: [...CONFIG.progress.initialUnlockedDifficulties], highestCleared: 0, recruit: { reviews: 0 }, codex: {}, stats: {} },
  };
}
