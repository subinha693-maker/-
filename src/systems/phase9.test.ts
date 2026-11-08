import { describe, expect, it } from 'vitest';
import { createNewGame } from '../core/initialState';
import { DATA } from '../data';
import { SaveManager } from '../save/SaveManager';
import { MemoryAdapter } from '../save/storage';
import { checksum } from '../save/checksum';
import { validateGameState } from '../save/validate';
import { CURRENT_SAVE_VERSION } from '../save/migrations';
import { effectiveDifficulty, endExpedition, enterNode, goDeeper, isCleared, isCombat, nodeOf, party, reachable, resolveOffer, settlementFor, startExpedition, winCombat } from './expedition';
import { activeSynergies, relicMods } from './battle';
import { recordGeneralExpedition, startOp } from './regions';
import { tickEconomy } from './economy';
import { trainAgent } from './growth';
import type { GameState } from '../core/types';

const ok = (r: { ok: boolean; state?: GameState; message?: string }) => { if (!r.ok) throw new Error(r.message); return r.state!; };
function play(s: GameState): GameState {
  for (let i = 0; i < 60 && !isCleared(s.expedition!); i++) {
    const ex = s.expedition!; const id = reachable(ex)[0]; const node = nodeOf(ex.map, id)!;
    s = ok(isCombat(node.type) ? winCombat(s, id) : enterNode(s, id));
    const o = s.expedition!.pending!;
    s = ok(resolveOffer(s, o.kind === 'relic' ? (o.choices.length ? { pick: o.choices[0] } : { skip: true }) : o.kind === 'reinforce' ? { pick: o.candidates[0] } : o.kind === 'event' || o.kind === 'battleReward' ? { index: 0 } : o.kind === 'shop' ? { skip: true } : {}));
    if (s.expedition!.pending) s = ok(resolveOffer(s, {}));
  }
  return s;
}
const go = (s = createNewGame(), seed = 3) => startExpedition(s, 1, ['aion', 'ring', 'jerag'], seed, { regionId: 'rg_industrial', purpose: 'resource', kind: 'general' });

describe('심층 원정', () => {
  it('only after clearing every node', () => {
    expect(goDeeper(go()).ok).toBe(false);
  });
  it('keeps party, HP, relics, buffs, loot and outpost; new harder map; path resets', () => {
    const s = play(go());
    const ex = s.expedition!;
    const d = ok(goDeeper(s)).expedition!;
    expect(d.depth).toBe(1);
    expect(party(d)).toEqual(party(ex));
    expect([d.hp, d.relics, d.buffs, d.loot, d.outpost]).toEqual([ex.hp, ex.relics, ex.buffs, ex.loot, ex.outpost]);
    expect(d.map).not.toEqual(ex.map);
    expect(d.path).toEqual([]); expect(d.currentNode).toBeNull();
    expect(d.pastNodes).toBe(ex.path.length);
    expect(effectiveDifficulty(d)).toBe(ex.difficulty + DATA.deep.difficultyPerDepth);
  });
  it('can repeat; each boss counts; settlement happens once on return with all loot', () => {
    let s = play(go());
    for (let i = 0; i < 3; i++) s = play(ok(goDeeper(s)));
    const ex = s.expedition!;
    expect(ex.depth).toBe(3); expect(ex.bossClears).toBe(4);
    const st = settlementFor(ex, 'victory');
    expect(st.items.special_biosample).toBe(DATA.settlement.bossItems.special_biosample * 4);
    const end = endExpedition(s, 'victory');
    expect(end.expedition).toBeNull();
    expect(end.inventory.special_biosample).toBe(st.items.special_biosample);
  });
  it('defeat deep inside loses the boss materials and most loot', () => {
    const s = ok(goDeeper(play(go())));
    expect(settlementFor(s.expedition!, 'defeat').items.special_biosample).toBeUndefined();
  });
  it('deep expeditions never change territory (general) and keep op judgement (strategic)', () => {
    let s = play(go()); for (let i = 0; i < 5; i++) s = play(ok(goDeeper(s)));
    s = endExpedition(s, 'victory');
    expect(s.regions.rg_industrial.state).toBe(2);
    expect(s.regions.rg_industrial.generalRuns).toBe(1);
    // strategic: objective on depth 0, then deep, then return -> success once
    let o = recordGeneralExpedition(createNewGame(), 'rg_industrial', 'victory');
    o = startExpedition(ok(startOp(o, 'op_industrial_forward')), 1, ['aion', 'ring', 'jerag'], 4, { regionId: 'rg_industrial', purpose: 'op', kind: 'strategic', opId: 'op_industrial_forward' });
    o = play(ok(goDeeper(play(o))));
    expect(o.strategicOps.op_industrial_forward.objectiveAchieved).toBe(true);
    expect(endExpedition(o, 'victory').regions.rg_industrial.state).toBe(3);
    expect(endExpedition(o, 'defeat').regions.rg_industrial.state).toBe(2); // lost deep inside = not returned
  });
  it('deep state survives save/load', () => {
    const sm = new SaveManager(new MemoryAdapter(), 't', 3);
    const s = ok(goDeeper(play(go())));
    sm.save(1, s, 'manual', 't'); const r = sm.load(1);
    expect(r.ok && r.state.expedition).toEqual(s.expedition);
  });
});

describe('relic synergies', () => {
  it('two relics sharing a tag activate the tag bonus on top of their own effects', () => {
    expect(activeSynergies(['rl_atkspd_1'])).toHaveLength(0);
    const syn = activeSynergies(['rl_atkspd_1', 'rl_atk_1']);
    expect(syn.map((x) => x.name)).toContain('연속 교전');
    const solo = relicMods(['rl_atkspd_1', 'rl_hp_1']).atkSpeed;
    expect(relicMods(['rl_atkspd_1', 'rl_atk_1']).atkSpeed).toBeGreaterThan(solo);
  });
  it('a third relic of the tag unlocks the next tier', () => {
    expect(activeSynergies(['rl_atkspd_1', 'rl_atk_1', 'rl_atkspd_2']).map((x) => x.name)).toContain('연속 교전 II');
  });
});

describe('save compatibility across every version', () => {
  it(`a PHASE 2-4 (v1) save upgrades through every migration to v${CURRENT_SAVE_VERSION}`, () => {
    const store = new MemoryAdapter(); const sm = new SaveManager(store, 'c', 3);
    const modern = go();
    const data: Record<string, unknown> = JSON.parse(JSON.stringify(modern));
    data.schema = 1;
    data.roster = modern.roster.map((c) => ({ charId: c.charId === 'ring' ? 'ling' : c.charId === 'jerag' ? 'zerag' : c.charId, level: 4, growth: {}, equipment: [] }));
    data.expedition = { difficulty: 1, members: ['aion', 'ling', 'zerag'], reinforcements: [], map: { kind: 'sample', columns: 6 }, currentNode: null, path: [], relics: [], buffs: [], outpost: { hp: 80, maxHp: 100 } };
    for (const k of ['inventory', 'regions', 'strategicOps', 'regionDev']) delete data[k];
    data.progress = { unlockedDifficulties: [1], codex: {}, stats: {} };
    const meta = { slot: 1, kind: 'manual', reason: 't', savedAt: new Date().toISOString(), summary: { gameDate: '', gameTime: '', facilities: 8, roster: 6, inExpedition: true, difficulty: 1 } };
    store.set('c.save.1', JSON.stringify({ format: 'UHA_SAVE', saveVersion: 1, gameVersion: '0.1.0', meta, checksum: checksum(JSON.stringify({ meta, data })), data }));
    const r = sm.load(1);
    expect(r.ok).toBe(true); if (!r.ok) return;
    expect(r.migratedFrom).toBe(1);
    expect(validateGameState(r.state)).toEqual([]);
    expect(r.state.schema).toBe(7);
    expect(r.state.roster.find((c) => c.charId === 'ring')?.level).toBe(4);
    expect(r.state.expedition).toMatchObject({ members: ['aion', 'ring', 'jerag'], kind: 'general', depth: 0, outpost: { hp: 80, maxHp: 100 } });
    expect(Object.keys(r.state.regions)).toHaveLength(DATA.regions.length);
    // the migrated game is playable
    const cont = play(r.state);
    expect(endExpedition(cont, 'victory').expedition).toBeNull();
  });
});

describe('long play stability', () => {
  it('one in-game year of time, expeditions, growth and monthly save/load stays valid', () => {
    const sm = new SaveManager(new MemoryAdapter(), 'y', 3);
    let s = createNewGame();
    for (let month = 0; month < 12; month++) {
      for (let h = 0; h < 24 * 30; h++) s = tickEconomy(s, 60).state;
      s = endExpedition(play(go(s, month + 10)), month % 3 ? 'victory' : 'return');
      const t = trainAgent(s, 'aion'); if (t.ok) s = t.state;
      expect(sm.save(1, s, 'auto', 'month').ok).toBe(true);
      const r = sm.load(1); expect(r.ok).toBe(true); if (r.ok) s = r.state;
      for (const v of Object.values(s.resources)) { expect(Number.isFinite(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(0); }
    }
    expect(s.clock.gameMinutes).toBe(12 * 30 * 24 * 60);
    expect(validateGameState(s)).toEqual([]);
    expect(JSON.stringify(s).length).toBeLessThan(200_000); // save size stays small
  });
});
