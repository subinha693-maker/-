import { CONFIG } from '../core/config';
import type { GameState } from '../core/types';
import { formatGameTime } from '../core/time';
import { checksum } from './checksum';
import { CURRENT_SAVE_VERSION, migrate } from './migrations';
import { StorageError, type StorageAdapter } from './storage';
import { SAVE_FORMAT, type LoadResult, type SaveFile, type SaveKind, type SaveMeta, type SlotId, type SlotInfo } from './types';
import { validateGameState } from './validate';

const sealed = (meta: SaveMeta, data: GameState) => checksum(JSON.stringify({ meta, data }));

type Parsed =
  | { ok: true; file: SaveFile; data: GameState; migratedFrom?: number }
  | { ok: false; status: 'corrupt' | 'incompatible' | 'newer'; message: string; meta?: SaveMeta; saveVersion?: number };

/**
 * Slot-based save storage with crash-safe writes:
 *   1) write  <slot>.tmp   2) read back + verify   3) copy current to <slot>.bak   4) write <slot>   5) drop .tmp
 * If the app dies at any point, the previous save (main or .bak) stays intact.
 */
export class SaveManager {
  private store: StorageAdapter; private prefix: string; private slotCount: number; private gameVersion: string;
  constructor(store: StorageAdapter, prefix = CONFIG.save.storagePrefix, slotCount = CONFIG.save.slotCount, gameVersion = CONFIG.version) {
    this.store = store; this.prefix = prefix; this.slotCount = slotCount; this.gameVersion = gameVersion;
  }

  slots(): SlotId[] { return ['auto', ...Array.from({ length: this.slotCount }, (_, i) => i + 1)]; }
  private key(slot: SlotId, suffix = '') { return `${this.prefix}.save.${slot}${suffix}`; }

  /** Parses and fully checks one raw save string. */
  parse(raw: string): Parsed {
    let file: SaveFile;
    try { file = JSON.parse(raw); } catch { return { ok: false, status: 'corrupt', message: '저장 파일을 읽을 수 없습니다 (형식 손상).' }; }
    if (!file || file.format !== SAVE_FORMAT || typeof file.saveVersion !== 'number' || !file.meta || !file.data) {
      return { ok: false, status: 'corrupt', message: '이 게임의 저장 데이터가 아니거나 필수 정보가 없습니다.' };
    }
    const base = { meta: file.meta, saveVersion: file.saveVersion };
    if (file.checksum !== sealed(file.meta, file.data)) return { ok: false, status: 'corrupt', message: '저장 데이터가 손상되었습니다 (검증값 불일치).', ...base };
    if (file.saveVersion > CURRENT_SAVE_VERSION) {
      return { ok: false, status: 'newer', message: `더 새로운 버전의 게임에서 만든 저장 데이터입니다 (데이터 v${file.saveVersion}, 현재 지원 v${CURRENT_SAVE_VERSION}). 게임을 업데이트해 주세요.`, ...base };
    }
    let data = file.data as unknown as Record<string, unknown>;
    let migratedFrom: number | undefined;
    if (file.saveVersion < CURRENT_SAVE_VERSION) {
      const m = migrate(data, file.saveVersion);
      if ('error' in m) return { ok: false, status: 'incompatible', message: m.error, ...base };
      data = m.data; migratedFrom = file.saveVersion;
    }
    const problems = validateGameState(data);
    if (problems.length) return { ok: false, status: 'corrupt', message: `저장 데이터에 잘못된 값이 있습니다: ${problems.slice(0, 3).join(' / ')}${problems.length > 3 ? ` 외 ${problems.length - 3}건` : ''}`, ...base };
    return { ok: true, file, data: data as unknown as GameState, migratedFrom };
  }

  info(slot: SlotId): SlotInfo {
    const raw = this.store.get(this.key(slot));
    const hasBackup = this.backupUsable(slot);
    if (raw === null) return { slot, status: 'empty', hasBackup };
    const p = this.parse(raw);
    if (p.ok) return { slot, status: 'ok', meta: p.file.meta, saveVersion: p.file.saveVersion, hasBackup };
    return { slot, status: p.status, meta: p.meta, saveVersion: p.saveVersion, problem: p.message, hasBackup };
  }
  list(): SlotInfo[] { return this.slots().map((s) => this.info(s)); }

  /** Most recently written valid save (for "이어하기"). */
  latest(): SlotInfo | null {
    const ok = this.list().filter((s) => s.status === 'ok');
    ok.sort((a, b) => (b.meta!.savedAt > a.meta!.savedAt ? 1 : -1));
    return ok[0] ?? null;
  }
  hasAnySave() { return this.list().some((s) => s.status !== 'empty'); }

  save(slot: SlotId, state: GameState, kind: SaveKind, reason: string): { ok: true; meta: SaveMeta } | { ok: false; message: string } {
    const problems = validateGameState(state);
    if (problems.length) return { ok: false, message: `현재 게임 상태에 문제가 있어 저장하지 않았습니다: ${problems[0]}` };
    const t = formatGameTime(state.clock.gameMinutes);
    const meta: SaveMeta = {
      slot, kind, reason, savedAt: new Date().toISOString(),
      summary: {
        gameDate: t.date, gameTime: t.time, facilities: state.facilities.length, roster: state.roster.length,
        inExpedition: !!state.expedition, difficulty: state.expedition?.difficulty ?? null,
      },
    };
    const data = JSON.parse(JSON.stringify(state)) as GameState; // detach from live state
    const file: SaveFile = { format: SAVE_FORMAT, saveVersion: CURRENT_SAVE_VERSION, gameVersion: this.gameVersion, meta, checksum: sealed(meta, data), data };
    const json = JSON.stringify(file);
    const main = this.key(slot), tmp = this.key(slot, '.tmp'), bak = this.key(slot, '.bak');
    try {
      this.store.set(tmp, json);
      const back = this.store.get(tmp);
      if (back !== json || !this.parse(back).ok) { this.store.remove(tmp); return { ok: false, message: '저장 검증에 실패했습니다. 기존 저장 데이터는 그대로 유지됩니다.' }; }
      const prev = this.store.get(main);
      if (prev !== null && this.parse(prev).ok) this.store.set(bak, prev);
      this.store.set(main, json);
      this.store.remove(tmp);
      return { ok: true, meta };
    } catch (e) {
      const msg = e instanceof StorageError ? e.message : '알 수 없는 오류';
      return { ok: false, message: `저장하지 못했습니다: ${msg} 기존 저장 데이터는 그대로 유지됩니다.` };
    }
  }

  load(slot: SlotId): LoadResult {
    const raw = this.store.get(this.key(slot));
    const canRestoreBackup = this.backupUsable(slot);
    if (raw === null) return { ok: false, status: 'empty', message: '이 슬롯에는 저장 데이터가 없습니다.', canRestoreBackup };
    const p = this.parse(raw);
    if (!p.ok) return { ok: false, status: p.status, message: p.message, canRestoreBackup };
    return { ok: true, state: p.data, meta: p.file.meta, migratedFrom: p.migratedFrom };
  }

  private backupUsable(slot: SlotId) {
    const raw = this.store.get(this.key(slot, '.bak'));
    return raw !== null && this.parse(raw).ok;
  }
  /** Replaces a damaged slot with its last good backup. */
  restoreBackup(slot: SlotId): LoadResult {
    const raw = this.store.get(this.key(slot, '.bak'));
    if (raw === null || !this.parse(raw).ok) return { ok: false, status: 'corrupt', message: '사용할 수 있는 백업이 없습니다.', canRestoreBackup: false };
    this.store.set(this.key(slot), raw);
    const r = this.load(slot);
    return r.ok ? { ...r, restoredFromBackup: true } : r;
  }

  delete(slot: SlotId) {
    for (const s of ['', '.bak', '.tmp']) this.store.remove(this.key(slot, s));
  }

  /** Run at startup: finishes or discards writes interrupted by a crash. Returns slots that were repaired. */
  recoverInterrupted(): SlotId[] {
    const repaired: SlotId[] = [];
    for (const slot of this.slots()) {
      const tmpRaw = this.store.get(this.key(slot, '.tmp'));
      if (tmpRaw === null) continue;
      const mainRaw = this.store.get(this.key(slot));
      const mainOk = mainRaw !== null && this.parse(mainRaw).ok;
      if (!mainOk && this.parse(tmpRaw).ok) { this.store.set(this.key(slot), tmpRaw); repaired.push(slot); }
      this.store.remove(this.key(slot, '.tmp'));
    }
    return repaired;
  }
}
