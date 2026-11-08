import { describe, expect, it } from 'vitest';
import { createNewGame } from '../core/initialState';
import { GROWTH, addExp, expToNext, levelCap, promoteAgent, promotionRequirements, raiseSkill, skillMax, trainAgent, unlockTrait, useExpItem } from './growth';
import { reviewResumes } from './recruit';
import { tickEconomy } from './economy';
import { startResearch } from './government';
import type { GameState } from '../core/types';

const ok = (r: { ok: boolean; state?: GameState; message?: string }) => { if (!r.ok) throw new Error(r.message); return r.state!; };
const rich = (s: GameState): GameState => ({ ...s, resources: { ...s.resources, budget: 1e9, data: 1e6 } });
const aion = (s: GameState) => s.roster.find((c) => c.charId === 'aion')!;
const withAgent = (s: GameState, patch: object) => ({ ...s, roster: s.roster.map((c) => (c.charId === 'aion' ? { ...c, ...patch } : c)) });

describe('starting roster', () => {
  it('all 6 distribution agents start at Phase 1, level 1, skill 1', () => {
    const s = createNewGame();
    expect(s.roster.map((c) => c.charId).sort()).toEqual(['aion', 'james_harold', 'jerag', 'miley_sneaker', 'ring', 'shion_shirayuko']);
    for (const c of s.roster) expect(c).toMatchObject({ phase: 1, level: 1, skillLevel: 1, merit: 0, traits: [] });
  });
});

describe('이력서 확인', () => {
  it('a duplicate converts into 인사 공적 for that agent; cost is paid', () => {
    const s0 = rich(createNewGame());
    const { result, applicants } = reviewResumes(s0, 'normal', 1, () => 0); // first of pool
    const s = ok(result);
    expect(applicants[0]).toMatchObject({ duplicate: true, merit: GROWTH.duplicateMerit });
    expect(s.roster.length).toBe(6);
    expect(s.roster.find((c) => c.charId === applicants[0].charId)!.merit).toBe(GROWTH.duplicateMerit);
    expect(s.resources.budget).toBeLessThan(s0.resources.budget);
    expect(s.progress.recruit.reviews).toBe(1);
  });
  it('a new applicant joins the roster', () => {
    const s0 = rich({ ...createNewGame(), roster: createNewGame().roster.filter((c) => c.charId !== 'ring') });
    const pool = ['shion_shirayuko', 'james_harold', 'aion', 'ring', 'jerag', 'miley_sneaker'];
    const { result, applicants } = reviewResumes(s0, 'normal', 1, () => pool.indexOf('ring') / pool.length);
    expect(applicants[0]).toEqual({ charId: 'ring', duplicate: false, merit: 0 });
    expect(ok(result).roster.some((c) => c.charId === 'ring' && c.phase === 1)).toBe(true);
  });
  it('a 10x review in one go never adds the same agent twice', () => {
    const s0 = rich({ ...createNewGame(), roster: [] });
    const s = ok(reviewResumes(s0, 'normal', 10, () => 0.99).result);
    expect(s.roster.length).toBe(1);
    expect(s.roster[0].merit).toBe(9 * GROWTH.duplicateMerit);
  });
  it('refuses when resources are short', () => {
    const s0 = { ...createNewGame(), resources: { ...createNewGame().resources, budget: 0 } };
    expect(reviewResumes(s0, 'special', 1).result.ok).toBe(false);
  });
});

describe('육성', () => {
  it('training gives EXP and levels up to the phase cap (excess discarded)', () => {
    let s = rich(createNewGame());
    for (let i = 0; i < 2000; i++) { const r = trainAgent(s, 'aion'); if (!r.ok) break; s = r.state; }
    expect(aion(s).level).toBe(levelCap(aion(s)));
    expect(aion(s).exp).toBe(0);
    expect(trainAgent(s, 'aion').ok).toBe(false);
  });
  it('작전 경력서 and 실무 훈장 give different EXP amounts', () => {
    const items = GROWTH.exp.items as Record<string, number>;
    expect(items.career_record).not.toBe(items.service_medal);
    let s: GameState = { ...createNewGame(), inventory: { career_record: 1, service_medal: 1 } };
    s = ok(useExpItem(s, 'aion', 'career_record'));
    const afterRecord = aion(s);
    s = ok(useExpItem(s, 'aion', 'service_medal'));
    expect(s.inventory).toEqual({ career_record: 0, service_medal: 0 });
    const expected = addExp(addExp(createNewGame().roster.find((c) => c.charId === 'aion')!, items.career_record), items.service_medal);
    expect(aion(s)).toEqual(expected);
    expect(afterRecord.level).toBeGreaterThan(1);
    expect(useExpItem(s, 'aion', 'career_record').ok).toBe(false);
  });
  it('EXP curve: one level needs expToNext(level)', () => {
    const c = createNewGame().roster[0];
    expect(addExp(c, expToNext(1) - 1).level).toBe(1);
    expect(addExp(c, expToNext(1)).level).toBe(2);
  });
  it('Phase 2 needs level + 국가 공인 직무 인증서; unlocks passive slot and raises caps', () => {
    let s: GameState = withAgent(rich(createNewGame()), { level: 30 });
    expect(promoteAgent(s, 'aion').ok).toBe(false); // no certificate
    s = { ...s, inventory: { certificate: 1 } };
    expect(promotionRequirements(s, aion(s)).every((r) => r.met)).toBe(true);
    s = ok(promoteAgent(s, 'aion'));
    expect(aion(s).phase).toBe(2);
    expect(s.inventory.certificate).toBe(0);
    expect(levelCap(aion(s))).toBe(GROWTH.phases[1].levelCap);
    expect(skillMax(aion(s))).toBe(GROWTH.phases[1].skillMax);
    s = withAgent(s, { merit: 0 });
    s = ok(unlockTrait(s, 'aion', 'passive'));
    expect(aion(s).traits).toContain('passive');
    expect(unlockTrait(s, 'aion', 'ultimate').ok).toBe(false);
  });
  it('Phase 3 additionally needs a cleared hard expedition and deep-expedition materials', () => {
    let s: GameState = withAgent({ ...rich(createNewGame()), inventory: { special_biosample: 5, relic_remnant: 5 } }, { phase: 2, level: 50 });
    expect(promoteAgent(s, 'aion').ok).toBe(false);
    s = { ...s, progress: { ...s.progress, highestCleared: 3 } };
    s = ok(promoteAgent(s, 'aion'));
    expect(aion(s).phase).toBe(3);
    expect(promoteAgent(s, 'aion').ok).toBe(false);
  });
  it('인사 공적 deepens skill level (up to phase max) and unlocks the unique trait', () => {
    let s: GameState = withAgent(createNewGame(), { merit: 10 });
    s = ok(raiseSkill(s, 'aion')); s = ok(raiseSkill(s, 'aion'));
    expect(aion(s).skillLevel).toBe(3);
    expect(raiseSkill(s, 'aion').ok).toBe(false); // phase 1 max = 3
    s = ok(unlockTrait(s, 'aion', 'unique'));
    expect(aion(s).merit).toBe(10 - 2 * GROWTH.skillLevelMeritCost - 2);
  });
  it('completing 행정/무장/방호 research grants 국가 공인 직무 인증서', () => {
    let s = ok(startResearch(rich(createNewGame()), 'r_adm_1'));
    for (let i = 0; i < 24 * 4; i++) s = tickEconomy(s, 60).state;
    expect(s.research.completed).toContain('r_adm_1');
    expect(s.inventory.certificate).toBe(1);
  });
});
