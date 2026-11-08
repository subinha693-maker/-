// Region reclamation (지역 탈환) — PHASE 1: finite region data, connections, 5-state progress,
// unlock conditions and control rules. Hard rules (user spec §4):
//  - general expeditions can never grant control or raise a region above state 2
//  - control (state 4) only through a completed strategic operation (objective achieved AND returned)
//  - every operation pays rewards / grants control at most once (flags recorded permanently)
//  - the region list is fixed data; nothing is generated
import { DATA, getOp, getRegion } from '../data';
import type { Condition, GameState, OpRecord, RegionProgress, RegionStateId } from '../core/types';
import type { ActionResult } from './government';

const fail = (message: string): ActionResult => ({ ok: false, message });
export const MAX_STATE_FROM_GENERAL = 2;
export const emptyOpRecord = (): OpRecord => ({ attempts: 0, objectiveAchieved: false, returned: false, rewardGranted: false, controlGranted: false, completedAt: null });

export function initialRegions(): Record<string, RegionProgress> {
  return Object.fromEntries(DATA.regions.map((r) => [r.id, { unlocked: r.initiallyUnlocked, state: 1 as RegionStateId, generalRuns: 0, generalClears: 0 }]));
}

export const opCompleted = (s: GameState, opId: string) => !!s.strategicOps[opId]?.rewardGranted;

/** Evaluates one data-defined condition. `regionId` gives context for region-local conditions. */
export function conditionMet(s: GameState, c: Condition, regionId?: string): boolean {
  switch (c.type) {
    case 'regionState': return (s.regions[c.region]?.state ?? 0) >= c.atLeast;
    case 'opCompleted': return opCompleted(s, c.op);
    case 'research': return s.research.completed.includes(c.id);
    case 'generalClears': return (s.regions[regionId ?? '']?.generalClears ?? 0) >= c.count;
    case 'item': return (s.inventory[c.id] ?? 0) >= c.count;
  }
}
export function describeCondition(c: Condition): string {
  switch (c.type) {
    case 'regionState': return `${getRegion(c.region)?.name ?? c.region}: ${DATA.regionStates.find((x) => x.id === c.atLeast)?.name} 이상`;
    case 'opCompleted': return `전략 작전 완료: ${getOp(c.op)?.name ?? c.op}`;
    case 'research': return `연구 완료: ${DATA.researchNodes.find((n) => n.id === c.id)?.name ?? c.id}`;
    case 'generalClears': return `이 지역 일반 원정 완수 ${c.count}회`;
    case 'item': return `${c.id} ${c.count}개 보유`;
  }
}

/**
 * Applies unlocks and upward state changes implied by current records. States never go down.
 * State 4 requires that the region's own control operation actually granted control.
 */
export function refreshRegions(s: GameState): GameState {
  let regions = { ...s.regions };
  for (let pass = 0; pass < DATA.regions.length; pass++) {
    let changed = false;
    for (const def of DATA.regions) {
      const cur = regions[def.id];
      const view = { ...s, regions };
      let next = { ...cur };
      if (!cur.unlocked && def.unlock.every((c) => conditionMet(view, c, def.id))) { next.unlocked = true; }
      if (next.unlocked) {
        for (const lv of [2, 3, 4] as const) {
          const conds = def.progression[String(lv) as '2' | '3' | '4'] ?? [];
          if (next.state >= lv) continue;                       // already there
          if (!conds.length || !conds.every((c) => conditionMet(view, c, def.id))) break;
          if (lv === 4 && !def.strategicOps.some((op) => view.strategicOps[op]?.controlGranted)) break;
          next = { ...next, state: lv as RegionStateId };
        }
      }
      if (next.unlocked !== cur.unlocked || next.state !== cur.state) { regions = { ...regions, [def.id]: next }; changed = true; }
    }
    if (!changed) break;
  }
  return { ...s, regions };
}

// ---------- general expeditions (repeatable; never change control) ----------
export function canRunGeneral(s: GameState, regionId: string): string[] {
  const def = getRegion(regionId); const p = s.regions[regionId];
  if (!def || !p) return ['알 수 없는 지역입니다.'];
  const why: string[] = [];
  if (!p.unlocked) why.push('해금되지 않은 지역입니다.');
  if (p.state < def.general.fromState) why.push('일반 원정 조건을 충족하지 못했습니다.');
  return why;
}
/** Records a finished general expedition. Can raise the region to state 2 at most. */
export function recordGeneralExpedition(s: GameState, regionId: string, outcome: string): GameState {
  const p = s.regions[regionId]; if (!p) return s;
  const cleared = outcome === 'victory';
  const updated = { ...s, regions: { ...s.regions, [regionId]: { ...p, generalRuns: p.generalRuns + 1, generalClears: p.generalClears + (cleared ? 1 : 0) } } };
  const refreshed = refreshRegions(updated);
  // safety net for rule §4-1: whatever the data says, a general run cannot push past state 2 by itself
  const before = s.regions[regionId].state, after = refreshed.regions[regionId].state;
  if (after > Math.max(before, MAX_STATE_FROM_GENERAL)) refreshed.regions[regionId] = { ...refreshed.regions[regionId], state: Math.max(before, MAX_STATE_FROM_GENERAL) as RegionStateId };
  return refreshed;
}

// ---------- strategic operations ----------
export function opBlockers(s: GameState, opId: string): string[] {
  const op = getOp(opId); if (!op) return ['알 수 없는 작전입니다.'];
  const why: string[] = [];
  if (!s.regions[op.regionId]?.unlocked) why.push('대상 지역이 해금되지 않았습니다.');
  if (opCompleted(s, opId)) why.push('이미 완료한 작전입니다.');
  for (const c of op.requires) if (!conditionMet(s, c, op.regionId)) why.push(describeCondition(c));
  for (const p of op.prereqOps) if (!opCompleted(s, p)) why.push(`선행 작전: ${getOp(p)?.name ?? p}`);
  return why;
}
export function startOp(s: GameState, opId: string): ActionResult {
  const why = opBlockers(s, opId);
  if (why.length) return fail(`작전을 개시할 수 없습니다: ${why.join(', ')}`);
  const rec = s.strategicOps[opId] ?? emptyOpRecord();
  return { ok: true, state: { ...s, strategicOps: { ...s.strategicOps, [opId]: { ...rec, attempts: rec.attempts + 1, objectiveAchieved: false, returned: false } } } };
}
/** Called when the operation's objective node is completed during the expedition. */
export function markObjective(s: GameState, opId: string): GameState {
  const rec = s.strategicOps[opId]; if (!rec || rec.rewardGranted) return s;
  return { ...s, strategicOps: { ...s.strategicOps, [opId]: { ...rec, objectiveAchieved: true } } };
}
/**
 * Settles an operation when the expedition ends. Success needs the objective AND a return to base.
 * Rewards and control are granted once; failure/withdrawal grants nothing.
 */
export function settleOp(s: GameState, opId: string, returned: boolean, gameMinutes = s.clock.gameMinutes): { state: GameState; success: boolean; granted: boolean } {
  const op = getOp(opId); const rec = s.strategicOps[opId];
  if (!op || !rec) return { state: s, success: false, granted: false };
  if (rec.rewardGranted) return { state: s, success: true, granted: false }; // already settled earlier
  const success = rec.objectiveAchieved && (returned || !op.returnRequired);
  if (!success) return { state: { ...s, strategicOps: { ...s.strategicOps, [opId]: { ...rec, objectiveAchieved: false, returned } } }, success: false, granted: false };
  const resources = { ...s.resources };
  for (const [k, v] of Object.entries(op.rewards.resources)) resources[k as keyof typeof resources] += v ?? 0;
  const inventory = { ...s.inventory };
  for (const [k, v] of Object.entries(op.rewards.items)) inventory[k] = (inventory[k] ?? 0) + v;
  const next: GameState = {
    ...s, resources, inventory,
    strategicOps: { ...s.strategicOps, [opId]: { ...rec, returned: true, rewardGranted: true, controlGranted: op.grantsControl, completedAt: gameMinutes } },
  };
  return { state: refreshRegions(next), success: true, granted: true };
}

export const controlledRegions = (s: GameState) => DATA.regions.filter((r) => s.regions[r.id]?.state >= 4).map((r) => r.id);

/** Static checks on region data (run at startup / in tests). */
export function validateRegionData(): string[] {
  const e: string[] = [];
  const ids = new Set(DATA.regions.map((r) => r.id));
  for (const r of DATA.regions) {
    for (const c of r.connections) { if (!ids.has(c)) e.push(`${r.id}: unknown connection ${c}`); else if (!getRegion(c)!.connections.includes(r.id)) e.push(`${r.id}<->${c} not symmetric`); }
    if (!DATA.regionTypes.some((t) => t.id === r.type)) e.push(`${r.id}: unknown type ${r.type}`);
    for (const op of r.strategicOps) if (getOp(op)?.regionId !== r.id) e.push(`${r.id}: op ${op} not for this region`);
    for (const c of r.progression['4'] ?? []) if (c.type !== 'opCompleted' || !getOp(c.op)?.grantsControl) e.push(`${r.id}: control must come from a strategic op`);
    for (const c of [...(r.progression['2'] ?? []), ...(r.progression['3'] ?? [])]) if (c.type === 'opCompleted' && getOp(c.op)?.grantsControl) e.push(`${r.id}: control op used below state 4`);
  }
  return e;
}
