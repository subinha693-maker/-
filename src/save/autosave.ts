import { events, type GameEvents } from '../core/events';
import type { GameState } from '../core/types';
import type { SaveManager } from './SaveManager';

export interface AutosaveConfig {
  enabled: boolean; intervalGameMinutes: number;
  onFacilityComplete: boolean; onResearchComplete: boolean; onExpeditionStart: boolean; onExpeditionEnd: boolean;
  onStoryEvent: boolean; onBattleEnter: boolean; onTutorialStep: boolean;
}

// Which config switch enables autosave for each event.
const TRIGGERS: Partial<Record<keyof GameEvents, keyof AutosaveConfig>> = {
  'facility:complete': 'onFacilityComplete',
  'research:complete': 'onResearchComplete',
  'expedition:start': 'onExpeditionStart',
  'expedition:end': 'onExpeditionEnd',
  'story:complete': 'onStoryEvent',
  'battle:enter': 'onBattleEnter',
  'tutorial:step': 'onTutorialStep',
};

/**
 * Autosave to the dedicated 'auto' slot. Requests arriving while a save is queued are merged
 * into that one save, and requests arriving while a save is running are run once afterwards,
 * so bursts of events never produce duplicate writes.
 */
export class AutosaveService {
  private queued: string[] | null = null;
  private running = false;
  private rerun: string[] | null = null;
  private lastIntervalAt = 0;
  private unsub: (() => void)[] = [];
  writes = 0;

  private manager: SaveManager;
  private getState: () => GameState | null;
  private canSave: () => boolean;
  private cfg: AutosaveConfig;
  private onResult: (r: { ok: boolean; message?: string; reasons: string[] }) => void;
  constructor(manager: SaveManager, getState: () => GameState | null, canSave: () => boolean, cfg: AutosaveConfig, onResult: (r: { ok: boolean; message?: string; reasons: string[] }) => void) {
    this.manager = manager; this.getState = getState; this.canSave = canSave; this.cfg = cfg; this.onResult = onResult;
  }

  attach() {
    for (const [ev, key] of Object.entries(TRIGGERS) as [keyof GameEvents, keyof AutosaveConfig][]) {
      this.unsub.push(events.on(ev, () => { if (this.cfg[key]) this.request(ev); }));
    }
    this.unsub.push(events.on('clock:advance', ({ gameMinutes }) => {
      if (gameMinutes - this.lastIntervalAt >= this.cfg.intervalGameMinutes) { this.lastIntervalAt = gameMinutes; this.request('interval'); }
    }));
    return this;
  }
  detach() { this.unsub.forEach((u) => u()); this.unsub = []; }
  resetInterval(gameMinutes: number) { this.lastIntervalAt = gameMinutes; }

  request(reason: string) {
    if (!this.cfg.enabled) return;
    if (this.running) { (this.rerun ??= []).push(reason); return; }
    if (this.queued) { this.queued.push(reason); return; }
    this.queued = [reason];
    queueMicrotask(() => this.flush());
  }

  /** Waits until no autosave is pending (used by tests and before quitting). */
  async idle() { while (this.queued || this.running || this.rerun) await new Promise((r) => setTimeout(r, 0)); }

  private flush() {
    const reasons = this.queued ?? [];
    this.queued = null;
    const state = this.getState();
    if (!state || !this.canSave()) return;
    this.running = true;
    try {
      const r = this.manager.save('auto', state, 'auto', reasons.join(','));
      this.writes++;
      this.onResult({ ok: r.ok, message: r.ok ? undefined : r.message, reasons });
    } finally {
      this.running = false;
      if (this.rerun) { const again = this.rerun; this.rerun = null; this.queued = again; queueMicrotask(() => this.flush()); }
    }
  }
}
