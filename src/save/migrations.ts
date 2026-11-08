// Save data versioning. When the saved structure changes, bump CURRENT_SAVE_VERSION and add a
// migration from the previous version. Old saves are upgraded step by step on load.
export const CURRENT_SAVE_VERSION = 2;

type Data = Record<string, unknown>;
type Migration = (data: Data) => Data;

// v1 -> v2 (PHASE 5): character ids renamed to match confirmed English names,
// agent growth fields, inventory, recruit counters.
const RENAMED: Record<string, string> = { ling: 'ring', zerag: 'jerag' };
const rename = (id: unknown) => (typeof id === 'string' && RENAMED[id]) || id;

/** migrations[n] upgrades data from version n to n + 1. */
export const migrations: Record<number, Migration> = {
  1: (d) => {
    const roster = (d.roster as Data[] | undefined ?? []).map((c) => ({
      phase: 1, capBonus: 0, skillLevel: 1, traits: [], merit: 0, growth: {}, equipment: [],
      ...c, charId: rename(c.charId),
    }));
    const ex = d.expedition as Data | null;
    const expedition = ex ? { ...ex, members: (ex.members as unknown[]).map(rename), reinforcements: ((ex.reinforcements as unknown[]) ?? []).map(rename) } : null;
    const progress = { highestCleared: 0, recruit: { reviews: 0 }, ...(d.progress as Data) };
    return { ...d, schema: 2, roster, expedition, inventory: (d.inventory as Data) ?? {}, progress };
  },
};

export function migrate(data: Data, from: number): { data: Data } | { error: string } {
  let d = data;
  for (let v = from; v < CURRENT_SAVE_VERSION; v++) {
    const m = migrations[v];
    if (!m) return { error: `저장 데이터 버전 ${from}은(는) 현재 버전(${CURRENT_SAVE_VERSION})과 호환되지 않습니다.` };
    d = m(d);
  }
  return { data: d };
}
