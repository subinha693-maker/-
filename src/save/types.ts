import type { GameState } from '../core/types';

export const SAVE_FORMAT = 'UHA_SAVE';
export type SlotId = 'auto' | number;
export type SaveKind = 'manual' | 'auto';

export interface SaveSummary {
  gameDate: string; gameTime: string;
  facilities: number; roster: number;
  inExpedition: boolean; difficulty: number | null;
}
export interface SaveMeta {
  slot: SlotId; kind: SaveKind; reason: string;
  savedAt: string;            // real-world ISO time
  summary: SaveSummary;
}
export interface SaveFile {
  format: typeof SAVE_FORMAT;
  saveVersion: number;
  gameVersion: string;
  meta: SaveMeta;
  checksum: string;
  data: GameState;
}

export type SlotStatus = 'empty' | 'ok' | 'corrupt' | 'incompatible' | 'newer';
export interface SlotInfo {
  slot: SlotId;
  status: SlotStatus;
  meta?: SaveMeta;
  saveVersion?: number;
  problem?: string;
  hasBackup: boolean;
}

export type LoadResult =
  | { ok: true; state: GameState; meta: SaveMeta; migratedFrom?: number; restoredFromBackup?: boolean }
  | { ok: false; status: Exclude<SlotStatus, 'ok'>; message: string; canRestoreBackup: boolean };
