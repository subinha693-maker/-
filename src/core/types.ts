// Core data structures. Definitions (static content) live in src/data,
// runtime state (what gets saved) is GameState. Saves reference definitions by id only.

export type ResourceId = 'food' | 'power' | 'material' | 'parts' | 'budget' | 'data' | 'biosample' | 'alloy';
export type PopulationId = 'labor' | 'research' | 'admin' | 'military' | 'inactive';
export type FacilityCategoryId = 'production' | 'industry' | 'research' | 'military' | 'living' | 'admin';

export interface ResourceDef { id: ResourceId; name: string; category: 'basic' | 'special'; icon: string }
export interface NamedDef<T extends string = string> { id: T; name: string }

export type ResourceMap = Partial<Record<ResourceId, number>>;
export type WorkerType = Exclude<PopulationId, 'inactive'>;
export interface FacilityLevelDef {
  workers: number;              // workers needed for full efficiency
  produce: ResourceMap;         // per game hour at full efficiency
  consume: ResourceMap;         // per game hour at full efficiency
  power: number;                // power used per game hour while operating
  research?: number;            // research rate contributed
  upkeep: { conditionPerDay: number };
  cost: ResourceMap;            // cost to build (level 1) or upgrade to this level
  buildHours: number;
}
export interface FacilityDef {
  id: string; name: string; category: FacilityCategoryId; workerType: WorkerType;
  sprite: string; spriteWidth: number; levels: FacilityLevelDef[];
  requires?: string;            // research id that unlocks building it
}

export interface ResearchNodeDef { id: string; field: string; tier: number; name: string; prereq: string[]; unlocks: { type: string; id: string }[]; cost: ResourceMap; hours: number }

export interface CharacterDef {
  id: string; name: string | null; grade: string | null; origin: string | null; specialty: string | null;
  art: { full: string; focus: [number, number] };
  stats: Record<string, number> | null; traits: string[];
  basicAttack: unknown | null; skill: unknown | null; story: string | null;
}
export interface NpcDef { id: string; name: string; role: string; personality: string | null; art: { full: string; portrait?: string } }
export interface NodeTypeDef { id: string; name: string; icon: string }
export interface DifficultyDef { level: number; name: string }

// ---------- Runtime state (saved) ----------
export interface FacilityInstance {
  uid: string; defId: string; level: number; workers: number;
  condition: number;            // maintenance condition 0..100 (rules TBD)
  status: 'active' | 'idle' | 'building' | 'disabled';   // idle = stopped by the player
  grid: [number, number];
  job?: { kind: 'build' | 'upgrade'; remainingMinutes: number; totalMinutes: number } | null;
}
export interface CharacterInstance {
  charId: string; level: number; growth: Record<string, number>; equipment: string[];
}
export interface ExpeditionState {
  difficulty: number; members: string[]; reinforcements: string[];
  map: unknown; currentNode: string | null; path: string[];
  relics: string[]; buffs: string[]; outpost: { hp: number; maxHp: number };
}
export interface TutorialState { active: boolean; step: number; completedHints: string[]; skipped: boolean }

export interface GameState {
  schema: 1;
  createdAt: string;
  clock: { gameMinutes: number; speed: number; paused: boolean };
  resources: Record<ResourceId, number>;
  population: Record<PopulationId, number>;
  facilities: FacilityInstance[];
  research: { active: string | null; progress: number; completed: string[] }; // progress 0..1
  unlocks: string[];
  roster: CharacterInstance[];
  expedition: ExpeditionState | null;
  tutorial: TutorialState;
  progress: { unlockedDifficulties: number[]; codex: Record<string, unknown>; stats: Record<string, number> };
}
