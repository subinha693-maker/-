import { describe, expect, it } from 'vitest';
import { createNewGame } from '../core/initialState';
import { DATA } from '../data';
import { SaveManager } from '../save/SaveManager';
import { MemoryAdapter } from '../save/storage';
import { checksum } from '../save/checksum';
import { computeEconomy, tickEconomy } from './economy';
import { assignedWorkers } from './government';
import { devOf, isDeveloped, outpostBonus, regionLabor, repairSite, setCleanupWorkers, setSiteWorkers, siteDefs, toggleSite } from './regionDev';
import { startExpedition } from './expedition';
import type { GameState } from '../core/types';

const ok = (r: { ok: boolean; state?: GameState; message?: string }) => { if (!r.ok) throw new Error(r.message); return r.state!; };
const R = 'rg_industrial';
const rich = (s: GameState): GameState => ({ ...s, resources: { ...s.resources, material: 1e5, parts: 1e5, budget: 1e6, food: 1e5, data: 1e4, power: 1e5 } });
const controlled = (id = R, st: 4 | 3 = 4): GameState => { const s = rich(createNewGame()); return { ...s, regions: { ...s.regions, [id]: { unlocked: true, state: st, generalRuns: 1, generalClears: 1 } } }; };
const other = (s: GameState) => assignedWorkers(s, 'labor') ; // all labor in use
const run = (s: GameState, minutes: number) => { const ev = []; while (minutes > 0) { const m = Math.min(60, minutes); const r = tickEconomy(s, m); s = r.state; ev.push(...r.events); minutes -= m; } return { s, ev }; };
const [A, B] = siteDefs(R);

describe('region development rules', () => {
  it('only controlled regions (state >= 4) can be developed', () => {
    expect(repairSite(controlled(R, 3), R, A.id).ok).toBe(false);
    expect(repairSite(controlled(), R, A.id).ok).toBe(true);
  });
  it('control alone does not run anything: sites start damaged, no production', () => {
    const s = controlled();
    expect(Object.values(devOf(s, R).sites).every((x) => x.status === 'damaged')).toBe(true);
    expect(computeEconomy(s).regions.size).toBe(0);
  });
  it('repair costs resources and takes game time, then the site is active (event)', () => {
    let s = controlled(); const mat = s.resources.material;
    s = ok(repairSite(s, R, A.id));
    expect(s.resources.material).toBe(mat - A.repairCost.material!);
    expect(repairSite(s, R, A.id).ok).toBe(false); // no double repair
    const { s: done, ev } = run(s, A.repairHours * 60);
    expect(devOf(done, R).sites[A.id].status).toBe('active');
    expect(ev).toContainEqual({ type: 'regionSite:complete', regionId: R, siteId: A.id });
  });
  it('a repaired site needs workers to produce; labor is shared with base facilities', () => {
    let s = run(ok(repairSite(controlled(), R, A.id)), A.repairHours * 60).s;
    expect(computeEconomy(s).regions.get(R)!.sites[A.id]).toBe(0);
    s = ok(setSiteWorkers(s, R, A.id, A.workers, other(s)));
    const re = computeEconomy(s).regions.get(R)!;
    expect(re.sites[A.id]).toBeGreaterThan(0);
    for (const [k] of Object.entries(A.produce)) expect(re.produce[k as keyof typeof re.produce]).toBeGreaterThan(0);
    expect(regionLabor(s)).toBe(A.workers);
    expect(assignedWorkers(s, 'labor')).toBe(assignedWorkers({ ...s, regionDev: {} }, 'labor') + A.workers);
    // cannot exceed the labor population
    const crowded = { ...s, population: { ...s.population, labor: assignedWorkers(s, 'labor') } };
    expect(setCleanupWorkers(crowded, R, 5000, other(crowded)).ok).toBe(false);
  });
  it('territory costs upkeep: a controlled, developed region has budget consumption', () => {
    const s = ok(setCleanupWorkers(controlled(), R, 0, 0));
    const re = computeEconomy(s).regions.get(R)!;
    expect(re.consume.budget).toBeGreaterThan(0);
    expect(computeEconomy(s).perHour.budget).toBeLessThan(computeEconomy({ ...s, regionDev: {} }).perHour.budget);
  });
  it('erosion lowers efficiency and falls with cleanup crews', () => {
    let s = run(ok(repairSite(controlled(), R, A.id)), A.repairHours * 60).s;
    s = ok(setSiteWorkers(s, R, A.id, A.workers, other(s)));
    const effHigh = computeEconomy(s).regions.get(R)!.sites[A.id];
    s = ok(setCleanupWorkers(s, R, 10000, other(s)));
    const e0 = devOf(s, R).erosion;
    s = run(s, 1440 * 5).s;
    expect(devOf(s, R).erosion).toBeLessThan(e0);
    expect(computeEconomy(s).regions.get(R)!.sites[A.id]).toBeGreaterThan(effHigh);
  });
  it('state 5 when all sites operate and erosion is low; stopping a site does not lower the state', () => {
    let s = ok(repairSite(ok(repairSite(controlled(), R, A.id)), R, B.id));
    s = ok(setCleanupWorkers(s, R, 10000, other(s)));
    s = run(s, 1440).s;
    expect(s.regions[R].state).toBe(4);
    s = run(s, 1440 * 12).s;
    expect(isDeveloped(s, R)).toBe(true);
    expect(s.regions[R].state).toBe(5);
    s = ok(toggleSite(s, R, A.id));
    s = run(s, 60).s;
    expect(s.regions[R].state).toBe(5);
  });
  it('military region sites raise expedition outpost HP', () => {
    const M = 'rg_military'; const base = DATA.generation.outpostHp;
    let s = controlled(M); const site = siteDefs(M).find((x) => x.outpostBonus)!;
    s = run(ok(repairSite(s, M, site.id)), site.repairHours * 60).s;
    s = ok(setSiteWorkers(s, M, site.id, site.workers, other(s)));
    expect(outpostBonus(s)).toBeGreaterThan(0);
    expect(startExpedition(s, 1, ['aion'], 1).expedition!.outpost.maxHp).toBe(base + outpostBonus(s));
  });
  it('residential survivors add to the labor population over time (placeholder rule)', () => {
    const Rs = 'rg_residential'; let s = controlled(Rs); const site = siteDefs(Rs).find((x) => x.survivorsPerDay)!;
    s = run(ok(repairSite(s, Rs, site.id)), site.repairHours * 60).s;
    s = ok(setSiteWorkers(s, Rs, site.id, site.workers, other(s)));
    const before = s.population.labor;
    expect(run(s, 1440).s.population.labor).toBeGreaterThan(before);
  });
});

describe('save v6', () => {
  it('development state survives save/load; v5 saves migrate', () => {
    const store = new MemoryAdapter(); const sm = new SaveManager(store, 'test', 3);
    const s = ok(repairSite(controlled(), R, A.id));
    expect(sm.save(1, s, 'manual', 't').ok).toBe(true);
    const r = sm.load(1); expect(r.ok && r.state.regionDev).toEqual(s.regionDev);
    const data: Record<string, unknown> = JSON.parse(JSON.stringify(createNewGame())); data.schema = 5; delete data.regionDev;
    const meta = { slot: 2, kind: 'manual', reason: 't', savedAt: new Date().toISOString(), summary: { gameDate: '', gameTime: '', facilities: 8, roster: 6, inExpedition: false, difficulty: null } };
    store.set('test.save.2', JSON.stringify({ format: 'UHA_SAVE', saveVersion: 5, gameVersion: '0.1.0', meta, checksum: checksum(JSON.stringify({ meta, data })), data }));
    const m = sm.load(2); expect(m.ok && m.state.regionDev).toEqual({});
  });
  it('rejects development records for regions without control', () => {
    const sm = new SaveManager(new MemoryAdapter(), 'test', 3);
    const s = ok(repairSite(controlled(), R, A.id));
    expect(sm.save(1, { ...s, regions: { ...s.regions, [R]: { ...s.regions[R], state: 2 } } }, 'manual', 't').ok).toBe(false);
  });
});
