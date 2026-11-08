// Agent growth: proficiency level, 전문가 등급 승급 (Phase 1-3), skill level, traits, level-cap extension.
// Rules follow the user's design; all numbers come from config/growth.json (placeholders).
import growth from '../config/growth.json';
import { DATA, getItem } from '../data';
import type { CharacterInstance, GameState } from '../core/types';
import type { ActionResult } from './government';

export const GROWTH = growth;
interface Phase {
  phase: number; name: string; levelCap: number; skillMax: number; equipSlots: number; unlocks: string[];
  requires?: { level?: number; clearedDifficulty?: number; items?: Record<string, number> };
}
const PHASES = growth.phases as Phase[];
const fail = (message: string): ActionResult => ({ ok: false, message });

export const phaseDef = (p: number): Phase => PHASES[p - 1];
export const levelCap = (c: CharacterInstance) => phaseDef(c.phase).levelCap;
export const skillMax = (c: CharacterInstance) => phaseDef(c.phase).skillMax;
export const equipSlots = (c: CharacterInstance) => phaseDef(c.phase).equipSlots;
export const itemName = (id: string) => getItem(id)?.name ?? id;

function updateAgent(s: GameState, charId: string, fn: (c: CharacterInstance) => CharacterInstance): GameState {
  return { ...s, roster: s.roster.map((c) => (c.charId === charId ? fn(c) : c)) };
}
const agent = (s: GameState, id: string) => s.roster.find((c) => c.charId === id);

/** EXP needed to go from `level` to `level + 1` (placeholder curve). */
export const expToNext = (level: number) => Math.round(growth.exp.perLevel.base * Math.pow(growth.exp.perLevel.growth, level - 1));
export const expItems = growth.exp.items as Record<string, number>;

/** Adds EXP, levelling up while below the current phase cap. Excess EXP at the cap is discarded. */
export function addExp(c: CharacterInstance, amount: number): CharacterInstance {
  let { level, exp } = c; exp += amount;
  const cap = levelCap(c);
  while (level < cap && exp >= expToNext(level)) { exp -= expToNext(level); level++; }
  if (level >= cap) exp = 0;
  return { ...c, level, exp };
}

export function useExpItem(s: GameState, charId: string, itemId: string): ActionResult {
  const c = agent(s, charId); if (!c) return fail('보유하지 않은 요원입니다.');
  const amount = expItems[itemId]; if (!amount) return fail('경험치 재화가 아닙니다.');
  if ((s.inventory[itemId] ?? 0) < 1) return fail(`${itemName(itemId)}이(가) 없습니다.`);
  if (c.level >= levelCap(c)) return fail('현재 등급의 레벨 상한입니다. 승급하면 상한이 늘어납니다.');
  return { ok: true, state: updateAgent({ ...s, inventory: { ...s.inventory, [itemId]: s.inventory[itemId] - 1 } }, charId, (x) => addExp(x, amount)) };
}

/** Temporary stand-in for the undecided EXP source (see config _training_note). */
export const trainingCost = () => ({ budget: growth.training.budgetPerUse });
export function trainAgent(s: GameState, charId: string): ActionResult {
  const c = agent(s, charId); if (!c) return fail('보유하지 않은 요원입니다.');
  if (c.level >= levelCap(c)) return fail('현재 등급의 레벨 상한입니다. 승급하면 상한이 늘어납니다.');
  const cost = trainingCost();
  if (s.resources.budget < cost.budget) return fail('자원이 부족합니다: 예산');
  return { ok: true, state: updateAgent({ ...s, resources: { ...s.resources, budget: s.resources.budget - cost.budget } }, charId, (x) => addExp(x, growth.training.exp)) };
}

export interface Requirement { label: string; met: boolean }
/** Requirements for promoting to the next phase (empty array = already max). */
export function promotionRequirements(s: GameState, c: CharacterInstance): Requirement[] {
  const next = PHASES[c.phase];
  if (!next) return [];
  const r = next.requires ?? {};
  const out: Requirement[] = [];
  if (r.level) out.push({ label: `전투 숙련도 레벨 ${r.level} 이상 (현재 ${c.level})`, met: c.level >= r.level });
  if (r.clearedDifficulty) out.push({ label: `침식 난이도 ${r.clearedDifficulty} 이상 원정 완료 (현재 ${s.progress.highestCleared || '없음'})`, met: s.progress.highestCleared >= r.clearedDifficulty });
  for (const [id, n] of Object.entries(r.items ?? {})) out.push({ label: `${itemName(id)} ${n}개 (보유 ${s.inventory[id] ?? 0})`, met: (s.inventory[id] ?? 0) >= n });
  return out;
}
export function promoteAgent(s: GameState, charId: string): ActionResult {
  const c = agent(s, charId); if (!c) return fail('보유하지 않은 요원입니다.');
  const next = PHASES[c.phase];
  if (!next) return fail('이미 최고 등급입니다.');
  const reqs = promotionRequirements(s, c);
  if (reqs.some((r) => !r.met)) return fail(`승급 조건 미충족: ${reqs.filter((r) => !r.met).map((r) => r.label).join(', ')}`);
  const inventory = { ...s.inventory };
  for (const [id, n] of Object.entries(next.requires?.items ?? {})) inventory[id] = (inventory[id] ?? 0) - n;
  return { ok: true, state: updateAgent({ ...s, inventory }, charId, (x) => ({ ...x, phase: next.phase as 1 | 2 | 3 })) };
}

export function raiseSkill(s: GameState, charId: string): ActionResult {
  const c = agent(s, charId); if (!c) return fail('보유하지 않은 요원입니다.');
  if (c.skillLevel >= skillMax(c)) return fail('현재 등급의 스킬 최대 레벨입니다. 승급하면 상한이 늘어납니다.');
  if (c.merit < growth.skillLevelMeritCost) return fail(`인사 공적이 부족합니다 (필요 ${growth.skillLevelMeritCost}).`);
  return { ok: true, state: updateAgent(s, charId, (x) => ({ ...x, skillLevel: x.skillLevel + 1, merit: x.merit - growth.skillLevelMeritCost })) };
}

export type TraitState = 'unlocked' | 'available' | 'locked';
export function traitState(c: CharacterInstance, slotId: string): TraitState {
  if (c.traits.includes(slotId)) return 'unlocked';
  const slot = growth.traitSlots.find((t) => t.id === slotId)!;
  const u = slot.unlock as { merit?: number; phase?: number };
  if (u.phase) return c.phase >= u.phase ? 'available' : 'locked';
  return 'available';
}
export function unlockTrait(s: GameState, charId: string, slotId: string): ActionResult {
  const c = agent(s, charId); if (!c) return fail('보유하지 않은 요원입니다.');
  const slot = growth.traitSlots.find((t) => t.id === slotId); if (!slot) return fail('알 수 없는 특성입니다.');
  const st = traitState(c, slotId);
  if (st === 'unlocked') return fail('이미 해금했습니다.');
  const u = slot.unlock as { merit?: number; phase?: number };
  if (st === 'locked') return fail(`${phaseDef(u.phase!).name} 승급 후 해금됩니다.`);
  const cost = u.merit ?? 0;
  if (c.merit < cost) return fail(`인사 공적이 부족합니다 (필요 ${cost}).`);
  return { ok: true, state: updateAgent(s, charId, (x) => ({ ...x, traits: [...x.traits, slotId], merit: x.merit - cost })) };
}

export const itemsHeld = (s: GameState) => DATA.items.filter((i) => !i.perCharacter).map((i) => ({ ...i, count: s.inventory[i.id] ?? 0 }));
