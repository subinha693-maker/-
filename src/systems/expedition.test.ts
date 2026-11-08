import { describe, expect, it } from 'vitest';
import { createNewGame } from '../core/initialState';
import { endExpedition, enterNode, generateMap, isCleared, isCombat, nodeOf, reachable, resolveOffer, startExpedition, winCombat, party } from './expedition';
import { validateGameState } from '../save/validate';
import type { GameState } from '../core/types';

const ok = (r: { ok: boolean; state?: GameState; message?: string }) => { if (!r.ok) throw new Error(r.message); return r.state!; };
const start = (seed = 42, diff = 1) => startExpedition(createNewGame(), diff, ['aion', 'ring', 'jerag'], seed);

/** Plays forward by always taking the first reachable node and making a default choice. */
function step(s: GameState): GameState {
  const ex = s.expedition!;
  const next = reachable(ex)[0];
  const node = nodeOf(ex.map, next)!;
  if (isCombat(node.type)) return ok(winCombat(s, next));
  s = ok(enterNode(s, next));
  const o = s.expedition!.pending!;
  const choice = o.kind === 'relic' ? { pick: o.choices[0] } : o.kind === 'reinforce' ? { pick: o.candidates[0] } : o.kind === 'event' ? { index: 0 } : { skip: true };
  s = ok(resolveOffer(s, choice));
  if (s.expedition!.pending) s = ok(resolveOffer(s, {})); // supply follow-up
  return s;
}

describe('map generation', () => {
  for (const diff of [1, 2, 3, 4, 5]) for (const seed of [1, 7, 99, 12345]) {
    it(`difficulty ${diff} seed ${seed}: every node reachable, start/boss fixed`, () => {
      const m = generateMap(seed, diff);
      expect(m.columns[0]).toHaveLength(1);
      expect(m.columns.at(-1)![0].type).toBe('boss');
      const ids = m.columns.flat().map((n) => n.id);
      for (const id of ids.slice(1)) expect(m.edges.some(([, b]) => b === id)).toBe(true);           // has incoming
      for (const col of m.columns.slice(0, -1)) for (const n of col) expect(m.edges.some(([a]) => a === n.id)).toBe(true); // has outgoing
    });
  }
  it('is deterministic per seed', () => expect(generateMap(5, 2)).toEqual(generateMap(5, 2)));
  it('harder difficulty means a longer map', () => expect(generateMap(5, 3).columns.length).toBeGreaterThan(generateMap(5, 1).columns.length));
});

describe('exploration', () => {
  it('only connected nodes can be entered; the path is recorded', () => {
    let s = start();
    const first = reachable(s.expedition!)[0];
    const far = s.expedition!.map.columns[2][0].id;
    expect(winCombat(s, far).ok).toBe(false);
    s = ok(winCombat(s, first));
    expect(s.expedition!.path).toEqual([first]);
    for (const id of reachable(s.expedition!)) expect(s.expedition!.map.edges).toContainEqual([first, id]);
  });

  it('a rolled node event is stored, so a save/load cannot re-roll it', () => {
    let s = start(3);
    // walk until we stand in front of a relic node, or give up
    for (let i = 0; i < 20 && s.expedition && !isCleared(s.expedition); i++) {
      const relicNext = reachable(s.expedition!).find((id) => nodeOf(s.expedition!.map, id)!.type === 'relic');
      if (relicNext) {
        s = ok(enterNode(s, relicNext));
        const offer = s.expedition!.pending;
        const reloaded: GameState = JSON.parse(JSON.stringify(s));
        expect(reloaded.expedition!.pending).toEqual(offer);
        expect(validateGameState(reloaded)).toEqual([]);
        expect(enterNode(reloaded, relicNext).ok).toBe(false); // already there, must resolve first
        const r1 = ok(resolveOffer(reloaded, { pick: (offer as { choices: string[] }).choices[0] }));
        expect(resolveOffer(r1, { pick: (offer as { choices: string[] }).choices[0] }).ok).toBe(false); // no double grant
        expect(new Set(r1.expedition!.relics).size).toBe(r1.expedition!.relics.length);
        return;
      }
      s = step(s);
    }
  });

  it('후발대: a new agent joins; picking a deployed agent triggers 보급품 도착', () => {
    let s = start();
    s = { ...s, expedition: { ...s.expedition!, currentNode: null, pending: { kind: 'reinforce', node: 'c0r0', candidates: ['shion_shirayuko', 'aion'] } } };
    const joined = ok(resolveOffer(s, { pick: 'shion_shirayuko' }));
    expect(party(joined.expedition!)).toContain('shion_shirayuko');
    expect(joined.expedition!.hp.shion_shirayuko).toBe(1);
    const sup = ok(resolveOffer({ ...s, expedition: { ...s.expedition!, hp: { ...s.expedition!.hp, aion: 0.3 } } }, { pick: 'aion' }));
    expect(sup.expedition!.pending).toMatchObject({ kind: 'supply', charId: 'aion' });
    const after = ok(resolveOffer(sup, {}));
    expect(after.expedition!.hp.aion).toBe(1);
    expect(after.expedition!.buffs[0].text).toContain('보급품 도착');
    expect(after.expedition!.reinforcements).not.toContain('aion');
  });

  it('a full run reaches the boss; victory records the clear and unlocks the next difficulty', () => {
    let s = start(11);
    for (let i = 0; i < 40 && !isCleared(s.expedition!); i++) s = step(s);
    expect(isCleared(s.expedition!)).toBe(true);
    expect(validateGameState(s)).toEqual([]);
    const end = endExpedition(s, 'victory');
    expect(end.expedition).toBeNull();
    expect(end.progress.highestCleared).toBe(1);
    expect(end.progress.unlockedDifficulties).toContain(2);
  });

  it('retreat/defeat ends without unlocking anything; relics vanish', () => {
    const s = start();
    const end = endExpedition({ ...s, expedition: { ...s.expedition!, relics: ['rl_hp_1'] } }, 'defeat');
    expect(end.expedition).toBeNull();
    expect(end.progress.unlockedDifficulties).toEqual([1]);
  });
});
