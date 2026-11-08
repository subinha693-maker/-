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

export interface ResearchNodeDef { id: string; field: string; tier: number; name: string; prereq: string[]; unlocks: { type: string; id: string }[]; cost: ResourceMap; hours: number; rewards?: Record<string, number> }

export interface CharacterDef {
  id: string; name: string | null; nameEn?: string; grade: string | null; origin: string | null; specialty: string | null;
  weapon?: string;
  tendencies?: { stat: string; grade: string }[];   // 능력치 경향성 (letter grades)
  art: { full: string; focus: [number, number] };
  stats: Record<string, number> | null; traits: string[];
  basicAttack: unknown | null; skill: { id: string; name: string; desc: string } | null; story: string | null;
}
export interface RelicDef { id: string; name: string; effects: { stat: string; op: 'mul' | 'add'; value: number }[]; tags: string[] }
export type EventOutcome = { type: 'loot'; loot: ResourceMap } | { type: 'hp'; value: number } | { type: 'outpost'; value: number };
export interface EventDef { id: string; title: string; text: string; choices: { label: string; outcomes: EventOutcome[] }[] }
export interface EnemyDef {
  id: string; name: string; role: 'normal' | 'elite' | 'boss'; sprite: string; size: number;
  hp: number; atk: number; def: number; atkInterval: number; speed: number; range: number; acc: number; eva: number;
}
export interface SpriteMeta { frameW: number; frameH: number; cols: number; anchorX?: number; anims: Record<string, { row: number; frames: number }> }
// ---------- Regions (외부 오염권 지역 탈환) ----------
export type RegionStateId = 1 | 2 | 3 | 4 | 5;
export type Condition =
  | { type: 'regionState'; region: string; atLeast: number }
  | { type: 'opCompleted'; op: string }
  | { type: 'research'; id: string }
  | { type: 'generalClears'; count: number }
  | { type: 'item'; id: string; count: number }
  | { type: 'developed' };
export interface RegionDef {
  id: string; name: string; type: string; description: string; pos: [number, number];
  connections: string[]; initiallyUnlocked: boolean; unlock: Condition[];
  progression: Partial<Record<'2' | '3' | '4' | '5', Condition[]>>;
  general: { fromState: number; purposes: string[] }; difficulty: number; strategicOps: string[];
}
export interface StrategicOpDef {
  id: string; name: string; regionId: string; kind: string; description: string;
  requires: Condition[]; prereqOps: string[];
  primary: { id: string; label: string; node: string }; optional: { id: string; label: string }[];
  returnRequired: boolean; grantsState: number; grantsControl: boolean;
  rewards: { resources: ResourceMap; items: Record<string, number> };
}
export interface RegionProgress { unlocked: boolean; state: RegionStateId; generalRuns: number; generalClears: number }
/** Permanent operation record. Each flag is tracked separately so settlement can never pay twice. */
export interface OpRecord { attempts: number; objectiveAchieved: boolean; returned: boolean; rewardGranted: boolean; controlGranted: boolean; completedAt: number | null }
export interface RegionSiteDef {
  id: string; name: string; repairCost: ResourceMap; repairHours: number; workers: number; requires?: string;
  produce: ResourceMap; consume: ResourceMap; research?: number; survivorsPerDay?: number; outpostBonus?: number;
}
export interface RegionSiteState { status: 'damaged' | 'repairing' | 'active' | 'idle'; remainingMinutes: number; totalMinutes: number; workers: number }
export interface RegionDevState { sites: Record<string, RegionSiteState>; erosion: number; cleanupWorkers: number }
export interface ItemDef { id: string; name: string; icon: string; source: string; use: string; perCharacter?: boolean }
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
  charId: string;
  level: number;                 // 전투 숙련도 레벨
  exp: number;                   // EXP toward the next level
  phase: 1 | 2 | 3;              // 전문가 등급 (승급 단계)
  skillLevel: number;
  traits: string[];              // unlocked trait slot ids
  merit: number;                 // 인사 공적 held for this agent
  growth: Record<string, number>;
  equipment: string[];
}
export interface MapNode { id: string; type: string }
export interface ExpeditionMap { columns: MapNode[][]; edges: [string, string][] }
/** A node event that has been rolled and saved, so loading never re-rolls or duplicates rewards. */
export type NodeOffer =
  | { kind: 'relic'; node: string; choices: string[] }
  | { kind: 'reinforce'; node: string; candidates: string[] }
  | { kind: 'supply'; node: string; charId: string }
  | { kind: 'resource'; node: string; loot: ResourceMap }
  | { kind: 'event'; node: string; eventId: string }
  | { kind: 'rest'; node: string }
  | { kind: 'shop'; node: string; stock: { relic: string; price: ResourceMap }[] }
  | { kind: 'intel'; node: string; loot: ResourceMap }
  | { kind: 'battleReward'; node: string; choices: RewardChoice[] };
export type RewardChoice = { type: 'loot'; loot: ResourceMap } | { type: 'relic'; relic: string } | { type: 'heal'; amount: number };
export interface ExpeditionBuff { id: string; source: string; text: string }
export interface ExpeditionState {
  seed: number;
  kind: 'general' | 'strategic';   // general = repeatable; strategic = PHASE 4 operations
  regionId: string;
  purpose: string;                 // general expedition purpose (자원 회수 / 생체시료 / 특수 조사 / 잔존 위협)
  opId: string | null;
  difficulty: number;
  members: string[];               // the 3 who departed
  reinforcements: string[];        // 후발대 joined during the expedition
  hp: Record<string, number>;      // per agent, 0..1 (combat numbers come in PHASE 7)
  map: ExpeditionMap;
  currentNode: string | null;      // null = at the entry point
  path: string[];                  // completed nodes in order
  pending: NodeOffer | null;
  relics: string[];
  buffs: ExpeditionBuff[];
  loot: ResourceMap;               // collected in the zone; settled at the base (PHASE 8)
  outpost: { hp: number; maxHp: number };
  log: string[];
}
export interface TutorialState { active: boolean; step: number; completedHints: string[]; skipped: boolean }

export interface GameState {
  schema: 6;
  createdAt: string;
  clock: { gameMinutes: number; speed: number; paused: boolean };
  resources: Record<ResourceId, number>;
  population: Record<PopulationId, number>;
  facilities: FacilityInstance[];
  research: { active: string | null; progress: number; completed: string[] }; // progress 0..1
  unlocks: string[];
  roster: CharacterInstance[];
  inventory: Record<string, number>;   // growth materials (except per-character 인사 공적)
  regions: Record<string, RegionProgress>;
  strategicOps: Record<string, OpRecord>;
  regionDev: Record<string, RegionDevState>;   // created when a region comes under control
  expedition: ExpeditionState | null;
  tutorial: TutorialState;
  progress: {
    unlockedDifficulties: number[]; highestCleared: number;
    recruit: { reviews: number };
    codex: Record<string, unknown>; stats: Record<string, number>;
  };
}
