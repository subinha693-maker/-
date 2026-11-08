import { describe, expect, it } from 'vitest';
import { createNewGame } from '../core/initialState';
import { BCFG, allyStats, castSkill, createBattle, isOver, results, skillReady, step, swapInto, type BattleState } from './battle';

const party = (ids: string[]) => createNewGame().roster.filter((c) => ids.includes(c.charId));
const setup = (nodeType = 'combat', difficulty = 1, ids = ['aion', 'james_harold', 'miley_sneaker'], seed = 7) =>
  createBattle({ party: party(ids), hp: {}, relics: [], supplied: [], outpost: { hp: 100, maxHp: 100 }, nodeType, difficulty, seed });
function run(b: BattleState, opts: { skills?: boolean; max?: number } = {}) {
  for (let i = 0; i < (opts.max ?? 6000) && !isOver(b); i++) {
    step(b, BCFG.tick);
    if (opts.skills) for (const a of b.allies) if (skillReady(a)) castSkill(b, a.charId);
  }
  return b;
}

describe('ally stats from confirmed tendencies', () => {
  const g = createNewGame();
  const st = (id: string) => allyStats(g.roster.find((c) => c.charId === id)!);
  it('S grades raise the matching stat', () => {
    expect(st('james_harold').atk).toBeGreaterThan(st('aion').atk);           // 파괴력 S + 화력 A vs 공격력 B
    expect(st('aion').eva).toBeGreaterThan(st('james_harold').eva);           // 회피율 S / 기동력 S+
    expect(st('shion_shirayuko').buthosDmg).toBeGreaterThan(0);              // 대오염특효 S
    expect(st('jerag').skillCharge).toBeLessThan(st('james_harold').skillCharge); // 지능 S
    expect(st('aion').melee).toBe(true);
    expect(st('miley_sneaker').melee).toBe(false);
  });
  it('level and promotion phase scale stats', () => {
    const c = g.roster[0];
    expect(allyStats({ ...c, level: 20 }).atk).toBeGreaterThan(allyStats(c).atk);
    expect(allyStats({ ...c, phase: 2 }).hp).toBeGreaterThan(allyStats(c).hp);
  });
  it('relics modify stats', () => {
    const c = g.roster[0];
    expect(allyStats(c, { atkSpeed: 0.1 }).atkInterval).toBeLessThan(allyStats(c).atkInterval);
  });
});

describe('battle flow', () => {
  it('intro -> waves -> victory with auto attacks on a basic node', () => {
    const b = run(setup());
    expect(b.phase).toBe('victory');
    expect(b.wave).toBe(b.waves.length - 1);
  });
  it('2 lanes x 4 slots: party alternates lanes, max 8 deployed', () => {
    const b = setup('combat', 1, ['aion', 'james_harold', 'miley_sneaker', 'ring', 'jerag', 'shion_shirayuko']);
    const dep = b.allies.filter((a) => a.lane !== null);
    expect(new Set(dep.map((a) => a.lane))).toEqual(new Set([0, 1]));
    for (const a of dep) expect(a.slot).toBeLessThan(4);
  });
  it('an undefended lane lets enemies reach the outpost; outpost 0 = defeat', () => {
    const b = setup('boss', 3, ['aion']);
    b.allies[0].lane = null; b.allies[0].slot = null; // nobody deployed
    run(b);
    expect(b.phase).toBe('defeat');
    expect(b.outpost.hp).toBe(0);
  });
  it('skills need a full gauge and apply their effects', () => {
    const b = setup('combat', 1, ['james_harold']);
    run(b, { max: 40 }); // past intro
    expect(castSkill(b, 'james_harold')).toBe(false);
    while (b.enemies.length === 0) step(b, BCFG.tick);
    b.allies[0].sp = 1;
    expect(castSkill(b, 'james_harold')).toBe(true);
    expect(b.enemies.every((e) => e.dead || e.st.slow > 0)).toBe(true); // 서프레시브 파이어: slow all
    expect(b.allies[0].sp).toBe(0);
  });
  it('swap: queued unit takes a deployed slot, the replaced one goes to the queue and regenerates', () => {
    const b = setup('combat', 1, ['aion', 'james_harold', 'ring']);
    const ring = b.allies.find((a) => a.charId === 'ring')!;
    const aion = b.allies.find((a) => a.charId === 'aion')!;
    ring.lane = null; ring.slot = null; ring.hp = ring.stats.hp / 2;
    const [lane, slot] = [aion.lane!, aion.slot!];
    aion.hp = aion.stats.hp * 0.3;
    expect(swapInto(b, 'ring', lane, slot)).toBe(true);
    expect([ring.lane, ring.slot]).toEqual([lane, slot]);
    expect(aion.lane).toBeNull();
    const before = aion.hp;
    for (let i = 0; i < 20; i++) step(b, BCFG.tick);
    expect(aion.hp).toBeGreaterThan(before);
  });
  it('results write back HP fractions and outpost HP', () => {
    const r = results(run(setup()));
    for (const v of Object.values(r.hp)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
    expect(r.outpostHp).toBeGreaterThan(0);
  });
});

describe('balance probe (placeholder numbers)', () => {
  it('prints outcomes', () => {
    const rows: string[] = [];
    for (const [type, d] of [['combat', 1], ['elite', 1], ['boss', 1], ['combat', 3], ['boss', 3], ['boss', 5]] as const) {
      for (const skills of [false, true]) {
        let wins = 0, time = 0, op = 0;
        for (let seed = 1; seed <= 10; seed++) { const b = run(setup(type, d, ['aion', 'james_harold', 'miley_sneaker'], seed), { skills }); if (b.phase === 'victory') wins++; time += b.t; op += b.outpost.hp; }
        rows.push(`${type} d${d} skills=${skills}: win ${wins}/10, avg ${(time / 10).toFixed(0)}s, outpost ${(op / 10).toFixed(0)}`);
      }
    }
    console.log(rows.join('\n'));
    expect(rows.length).toBe(12);
  });
});
