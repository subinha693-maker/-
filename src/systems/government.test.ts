import { describe, expect, it } from 'vitest';
import { createNewGame } from '../core/initialState';
import { computeEconomy, tickEconomy } from './economy';
import { assignedWorkers, availableWorkers, buildFacility, repairFacility, setWorkers, startResearch, toggleFacility, upgradeFacility } from './government';
import { getFacilityDef, getResearch } from '../data';
import type { GameState } from '../core/types';

const run = (s: GameState, minutes: number) => {
  const evs = [];
  while (minutes > 0) { const st = Math.min(60, minutes); const r = tickEconomy(s, st); s = r.state; evs.push(...r.events); minutes -= st; }
  return { s, evs };
};
const ok = (r: ReturnType<typeof setWorkers>) => { if (!r.ok) throw new Error(r.message); return r.state; };
const fac = (s: GameState, defId: string) => s.facilities.find((f) => f.defId === defId)!;

describe('economy', () => {
  it('fully staffed starting district produces and consumes per hour', () => {
    const s = createNewGame();
    const eco = computeEconomy(s);
    expect(eco.facilities.get(fac(s, 'fac_farm').uid)!.efficiency).toBe(1);
    expect(eco.gross.produce.food).toBe(90);
    expect(eco.perHour.food).toBeCloseTo(90 - 60 - 10, 5); // farm - population - barracks
    expect(eco.researchRate).toBeGreaterThan(0);
  });

  it('time passing changes resources by the hourly rates and advances the clock', () => {
    const s0 = createNewGame();
    const eco = computeEconomy(s0);
    const { s } = run(s0, 60);
    expect(s.clock.gameMinutes).toBe(60);
    expect(s.resources.budget).toBeCloseTo(s0.resources.budget + eco.perHour.budget, 3);
    expect(s.resources.food).toBeCloseTo(s0.resources.food + eco.perHour.food, 3);
  });

  it('understaffing scales output, stopping a facility halts it', () => {
    let s = createNewGame();
    const farm = fac(s, 'fac_farm');
    s = ok(setWorkers(s, farm.uid, getFacilityDef('fac_farm')!.levels[0].workers / 2));
    expect(computeEconomy(s).gross.produce.food).toBeCloseTo(45, 5);
    s = ok(toggleFacility(s, farm.uid));
    expect(computeEconomy(s).gross.produce.food).toBe(0);
    expect(computeEconomy(s).facilities.get(farm.uid)!.issues).toContain('stopped');
  });

  it('missing inputs limit a consumer facility (shortage)', () => {
    let s = createNewGame();
    s = { ...s, resources: { ...s.resources, material: 0 } };
    s = ok(toggleFacility(s, fac(s, 'fac_depot').uid)); // stop material production
    const rep = computeEconomy(s).facilities.get(fac(s, 'fac_plant').uid)!;
    expect(rep.input).toBe(0);
    expect(rep.issues).toContain('shortage');
  });

  it('resources never go negative', () => {
    let s = createNewGame();
    s = ok(toggleFacility(s, fac(s, 'fac_farm').uid));
    const { s: after } = run(s, 60 * 24 * 30);
    expect(after.resources.food).toBe(0);
    for (const v of Object.values(after.resources)) expect(v).toBeGreaterThanOrEqual(0);
  });

  it('condition decays daily while operating, lowering efficiency; repair restores it', () => {
    let s = run(createNewGame(), 60 * 24 * 10).s;
    const farm = fac(s, 'fac_farm');
    expect(farm.condition).toBeCloseTo(80, 3);
    expect(computeEconomy(s).facilities.get(farm.uid)!.efficiency).toBeCloseTo(0.9, 3);
    s = { ...s, resources: { ...s.resources, material: 9999, budget: 99999 } };
    s = ok(repairFacility(s, farm.uid));
    expect(fac(s, 'fac_farm').condition).toBe(100);
  });
});

describe('labor', () => {
  it('cannot assign more workers than the population of that type', () => {
    let s = createNewGame();
    const lab = fac(s, 'fac_lab');
    s = { ...s, population: { ...s.population, research: 5000 } };
    const r = setWorkers(s, lab.uid, 999999);
    expect(r.ok ? r.state.facilities.find((f) => f.uid === lab.uid)!.workers : -1).toBe(5000);
    expect(availableWorkers(r.ok ? r.state : s, 'research')).toBe(0);
    expect(assignedWorkers(s, 'labor')).toBeGreaterThan(0);
  });
});

describe('construction & research', () => {
  it('build -> constructing -> complete after build hours (event), cost paid', () => {
    let s = createNewGame();
    const before = s.resources.budget;
    s = ok(buildFacility(s, 'fac_farm'));
    const nf = s.facilities[s.facilities.length - 1];
    expect(nf.status).toBe('building');
    expect(s.resources.budget).toBe(before - getFacilityDef('fac_farm')!.levels[0].cost.budget!);
    const { s: done, evs } = run(s, getFacilityDef('fac_farm')!.levels[0].buildHours * 60);
    expect(done.facilities.find((f) => f.uid === nf.uid)!.status).toBe('active');
    expect(evs).toContainEqual({ type: 'facility:complete', uid: nf.uid, kind: 'build' });
  });

  it('upgrade raises level after its duration; refused when unaffordable', () => {
    let s = createNewGame();
    const farm = fac(s, 'fac_farm');
    s = { ...s, resources: { ...s.resources, material: 9999, parts: 9999, budget: 99999 } };
    s = ok(upgradeFacility(s, farm.uid));
    expect(computeEconomy(s).facilities.get(farm.uid)!.efficiency).toBe(0); // under construction
    s = run(s, getFacilityDef('fac_farm')!.levels[1].buildHours * 60).s;
    expect(fac(s, 'fac_farm').level).toBe(2);
    const poor = { ...createNewGame(), resources: { ...s.resources, material: 0 } };
    expect(upgradeFacility(poor, fac(poor, 'fac_farm').uid).ok).toBe(false);
  });

  it('locked facility needs research; research completes over time and unlocks it', () => {
    let s = createNewGame();
    expect(buildFacility(s, 'fac_workshop').ok).toBe(false);
    expect(startResearch(s, 'r_ind_2').ok).toBe(false); // prereq missing
    s = { ...s, resources: { ...s.resources, data: 100 } };
    s = ok(startResearch(s, 'r_ind_1'));
    const rate = computeEconomy(s).researchRate;
    const { s: done, evs } = run(s, Math.ceil((getResearch('r_ind_1')!.hours / rate) * 60) + 60);
    expect(evs).toContainEqual({ type: 'research:complete', id: 'r_ind_1' });
    expect(done.research.completed).toContain('r_ind_1');
    expect(done.unlocks).toContain('facility:fac_workshop');
    const rich = { ...done, resources: { ...done.resources, material: 9999, parts: 9999, budget: 99999 } };
    expect(buildFacility(rich, 'fac_workshop').ok).toBe(true);
  });

  it('research stalls without staffed research facilities', () => {
    let s = createNewGame();
    s = { ...s, resources: { ...s.resources, data: 100 } };
    s = ok(startResearch(s, 'r_bio_1'));
    s = ok(setWorkers(s, fac(s, 'fac_lab').uid, 0));
    expect(run(s, 60 * 24 * 5).s.research.progress).toBe(0);
  });
});
