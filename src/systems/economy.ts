// Government economy simulation (pure functions over GameState).
// All numbers come from data/facilities.json and config/balance.json (placeholders until decided).
import { BALANCE } from '../core/config';
import { DATA, getFacilityDef, getResearch } from '../data';
import { regionEconomy, tickRegionDev, type RegionEco } from './regionDev';
import { refreshRegions } from './regions';
import type { FacilityInstance, GameState, ResourceId, ResourceMap } from '../core/types';

const ECON = BALANCE.economy;
const RES = DATA.resources.map((r) => r.id);

export type FacilityIssue = 'understaffed' | 'unstaffed' | 'shortage' | 'worn' | 'stopped' | 'building';
export interface FacilityReport {
  uid: string;
  efficiency: number;            // 0..1 actual output factor this hour
  staffing: number; condition: number; input: number;
  produce: ResourceMap; consume: ResourceMap; power: number; research: number;
  issues: FacilityIssue[];
}
export interface EconomyReport {
  facilities: Map<string, FacilityReport>;
  perHour: Record<ResourceId, number>;   // net change per game hour
  gross: { produce: Record<ResourceId, number>; consume: Record<ResourceId, number> };
  researchRate: number;
  populationFood: number;
  regions: Map<string, RegionEco>;
}

const zero = () => Object.fromEntries(RES.map((r) => [r, 0])) as Record<ResourceId, number>;
export const conditionFactor = (c: number) => ECON.conditionEfficiency.min + (1 - ECON.conditionEfficiency.min) * (c / 100);
export const populationTotal = (s: GameState) => Object.values(s.population).reduce((a, b) => a + b, 0);

/** Rates for the current state. `stock` lets callers check affordability over a time slice. */
export function computeEconomy(s: GameState, hours = 1): EconomyReport {
  const facilities = new Map<string, FacilityReport>();
  const produce = zero(), consume = zero();
  let researchRate = 0;
  const populationFood = populationTotal(s) * ECON.foodPerCapitaPerHour;
  consume.food += populationFood;

  // Pass 1: demand at staffing x condition, to find input shortages against the stock.
  const demand = zero(), potential = zero();
  const pre: { f: FacilityInstance; base: number; staffing: number; cond: number }[] = [];
  for (const f of s.facilities) {
    const def = getFacilityDef(f.defId); if (!def) continue;
    const lv = def.levels[f.level - 1];
    const operating = f.status === 'active' && !f.job;
    const staffing = lv.workers > 0 ? Math.min(1, f.workers / lv.workers) : 1;
    const cond = conditionFactor(f.condition);
    const base = operating ? staffing * cond : 0;
    pre.push({ f, base, staffing, cond });
    for (const [r, v] of Object.entries(lv.consume) as [ResourceId, number][]) demand[r] += v * base;
    for (const [r, v] of Object.entries(lv.produce) as [ResourceId, number][]) potential[r] += v * base;
    demand.power += lv.power * (operating && staffing > 0 ? 1 : 0);
  }
  // Inputs available this slice = stock + what producers can make in the same slice (approximation).
  const supplyRatio = (r: ResourceId) => {
    const need = (demand[r] + (r === 'food' ? populationFood : 0)) * hours;
    if (need <= 0) return 1;
    return Math.min(1, (s.resources[r] + potential[r] * hours) / need);
  };

  for (const { f, base, staffing, cond } of pre) {
    const def = getFacilityDef(f.defId)!; const lv = def.levels[f.level - 1];
    const issues: FacilityIssue[] = [];
    if (f.job) issues.push('building');
    if (f.status === 'idle') issues.push('stopped');
    if (staffing === 0) issues.push('unstaffed'); else if (staffing < 1) issues.push('understaffed');
    if (f.condition < 50) issues.push('worn');
    const inputs = [...Object.keys(lv.consume), ...(lv.power > 0 ? ['power'] : [])] as ResourceId[];
    const input = base > 0 ? Math.min(1, ...inputs.map(supplyRatio)) : 0;
    if (base > 0 && input < 1) issues.push('shortage');
    const eff = base * input;
    const rep: FacilityReport = { uid: f.uid, efficiency: eff, staffing, condition: cond, input, produce: {}, consume: {}, power: base > 0 ? lv.power * input : 0, research: (lv.research ?? 0) * eff, issues };
    for (const [r, v] of Object.entries(lv.produce) as [ResourceId, number][]) { rep.produce[r] = v * eff; produce[r] += v * eff; }
    for (const [r, v] of Object.entries(lv.consume) as [ResourceId, number][]) { rep.consume[r] = v * eff; consume[r] += v * eff; }
    consume.power += rep.power;
    researchRate += rep.research;
    facilities.set(f.uid, rep);
  }
  // controlled regions: production, facility inputs, upkeep and erosion management
  const regions = new Map<string, RegionEco>();
  for (const rid of Object.keys(s.regionDev ?? {})) {
    const re = regionEconomy(s, rid);
    regions.set(rid, re);
    for (const [r, v] of Object.entries(re.produce) as [ResourceId, number][]) produce[r] += v;
    for (const [r, v] of Object.entries(re.consume) as [ResourceId, number][]) consume[r] += v;
    researchRate += re.research;
  }
  const perHour = zero();
  for (const r of RES) perHour[r] = produce[r] - consume[r];
  return { facilities, perHour, gross: { produce, consume }, researchRate, populationFood, regions };
}

export type EconomyEvent =
  | { type: 'facility:complete'; uid: string; kind: 'build' | 'upgrade' }
  | { type: 'research:complete'; id: string }
  | { type: 'regionSite:complete'; regionId: string; siteId: string };

/** Advances the government simulation by `minutes` of game time. */
export function tickEconomy(s: GameState, minutes: number): { state: GameState; events: EconomyEvent[] } {
  const events: EconomyEvent[] = [];
  const hours = minutes / 60;
  const eco = computeEconomy(s, hours);
  const resources = { ...s.resources };
  for (const r of RES) resources[r] = Math.max(0, resources[r] + eco.perHour[r] * hours);

  const facilities = s.facilities.map((f) => {
    const def = getFacilityDef(f.defId)!;
    let next = f;
    if (f.job) {
      const remaining = f.job.remainingMinutes - minutes;
      if (remaining <= 0) {
        next = { ...f, job: null, level: f.job.kind === 'upgrade' ? f.level + 1 : f.level, status: f.status === 'building' ? 'active' : f.status };
        events.push({ type: 'facility:complete', uid: f.uid, kind: f.job.kind });
      } else next = { ...f, job: { ...f.job, remainingMinutes: remaining } };
    } else if (f.status === 'active' && f.workers > 0) {
      const decay = def.levels[f.level - 1].upkeep.conditionPerDay * (minutes / 1440);
      next = { ...f, condition: Math.max(0, f.condition - decay) };
    }
    return next;
  });

  let research = s.research;
  if (research.active) {
    const node = getResearch(research.active);
    if (node) {
      const progress = research.progress + (eco.researchRate * hours) / node.hours;
      if (progress >= 1) {
        research = { active: null, progress: 0, completed: [...research.completed, node.id] };
        events.push({ type: 'research:complete', id: node.id });
      } else research = { ...research, progress };
    }
  }
  let unlocks = s.unlocks;
  let inventory = s.inventory;
  for (const e of events) if (e.type === 'research:complete') {
    const node = getResearch(e.id);
    for (const u of node?.unlocks ?? []) if (!unlocks.includes(`${u.type}:${u.id}`)) unlocks = [...unlocks, `${u.type}:${u.id}`];
    for (const [item, n] of Object.entries(node?.rewards ?? {})) inventory = { ...inventory, [item]: (inventory[item] ?? 0) + n };
  }
  const rd = tickRegionDev({ ...s, resources, facilities, research, unlocks, inventory }, minutes);
  for (const c of rd.completed) events.push({ type: 'regionSite:complete', ...c });
  const before = s.regions;
  const refreshed = refreshRegions(rd.state);
  return { state: { ...refreshed, regions: refreshed.regions === before ? before : refreshed.regions, clock: { ...s.clock, gameMinutes: s.clock.gameMinutes + minutes } }, events };
}
