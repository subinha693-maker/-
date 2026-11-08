// Save data versioning. When the saved structure changes, bump CURRENT_SAVE_VERSION and add a
// migration from the previous version. Old saves are upgraded step by step on load.
export const CURRENT_SAVE_VERSION = 6;

import { DATA } from '../data';
import { initialRegions } from '../systems/regions';

type Data = Record<string, unknown>;
// PHASE 2-5 expeditions only had the fixed sample map.
const SAMPLE_MAP = DATA.sampleMap;
type Migration = (data: Data) => Data;

// v1 -> v2 (PHASE 5): character ids renamed to match confirmed English names,
// agent growth fields, inventory, recruit counters.
const RENAMED: Record<string, string> = { ling: 'ring', zerag: 'jerag' };
const rename = (id: unknown) => (typeof id === 'string' && RENAMED[id]) || id;

/** migrations[n] upgrades data from version n to n + 1. */
export const migrations: Record<number, Migration> = {
  1: (d) => {
    const roster = (d.roster as Data[] | undefined ?? []).map((c) => ({
      phase: 1, capBonus: 0, skillLevel: 1, traits: [], merit: 0, growth: {}, equipment: [],
      ...c, charId: rename(c.charId),
    }));
    const ex = d.expedition as Data | null;
    const expedition = ex ? { ...ex, members: (ex.members as unknown[]).map(rename), reinforcements: ((ex.reinforcements as unknown[]) ?? []).map(rename) } : null;
    const progress = { highestCleared: 0, recruit: { reviews: 0 }, ...(d.progress as Data) };
    return { ...d, schema: 2, roster, expedition, inventory: (d.inventory as Data) ?? {}, progress };
  },
  // v2 -> v3 (PHASE 6): level-cap extension replaced by EXP; expeditions get a real map and progress fields.
  2: (d) => {
    const roster = (d.roster as Data[]).map(({ capBonus: _drop, ...c }) => ({ exp: 0, ...c }));
    const ex = d.expedition as Data | null;
    let expedition: Data | null = null;
    if (ex) {
      const members = ex.members as string[];
      const all = [...members, ...((ex.reinforcements as string[]) ?? [])];
      expedition = {
        seed: 1, difficulty: ex.difficulty, members, reinforcements: ex.reinforcements ?? [],
        hp: Object.fromEntries(all.map((m) => [m, 1])),
        map: SAMPLE_MAP, currentNode: null, path: [], pending: null,
        relics: ex.relics ?? [], buffs: [], loot: {}, outpost: ex.outpost ?? { hp: 100, maxHp: 100 }, log: [],
      };
    }
    return { ...d, schema: 3, roster, expedition };
  },
  // v3 -> v4 (region reclamation): every region starts at its initial state; no operations recorded.
  3: (d) => ({ ...d, schema: 4, regions: d.regions ?? initialRegions(), strategicOps: d.strategicOps ?? {} }),
  // v4 -> v5 (region PHASE 3): an expedition in progress is treated as a general resource run in the first region.
  4: (d) => {
    const ex = d.expedition as Data | null;
    return { ...d, schema: 5, expedition: ex ? { kind: 'general', regionId: 'rg_industrial', purpose: 'resource', opId: null, ...ex } : null };
  },
  // v5 -> v6 (region PHASE 5): development state starts empty; controlled regions get it on first use.
  5: (d) => ({ ...d, schema: 6, regionDev: d.regionDev ?? {} }),
};

export function migrate(data: Data, from: number): { data: Data } | { error: string } {
  let d = data;
  for (let v = from; v < CURRENT_SAVE_VERSION; v++) {
    const m = migrations[v];
    if (!m) return { error: `저장 데이터 버전 ${from}은(는) 현재 버전(${CURRENT_SAVE_VERSION})과 호환되지 않습니다.` };
    d = m(d);
  }
  return { data: d };
}
