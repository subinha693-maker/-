// Save data versioning. When the saved structure changes, bump CURRENT_SAVE_VERSION and add a
// migration from the previous version. Old saves are upgraded step by step on load.
export const CURRENT_SAVE_VERSION = 1;

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;
/** migrations[n] upgrades data from version n to n + 1. */
export const migrations: Record<number, Migration> = {};

export function migrate(data: Record<string, unknown>, from: number): { data: Record<string, unknown> } | { error: string } {
  let d = data;
  for (let v = from; v < CURRENT_SAVE_VERSION; v++) {
    const m = migrations[v];
    if (!m) return { error: `저장 데이터 버전 ${from}은(는) 현재 버전(${CURRENT_SAVE_VERSION})과 호환되지 않습니다.` };
    d = m(d);
  }
  return { data: d };
}
