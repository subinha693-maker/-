// Player actions on the government (pure: return a new state or an error message).
import { BALANCE } from '../core/config';
import { DATA, getFacilityDef, getResearch } from '../data';
import { regionLabor } from './regionDev';
import type { FacilityDef, GameState, ResourceMap, WorkerType } from '../core/types';

const ECON = BALANCE.economy;
export type ActionResult = { ok: true; state: GameState } | { ok: false; message: string };
const fail = (message: string): ActionResult => ({ ok: false, message });
const resName = (id: string) => DATA.resources.find((r) => r.id === id)?.name ?? id;

export function missingCost(s: GameState, cost: ResourceMap): string[] {
  return Object.entries(cost).filter(([r, v]) => s.resources[r as keyof typeof s.resources] < (v ?? 0)).map(([r]) => resName(r));
}
function pay(s: GameState, cost: ResourceMap): GameState {
  const resources = { ...s.resources };
  for (const [r, v] of Object.entries(cost)) resources[r as keyof typeof resources] -= v ?? 0;
  return { ...s, resources };
}
function updateFacility(s: GameState, uid: string, fn: (f: GameState['facilities'][number]) => GameState['facilities'][number]): GameState {
  return { ...s, facilities: s.facilities.map((f) => (f.uid === uid ? fn(f) : f)) };
}

// ---------- Labor ----------
export function assignedWorkers(s: GameState, type: WorkerType, exceptUid?: string) {
  const fac = s.facilities.reduce((sum, f) => (f.uid !== exceptUid && getFacilityDef(f.defId)?.workerType === type ? sum + f.workers : sum), 0);
  return type === 'labor' ? fac + regionLabor(s) : fac;   // region sites and cleanup crews use labor
}
export function availableWorkers(s: GameState, type: WorkerType) {
  return s.population[type] - assignedWorkers(s, type);
}
export function setWorkers(s: GameState, uid: string, workers: number): ActionResult {
  const f = s.facilities.find((x) => x.uid === uid); if (!f) return fail('시설을 찾을 수 없습니다.');
  const def = getFacilityDef(f.defId)!;
  const max = def.levels[f.level - 1].workers;
  const pool = s.population[def.workerType] - assignedWorkers(s, def.workerType, uid);
  const target = Math.max(0, Math.min(Math.round(workers), max, pool));
  if (workers > pool && target === f.workers) return fail(`배치할 수 있는 ${DATA.population.find((p) => p.id === def.workerType)?.name}이(가) 부족합니다.`);
  return { ok: true, state: updateFacility(s, uid, (x) => ({ ...x, workers: target })) };
}

// ---------- Facility operations ----------
export function toggleFacility(s: GameState, uid: string): ActionResult {
  const f = s.facilities.find((x) => x.uid === uid); if (!f) return fail('시설을 찾을 수 없습니다.');
  if (f.job && f.status === 'building') return fail('건설 중인 시설입니다.');
  return { ok: true, state: updateFacility(s, uid, (x) => ({ ...x, status: x.status === 'idle' ? 'active' : 'idle' })) };
}

export function repairCost(s: GameState, uid: string): ResourceMap {
  const f = s.facilities.find((x) => x.uid === uid)!;
  const lost = (100 - f.condition) / 100;
  return { material: Math.ceil(ECON.repairCost.material * f.level * lost), budget: Math.ceil(ECON.repairCost.budget * f.level * lost) };
}
export function repairFacility(s: GameState, uid: string): ActionResult {
  const f = s.facilities.find((x) => x.uid === uid); if (!f) return fail('시설을 찾을 수 없습니다.');
  if (f.condition >= 100) return fail('이미 최상의 상태입니다.');
  const cost = repairCost(s, uid);
  const miss = missingCost(s, cost); if (miss.length) return fail(`자원이 부족합니다: ${miss.join(', ')}`);
  return { ok: true, state: updateFacility(pay(s, cost), uid, (x) => ({ ...x, condition: 100 })) };
}

export function upgradeFacility(s: GameState, uid: string): ActionResult {
  const f = s.facilities.find((x) => x.uid === uid); if (!f) return fail('시설을 찾을 수 없습니다.');
  const def = getFacilityDef(f.defId)!;
  if (f.job) return fail('이미 공사 중입니다.');
  const next = def.levels[f.level]; if (!next) return fail('최대 레벨입니다.');
  const miss = missingCost(s, next.cost); if (miss.length) return fail(`자원이 부족합니다: ${miss.join(', ')}`);
  const minutes = next.buildHours * 60;
  return { ok: true, state: updateFacility(pay(s, next.cost), uid, (x) => ({ ...x, job: { kind: 'upgrade', remainingMinutes: minutes, totalMinutes: minutes } })) };
}

export function isUnlocked(s: GameState, def: FacilityDef) {
  return !def.requires || s.research.completed.includes(def.requires);
}
export function freeGridCell(s: GameState): [number, number] | null {
  const used = new Set(s.facilities.map((f) => f.grid.join(',')));
  const n = ECON.buildGrid;
  for (let d = 0; d < n * 2; d++) for (let x = 0; x < n; x++) { const y = d - x; if (y >= 0 && y < n && !used.has(`${x},${y}`)) return [x, y]; }
  return null;
}
export function buildFacility(s: GameState, defId: string): ActionResult {
  const def = getFacilityDef(defId); if (!def) return fail('알 수 없는 시설입니다.');
  if (!isUnlocked(s, def)) return fail(`연구 '${getResearch(def.requires!)?.name}' 완료가 필요합니다.`);
  const lv = def.levels[0];
  const miss = missingCost(s, lv.cost); if (miss.length) return fail(`자원이 부족합니다: ${miss.join(', ')}`);
  const grid = freeGridCell(s); if (!grid) return fail('건설할 공간이 없습니다.');
  const n = s.facilities.reduce((m, f) => Math.max(m, Number(f.uid.slice(1)) || 0), 0) + 1;
  const minutes = lv.buildHours * 60;
  const paid = pay(s, lv.cost);
  return { ok: true, state: { ...paid, facilities: [...paid.facilities, { uid: `f${n}`, defId, level: 1, workers: 0, condition: 100, status: 'building', grid, job: { kind: 'build', remainingMinutes: minutes, totalMinutes: minutes } }] } };
}

// ---------- Research ----------
export type ResearchStatus = 'done' | 'active' | 'open' | 'locked';
export function researchStatus(s: GameState, id: string): ResearchStatus {
  if (s.research.completed.includes(id)) return 'done';
  if (s.research.active === id) return 'active';
  return getResearch(id)!.prereq.every((p) => s.research.completed.includes(p)) ? 'open' : 'locked';
}
export function startResearch(s: GameState, id: string): ActionResult {
  const node = getResearch(id); if (!node) return fail('알 수 없는 연구입니다.');
  if (s.research.active) return fail('이미 진행 중인 연구가 있습니다.');
  const st = researchStatus(s, id);
  if (st === 'done') return fail('이미 완료한 연구입니다.');
  if (st === 'locked') return fail('선행 연구를 먼저 완료해야 합니다.');
  const miss = missingCost(s, node.cost); if (miss.length) return fail(`자원이 부족합니다: ${miss.join(', ')}`);
  return { ok: true, state: { ...pay(s, node.cost), research: { ...s.research, active: id, progress: 0 } } };
}
