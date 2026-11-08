import { describe, expect, it } from 'vitest';
import { createNewGame } from '../core/initialState';
import { DATA } from '../data';
import { SaveManager } from '../save/SaveManager';
import { MemoryAdapter } from '../save/storage';
import { checksum } from '../save/checksum';
import { canRunGeneral, controlledRegions, markObjective, opBlockers, recordGeneralExpedition, refreshRegions, settleOp, startOp, validateRegionData } from './regions';
import type { GameState } from '../core/types';

const ok = (r: { ok: boolean; state?: GameState; message?: string }) => { if (!r.ok) throw new Error(r.message); return r.state!; };
const R = 'rg_industrial';
/** Runs a strategic op to completion (objective + return). */
const completeOp = (s: GameState, op: string) => settleOp(markObjective(ok(startOp(s, op)), op), op, true).state;

describe('region data (finite, consistent)', () => {
  it('passes static validation: symmetric connections, control only from strategic ops', () => expect(validateRegionData()).toEqual([]));
  it('the world is a fixed list (rule 8)', () => {
    const s = createNewGame();
    expect(Object.keys(s.regions).sort()).toEqual(DATA.regions.map((r) => r.id).sort());
  });
  it('starts with only the initial region unlocked, all at 미확인', () => {
    const s = createNewGame();
    expect(Object.entries(s.regions).filter(([, p]) => p.unlocked).map(([k]) => k)).toEqual([R]);
    expect(Object.values(s.regions).every((p) => p.state === 1)).toBe(true);
  });
});

describe('general expeditions never grant territory (rules 1, 6, 7)', () => {
  it('first clear gives 정보 확보 (state 2) and nothing more, however many times it repeats', () => {
    let s = createNewGame();
    expect(canRunGeneral(s, R)).toEqual([]);
    s = recordGeneralExpedition(s, R, 'victory');
    expect(s.regions[R].state).toBe(2);
    for (let i = 0; i < 200; i++) s = recordGeneralExpedition(s, R, i % 3 ? 'victory' : 'return');
    expect(s.regions[R].state).toBe(2);
    expect(s.regions[R].generalRuns).toBe(201);
    expect(controlledRegions(s)).toEqual([]);
    expect(Object.values(s.regions).filter((p) => p.unlocked).length).toBe(1); // nothing new opened
  });
  it('a failed/returned run does not count as a clear', () => {
    const s = recordGeneralExpedition(createNewGame(), R, 'defeat');
    expect(s.regions[R]).toMatchObject({ state: 1, generalRuns: 1, generalClears: 0 });
  });
  it('general runs remain available after control (rule 6) and do not add area (rule 7)', () => {
    let s = recordGeneralExpedition(createNewGame(), R, 'victory');
    s = completeOp(s, 'op_industrial_forward'); s = completeOp(s, 'op_industrial_control');
    const before = controlledRegions(s).length;
    expect(canRunGeneral(s, R)).toEqual([]);
    for (let i = 0; i < 50; i++) s = recordGeneralExpedition(s, R, 'victory');
    expect(controlledRegions(s).length).toBe(before);
  });
});

describe('strategic operations (rules 2, 3, 4, 10)', () => {
  it('operations need their start conditions and prerequisites', () => {
    const s = createNewGame();
    expect(opBlockers(s, 'op_industrial_forward').length).toBeGreaterThan(0);   // region still 미확인
    expect(opBlockers(s, 'op_industrial_control')).toContain('전략 작전 완료: 외곽 공업 지구 전진 거점 설치 (임시)'.replace('전략 작전 완료', '선행 작전'));
  });
  it('forward-base op -> state 3; control op -> state 4 and opens connected regions (rule 9)', () => {
    let s = recordGeneralExpedition(createNewGame(), R, 'victory');
    s = completeOp(s, 'op_industrial_forward');
    expect(s.regions[R].state).toBe(3);
    expect(controlledRegions(s)).toEqual([]);
    s = completeOp(s, 'op_industrial_control');
    expect(s.regions[R].state).toBe(4);
    expect(s.regions.rg_residential.unlocked).toBe(true);
    expect(s.regions.rg_energy.unlocked).toBe(true);
    expect(s.regions.rg_research.unlocked).toBe(false); // needs residential control + a research
  });
  it('objective without return, or return without objective, grants nothing (rule 4)', () => {
    let s = recordGeneralExpedition(createNewGame(), R, 'victory');
    s = ok(startOp(s, 'op_industrial_forward'));
    const noObjective = settleOp(s, 'op_industrial_forward', true);
    expect(noObjective.success).toBe(false);
    expect(noObjective.state.regions[R].state).toBe(2);
    const noReturn = settleOp(markObjective(s, 'op_industrial_forward'), 'op_industrial_forward', false);
    expect(noReturn.success).toBe(false);
    expect(noReturn.state.strategicOps.op_industrial_forward.rewardGranted).toBe(false);
    expect(noReturn.state.regions[R].state).toBe(2);
  });
  it('rewards and control are granted exactly once (no duplicates on re-settle or restart)', () => {
    let s = recordGeneralExpedition(createNewGame(), R, 'victory');
    s = completeOp(s, 'op_industrial_forward');
    s = ok(startOp(s, 'op_industrial_control'));
    s = markObjective(s, 'op_industrial_control');
    const first = settleOp(s, 'op_industrial_control', true);
    expect(first.granted).toBe(true);
    const budget = first.state.resources.budget, cert = first.state.inventory.certificate;
    const again = settleOp(first.state, 'op_industrial_control', true);
    expect(again.granted).toBe(false);
    expect(again.state.resources.budget).toBe(budget);
    expect(again.state.inventory.certificate).toBe(cert);
    expect(startOp(first.state, 'op_industrial_control').ok).toBe(false); // completed op cannot be re-run
  });
  it('states never decrease', () => {
    let s = recordGeneralExpedition(createNewGame(), R, 'victory');
    s = completeOp(s, 'op_industrial_forward');
    s = recordGeneralExpedition(s, R, 'defeat');
    s = refreshRegions(s);
    expect(s.regions[R].state).toBe(3);
  });
  it('region unlocks combine conditions (control of a neighbour + a research)', () => {
    let s = recordGeneralExpedition(createNewGame(), R, 'victory');
    s = completeOp(completeOp(s, 'op_industrial_forward'), 'op_industrial_control');
    s = recordGeneralExpedition(s, 'rg_residential', 'victory');
    s = completeOp(completeOp(s, 'op_residential_forward'), 'op_residential_control');
    expect(s.regions.rg_research.unlocked).toBe(false);
    s = refreshRegions({ ...s, research: { ...s.research, completed: ['r_bio_1', 'r_bio_2'] } });
    expect(s.regions.rg_research.unlocked).toBe(true);
  });
});

describe('save (v4) and migration from v3', () => {
  it('region state and op records survive save/load', () => {
    const sm = new SaveManager(new MemoryAdapter(), 'test', 3);
    let s = recordGeneralExpedition(createNewGame(), R, 'victory');
    s = completeOp(s, 'op_industrial_forward');
    s = markObjective(ok(startOp(s, 'op_industrial_control')), 'op_industrial_control'); // mid-operation
    expect(sm.save(1, s, 'manual', 't').ok).toBe(true);
    const r = sm.load(1);
    expect(r.ok && r.state.regions).toEqual(s.regions);
    expect(r.ok && r.state.strategicOps).toEqual(s.strategicOps);
  });
  it('a v3 save (PHASE 7 format) gets the initial region state', () => {
    const store = new MemoryAdapter(); const sm = new SaveManager(store, 'test', 3);
    const data: Record<string, unknown> = JSON.parse(JSON.stringify(createNewGame()));
    data.schema = 3; delete data.regions; delete data.strategicOps;
    const meta = { slot: 1, kind: 'manual', reason: 't', savedAt: new Date().toISOString(), summary: { gameDate: '', gameTime: '', facilities: 8, roster: 6, inExpedition: false, difficulty: null } };
    store.set('test.save.1', JSON.stringify({ format: 'UHA_SAVE', saveVersion: 3, gameVersion: '0.1.0', meta, checksum: checksum(JSON.stringify({ meta, data })), data }));
    const r = sm.load(1);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.migratedFrom).toBe(3); expect(r.state.regions[R]).toMatchObject({ unlocked: true, state: 1 }); expect(r.state.strategicOps).toEqual({}); }
  });
  it('rejects a save whose op record claims control without the reward settlement', () => {
    const sm = new SaveManager(new MemoryAdapter(), 'test', 3);
    const s = createNewGame();
    const bad: GameState = { ...s, strategicOps: { op_industrial_control: { attempts: 1, objectiveAchieved: true, returned: true, rewardGranted: false, controlGranted: true, completedAt: null } } };
    expect(sm.save(1, bad, 'manual', 't').ok).toBe(false);
  });
});
