import { describe, expect, it } from 'vitest';
import { createNewGame } from '../core/initialState';
import { DATA } from '../data';
import { SaveManager } from '../save/SaveManager';
import { MemoryAdapter } from '../save/storage';
import { checksum } from '../save/checksum';
import { endExpedition, enterNode, generateMap, isCleared, isCombat, nodeOf, purposeLoot, reachable, resolveOffer, settlementFor, startExpedition, winCombat } from './expedition';
import { controlledRegions } from './regions';
import type { GameState } from '../core/types';

const ok = (r: { ok: boolean; state?: GameState; message?: string }) => { if (!r.ok) throw new Error(r.message); return r.state!; };
const R = 'rg_industrial';
const go = (s: GameState, purpose = 'resource', seed = 5) => startExpedition(s, 1, ['aion', 'ring', 'jerag'], seed, { regionId: R, purpose, kind: 'general' });
function playToEnd(s: GameState): GameState {
  for (let i = 0; i < 60 && !isCleared(s.expedition!); i++) {
    const ex = s.expedition!; const id = reachable(ex)[0]; const node = nodeOf(ex.map, id)!;
    if (isCombat(node.type)) s = ok(winCombat(s, id)); else s = ok(enterNode(s, id));
    const o = s.expedition!.pending!;
    s = ok(resolveOffer(s, o.kind === 'relic' ? { pick: o.choices[0] } : o.kind === 'reinforce' ? { pick: o.candidates[0] } : o.kind === 'event' || o.kind === 'battleReward' ? { index: 0 } : o.kind === 'shop' ? { skip: true } : {}));
    if (s.expedition!.pending) s = ok(resolveOffer(s, {}));
  }
  return s;
}

describe('general expedition bound to a region', () => {
  it('stores region, purpose and kind on the expedition', () => {
    const ex = go(createNewGame(), 'survey').expedition!;
    expect(ex).toMatchObject({ regionId: R, purpose: 'survey', kind: 'general', opId: null });
  });
  it('purpose changes the node mix (data-driven weights)', () => {
    const count = (purpose: string, type: string) => [...Array(40).keys()].reduce((n, seed) => n + generateMap(seed + 1, 3, purpose).columns.flat().filter((x) => x.type === type).length, 0);
    expect(count('resource', 'resource')).toBeGreaterThan(count('survey', 'resource'));
    expect(count('survey', 'intel')).toBeGreaterThan(count('resource', 'intel'));
  });
  it('purpose changes loot amounts', () => {
    expect(purposeLoot('biosample', { biosample: 10 }).biosample).toBeGreaterThan(purposeLoot('resource', { biosample: 10 }).biosample!);
  });
});

describe('settlement (원정 정산)', () => {
  it('victory delivers loot by ratio, grants growth materials and boss materials, once', () => {
    let s = playToEnd(go(createNewGame()));
    const ex = s.expedition!;
    const st = settlementFor(ex, 'victory');
    expect(st.bossCleared).toBe(true);
    const before = { ...s.resources }; const inv = { ...s.inventory };
    s = endExpedition(s, 'victory');
    for (const [k, v] of Object.entries(st.resources)) expect(s.resources[k as keyof typeof s.resources]).toBeCloseTo(before[k as keyof typeof before] + v!, 5);
    for (const [k, v] of Object.entries(st.items)) expect(s.inventory[k]).toBe((inv[k] ?? 0) + v);
    expect(s.inventory.special_biosample).toBe(DATA.settlement.bossItems.special_biosample);
    // ending again is a no-op: there is no expedition left to settle
    const again = endExpedition(s, 'victory');
    expect(again).toBe(s);
  });
  it('withdrawal and defeat deliver a smaller share and no boss materials', () => {
    let s = go(createNewGame());
    s = { ...s, expedition: { ...s.expedition!, loot: { material: 100 } } };
    expect(settlementFor(s.expedition!, 'return').resources.material).toBe(Math.floor(100 * DATA.settlement.ratio.return));
    expect(settlementFor(s.expedition!, 'defeat').resources.material).toBe(Math.floor(100 * DATA.settlement.ratio.defeat));
    expect(settlementFor(s.expedition!, 'defeat').bossCleared).toBe(false);
  });
});

describe('region rules hold through real expeditions', () => {
  it('first completed run -> 정보 확보; 50 more runs never add control or regions', () => {
    let s = endExpedition(playToEnd(go(createNewGame())), 'victory');
    expect(s.regions[R]).toMatchObject({ state: 2, generalRuns: 1, generalClears: 1 });
    for (let i = 0; i < 50; i++) {
      s = go(s, DATA.generalPurposes[i % 4].id, 100 + i);
      s = endExpedition(i % 5 === 0 ? s : playToEnd(s), i % 5 === 0 ? 'return' : 'victory');
    }
    expect(s.regions[R].state).toBe(2);
    expect(s.regions[R].generalRuns).toBe(51);
    expect(controlledRegions(s)).toEqual([]);
    expect(Object.values(s.regions).filter((p) => p.unlocked)).toHaveLength(1);
  });
});

describe('save v5', () => {
  it('migrates a v4 save with an expedition in progress', () => {
    const store = new MemoryAdapter(); const sm = new SaveManager(store, 'test', 3);
    const s = go(createNewGame());
    const data: Record<string, unknown> = JSON.parse(JSON.stringify(s));
    data.schema = 4;
    const ex = data.expedition as Record<string, unknown>; delete ex.kind; delete ex.regionId; delete ex.purpose; delete ex.opId;
    const meta = { slot: 1, kind: 'manual', reason: 't', savedAt: new Date().toISOString(), summary: { gameDate: '', gameTime: '', facilities: 8, roster: 6, inExpedition: true, difficulty: 1 } };
    store.set('test.save.1', JSON.stringify({ format: 'UHA_SAVE', saveVersion: 4, gameVersion: '0.1.0', meta, checksum: checksum(JSON.stringify({ meta, data })), data }));
    const r = sm.load(1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.expedition).toMatchObject({ kind: 'general', regionId: R, purpose: 'resource', opId: null });
  });
});
