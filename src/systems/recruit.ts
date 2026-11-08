// 이력서 확인 (recruitment). Pool, rates, cost and ceiling are NOT decided: config/recruit.json holds
// temporary test values. A duplicate of an owned agent converts to 인사 공적 for that agent.
import recruit from '../config/recruit.json';
import growth from '../config/growth.json';
import { DATA } from '../data';
import { newAgent } from '../core/initialState';
import type { GameState, ResourceMap } from '../core/types';
import { missingCost, type ActionResult } from './government';

export const RECRUIT = recruit;
export type Banner = (typeof recruit.banners)[number];
export interface Applicant { charId: string; duplicate: boolean; merit: number }

export const poolOf = (b: Banner) => (b.pool === 'all' ? DATA.characters.map((c) => c.id) : (b.pool as unknown as string[]));
export const bannerCost = (b: Banner, count: number): ResourceMap =>
  Object.fromEntries(Object.entries(b.cost).map(([k, v]) => [k, v * count]));

/** Reviews `count` resumes. `rand` is injectable for tests (uniform placeholder draw). */
export function reviewResumes(s: GameState, bannerId: string, count: number, rand: () => number = Math.random): { result: ActionResult; applicants: Applicant[] } {
  const b = recruit.banners.find((x) => x.id === bannerId);
  if (!b) return { result: { ok: false, message: '알 수 없는 모집입니다.' }, applicants: [] };
  const pool = poolOf(b);
  if (!pool.length) return { result: { ok: false, message: '모집 대상이 없습니다.' }, applicants: [] };
  const cost = bannerCost(b, count);
  const miss = missingCost(s, cost);
  if (miss.length) return { result: { ok: false, message: `자원이 부족합니다: ${miss.join(', ')}` }, applicants: [] };
  const resources = { ...s.resources };
  for (const [k, v] of Object.entries(cost)) resources[k as keyof typeof resources] -= v ?? 0;
  let roster = [...s.roster];
  const applicants: Applicant[] = [];
  for (let i = 0; i < count; i++) {
    const charId = pool[Math.floor(rand() * pool.length) % pool.length];
    const owned = roster.some((c) => c.charId === charId);
    if (owned) {
      roster = roster.map((c) => (c.charId === charId ? { ...c, merit: c.merit + growth.duplicateMerit } : c));
      applicants.push({ charId, duplicate: true, merit: growth.duplicateMerit });
    } else {
      roster = [...roster, newAgent(charId)];
      applicants.push({ charId, duplicate: false, merit: 0 });
    }
  }
  const state: GameState = { ...s, resources, roster, progress: { ...s.progress, recruit: { reviews: s.progress.recruit.reviews + count } } };
  return { result: { ok: true, state }, applicants };
}
