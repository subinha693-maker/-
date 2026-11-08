// Region development (지역 탈환 PHASE 5). Controlled regions (state >= 4) can have their facilities
// repaired, staffed and run. They produce through the government economy but also cost upkeep,
// and residual erosion lowers efficiency and costs budget until cleaned up.
// State 5 (지역 개발 완료) = every site operating and erosion at or below the configured limit.
import { DATA, getRegion } from '../data';
import type { GameState, RegionDevState, RegionSiteDef, ResourceMap } from '../core/types';
import type { ActionResult } from './government';

const CFG = DATA.regionDev;
const fail = (message: string): ActionResult => ({ ok: false, message });
const RES_NAME = (id: string) => DATA.resources.find((r) => r.id === id)?.name ?? id;

export const siteDefs = (regionId: string): RegionSiteDef[] => CFG.sitesByType[getRegion(regionId)?.type ?? ''] ?? [];
export const canDevelop = (s: GameState, regionId: string) => (s.regions[regionId]?.state ?? 0) >= 4;
export function newDev(regionId: string): RegionDevState {
  return { sites: Object.fromEntries(siteDefs(regionId).map((d) => [d.id, { status: 'damaged' as const, remainingMinutes: 0, totalMinutes: 0, workers: 0 }])), erosion: CFG.erosion.initial, cleanupWorkers: 0 };
}
/** Development state of a controlled region (default if not touched yet). */
export const devOf = (s: GameState, regionId: string): RegionDevState => s.regionDev[regionId] ?? newDev(regionId);
const withDev = (s: GameState, regionId: string, fn: (d: RegionDevState) => RegionDevState): GameState => ({ ...s, regionDev: { ...s.regionDev, [regionId]: fn(devOf(s, regionId)) } });

export const erosionFactor = (erosion: number) => Math.max(CFG.erosion.minEfficiency, 1 - erosion * CFG.erosion.efficiencyLossPerPoint);
export function isDeveloped(s: GameState, regionId: string): boolean {
  const d = s.regionDev[regionId]; if (!d) return false;
  const defs = siteDefs(regionId);
  return defs.length > 0 && defs.every((x) => d.sites[x.id]?.status === 'active') && d.erosion <= CFG.erosion.developedMax;
}
export function developmentProgress(s: GameState, regionId: string) {
  const d = devOf(s, regionId); const defs = siteDefs(regionId);
  return { active: defs.filter((x) => d.sites[x.id]?.status === 'active').length, total: defs.length, erosion: d.erosion, target: CFG.erosion.developedMax };
}

/** Labor used by all region sites and cleanup crews (counts against the labor population). */
export function regionLabor(s: GameState): number {
  let n = 0;
  for (const [rid, d] of Object.entries(s.regionDev)) {
    if (!canDevelop(s, rid)) continue;
    n += d.cleanupWorkers;
    for (const st of Object.values(d.sites)) n += st.workers;
  }
  return n;
}
const freeLabor = (s: GameState, assignedElsewhere: number) => s.population.labor - assignedElsewhere;

// ---------- actions ----------
export function repairSite(s: GameState, regionId: string, siteId: string): ActionResult {
  if (!canDevelop(s, regionId)) return fail('통제권을 확보한 지역만 개발할 수 있습니다.');
  const def = siteDefs(regionId).find((x) => x.id === siteId); if (!def) return fail('알 수 없는 시설입니다.');
  const st = devOf(s, regionId).sites[siteId];
  if (st.status !== 'damaged') return fail('이미 복구했거나 복구 중인 시설입니다.');
  if (def.requires && !s.research.completed.includes(def.requires)) return fail(`연구 '${DATA.researchNodes.find((n) => n.id === def.requires)?.name}' 완료가 필요합니다.`);
  const miss = Object.entries(def.repairCost).filter(([k, v]) => s.resources[k as keyof typeof s.resources] < (v ?? 0)).map(([k]) => RES_NAME(k));
  if (miss.length) return fail(`자원이 부족합니다: ${miss.join(', ')}`);
  const resources = { ...s.resources };
  for (const [k, v] of Object.entries(def.repairCost)) resources[k as keyof typeof resources] -= v ?? 0;
  const m = def.repairHours * 60;
  return { ok: true, state: withDev({ ...s, resources }, regionId, (d) => ({ ...d, sites: { ...d.sites, [siteId]: { ...st, status: 'repairing', remainingMinutes: m, totalMinutes: m } } })) };
}

/** `assignedOther` = labor used outside this region site (facilities + other region work). */
export function setSiteWorkers(s: GameState, regionId: string, siteId: string, workers: number, assignedOther: number): ActionResult {
  if (!canDevelop(s, regionId)) return fail('통제권을 확보한 지역만 개발할 수 있습니다.');
  const def = siteDefs(regionId).find((x) => x.id === siteId); if (!def) return fail('알 수 없는 시설입니다.');
  const st = devOf(s, regionId).sites[siteId];
  const pool = freeLabor(s, assignedOther);
  const target = Math.max(0, Math.min(Math.round(workers), def.workers, pool));
  if (workers > pool && target === st.workers) return fail('배치할 수 있는 노동 인구가 부족합니다.');
  return { ok: true, state: withDev(s, regionId, (d) => ({ ...d, sites: { ...d.sites, [siteId]: { ...st, workers: target } } })) };
}
export function setCleanupWorkers(s: GameState, regionId: string, workers: number, assignedOther: number): ActionResult {
  if (!canDevelop(s, regionId)) return fail('통제권을 확보한 지역만 개발할 수 있습니다.');
  const pool = freeLabor(s, assignedOther);
  const target = Math.max(0, Math.min(Math.round(workers), CFG.erosion.cleanupMaxWorkers, pool));
  if (workers > pool && target === devOf(s, regionId).cleanupWorkers) return fail('배치할 수 있는 노동 인구가 부족합니다.');
  return { ok: true, state: withDev(s, regionId, (d) => ({ ...d, cleanupWorkers: target })) };
}
export function toggleSite(s: GameState, regionId: string, siteId: string): ActionResult {
  const st = devOf(s, regionId).sites[siteId];
  if (!st || (st.status !== 'active' && st.status !== 'idle')) return fail('복구가 끝난 시설만 운영을 바꿀 수 있습니다.');
  return { ok: true, state: withDev(s, regionId, (d) => ({ ...d, sites: { ...d.sites, [siteId]: { ...st, status: st.status === 'active' ? 'idle' : 'active' } } })) };
}

// ---------- economy ----------
export interface RegionEco { produce: ResourceMap; consume: ResourceMap; research: number; survivorsPerDay: number; sites: Record<string, number> }
/** Per-hour production/consumption of one controlled region at the current state (stock-limited inputs are ignored for simplicity). */
export function regionEconomy(s: GameState, regionId: string): RegionEco {
  const out: RegionEco = { produce: {}, consume: {}, research: 0, survivorsPerDay: 0, sites: {} };
  if (!canDevelop(s, regionId) || !s.regionDev[regionId]) return out;
  const d = s.regionDev[regionId];
  const add = (m: ResourceMap, k: string, v: number) => { m[k as keyof ResourceMap] = (m[k as keyof ResourceMap] ?? 0) + v; };
  for (const [k, v] of Object.entries(CFG.upkeep.base)) add(out.consume, k, v ?? 0);
  add(out.consume, 'budget', d.erosion * CFG.upkeep.erosionBudgetPerPoint);
  const ef = erosionFactor(d.erosion);
  for (const def of siteDefs(regionId)) {
    const st = d.sites[def.id];
    if (st?.status !== 'active') { out.sites[def.id] = 0; continue; }
    const eff = (def.workers ? Math.min(1, st.workers / def.workers) : 1) * ef;
    out.sites[def.id] = eff;
    for (const [k, v] of Object.entries(CFG.upkeep.perActiveSite)) add(out.consume, k, v ?? 0);
    for (const [k, v] of Object.entries(def.produce)) add(out.produce, k, (v ?? 0) * eff);
    if (eff > 0) for (const [k, v] of Object.entries(def.consume)) add(out.consume, k, (v ?? 0) * eff);
    out.research += (def.research ?? 0) * eff;
    out.survivorsPerDay += (def.survivorsPerDay ?? 0) * eff;
  }
  return out;
}

/** Advances repairs and erosion cleanup; returns completed sites. Survivors join the labor population (placeholder rule). */
export function tickRegionDev(s: GameState, minutes: number): { state: GameState; completed: { regionId: string; siteId: string }[] } {
  const completed: { regionId: string; siteId: string }[] = [];
  let survivors = 0;
  const regionDev = { ...s.regionDev };
  for (const [rid, d] of Object.entries(s.regionDev)) {
    if (!canDevelop(s, rid)) continue;
    survivors += regionEconomy(s, rid).survivorsPerDay * (minutes / 1440);
    const sites = { ...d.sites };
    for (const [sid, st] of Object.entries(sites)) {
      if (st.status !== 'repairing') continue;
      const rem = st.remainingMinutes - minutes;
      if (rem <= 0) { sites[sid] = { ...st, status: 'active', remainingMinutes: 0 }; completed.push({ regionId: rid, siteId: sid }); }
      else sites[sid] = { ...st, remainingMinutes: rem };
    }
    const cleaned = (d.cleanupWorkers / 1000) * CFG.erosion.cleanupPerDayPer1000 * (minutes / 1440);
    regionDev[rid] = { ...d, sites, erosion: Math.max(0, d.erosion - cleaned) };
  }
  const population = survivors > 0 ? { ...s.population, labor: s.population.labor + survivors } : s.population;
  return { state: { ...s, regionDev, population }, completed };
}

/** Military region facilities strengthen expedition outposts (bonus to max HP). */
export function outpostBonus(s: GameState): number {
  let n = 0;
  for (const rid of Object.keys(s.regionDev)) {
    const eco = regionEconomy(s, rid);
    for (const def of siteDefs(rid)) n += (def.outpostBonus ?? 0) * (eco.sites[def.id] ?? 0);
  }
  return Math.round(n);
}
