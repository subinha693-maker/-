import { DATA } from '../data';
import type { GameState } from '../core/types';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown) => Number.isInteger(v);

/** Structural + reference validation of a GameState. Returns human-readable problems (empty = valid). */
export function validateGameState(s: unknown): string[] {
  const e: string[] = [];
  if (!isObj(s)) return ['게임 데이터가 객체가 아닙니다.'];
  if (s.schema !== 6) e.push('게임 데이터 구조 버전이 올바르지 않습니다.');

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
    if (!isInt(c.merit) || (c.merit as number) < 0 || !isNum(c.exp) || (c.exp as number) < 0) e.push(`부대원 ${c.charId}의 육성 정보가 손상되었습니다.`);
    if (!Array.isArray(c.traits)) e.push(`부대원 ${c.charId}의 특성 정보가 손상되었습니다.`);
  }

  const inv = s.inventory;
  if (!isObj(inv)) e.push('보유 재화 정보가 없습니다.');
  else for (const [k, v] of Object.entries(inv)) {
    if (!DATA.items.some((i) => i.id === k)) e.push(`알 수 없는 재화: ${k}`);
    if (!isInt(v) || (v as number) < 0) e.push(`재화 '${k}' 수량이 올바르지 않습니다.`);
  }

  const regs = s.regions;
  if (!isObj(regs)) e.push('지역 정보가 없습니다.');
  else {
    for (const r of DATA.regions) {
      const p = regs[r.id];
      if (!isObj(p) || typeof p.unlocked !== 'boolean' || ![1, 2, 3, 4, 5].includes(p.state as number) || !isInt(p.generalRuns) || !isInt(p.generalClears)) e.push(`지역 '${r.name}' 정보가 손상되었습니다.`);
    }
    for (const k of Object.keys(regs)) if (!DATA.regions.some((r) => r.id === k)) e.push(`알 수 없는 지역: ${k}`);
  }
  const dev = s.regionDev;
  if (!isObj(dev)) e.push('지역 개발 정보가 없습니다.');
  else for (const [rid, v] of Object.entries(dev)) {
    const r = DATA.regions.find((x) => x.id === rid);
    if (!r) { e.push(`알 수 없는 개발 지역: ${rid}`); continue; }
    if (!isObj(v) || !isObj(v.sites) || !isNum(v.erosion) || !isInt(v.cleanupWorkers)) { e.push(`지역 개발 정보 손상: ${r.name}`); continue; }
    const defs = DATA.regionDev.sitesByType[r.type] ?? [];
    for (const [sid, st] of Object.entries(v.sites as Record<string, unknown>)) {
      if (!defs.some((d) => d.id === sid)) e.push(`알 수 없는 지역 시설: ${sid}`);
      if (!isObj(st) || !['damaged', 'repairing', 'active', 'idle'].includes(st.status as string) || !isInt(st.workers) || (st.workers as number) < 0) e.push(`지역 시설 정보 손상: ${sid}`);
    }
    if (isObj(regs) && ((regs[rid] as Record<string, unknown>)?.state as number) < 4) e.push(`통제권이 없는 지역에 개발 기록이 있습니다: ${r.name}`);
  }

  const ops = s.strategicOps;
  if (!isObj(ops)) e.push('전략 작전 기록이 없습니다.');
  else for (const [k, v] of Object.entries(ops)) {
    if (!DATA.strategicOps.some((o) => o.id === k)) e.push(`알 수 없는 전략 작전: ${k}`);
    if (!isObj(v) || typeof v.rewardGranted !== 'boolean' || typeof v.controlGranted !== 'boolean' || typeof v.objectiveAchieved !== 'boolean') e.push(`전략 작전 기록 손상: ${k}`);
    else if (v.controlGranted && !v.rewardGranted) e.push(`전략 작전 기록 불일치: ${k}`);
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
      if (!DATA.regions.some((r) => r.id === ex.regionId)) e.push(`원정 지역이 올바르지 않습니다: ${String(ex.regionId)}`);
      if (ex.kind !== 'general' && ex.kind !== 'strategic') e.push('원정 종류가 올바르지 않습니다.');
      if (ex.kind === 'general' && !DATA.generalPurposes.some((g) => g.id === ex.purpose)) e.push(`원정 목적이 올바르지 않습니다: ${String(ex.purpose)}`);
      if (ex.kind === 'strategic') {
        const op = DATA.strategicOps.find((o) => o.id === ex.opId);
        if (!op) e.push(`전략 작전이 올바르지 않습니다: ${String(ex.opId)}`);
        else if (op.regionId !== ex.regionId) e.push('전략 작전과 원정 지역이 일치하지 않습니다.');
        else if (!isObj(s.strategicOps) || !(s.strategicOps as Record<string, unknown>)[op.id]) e.push('진행 중인 전략 작전 기록이 없습니다.');
      }
      const map = ex.map as Record<string, unknown> | undefined;
      const ids = new Set<string>();
      if (!isObj(map) || !Array.isArray(map.columns) || !Array.isArray(map.edges)) e.push('원정 지도가 손상되었습니다.');
      else {
        for (const col of map.columns as unknown[]) for (const n of (col as { id: string; type: string }[])) {
          ids.add(n.id);
          if (!DATA.nodeTypes.some((t) => t.id === n.type)) e.push(`알 수 없는 노드 유형: ${n.type}`);
        }
        if (ex.currentNode != null && !ids.has(ex.currentNode as string)) e.push('현재 위치 노드가 지도에 없습니다.');
        if (!Array.isArray(ex.path) || (ex.path as string[]).some((p) => !ids.has(p))) e.push('이동 경로가 손상되었습니다.');
      }
      if (Array.isArray(ex.relics)) for (const r of ex.relics as string[]) if (!DATA.relics.some((x) => x.id === r)) e.push(`알 수 없는 유물: ${r}`);
      if (Array.isArray(ex.reinforcements)) for (const m of ex.reinforcements) if (!rosterIds.has(m as string)) e.push(`후발대가 보유 목록에 없습니다: ${String(m)}`);
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
