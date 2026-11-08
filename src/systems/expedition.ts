// Expedition (개척 작전) roguelike rules: map generation, branching movement, node events.
// Node events are rolled ONCE when entered and stored in `pending`, so a save/load never re-rolls
// or grants a reward twice. All amounts/weights are placeholders from data/expedition.json.
import { DATA, getEvent, getRelic, getCharacterDef } from '../data';
import type { ExpeditionMap, ExpeditionState, GameState, MapNode, NodeOffer, ResourceMap, RewardChoice } from '../core/types';
import type { ActionResult } from './government';
import { recordGeneralExpedition } from './regions';

const GEN = DATA.generation;
const fail = (message: string): ActionResult => ({ ok: false, message });
export const COMBAT_TYPES = ['combat', 'elite', 'boss'];
export const isCombat = (type: string) => COMBAT_TYPES.includes(type);

// ---------- deterministic RNG ----------
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rngFor = (seed: number, key: string) => rng(seed ^ hash(key));
const pick = <T,>(r: () => number, arr: T[]) => arr[Math.floor(r() * arr.length) % arr.length];
function sample<T>(r: () => number, arr: T[], n: number): T[] {
  const a = [...arr]; const out: T[] = [];
  while (a.length && out.length < n) out.push(a.splice(Math.floor(r() * a.length) % a.length, 1)[0]);
  return out;
}

// ---------- map ----------
export function generateMap(seed: number, difficulty: number, purpose?: string): ExpeditionMap {
  const wm = DATA.generalPurposes.find((g) => g.id === purpose)?.weightMul ?? {};
  const r = rng(seed);
  const nCols = (GEN.columnsByDifficulty as Record<string, number>)[String(difficulty)] ?? 6;
  const columns: MapNode[][] = [];
  for (let c = 0; c < nCols; c++) {
    if (c === 0) { columns.push([{ id: 'c0r0', type: GEN.firstType }]); continue; }
    if (c === nCols - 1) { columns.push([{ id: `c${c}r0`, type: GEN.lastType }]); continue; }
    const rows = GEN.rows.min + Math.floor(r() * (GEN.rows.max - GEN.rows.min + 1));
    const pool = GEN.weights.filter((w) => !('minCol' in w) || c >= (w.minCol as number)).map((w) => ({ ...w, w: w.w * (wm[w.type] ?? 1) }));
    const total = pool.reduce((s, w) => s + w.w, 0);
    const col: MapNode[] = [];
    for (let i = 0; i < rows; i++) {
      let x = r() * total; let type = pool[0].type;
      for (const w of pool) { if ((x -= w.w) < 0) { type = w.type; break; } }
      col.push({ id: `c${c}r${i}`, type });
    }
    columns.push(col);
  }
  const edges: [string, string][] = [];
  const has = new Set<string>();
  const add = (a: string, b: string) => { const k = `${a}>${b}`; if (!has.has(k)) { has.add(k); edges.push([a, b]); } };
  for (let c = 0; c < nCols - 1; c++) {
    const A = columns[c], B = columns[c + 1];
    const map = (i: number, from: number, to: number) => (from <= 1 ? 0 : Math.round((i * (to - 1)) / (from - 1)));
    A.forEach((n, i) => {
      if (A.length === 1) { B.forEach((m) => add(n.id, m.id)); return; }
      const j = map(i, A.length, B.length); add(n.id, B[j].id);
      if (r() < 0.45) { const k = Math.min(B.length - 1, Math.max(0, j + (r() < 0.5 ? -1 : 1))); add(n.id, B[k].id); }
    });
    B.forEach((m, k) => { if (!edges.some(([, b]) => b === m.id)) add(A[map(k, B.length, A.length)].id, m.id); });
  }
  return { columns, edges };
}
export const nodeOf = (map: ExpeditionMap, id: string) => map.columns.flat().find((n) => n.id === id);
export const columnOf = (map: ExpeditionMap, id: string) => map.columns.findIndex((c) => c.some((n) => n.id === id));
export function reachable(ex: ExpeditionState): string[] {
  if (ex.pending) return [];
  if (!ex.currentNode) return ex.map.columns[0].map((n) => n.id);
  return ex.map.edges.filter(([a]) => a === ex.currentNode).map(([, b]) => b);
}
export const isCleared = (ex: ExpeditionState) => !!ex.currentNode && !ex.pending && columnOf(ex.map, ex.currentNode) === ex.map.columns.length - 1;
export const party = (ex: ExpeditionState) => [...ex.members, ...ex.reinforcements];

// ---------- lifecycle ----------
export interface ExpeditionTarget { regionId: string; purpose: string; kind?: 'general' | 'strategic'; opId?: string | null }
const DEFAULT_TARGET: ExpeditionTarget = { regionId: 'rg_industrial', purpose: 'resource' };

export function startExpedition(s: GameState, difficulty: number, members: string[], seed = Math.floor(Math.random() * 2 ** 31), target: ExpeditionTarget = DEFAULT_TARGET): GameState {
  return {
    ...s,
    expedition: {
      seed, difficulty, members: [...members], reinforcements: [],
      kind: target.kind ?? 'general', regionId: target.regionId, purpose: target.purpose, opId: target.opId ?? null,
      hp: Object.fromEntries(members.map((m) => [m, 1])),
      map: generateMap(seed, difficulty, target.purpose), currentNode: null, path: [], pending: null,
      relics: [], buffs: [], loot: {}, outpost: { hp: GEN.outpostHp, maxHp: GEN.outpostHp }, log: [],
    },
  };
}

export interface Settlement { ratio: number; resources: ResourceMap; items: Record<string, number>; bossCleared: boolean }
/** What the base receives when an expedition ends with `outcome` (shown on the result screen). */
export function settlementFor(ex: ExpeditionState, outcome: string): Settlement {
  const st = DATA.settlement;
  const ratio = st.ratio[outcome] ?? 0;
  const resources = Object.fromEntries(Object.entries(ex.loot).map(([k, v]) => [k, Math.floor((v ?? 0) * ratio)]).filter(([, v]) => (v as number) > 0));
  const boss = ex.map.columns[ex.map.columns.length - 1][0].id;
  const bossCleared = outcome === 'victory' && ex.path.includes(boss);
  const items: Record<string, number> = { ...(st.items[outcome] ?? {}) };
  if (bossCleared) for (const [k, v] of Object.entries(st.bossItems)) items[k] = (items[k] ?? 0) + v;
  return { ratio, resources, items, bossCleared };
}

/**
 * Ends the expedition and settles it in one step (so it can only happen once): loot -> government
 * resources by outcome, growth materials, difficulty clear/unlock on victory, and the region's
 * general-expedition record (which can never grant control). Relics vanish.
 */
export function endExpedition(s: GameState, outcome = 'return'): GameState {
  const ex = s.expedition;
  if (!ex) return s;
  let progress = s.progress;
  if (outcome === 'victory') {
    const next = ex.difficulty + 1;
    const exists = DATA.difficulties.some((d) => d.level === next);
    progress = {
      ...progress,
      highestCleared: Math.max(progress.highestCleared, ex.difficulty),
      unlockedDifficulties: exists && !progress.unlockedDifficulties.includes(next) ? [...progress.unlockedDifficulties, next] : progress.unlockedDifficulties,
    };
  }
  const st = settlementFor(ex, outcome);
  const resources = { ...s.resources };
  for (const [k, v] of Object.entries(st.resources)) resources[k as keyof typeof resources] += v ?? 0;
  const inventory = { ...s.inventory };
  for (const [k, v] of Object.entries(st.items)) inventory[k] = (inventory[k] ?? 0) + v;
  let next: GameState = { ...s, expedition: null, progress, resources, inventory };
  if (ex.kind === 'general') next = recordGeneralExpedition(next, ex.regionId, outcome);
  return next;
}

/** Loot scaled by the general expedition's purpose (placeholder multipliers in regions.json). */
export function purposeLoot(purpose: string, loot: ResourceMap): ResourceMap {
  const m = DATA.generalPurposes.find((g) => g.id === purpose)?.lootMul ?? {};
  return Object.fromEntries(Object.entries(loot).map(([k, v]) => [k, Math.round((v ?? 0) * (m[k] ?? 1))]));
}
const withEx = (s: GameState, fn: (ex: ExpeditionState) => ExpeditionState): GameState => ({ ...s, expedition: fn(s.expedition!) });
const addLoot = (a: ResourceMap, b: ResourceMap): ResourceMap => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k as keyof ResourceMap] = (out[k as keyof ResourceMap] ?? 0) + (v ?? 0);
  return out;
};
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const name = (id: string) => getCharacterDef(id)?.name ?? id;

function rollOffer(ex: ExpeditionState, node: MapNode): NodeOffer {
  const r = rngFor(ex.seed, node.id);
  switch (node.type) {
    case 'relic': return { kind: 'relic', node: node.id, choices: sample(r, DATA.relics.filter((x) => !ex.relics.includes(x.id)).map((x) => x.id), GEN.relicChoices) };
    case 'reinforce': return { kind: 'reinforce', node: node.id, candidates: [] }; // filled by caller (needs roster)
    case 'resource': return { kind: 'resource', node: node.id, loot: purposeLoot(ex.purpose, GEN.loot.resource) };
    case 'intel': return { kind: 'intel', node: node.id, loot: purposeLoot(ex.purpose, GEN.loot.intel) };
    case 'event': return { kind: 'event', node: node.id, eventId: pick(r, DATA.events).id };
    case 'rest': return { kind: 'rest', node: node.id };
    case 'shop': return { kind: 'shop', node: node.id, stock: sample(r, DATA.relics.filter((x) => !ex.relics.includes(x.id)).map((x) => x.id), GEN.shopStock).map((relic) => ({ relic, price: GEN.shopPrice })) };
    default: throw new Error(`no offer for ${node.type}`);
  }
}

/** Moves onto a non-combat node and rolls its event (saved in `pending`). */
export function enterNode(s: GameState, nodeId: string): ActionResult {
  const ex = s.expedition; if (!ex) return fail('진행 중인 원정이 없습니다.');
  if (ex.pending) return fail('먼저 현재 노드의 사건을 처리해야 합니다.');
  if (!reachable(ex).includes(nodeId)) return fail('현재 위치에서 갈 수 없는 노드입니다.');
  const node = nodeOf(ex.map, nodeId)!;
  if (isCombat(node.type)) return fail('전투 노드는 전투로 진입합니다.');
  let offer = rollOffer(ex, node);
  if (offer.kind === 'reinforce') {
    const r = rngFor(ex.seed, node.id + ':cand');
    offer = { ...offer, candidates: sample(r, s.roster.map((c) => c.charId), GEN.reinforceCandidates) };
  }
  return { ok: true, state: withEx(s, (e) => ({ ...e, currentNode: nodeId, path: [...e.path, nodeId], pending: offer, log: [...e.log, `${DATA.nodeTypes.find((t) => t.id === node.type)?.name} 진입`] })) };
}

type RewardTable = { count: number; loot: ResourceMap[]; relicChance: number; heal: number };
function rollBattleReward(ex: ExpeditionState, node: MapNode): NodeOffer {
  const t = (GEN.battleRewards as unknown as Record<string, RewardTable>)[node.type] ?? (GEN.battleRewards as unknown as Record<string, RewardTable>).combat;
  const r = rngFor(ex.seed, node.id + ':reward');
  const choices: RewardChoice[] = [];
  const free = DATA.relics.filter((x) => !ex.relics.includes(x.id)).map((x) => x.id);
  if (free.length && r() < t.relicChance) choices.push({ type: 'relic', relic: pick(r, free) });
  for (const l of sample(r, t.loot, t.count)) if (choices.length < t.count - 1) choices.push({ type: 'loot', loot: purposeLoot(ex.purpose, l) });
  choices.push({ type: 'heal', amount: t.heal });
  return { kind: 'battleReward', node: node.id, choices };
}

/**
 * Records a won combat node (all waves cleared) and rolls its reward choice, which is stored in
 * `pending` before it is shown so a save/load cannot re-roll or repeat it.
 */
export function winCombat(s: GameState, nodeId: string): ActionResult {
  const ex = s.expedition; if (!ex) return fail('진행 중인 원정이 없습니다.');
  if (!reachable(ex).includes(nodeId)) return fail('현재 위치에서 갈 수 없는 노드입니다.');
  const node = nodeOf(ex.map, nodeId)!;
  if (!isCombat(node.type)) return fail('전투 노드가 아닙니다.');
  return { ok: true, state: withEx(s, (e) => ({ ...e, currentNode: nodeId, path: [...e.path, nodeId], pending: rollBattleReward(e, node), log: [...e.log, `${DATA.nodeTypes.find((t) => t.id === node.type)?.name} 승리`] })) };
}

export type OfferChoice = { pick?: string; index?: number; skip?: boolean };
/** Resolves the pending node event with the player's choice. */
export function resolveOffer(s: GameState, choice: OfferChoice): ActionResult {
  const ex = s.expedition; if (!ex?.pending) return fail('처리할 사건이 없습니다.');
  const o = ex.pending;
  const done = (fn: (e: ExpeditionState) => ExpeditionState): ActionResult => ({ ok: true, state: withEx(s, (e) => ({ ...fn(e), pending: null })) });
  switch (o.kind) {
    case 'relic': {
      if (choice.skip) return done((e) => e);
      if (!choice.pick || !o.choices.includes(choice.pick)) return fail('선택지에 없는 유물입니다.');
      if (ex.relics.includes(choice.pick)) return fail('이미 보유한 유물입니다.');
      return done((e) => ({ ...e, relics: [...e.relics, choice.pick!], log: [...e.log, `유물 획득: ${getRelic(choice.pick!)?.name}`] }));
    }
    case 'reinforce': {
      if (choice.skip) return done((e) => e);
      const id = choice.pick;
      if (!id || !o.candidates.includes(id)) return fail('후보에 없는 요원입니다.');
      if (party(ex).includes(id)) {
        // Already deployed: 보급품 도착 instead of a normal duplicate.
        return { ok: true, state: withEx(s, (e) => ({ ...e, pending: { kind: 'supply', node: o.node, charId: id } })) };
      }
      return done((e) => ({ ...e, reinforcements: [...e.reinforcements, id], hp: { ...e.hp, [id]: 1 }, log: [...e.log, `후발대 합류: ${name(id)}`] }));
    }
    case 'supply': {
      const c = s.roster.find((x) => x.charId === o.charId)!;
      return done((e) => ({
        ...e, hp: { ...e.hp, [o.charId]: clamp((e.hp[o.charId] ?? 1) + GEN.supply.heal) },
        buffs: [...e.buffs, { id: `supply-${o.node}`, source: o.charId, text: `보급품 도착: ${name(o.charId)} (기지 육성 Lv.${c.level} · Phase ${c.phase} 반영, 효과 수치는 PHASE 7)` }],
        log: [...e.log, `보급품 도착: ${name(o.charId)}`],
      }));
    }
    case 'resource': case 'intel':
      return done((e) => ({ ...e, loot: addLoot(e.loot, o.loot) }));
    case 'rest':
      return done((e) => ({ ...e, hp: Object.fromEntries(Object.entries(e.hp).map(([k, v]) => [k, clamp(v + GEN.restHeal)])), outpost: { ...e.outpost, hp: Math.min(e.outpost.maxHp, e.outpost.hp + GEN.restOutpost) } }));
    case 'shop': {
      if (choice.skip) return done((e) => e);
      const item = o.stock[choice.index ?? -1]; if (!item) return fail('상품을 선택하세요.');
      for (const [k, v] of Object.entries(item.price)) if ((ex.loot[k as keyof ResourceMap] ?? 0) < (v ?? 0)) return fail('교환할 원정 획득물이 부족합니다.');
      const neg = Object.fromEntries(Object.entries(item.price).map(([k, v]) => [k, -(v ?? 0)]));
      return done((e) => ({ ...e, loot: addLoot(e.loot, neg), relics: [...e.relics, item.relic], log: [...e.log, `교환: ${getRelic(item.relic)?.name}`] }));
    }
    case 'battleReward': {
      const c = o.choices[choice.index ?? -1]; if (!c) return fail('보상을 선택하세요.');
      if (c.type === 'relic' && ex.relics.includes(c.relic)) return fail('이미 보유한 유물입니다.');
      return done((e) => (c.type === 'loot' ? { ...e, loot: addLoot(e.loot, c.loot) }
        : c.type === 'relic' ? { ...e, relics: [...e.relics, c.relic], log: [...e.log, `유물 획득: ${getRelic(c.relic)?.name}`] }
        : { ...e, hp: Object.fromEntries(Object.entries(e.hp).map(([k, v]) => [k, v > 0 ? clamp(v + c.amount) : v])) }));
    }
    case 'event': {
      const ev = getEvent(o.eventId)!; const ch = ev.choices[choice.index ?? -1];
      if (!ch) return fail('선택지를 고르세요.');
      return done((e) => {
        let next = e;
        for (const out of ch.outcomes) {
          if (out.type === 'loot') next = { ...next, loot: addLoot(next.loot, out.loot) };
          if (out.type === 'hp') next = { ...next, hp: Object.fromEntries(Object.entries(next.hp).map(([k, v]) => [k, clamp(v + out.value, 0.05)])) };
          if (out.type === 'outpost') next = { ...next, outpost: { ...next.outpost, hp: clamp(next.outpost.hp + out.value, 1, next.outpost.maxHp) } };
        }
        return { ...next, log: [...next.log, `${ev.title}: ${ch.label}`] };
      });
    }
  }
}
