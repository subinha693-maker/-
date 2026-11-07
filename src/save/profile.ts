import { create } from 'zustand';
import { CONFIG } from '../core/config';
import type { StorageAdapter } from './storage';

/**
 * Data kept OUTSIDE save slots: first-run flag, settings, sound. Survives deleting saves.
 * (Spec 10.1: first-run detection is managed separately from save data.)
 */
export interface Profile {
  version: 1;
  firstRun: boolean;                 // true until the player starts a game for the first time
  lastSlot: number | 'auto' | null;
  settings: { sound: { master: number; bgm: number; sfx: number } };
}
export const DEFAULT_PROFILE: Profile = { version: 1, firstRun: true, lastSlot: null, settings: { sound: { master: 80, bgm: 70, sfx: 80 } } };

const KEY = `${CONFIG.save.storagePrefix}.profile`;

export function readProfile(store: StorageAdapter): Profile {
  try {
    const raw = store.get(KEY);
    if (!raw) return structuredClone(DEFAULT_PROFILE);
    const p = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_PROFILE), ...p, settings: { ...DEFAULT_PROFILE.settings, ...p.settings, sound: { ...DEFAULT_PROFILE.settings.sound, ...p.settings?.sound } } };
  } catch { return structuredClone(DEFAULT_PROFILE); }
}

interface ProfileStore {
  profile: Profile;
  init: (store: StorageAdapter) => void;
  update: (fn: (p: Profile) => Profile) => void;
}
let backing: StorageAdapter | null = null;
export const useProfile = create<ProfileStore>((set, get) => ({
  profile: structuredClone(DEFAULT_PROFILE),
  init: (store) => { backing = store; set({ profile: readProfile(store) }); },
  update: (fn) => {
    const next = fn(get().profile);
    set({ profile: next });
    try { backing?.set(KEY, JSON.stringify(next)); } catch { /* settings stay in memory for this session */ }
  },
}));
