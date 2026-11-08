import { DATA } from '../data';
import type { GameState } from '../core/types';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown) => Number.isInteger(v);

/** Structural + reference validation of a GameState. Returns human-readable problems (empty = valid). */
export function validateGameState(s: unknown): string[] {
  const e: string[] = [];
  if (!isObj(s)) return ['게임 데이터가 객체가 아닙니다.'];
  if (s.schema !== 2) e.push('게임 데이터 구조 버전이 올바르지 않습니다.');

  const clock = s.clock;
  if (!isObj(clock) || !isNum(clock.gameMinutes) || (clock.gameMinutes as number) < 0) e.push('게임 시간 정보가 손상되었습니다.');

  const res = s.resources;
  if (!isObj(res)) e.push('자원 정보가 없습니다.');
  else for (const r of DATA.resources) if (!isNum(res[r.id]) || (res[r.id] as number) < 0) e.push(`자원 '${r.name}' 값이 올바르지 않습니다.`);

  const pop = s.population;
  if (!isObj(pop)) e.push('인구 정보가 없습니다.');
  else for (const p of DATA.population) if (!isNum(pop[p.id]) || (pop[p.id] as number) < 0) e.push(`인구 '${p.name}' 값이 올바르지 않습니다.`);

  if (!Array.isArray(s.facilities)) e.push('시설 목록이 없습니다.');
  else {
    const uids = new Set<string>();
    for (const f of s.facilities) {
      if (!isObj(f)) { e.push('시설 항목이 손상되었습니다.'); continue; }
      const def = DATA.facilities.find((d) => d.id === f.defId);
      if (!def) e.push(`알 수 없는 시설: ${String(f.defId)}`);
      else if (!isInt(f.level) || (f.level as number) < 1 || (f.level as number) > def.levels.length) e.push(`시설 ${def.name}의 레벨이 올바르지 않습니다.`);
      if (typeof f.uid !== 'string' || uids.has(f.uid)) e.push('시설 식별자가 중복되었거나 없습니다.');
      else uids.add(f.uid);
      if (!isInt(f.workers) || (f.workers as number) < 0) e.push('시설 배치 인력 값이 올바르지 않습니다.');
      if (!isNum(f.condition) || (f.condition as number) < 0 || (f.condition as number) > 100) e.push('시설 유지보수 상태 값이 올바르지 않습니다.');
      if (f.job != null && (!isObj(f.job) || !isNum(f.job.remainingMinutes) || !isNum(f.job.totalMinutes))) e.push('시설 공사 정보가 손상되었습니다.');
    }
  }

  const research = s.research;
  if (!isObj(research) || !Array.isArray(research.completed)) e.push('연구 진행 정보가 손상되었습니다.');
  else {
    for (const id of research.completed) if (!DATA.researchNodes.some((n) => n.id === id)) e.push(`알 수 없는 연구: ${String(id)}`);
    if (research.active != null && !DATA.researchNodes.some((n) => n.id === research.active)) e.push(`알 수 없는 진행 중 연구: ${String(research.active)}`);
    if (!isNum(research.progress) || (research.progress as number) < 0 || (research.progress as number) > 1) e.push('연구 진행도 값이 올바르지 않습니다.');
  }

  const roster = s.roster;
  const rosterIds = new Set<string>();
  if (!Array.isArray(roster)) e.push('부대원 목록이 없습니다.');
  else for (const c of roster) {
    if (!isObj(c) || typeof c.charId !== 'string') { e.push('부대원 항목이 손상되었습니다.'); continue; }
    if (!DATA.characters.some((d) => d.id === c.charId)) e.push(`알 수 없는 부대원: ${c.charId}`);
    if (rosterIds.has(c.charId)) e.push(`부대원이 중복 저장되었습니다: ${c.charId}`);
    rosterIds.add(c.charId);
    if (!isInt(c.level) || (c.level as number) < 1) e.push(`부대원 ${c.charId}의 레벨이 올바르지 않습니다.`);
    if (![1, 2, 3].includes(c.phase as number)) e.push(`부대원 ${c.charId}의 승급 단계가 올바르지 않습니다.`);
    if (!isInt(c.skillLevel) || (c.skillLevel as number) < 1) e.push(`부대원 ${c.charId}의 스킬 레벨이 올바르지 않습니다.`);
    if (!isInt(c.merit) || (c.merit as number) < 0 || !isInt(c.capBonus) || (c.capBonus as number) < 0) e.push(`부대원 ${c.charId}의 육성 정보가 손상되었습니다.`);
    if (!Array.isArray(c.traits)) e.push(`부대원 ${c.charId}의 특성 정보가 손상되었습니다.`);
  }

  const inv = s.inventory;
  if (!isObj(inv)) e.push('보유 재화 정보가 없습니다.');
  else for (const [k, v] of Object.entries(inv)) {
    if (!DATA.items.some((i) => i.id === k)) e.push(`알 수 없는 재화: ${k}`);
    if (!isInt(v) || (v as number) < 0) e.push(`재화 '${k}' 수량이 올바르지 않습니다.`);
  }

  const ex = s.expedition;
  if (ex !== null) {
    if (!isObj(ex)) e.push('원정 정보가 손상되었습니다.');
    else {
      if (!Array.isArray(ex.members) || !ex.members.length) e.push('원정 참여 부대원 정보가 없습니다.');
      else for (const m of ex.members) if (!rosterIds.has(m as string)) e.push(`원정 참여 부대원이 보유 목록에 없습니다: ${String(m)}`);
      if (!Array.isArray(ex.relics)) e.push('원정 유물 정보가 손상되었습니다.');
      else if (new Set(ex.relics).size !== ex.relics.length) e.push('같은 유물이 중복 저장되었습니다.');
      if (!isObj(ex.outpost) || !isNum(ex.outpost.hp)) e.push('임시 거점 정보가 손상되었습니다.');
    }
  }

  const t = s.tutorial;
  if (!isObj(t) || typeof t.active !== 'boolean' || !isInt(t.step) || typeof t.skipped !== 'boolean') e.push('튜토리얼 진행 정보가 손상되었습니다.');

  const pr = s.progress;
  if (!isObj(pr) || !Array.isArray(pr.unlockedDifficulties) || !pr.unlockedDifficulties.length) e.push('해금 정보가 손상되었습니다.');
  else if (!isInt(pr.highestCleared) || !isObj(pr.recruit)) e.push('진행 기록이 손상되었습니다.');
  return e;
}

export const isGameState = (s: unknown): s is GameState => validateGameState(s).length === 0;
