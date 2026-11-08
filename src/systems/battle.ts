// Real-time lane defense battle (pure simulation, rendered by BattleScreen).
// Confirmed rules: 2 lanes x 4 slots, auto attacks, skills cast by the player when charged,
// swap = select a unit then click a deployed slot, queue units regenerate HP,
// outpost HP 0 = defeat (expedition failure). All numbers: config/battle.json (placeholders).
import cfg from '../config/battle.json';
import { DATA, getCharacterDef, getEnemy, getRelic } from '../data';
import type { CharacterInstance, EnemyDef, ExpeditionState } from '../core/types';
import { rng } from './expedition';

export const BCFG = cfg;
const A = cfg.ally;
type SkillCfg = { target: string; dmg: number; slow?: number; accDown?: number; duration?: number; selfEva?: number; bleed?: number; rangeMul?: number; hits?: number; stun?: number; atkDown?: number };
const SKILLS = cfg.skills as Record<string, SkillCfg>;

export interface AllyStats { hp: number; atk: number; def: number; atkInterval: number; eva: number; acc: number; crit: number; skillCharge: number; buthosDmg: number; range: number; melee: boolean }
export interface Ally {
  charId: string; stats: AllyStats;
  hp: number; lane: number | null; slot: number | null; x: number;
  atkCd: number; sp: number; down: boolean;
  evaBuff: number; evaBuffT: number;
  anim: string; animT: number;
}
export interface Status { slow: number; accDown: number; atkDown: number; until: number; stunUntil: number; bleed: number; bleedUntil: number }
export interface Enemy { uid: number; def: EnemyDef; lane: number; x: number; hp: number; maxHp: number; atk: number; atkCd: number; st: Status; anim: string; animT: number; dead: boolean; deadT: number }
export interface Spawn { at: number; enemy: string; lane: number }
export interface FloatText { id: number; lane: number; x: number; text: string; kind: 'dmg' | 'crit' | 'miss' | 'heal' | 'skill' | 'outpost'; t: number }
export interface BattleState {
  t: number; phase: 'intro' | 'fight' | 'advance' | 'victory' | 'defeat';
  phaseT: number; wave: number; waves: Spawn[][]; pending: Spawn[];
  allies: Ally[]; enemies: Enemy[];
  outpost: { hp: number; max: number }; nodeType: string; difficulty: number;
  relicMods: Record<string, number>; floats: FloatText[]; seq: number; rand: () => number;
}

// ---------- stats ----------
export function relicMods(relics: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of relics) for (const e of getRelic(r)?.effects ?? []) m[e.stat] = (m[e.stat] ?? 0) + e.value;
  return m;
}
export function allyStats(c: CharacterInstance, mods: Record<string, number> = {}, supply = false): AllyStats {
  const def = getCharacterDef(c.charId)!;
  const melee = (cfg.weaponClass as Record<string, string>)[c.charId] !== 'ranged';
  const cls = melee ? A.melee : A.ranged;
  const s = { ...A.base, hp: A.base.hp * cls.hpMul, def: A.base.def * cls.defMul };
  const fx = cfg.tendencyEffects as Record<string, string[]>;
  for (const t of def.tendencies ?? []) {
    const g = (A.gradeMul as Record<string, number>)[t.grade] ?? 1;
    for (const k of fx[t.stat] ?? []) {
      if (k === 'atk') s.atk *= g;
      if (k === 'hp') s.hp *= g;
      if (k === 'atkSpeed') s.atkInterval /= 1 + (g - 1) * 0.6;
      if (k === 'eva') s.eva += (g - 1) * 0.35;
      if (k === 'acc') s.acc += (g - 1) * 0.15;
      if (k === 'crit') s.crit += (g - 1) * 0.3;
      if (k === 'skillCharge') s.skillCharge /= g;
      if (k === 'buthosDmg') s.buthosDmg += (g - 1);
    }
  }
  const growth = (1 + A.perLevel * (c.level - 1)) * ((A.phaseMul as Record<string, number>)[String(c.phase)] ?? 1);
  const sup = supply ? A.supplyBuff : { atk: 0, def: 0 };
  return {
    hp: Math.round(s.hp * growth * (1 + (mods.hp ?? 0))),
    atk: s.atk * growth * (1 + (mods.atk ?? 0) + sup.atk),
    def: s.def * growth * (1 + (mods.def ?? 0) + sup.def),
    atkInterval: s.atkInterval / (1 + (mods.atkSpeed ?? 0)),
    eva: Math.min(0.75, s.eva), acc: s.acc, crit: Math.min(0.6, s.crit),
    skillCharge: s.skillCharge / (1 + (mods.skillCharge ?? 0)),
    buthosDmg: s.buthosDmg + (mods.elementalDmg ?? 0),
    range: cls.range, melee,
  };
}

// ---------- setup ----------
export function buildWaves(nodeType: string, difficulty: number, seed: number): Spawn[][] {
  const W = cfg.waves;
  type Plan = { waves: number; count: number[]; pool: string[]; last?: string };
  const plans = W as unknown as Record<string, Plan>;
  const plan = plans[nodeType] ?? plans.combat;
  const r = rng(seed);
  const pool = DATA.enemies.filter((e) => e.role === 'normal');
  const waves: Spawn[][] = [];
  for (let w = 0; w < plan.waves; w++) {
    const n = Math.round(plan.count[w] + (difficulty - 1) * W.perDifficulty.count);
    const list: Spawn[] = [];
    for (let i = 0; i < n; i++) list.push({ at: i * W.spawnGap, enemy: pool[Math.floor(r() * pool.length)].id, lane: Math.floor(r() * 2) });
    if (w === plan.waves - 1 && plan.last) {
      const special = DATA.enemies.filter((e) => e.role === plan.last);
      list.push({ at: n * W.spawnGap + 1, enemy: special[Math.floor(r() * special.length)].id, lane: Math.floor(r() * 2) });
    }
    waves.push(list);
  }
  return waves;
}

export interface BattleSetup { party: CharacterInstance[]; hp: Record<string, number>; relics: string[]; supplied: string[]; outpost: { hp: number; maxHp: number }; nodeType: string; difficulty: number; seed: number }

/** Initial formation: alternate lanes front to back (player can rearrange with swaps). */
export function createBattle(p: BattleSetup): BattleState {
  const mods = relicMods(p.relics);
  const allies: Ally[] = p.party.map((c, i) => {
    const stats = allyStats(c, mods, p.supplied.includes(c.charId));
    const frac = p.hp[c.charId] ?? 1;
    const deployed = i < 8 && frac > 0;
    const lane = deployed ? i % 2 : null, slot = deployed ? Math.floor(i / 2) : null;
    return { charId: c.charId, stats, hp: Math.round(stats.hp * frac), lane, slot, x: -10, atkCd: 0.3 * i, sp: 0, down: frac <= 0, evaBuff: 0, evaBuffT: 0, anim: 'move', animT: 0 };
  });
  const omul = 1 + (mods.outpostHp ?? 0);
  return {
    t: 0, phase: 'intro', phaseT: 0, wave: 0, waves: buildWaves(p.nodeType, p.difficulty, p.seed), pending: [],
    allies, enemies: [], outpost: { hp: p.outpost.hp * omul, max: p.outpost.maxHp * omul },
    nodeType: p.nodeType, difficulty: p.difficulty, relicMods: mods, floats: [], seq: 0, rand: rng(p.seed ^ 0x9e3779b9),
  };
}

// ---------- helpers ----------
const slotX = (slot: number) => cfg.slotX[slot];
const living = (b: BattleState) => b.enemies.filter((e) => !e.dead);
const frontAlly = (b: BattleState, lane: number) =>
  b.allies.filter((a) => a.lane === lane && !a.down && a.hp > 0).sort((p, q) => q.x - p.x)[0];
function float(b: BattleState, lane: number, x: number, text: string, kind: FloatText['kind']) {
  b.floats.push({ id: ++b.seq, lane, x, text, kind, t: b.t });
}
function spawn(b: BattleState, s: Spawn) {
  const def = getEnemy(s.enemy)!;
  const pd = cfg.waves.perDifficulty;
  const hp = Math.round(def.hp * (1 + pd.hp * (b.difficulty - 1)));
  b.enemies.push({ uid: ++b.seq, def, lane: s.lane, x: cfg.spawnX, hp, maxHp: hp, atk: def.atk * (1 + pd.atk * (b.difficulty - 1)), atkCd: def.atkInterval, st: { slow: 0, accDown: 0, atkDown: 0, until: 0, stunUntil: 0, bleed: 0, bleedUntil: 0 }, anim: 'walk', animT: 0, dead: false, deadT: 0 });
}
function hitEnemy(b: BattleState, a: Ally, e: Enemy, mult: number, canMiss = true) {
  if (canMiss && b.rand() > a.stats.acc * (1 - e.def.eva)) { float(b, e.lane, e.x, 'MISS', 'miss'); return; }
  const crit = b.rand() < a.stats.crit;
  const raw = a.stats.atk * mult * (crit ? 1.6 : 1) * (1 + a.stats.buthosDmg);
  const dmg = Math.max(Math.round(raw * 0.15), Math.round(raw - e.def.def));
  e.hp -= dmg; e.anim = 'damage'; e.animT = 0;
  float(b, e.lane, e.x, String(dmg), crit ? 'crit' : 'dmg');
  if (e.hp <= 0 && !e.dead) { e.dead = true; e.deadT = 0; e.anim = 'dead'; e.animT = 0; }
}

// ---------- player actions ----------
export const skillReady = (a: Ally) => !a.down && a.lane !== null && a.sp >= 1;
export function castSkill(b: BattleState, charId: string, skillLevel = 1): boolean {
  const a = b.allies.find((x) => x.charId === charId);
  if (!a || !skillReady(a) || b.phase !== 'fight') return false;
  const def = getCharacterDef(charId)!; const sk = SKILLS[def.skill?.id ?? ''];
  if (!sk) return false;
  const power = 1 + cfg.ally.skillLevelPower * (skillLevel - 1);
  const until = b.t + (sk.duration ?? 0);
  const inLane = living(b).filter((e) => e.lane === a.lane);
  let targets: Enemy[] = [];
  if (sk.target === 'lane') targets = inLane;
  else if (sk.target === 'all') targets = living(b);
  else if (sk.target === 'nearest') targets = inLane.sort((p, q) => p.x - q.x).slice(0, 1);
  else if (sk.target === 'melee') targets = inLane.filter((e) => e.x - a.x <= a.stats.range * (sk.rangeMul ?? 1));
  if (sk.target === 'random') {
    const pool = living(b);
    for (let i = 0; i < (sk.hits ?? 1) && pool.length; i++) {
      const e = pool[Math.floor(b.rand() * pool.length)];
      hitEnemy(b, a, e, sk.dmg * power, false);
      if (sk.stun) e.st.stunUntil = b.t + sk.stun;
      if (sk.atkDown) { e.st.atkDown = sk.atkDown; e.st.until = Math.max(e.st.until, until); }
    }
  }
  for (const e of targets) {
    hitEnemy(b, a, e, sk.dmg * power, false);
    if (sk.slow) e.st.slow = Math.max(e.st.slow, sk.slow);
    if (sk.accDown) e.st.accDown = Math.max(e.st.accDown, sk.accDown);
    if (sk.slow || sk.accDown) e.st.until = Math.max(e.st.until, until);
    if (sk.bleed) { e.st.bleed = a.stats.atk * sk.bleed * power; e.st.bleedUntil = until; }
  }
  if (sk.selfEva) { a.evaBuff = sk.selfEva; a.evaBuffT = until; }
  a.sp = 0; a.anim = 'attack'; a.animT = 0;
  float(b, a.lane!, a.x, def.skill!.name, 'skill');
  return true;
}

/**
 * Swap: `picked` is the unit chosen first; target is a lane/slot. If the slot is occupied, the two
 * units trade places (a queued unit sent in pushes the deployed one to the queue).
 */
export function swapInto(b: BattleState, picked: string, lane: number, slot: number): boolean {
  if (b.phase === 'victory' || b.phase === 'defeat') return false;
  const a = b.allies.find((x) => x.charId === picked);
  if (!a || a.down) return false;
  const other = b.allies.find((x) => x.lane === lane && x.slot === slot);
  if (other === a) return false;
  const [pl, ps] = [a.lane, a.slot];
  a.lane = lane; a.slot = slot; a.x = slotX(slot); a.anim = 'move'; a.animT = 0;
  if (other) { other.lane = pl; other.slot = ps; other.x = ps === null ? -10 : slotX(ps); other.anim = 'idle'; }
  return true;
}

// ---------- simulation ----------
export function step(b: BattleState, dt: number) {
  if (b.phase === 'victory' || b.phase === 'defeat') return;
  b.t += dt; b.phaseT += dt;
  b.floats = b.floats.filter((f) => b.t - f.t < 1.1);
  for (const a of b.allies) a.animT += dt;
  for (const e of b.enemies) { e.animT += dt; if (e.dead) e.deadT += dt; }
  b.enemies = b.enemies.filter((e) => !e.dead || e.deadT < 0.9);

  // queue regeneration (deployed units do not regenerate)
  for (const a of b.allies) if (a.lane === null && !a.down) a.hp = Math.min(a.stats.hp, a.hp + a.stats.hp * cfg.queueRegenPerSec * dt);

  if (b.phase === 'intro' || b.phase === 'advance') {
    const dur = b.phase === 'intro' ? cfg.introSeconds : cfg.advanceSeconds;
    const k = Math.min(1, b.phaseT / dur);
    // intro: run in from the outpost side; advance: hold position and play the running animation
    for (const a of b.allies) if (a.lane !== null) { a.anim = 'move'; a.x = b.phase === 'intro' ? -10 + (slotX(a.slot!) + 10) * k : slotX(a.slot!); }
    if (b.phaseT >= dur) {
      for (const a of b.allies) if (a.lane !== null) { a.x = slotX(a.slot!); a.anim = 'idle'; }
      b.phase = 'fight'; b.phaseT = 0; b.pending = [...b.waves[b.wave]];
    }
    return;
  }

  // spawns
  b.pending = b.pending.filter((s) => { if (s.at <= b.phaseT) { spawn(b, s); return false; } return true; });

  // allies
  for (const a of b.allies) {
    if (a.lane === null || a.down) continue;
    a.sp = Math.min(1, a.sp + dt / a.stats.skillCharge);
    a.atkCd -= dt;
    if (a.anim === 'attack' && a.animT > 0.6) a.anim = 'idle';
    if (a.anim === 'move' && a.animT > 0.4) a.anim = 'idle';
    if (a.atkCd > 0) continue;
    const target = living(b).filter((e) => e.lane === a.lane && e.x >= a.x - 2 && e.x - a.x <= a.stats.range).sort((p, q) => p.x - q.x)[0];
    if (!target) continue;
    hitEnemy(b, a, target, 1);
    a.atkCd = a.stats.atkInterval; a.anim = 'attack'; a.animT = 0;
  }

  // enemies
  for (const e of living(b)) {
    if (e.st.bleedUntil > b.t) { e.hp -= e.st.bleed * dt; if (e.hp <= 0) { e.dead = true; e.anim = 'dead'; e.animT = 0; continue; } }
    if (e.st.until <= b.t) { e.st.slow = 0; e.st.accDown = 0; e.st.atkDown = 0; }
    if (e.st.stunUntil > b.t) { e.anim = 'wait'; continue; }
    const front = frontAlly(b, e.lane);
    const stopAt = front ? front.x + Math.max(cfg.contactGap, e.def.range) : cfg.outpostX + e.def.range * 0.3;
    if (e.x > stopAt) {
      e.x = Math.max(stopAt, e.x - e.def.speed * (1 - e.st.slow) * dt);
      if (e.anim !== 'damage' || e.animT > 0.3) e.anim = 'walk';
      continue;
    }
    e.atkCd -= dt;
    if (e.anim !== 'attack' && (e.anim !== 'damage' || e.animT > 0.3)) e.anim = 'wait';
    if (e.atkCd > 0) continue;
    e.atkCd = e.def.atkInterval; e.anim = 'attack'; e.animT = 0;
    const atk = e.atk * (1 - e.st.atkDown);
    if (!front) {
      b.outpost.hp = Math.max(0, b.outpost.hp - atk * 0.2);
      float(b, e.lane, cfg.outpostX + 2, `-${Math.round(atk * 0.2)}`, 'outpost');
      continue;
    }
    const eva = Math.min(0.9, front.stats.eva + (front.evaBuffT > b.t ? front.evaBuff : 0));
    if (b.rand() > e.def.acc * (1 - e.st.accDown) * (1 - eva)) { float(b, e.lane, front.x, 'MISS', 'miss'); continue; }
    const dmg = Math.max(Math.round(atk * 0.15), Math.round(atk - front.stats.def));
    front.hp -= dmg;
    float(b, e.lane, front.x, String(dmg), 'dmg');
    if (front.hp <= 0) { front.hp = 0; front.down = true; front.lane = null; front.slot = null; front.x = -10; }
  }

  if (b.outpost.hp <= 0) { b.phase = 'defeat'; return; }
  if (!b.pending.length && !living(b).length) {
    if (b.wave >= b.waves.length - 1) { b.phase = 'victory'; return; }
    b.wave++; b.phase = 'advance'; b.phaseT = 0;
  }
}

/** HP fractions to write back to the expedition after the battle. */
export function results(b: BattleState) {
  return {
    hp: Object.fromEntries(b.allies.map((a) => [a.charId, a.down ? 0 : Math.max(0, Math.min(1, a.hp / a.stats.hp))])),
    outpostHp: Math.round(b.outpost.hp / (1 + (b.relicMods.outpostHp ?? 0))),
  };
}
export const isOver = (b: BattleState) => b.phase === 'victory' || b.phase === 'defeat';
export type { ExpeditionState };
