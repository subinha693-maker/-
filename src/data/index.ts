// Central access point for static definitions (Data layer).
import resources from './resources.json';
import population from './population.json';
import facilityCategories from './facilityCategories.json';
import facilities from './facilities.json';
import research from './research.json';
import characters from './characters.json';
import npcs from './npcs.json';
import expedition from './expedition.json';
import tutorial from './tutorial.json';
import items from './items.json';
import relics from './relics.json';
import events from './events.json';
import enemies from './enemies.json';
import regions from './regions.json';
import strategicOps from './strategicOps.json';
import regionDev from './regionDev.json';
import unitSprites from './unitSprites.json';
import enemySprites from './enemySprites.json';
import type { ResourceMap, RegionSiteDef, RegionDef, StrategicOpDef, EnemyDef, SpriteMeta, RelicDef, EventDef, ItemDef, CharacterDef, DifficultyDef, FacilityCategoryId, FacilityDef, NamedDef, NodeTypeDef, NpcDef, PopulationId, ResearchNodeDef, ResourceDef } from '../core/types';

export const DATA = {
  resources: resources as ResourceDef[],
  population: population as NamedDef<PopulationId>[],
  facilityCategories: facilityCategories as NamedDef<FacilityCategoryId>[],
  facilities: facilities.facilities as unknown as FacilityDef[],
  startingFacilities: facilities.startingFacilities as unknown as { defId: string; grid: [number, number]; workers: number }[],
  researchFields: research.fields as NamedDef[],
  researchNodes: research.nodes as unknown as ResearchNodeDef[],
  characters: characters.characters as unknown as CharacterDef[],
  startingRoster: characters.startingRoster as string[],
  npcs: npcs.npcs as NpcDef[],
  nodeTypes: expedition.nodeTypes as NodeTypeDef[],
  difficulties: expedition.difficulties as DifficultyDef[],
  sampleMap: expedition.sampleMap as unknown as { columns: { id: string; type: string }[][]; edges: [string, string][] },
  tutorial,
  items: items.items as ItemDef[],
  relics: relics.relics as RelicDef[],
  events: events.events as EventDef[],
  generation: expedition.generation,
  enemies: enemies.enemies as EnemyDef[],
  unitSprites: unitSprites as Record<string, SpriteMeta>,
  enemySprites: enemySprites as Record<string, SpriteMeta>,
  regionStates: regions.states as { id: number; name: string }[],
  regionTypes: regions.types as { id: string; name: string; feature: string; develop: string }[],
  regions: regions.regions as unknown as RegionDef[],
  generalPurposes: regions.generalPurposes as unknown as { id: string; name: string; focus: string; weightMul: Record<string, number>; lootMul: Record<string, number> }[],
  settlement: expedition.settlement as { ratio: Record<string, number>; items: Record<string, Record<string, number>>; bossItems: Record<string, number> },
  strategicOps: strategicOps.ops as unknown as StrategicOpDef[],
  regionDev: regionDev as unknown as { upkeep: { base: ResourceMap; perActiveSite: ResourceMap; erosionBudgetPerPoint: number }; erosion: { initial: number; efficiencyLossPerPoint: number; minEfficiency: number; cleanupPerDayPer1000: number; cleanupMaxWorkers: number; developedMax: number }; workerStep: number; sitesByType: Record<string, RegionSiteDef[]> },
};

const byId = <T extends { id: string }>(arr: T[]) => new Map(arr.map((x) => [x.id, x]));
const facilityIndex = byId(DATA.facilities);
const characterIndex = byId(DATA.characters);
const nodeTypeIndex = byId(DATA.nodeTypes);

export const getFacilityDef = (id: string) => facilityIndex.get(id);
export const getCharacterDef = (id: string) => characterIndex.get(id);
export const getNodeType = (id: string) => nodeTypeIndex.get(id);
const researchIndex = byId(DATA.researchNodes);
export const getResearch = (id: string) => researchIndex.get(id);
const itemIndex = byId(DATA.items);
export const getItem = (id: string) => itemIndex.get(id);
const relicIndex = byId(DATA.relics);
export const getRelic = (id: string) => relicIndex.get(id);
export const getRegion = (id: string) => DATA.regions.find((r) => r.id === id);
export const getOp = (id: string) => DATA.strategicOps.find((o) => o.id === id);
export const getEnemy = (id: string) => DATA.enemies.find((e) => e.id === id);
export const getEvent = (id: string) => DATA.events.find((e) => e.id === id);
export const getNpc = (id: string) => DATA.npcs.find((n) => n.id === id);

/** Display name helper: undecided names are shown explicitly as undecided. */
export const charName = (c: CharacterDef | undefined) => c?.name ?? `이름 미정 (${c?.id ?? '?'})`;

/** Basic integrity check run at startup; throws with a readable message on broken data. */
export function validateData(): string[] {
  const errors: string[] = [];
  for (const f of DATA.startingFacilities) if (!facilityIndex.has(f.defId)) errors.push(`startingFacilities: unknown facility ${f.defId}`);
  for (const id of DATA.startingRoster) if (!characterIndex.has(id)) errors.push(`startingRoster: unknown character ${id}`);
  for (const n of DATA.researchNodes) for (const p of n.prereq) if (!DATA.researchNodes.some((x) => x.id === p)) errors.push(`research ${n.id}: unknown prereq ${p}`);
  for (const col of DATA.sampleMap.columns) for (const n of col) if (!nodeTypeIndex.has(n.type)) errors.push(`sampleMap: unknown node type ${n.type}`);
  return errors;
}
