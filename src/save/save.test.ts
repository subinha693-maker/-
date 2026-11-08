import { describe, expect, it, beforeEach } from 'vitest';
import { SaveManager } from './SaveManager';
import { MemoryAdapter } from './storage';
import { AutosaveService, type AutosaveConfig } from './autosave';
import { migrations, CURRENT_SAVE_VERSION } from './migrations';
import { readProfile } from './profile';
import { createNewGame } from '../core/initialState';
import { startExpedition } from '../systems/expedition';
import { events } from '../core/events';
import type { GameState } from '../core/types';
import { checksum } from './checksum';

const KEY = (slot: string | number, s = '') => `test.save.${slot}${s}`;

/** A state that differs from a fresh game in every saved area. */
function progressedState(): GameState {
  let s = createNewGame();
  s = startExpedition(s, 1, ['aion', 'ring', 'jerag']);
  s = {
    ...s,
    clock: { ...s.clock, gameMinutes: 12345 },
    resources: { ...s.resources, food: 4321, biosample: 17 },
    population: { ...s.population, labor: 599000, research: 51000 },
    facilities: s.facilities.map((f, i) => (i === 0 ? { ...f, workers: 12, condition: 73, status: 'idle' } : f)),
    research: { active: 'r_bio_2', progress: 0.4, completed: ['r_bio_1'] },
    unlocks: ['tech_a'],
    roster: s.roster.map((c) => (c.charId === 'aion' ? { ...c, level: 3, phase: 2 as const, merit: 3, skillLevel: 2, traits: ['unique'], growth: { atk: 2 }, equipment: ['eq1'] } : c)),
    expedition: { ...s.expedition!, currentNode: s.expedition!.map.columns[1][0].id, path: ['c0r0', s.expedition!.map.columns[1][0].id], relics: ['rl_hp_1'], reinforcements: ['shion_shirayuko'], hp: { aion: 0.5, ring: 1, jerag: 1, shion_shirayuko: 1 }, loot: { food: 40 }, outpost: { hp: 62, maxHp: 100 } },
    tutorial: { active: true, step: 4, completedHints: ['res'], skipped: false },
    progress: { unlockedDifficulties: [1, 2], highestCleared: 1, recruit: { reviews: 4 }, codex: { enemy_a: true }, stats: { battles: 3 } },
    inventory: { certificate: 2 },
  };
  return s;
}

describe('SaveManager', () => {
  let store: MemoryAdapter; let sm: SaveManager;
  beforeEach(() => { store = new MemoryAdapter(); sm = new SaveManager(store, 'test', 3, '0.1.0'); });

  it('lists auto + configured slots, all empty initially', () => {
    expect(sm.list().map((s) => [s.slot, s.status])).toEqual([['auto', 'empty'], [1, 'empty'], [2, 'empty'], [3, 'empty']]);
  });

  it('restores the exact saved state (all areas)', () => {
    const s = progressedState();
    expect(sm.save(1, s, 'manual', 'test').ok).toBe(true);
    const r = sm.load(1);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state).toEqual(s);
    expect(sm.info(1).meta?.summary).toMatchObject({ inExpedition: true, difficulty: 1, roster: 6 });
  });

  it('keeps the save detached from later changes to the live state', () => {
    const s = progressedState();
    sm.save(1, s, 'manual', 't');
    s.resources.food = 0;
    const r = sm.load(1);
    expect(r.ok && r.state.resources.food).toBe(4321);
  });

  it('detects tampered/damaged data via checksum', () => {
    sm.save(1, progressedState(), 'manual', 't');
    store.set(KEY(1), store.get(KEY(1))!.replace('"food":4321', '"food":999999'));
    const r = sm.load(1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe('corrupt');
  });

  it('detects unreadable JSON', () => {
    store.set(KEY(2), '{"format":"UHA_SAVE", broken');
    expect(sm.info(2).status).toBe('corrupt');
  });

  it('overwrite keeps a backup that can restore a damaged slot', () => {
    const a = progressedState(); const b = { ...progressedState(), resources: { ...a.resources, food: 1 } };
    sm.save(1, a, 'manual', 't'); sm.save(1, b, 'manual', 't');
    store.set(KEY(1), 'garbage');
    const r = sm.load(1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.canRestoreBackup).toBe(true);
    const restored = sm.restoreBackup(1);
    expect(restored.ok && restored.state.resources.food).toBe(4321);
  });

  it('a crash during the main write leaves the previous save intact', () => {
    const a = progressedState();
    sm.save(1, a, 'manual', 't');
    store.failNextSetFor = 'save.1'; // the final write to the main key fails
    const r = sm.save(1, { ...a, resources: { ...a.resources, food: 5 } }, 'manual', 't');
    expect(r.ok).toBe(false);
    const l = sm.load(1);
    expect(l.ok && l.state.resources.food).toBe(4321);
  });

  it('recovers an interrupted first save from the temp file, and drops stale temp files', () => {
    const a = progressedState();
    sm.save(2, a, 'manual', 't');
    store.set(KEY(2, '.tmp'), store.get(KEY(2))!); store.remove(KEY(2)); // crash after tmp, before main
    store.set(KEY(3, '.tmp'), 'half-written');
    expect(sm.recoverInterrupted()).toEqual([2]);
    expect(sm.load(2).ok).toBe(true);
    expect(store.get(KEY(3, '.tmp'))).toBeNull();
    expect(sm.info(3).status).toBe('empty');
  });

  it('refuses saves from a newer game version', () => {
    sm.save(1, progressedState(), 'manual', 't');
    const f = JSON.parse(store.get(KEY(1))!); f.saveVersion = CURRENT_SAVE_VERSION + 1;
    store.set(KEY(1), JSON.stringify(f));
    expect(sm.info(1).status).toBe('newer');
  });

  it('migrates older saves when a migration exists, refuses when none exists', () => {
    sm.save(1, progressedState(), 'manual', 't');
    const f = JSON.parse(store.get(KEY(1))!); f.saveVersion = 0; store.set(KEY(1), JSON.stringify(f));
    expect(sm.info(1).status).toBe('incompatible');
    migrations[0] = (d) => d;
    try {
      const r = sm.load(1);
      expect(r.ok && r.migratedFrom).toBe(0);
    } finally { delete migrations[0]; }
  });

  it('upgrades a real v1 save (PHASE 2-4 format) through v2 to v3', () => {
    const v2 = progressedState();
    // Build what PHASE 4 wrote: schema 1, old ids, agents without growth fields, no inventory/recruit.
    const data: Record<string, unknown> = JSON.parse(JSON.stringify(v2));
    data.schema = 1;
    data.roster = v2.roster.map((c) => ({ charId: c.charId === 'ring' ? 'ling' : c.charId === 'jerag' ? 'zerag' : c.charId, level: c.level, growth: c.growth, equipment: c.equipment }));
    data.expedition = { difficulty: 1, members: ['aion', 'ling', 'zerag'], reinforcements: [], map: { kind: 'sample', columns: 6 }, currentNode: null, path: [], relics: [], buffs: [], outpost: { hp: 100, maxHp: 100 } };
    delete data.inventory;
    data.progress = { unlockedDifficulties: [1], codex: {}, stats: {} };
    const meta = { slot: 1, kind: 'manual', reason: 't', savedAt: new Date().toISOString(), summary: { gameDate: '', gameTime: '', facilities: 9, roster: 6, inExpedition: true, difficulty: 1 } };
    store.set(KEY(1), JSON.stringify({ format: 'UHA_SAVE', saveVersion: 1, gameVersion: '0.1.0', meta, checksum: checksum(JSON.stringify({ meta, data })), data }));
    const r = sm.load(1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.migratedFrom).toBe(1);
    expect(r.state.roster.map((c) => c.charId)).toContain('ring');
    expect(r.state.roster.map((c) => c.charId)).toContain('jerag');
    expect(r.state.expedition!.members).toEqual(['aion', 'ring', 'jerag']);
    expect(r.state.roster.find((c) => c.charId === 'aion')).toMatchObject({ level: 3, exp: 0, phase: 1, merit: 0, skillLevel: 1 });
    expect(r.state.expedition!.map.columns.length).toBeGreaterThan(1);
    expect(r.state.expedition!.hp).toEqual({ aion: 1, ring: 1, jerag: 1 });
    expect(r.state.inventory).toEqual({});
    expect(r.state.progress.highestCleared).toBe(0);
  });

  it('upgrades a v2 save (PHASE 5 format): capBonus removed, exp added', () => {
    const data: Record<string, unknown> = JSON.parse(JSON.stringify({ ...progressedState(), expedition: null }));
    data.schema = 2;
    data.roster = (data.roster as Record<string, unknown>[]).map(({ exp: _e, ...c }) => ({ ...c, capBonus: 4 }));
    const meta = { slot: 2, kind: 'manual', reason: 't', savedAt: new Date().toISOString(), summary: { gameDate: '', gameTime: '', facilities: 9, roster: 6, inExpedition: false, difficulty: null } };
    store.set(KEY(2), JSON.stringify({ format: 'UHA_SAVE', saveVersion: 2, gameVersion: '0.1.0', meta, checksum: checksum(JSON.stringify({ meta, data })), data }));
    const r = sm.load(2);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.migratedFrom).toBe(2); expect(r.state.roster[0]).not.toHaveProperty('capBonus'); expect(r.state.roster[0].exp).toBe(0); }
  });

  it('rejects structurally invalid states (unknown character, duplicated relic)', () => {
    const s = progressedState();
    const bad = { ...s, roster: [...s.roster, { ...s.roster[0], charId: 'nobody' }] };
    expect(sm.save(1, bad, 'manual', 't').ok).toBe(false);
    const dup = { ...s, expedition: { ...s.expedition!, relics: ['rl_hp_1', 'rl_hp_1'] } };
    expect(sm.save(1, dup, 'manual', 't').ok).toBe(false);
  });

  it('refuses a well-formed, correctly sealed file whose content is invalid', () => {
    sm.save(1, progressedState(), 'manual', 't');
    const f = JSON.parse(store.get(KEY(1))!);
    f.data.roster.push({ charId: 'ghost', level: 1, growth: {}, equipment: [] });
    f.checksum = checksum(JSON.stringify({ meta: f.meta, data: f.data }));
    store.set(KEY(1), JSON.stringify(f));
    const r = sm.load(1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('ghost');
  });

  it('latest() returns the most recent valid save; delete removes slot and backups', async () => {
    sm.save(1, progressedState(), 'manual', 't');
    await new Promise((r) => setTimeout(r, 5));
    sm.save(3, progressedState(), 'manual', 't');
    expect(sm.latest()?.slot).toBe(3);
    sm.delete(3);
    expect(sm.info(3).status).toBe('empty');
    expect(sm.latest()?.slot).toBe(1);
  });

  it('profile (first-run, settings) is stored outside slots', () => {
    store.set('uha.profile', JSON.stringify({ version: 1, firstRun: false, settings: { sound: { bgm: 10 } } }));
    sm.save(1, progressedState(), 'manual', 't'); sm.delete(1);
    const p = readProfile(store);
    expect(p.firstRun).toBe(false);
    expect(p.settings.sound).toEqual({ master: 80, bgm: 10, sfx: 80 });
  });
});

describe('AutosaveService', () => {
  const cfg: AutosaveConfig = { enabled: true, intervalGameMinutes: 1440, onFacilityComplete: true, onResearchComplete: true, onExpeditionStart: true, onExpeditionEnd: true, onStoryEvent: true, onBattleEnter: true, onTutorialStep: true };

  it('merges a burst of requests into one write and skips while saving is not allowed', async () => {
    const store = new MemoryAdapter(); const sm = new SaveManager(store, 'test', 3);
    let allowed = true; const state = progressedState();
    const a = new AutosaveService(sm, () => state, () => allowed, cfg, () => {}).attach();
    events.emit('expedition:start', { difficulty: 1 });
    events.emit('research:complete', { id: 'x' });
    a.request('manual-burst');
    await a.idle();
    expect(a.writes).toBe(1);
    expect(sm.info('auto').meta?.reason).toBe('expedition:start,research:complete,manual-burst');
    allowed = false;
    events.emit('expedition:end', { outcome: 'return' });
    await a.idle();
    expect(a.writes).toBe(1);
    a.detach();
  });

  it('fires the interval autosave from game-time advances', async () => {
    const sm = new SaveManager(new MemoryAdapter(), 'test', 3);
    const a = new AutosaveService(sm, () => progressedState(), () => true, cfg, () => {}).attach();
    events.emit('clock:advance', { gameMinutes: 600 }); await a.idle(); expect(a.writes).toBe(0);
    events.emit('clock:advance', { gameMinutes: 1500 }); await a.idle(); expect(a.writes).toBe(1);
    events.emit('clock:advance', { gameMinutes: 2000 }); await a.idle(); expect(a.writes).toBe(1);
    a.detach();
  });

  it('respects disabled triggers in config', async () => {
    const sm = new SaveManager(new MemoryAdapter(), 'test', 3);
    const a = new AutosaveService(sm, () => progressedState(), () => true, { ...cfg, onBattleEnter: false }, () => {}).attach();
    events.emit('battle:enter', { node: 'n0' }); await a.idle();
    expect(a.writes).toBe(0);
    a.detach();
  });
});
