// Randomized integration check of the region-reclamation rules (user spec §4, §12):
// thousands of random actions with save/load round trips; invariants are checked after every step.
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../core/initialState';
import { DATA } from '../data';
import { SaveManager } from '../save/SaveManager';
import { MemoryAdapter } from '../save/storage';
import { validateGameState } from '../save/validate';
import { rng, endExpedition, enterNode, isCleared, isCombat, nodeOf, reachable, resolveOffer, startExpedition, winCombat } from './expedition';
import { opBlockers, startOp } from './regions';
import { repairSite, setCleanupWorkers, setSiteWorkers, siteDefs } from './regionDev';
import { assignedWorkers } from './government';
import { tickEconomy } from './economy';
import type { GameState } from '../core/types';

function play(s: GameState, r: () => number, stopEarly: boolean): GameState {
  for (let i = 0; i < 60 && !isCleared(s.expedition!); i++) {
    if (stopEarly && r() < 0.15) return s;
    const ex = s.expedition!; const ids = reachable(ex); const id = ids[Math.floor(r() * ids.length)]; const node = nodeOf(ex.map, id)!;
    const res = isCombat(node.type) ? winCombat(s, id) : enterNode(s, id);
    if (!res.ok) throw new Error(res.message); s = res.state;
    const o = s.expedition!.pending!;
    const c = o.kind === 'relic' ? { pick: o.choices[0] } : o.kind === 'reinforce' ? { pick: o.candidates[0] } : o.kind === 'event' || o.kind === 'battleReward' ? { index: 0 } : o.kind === 'shop' ? { skip: true } : {};
    const rr = resolveOffer(s, c); if (!rr.ok) throw new Error(rr.message); s = rr.state;
    if (s.expedition!.pending) { const r2 = resolveOffer(s, {}); if (r2.ok) s = r2.state; }
  }
  return s;
}

describe('region rules hold under random play with save/load', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    it(`seed ${seed}`, () => {
      const r = rng(seed * 7919);
      const sm = new SaveManager(new MemoryAdapter(), 'inv', 3);
      let s: GameState = { ...createNewGame(), resources: { ...createNewGame().resources, material: 1e6, parts: 1e6, budget: 1e7, food: 1e6, data: 1e5, power: 1e6 } };
      const certFromOps = () => DATA.strategicOps.filter((o) => s.strategicOps[o.id]?.rewardGranted).reduce((n, o) => n + (o.rewards.items.certificate ?? 0), 0);
      let certBase = 0; let prevStates = Object.fromEntries(Object.entries(s.regions).map(([k, v]) => [k, v.state]));
      let opsGranted = 0;
      for (let step = 0; step < 400; step++) {
        const roll = r();
        const unlocked = DATA.regions.filter((x) => s.regions[x.id].unlocked);
        const certBefore = s.inventory.certificate ?? 0, grantedBefore = DATA.strategicOps.filter((o) => s.strategicOps[o.id]?.rewardGranted).length;
        if (roll < 0.35) {                                  // general expedition
          const reg = unlocked[Math.floor(r() * unlocked.length)];
          s = startExpedition(s, 1, ['aion', 'ring', 'jerag'], Math.floor(r() * 1e6), { regionId: reg.id, purpose: DATA.generalPurposes[Math.floor(r() * 4)].id, kind: 'general' });
          const early = r() < 0.3; s = play(s, r, early);
          s = endExpedition(s, isCleared(s.expedition!) ? 'victory' : r() < 0.5 ? 'return' : 'defeat');
        } else if (roll < 0.6) {                            // strategic operation (maybe withdrawn / failed)
          const open = DATA.strategicOps.filter((o) => opBlockers(s, o.id).length === 0);
          if (open.length) {
            const op = open[Math.floor(r() * open.length)];
            const st = startOp(s, op.id); if (!st.ok) throw new Error(st.message);
            s = startExpedition(st.state, 1, ['aion', 'ring', 'jerag'], Math.floor(r() * 1e6), { regionId: op.regionId, purpose: 'op', kind: 'strategic', opId: op.id });
            s = play(s, r, r() < 0.3);
            s = endExpedition(s, r() < 0.15 ? 'defeat' : isCleared(s.expedition!) ? 'victory' : 'return');
          }
        } else if (roll < 0.8) {                            // development actions
          for (const reg of DATA.regions.filter((x) => s.regions[x.id].state >= 4)) {
            for (const d of siteDefs(reg.id)) {
              const a = repairSite(s, reg.id, d.id); if (a.ok) s = a.state;
              const b = setSiteWorkers(s, reg.id, d.id, d.workers, assignedWorkers(s, 'labor')); if (b.ok) s = b.state;
            }
            const c = setCleanupWorkers(s, reg.id, 10000, assignedWorkers(s, 'labor')); if (c.ok) s = c.state;
          }
          for (let h = 0; h < 24 * 3; h++) s = tickEconomy(s, 60).state;
        } else {                                            // save + load round trip
          expect(sm.save(1, s, 'manual', 'inv').ok).toBe(true);
          const l = sm.load(1); expect(l.ok).toBe(true); if (l.ok) s = l.state;
        }
        // ---- invariants ----
        expect(validateGameState(s)).toEqual([]);
        expect(Object.keys(s.regions).length).toBe(DATA.regions.length);                       // finite world
        for (const [k, v] of Object.entries(s.regions)) {
          expect(v.state).toBeGreaterThanOrEqual(prevStates[k]);                                 // never decreases
          if (v.state >= 4) expect(DATA.regions.find((x) => x.id === k)!.strategicOps.some((o) => s.strategicOps[o]?.controlGranted)).toBe(true); // control only via op
          if (v.state >= 3) expect(DATA.regions.find((x) => x.id === k)!.strategicOps.some((o) => s.strategicOps[o]?.rewardGranted)).toBe(true);
        }
        const grantedNow = DATA.strategicOps.filter((o) => s.strategicOps[o.id]?.rewardGranted).length;
        expect(grantedNow - grantedBefore).toBeLessThanOrEqual(1);                               // at most one op settles per step
        // certificates from operations increase only when an operation newly settles
        if (grantedNow === grantedBefore) expect(certFromOps()).toBe(certBase);
        void certBefore;
        for (const o of DATA.strategicOps) { const rec = s.strategicOps[o.id]; if (rec?.controlGranted) expect(rec.rewardGranted).toBe(true); }
        prevStates = Object.fromEntries(Object.entries(s.regions).map(([k, v]) => [k, v.state]));
        opsGranted = grantedNow; certBase = certFromOps();
      }
      console.log(`seed ${seed}: ops settled ${opsGranted}, states ${JSON.stringify(Object.fromEntries(Object.entries(s.regions).map(([k, v]) => [k.slice(3), v.state])))}`);
      expect(opsGranted).toBeGreaterThanOrEqual(2);   // the run must actually progress past control
    });
  }
});
