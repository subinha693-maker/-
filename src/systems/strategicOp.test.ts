import { describe, expect, it } from 'vitest';
import { createNewGame } from '../core/initialState';
import { SaveManager } from '../save/SaveManager';
import { MemoryAdapter } from '../save/storage';
import { endExpedition, enterNode, isCleared, isCombat, nodeOf, reachable, resolveOffer, startExpedition, winCombat } from './expedition';
import { controlledRegions, recordGeneralExpedition, startOp } from './regions';
import { validateGameState } from '../save/validate';
import type { GameState } from '../core/types';

const ok = (r: { ok: boolean; state?: GameState; message?: string }) => { if (!r.ok) throw new Error(r.message); return r.state!; };
const R = 'rg_industrial';
const launch = (s: GameState, opId: string, seed = 9) => startExpedition(ok(startOp(s, opId)), 1, ['aion', 'ring', 'jerag'], seed, { regionId: R, purpose: 'op', kind: 'strategic', opId });
function advance(s: GameState, stopBeforeObjective = false): GameState {
  for (let i = 0; i < 60 && !isCleared(s.expedition!); i++) {
    const ex = s.expedition!; const id = reachable(ex)[0]; const node = nodeOf(ex.map, id)!;
    if (stopBeforeObjective && node.type === 'objective') return s;
    if (isCombat(node.type)) s = ok(winCombat(s, id)); else s = ok(enterNode(s, id));
    const o = s.expedition!.pending!;
    s = ok(resolveOffer(s, o.kind === 'relic' ? { pick: o.choices[0] } : o.kind === 'reinforce' ? { pick: o.candidates[0] } : o.kind === 'event' || o.kind === 'battleReward' ? { index: 0 } : o.kind === 'shop' ? { skip: true } : {}));
    if (s.expedition!.pending) s = ok(resolveOffer(s, {}));
  }
  return s;
}
const ready = () => recordGeneralExpedition(createNewGame(), R, 'victory'); // region at 정보 확보

describe('strategic operation via a real expedition', () => {
  it('the operation map ends with a distinct objective node instead of the boss', () => {
    const ex = launch(ready(), 'op_industrial_forward').expedition!;
    expect(ex.kind).toBe('strategic');
    expect(ex.map.columns.at(-1)![0].type).toBe('objective');
    expect(ex.map.columns.flat().some((n) => n.type === 'boss')).toBe(false);
  });
  it('objective node -> objective recorded, territory unchanged until return and settlement', () => {
    let s = advance(launch(ready(), 'op_industrial_forward'));
    expect(s.strategicOps.op_industrial_forward.objectiveAchieved).toBe(true);
    expect(s.strategicOps.op_industrial_forward.rewardGranted).toBe(false);
    expect(s.regions[R].state).toBe(2);                 // not yet
    s = endExpedition(s, 'victory');                    // return + settlement
    expect(s.regions[R].state).toBe(3);
    expect(s.strategicOps.op_industrial_forward).toMatchObject({ returned: true, rewardGranted: true, controlGranted: false });
    expect(s.regions[R].generalRuns).toBe(1);           // strategic ops are not general runs
  });
  it('control operation -> control, neighbours unlocked, rewards once', () => {
    let s = endExpedition(advance(launch(ready(), 'op_industrial_forward')), 'victory');
    s = advance(launch(s, 'op_industrial_control'));
    const cert = s.inventory.certificate ?? 0;
    s = endExpedition(s, 'victory');
    expect(s.regions[R].state).toBe(4);
    expect(controlledRegions(s)).toEqual([R]);
    expect(s.regions.rg_residential.unlocked && s.regions.rg_energy.unlocked).toBe(true);
    expect(s.inventory.certificate).toBe(cert + 1);
    expect(startOp(s, 'op_industrial_control').ok).toBe(false); // cannot be repeated
  });
  it('withdrawing before the objective, or losing, grants nothing', () => {
    const s0 = advance(launch(ready(), 'op_industrial_forward'), true);
    expect(s0.expedition!.currentNode).not.toBeNull();
    const withdrawn = endExpedition(s0, 'return');
    expect(withdrawn.regions[R].state).toBe(2);
    expect(withdrawn.strategicOps.op_industrial_forward).toMatchObject({ attempts: 1, rewardGranted: false, objectiveAchieved: false });
    const lost = endExpedition(advance(launch(withdrawn, 'op_industrial_forward')), 'defeat');
    expect(lost.regions[R].state).toBe(2);
    expect(lost.strategicOps.op_industrial_forward).toMatchObject({ attempts: 2, rewardGranted: false });
  });
  it('withdrawal after the objective still counts as a return (objective + return = success)', () => {
    const s = endExpedition(advance(launch(ready(), 'op_industrial_forward')), 'return');
    expect(s.regions[R].state).toBe(3);
  });
  it('save in the middle of an operation and continue: objective, record and pending survive', () => {
    const sm = new SaveManager(new MemoryAdapter(), 'test', 3);
    const mid = advance(launch(ready(), 'op_industrial_forward'), true);
    expect(validateGameState(mid)).toEqual([]);
    expect(sm.save(1, mid, 'manual', 't').ok).toBe(true);
    const r = sm.load(1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const done = endExpedition(advance(r.state), 'victory');
    expect(done.regions[R].state).toBe(3);
  });
  it('an op cannot start before its conditions (region still 미확인)', () => {
    expect(startOp(createNewGame(), 'op_industrial_forward').ok).toBe(false);
  });
});
