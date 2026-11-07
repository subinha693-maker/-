// Glue between the game store, the router and the save system (UI-independent).
import { CONFIG } from './config';
import { events } from './events';
import { useGame } from './gameStore';
import { useRouter } from './router';
import { SaveManager } from '../save/SaveManager';
import { AutosaveService } from '../save/autosave';
import { LocalStorageAdapter, type StorageAdapter } from '../save/storage';
import { useProfile } from '../save/profile';
import type { SlotId } from '../save/types';
import { useToast } from '../ui/components/Toast';
import { endExpedition, startExpedition } from '../systems/expedition';
import { offerTutorial, resumeTutorial } from '../tutorial/controller';

let storage: StorageAdapter;
export let saves: SaveManager;
export let autosave: AutosaveService;

export function initSession(adapter: StorageAdapter = new LocalStorageAdapter()) {
  storage = adapter;
  saves = new SaveManager(storage);
  useProfile.getState().init(storage);
  const repaired = saves.recoverInterrupted();
  autosave?.detach();
  autosave = new AutosaveService(
    saves,
    () => useGame.getState().state,
    () => !useGame.getState().inBattle,
    CONFIG.save.autosave,
    (r) => {
      if (r.ok) {
        useGame.getState().markSaved(new Date().toISOString());
        // tutorial step saves are frequent; keep them silent so toasts never cover the highlighted UI
        if (!r.reasons.every((x) => x === 'tutorial:step')) useToast.getState().push('자동 저장 완료');
      }
      else useToast.getState().push(r.message ?? '자동 저장 실패', 'danger');
    },
  ).attach();
  return { repaired };
}

/** First run = never started a game on this device (profile) and no save data exists. */
export function isFirstRun() {
  return useProfile.getState().profile.firstRun && !saves.hasAnySave();
}

export function newGameSession() {
  const first = isFirstRun();
  useGame.getState().newGame();
  useProfile.getState().update((p) => ({ ...p, firstRun: false }));
  autosave.resetInterval(0);
  useRouter.getState().reset('main');
  if (first) offerTutorial();
}

/** Screen to resume on after loading: an active expedition resumes on its map (never mid-battle). */
function resumeScreen() {
  return useGame.getState().state?.expedition ? 'expeditionMap' : 'main';
}

export function loadSlot(slot: SlotId, useBackup = false) {
  const r = useBackup ? saves.restoreBackup(slot) : saves.load(slot);
  if (!r.ok) return r;
  useGame.getState().loadState(r.state);
  useGame.getState().markSaved(r.meta.savedAt);
  autosave.resetInterval(r.state.clock.gameMinutes);
  useProfile.getState().update((p) => ({ ...p, lastSlot: slot, firstRun: false }));
  useRouter.getState().reset(resumeScreen());
  if (r.state.tutorial.active) resumeTutorial();
  return r;
}

export function saveSlot(slot: SlotId) {
  const g = useGame.getState();
  if (!g.state) return { ok: false as const, message: '진행 중인 게임이 없습니다.' };
  if (g.inBattle) return { ok: false as const, message: '전투 중에는 저장할 수 없습니다.' };
  const r = saves.save(slot, g.state, slot === 'auto' ? 'auto' : 'manual', 'manual');
  if (r.ok) { g.markSaved(r.meta.savedAt); useProfile.getState().update((p) => ({ ...p, lastSlot: slot })); }
  return r;
}

export function continueLatest() {
  const latest = saves.latest();
  return latest ? loadSlot(latest.slot) : null;
}

// ---- Expedition lifecycle (state + autosave triggers) ----
export function launchExpedition(difficulty: number, members: string[]) {
  useGame.getState().mutate((s) => startExpedition(s, difficulty, members));
  events.emit('expedition:start', { difficulty });
  useRouter.getState().reset('expeditionMap');
}
export function finishExpedition(outcome: string) {
  useGame.getState().mutate((s) => endExpedition(s));
  events.emit('expedition:end', { outcome });
  useRouter.getState().reset('main');
}
/** Autosaves the pre-battle state first, so loading always resumes right before the battle. */
export async function enterBattle(node: string) {
  events.emit('battle:enter', { node });
  await autosave.idle();
  useGame.getState().setInBattle(true);
  useRouter.getState().go('battle', { node });
}
export function leaveBattle() { useGame.getState().setInBattle(false); }
