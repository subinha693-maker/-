// Real-time clock: advances game time (config: 1 real second = 10 game minutes x speed)
// and runs the government simulation in bounded steps.
import { BALANCE, CONFIG } from './config';
import { events } from './events';
import { useGame } from './gameStore';
import { useRouter } from './router';
import { tickEconomy } from '../systems/economy';
import { getFacilityDef, getRegion, getResearch } from '../data';
import { siteDefs } from '../systems/regionDev';
import { pushLog } from './log';

const ECON = BALANCE.economy;
let timer: ReturnType<typeof setInterval> | null = null;
let last = 0;
let carry = 0;

/** Time runs only during normal government/expedition play. */
export function clockRunning() {
  const g = useGame.getState();
  const screen = useRouter.getState().screen;
  return !!g.state && !g.state.clock.paused && !g.inBattle && !g.state.tutorial.active && screen !== 'title' && screen !== 'screenIndex';
}

/** Advances the game by `minutes` (also used by tests). */
export function advance(minutes: number) {
  const g = useGame.getState();
  if (!g.state || minutes <= 0) return;
  let s = g.state;
  const evs = [];
  let left = minutes;
  while (left > 0) {
    const step = Math.min(left, ECON.maxTickMinutes);
    const r = tickEconomy(s, step);
    s = r.state; evs.push(...r.events); left -= step;
  }
  useGame.setState({ state: s });
  for (const e of evs) {
    if (e.type === 'facility:complete') {
      const f = s.facilities.find((x) => x.uid === e.uid);
      pushLog('info', e.kind === 'build' ? '건설 완료' : '업그레이드 완료', `${getFacilityDef(f!.defId)?.name}${e.kind === 'upgrade' ? ` Lv.${f!.level}` : ''}`);
      events.emit('facility:complete', { uid: e.uid });
    } else if (e.type === 'research:complete') {
      pushLog('info', '연구 완료', getResearch(e.id)?.name ?? e.id);
      events.emit('research:complete', { id: e.id });
    } else {
      const def = siteDefs(e.regionId).find((x) => x.id === e.siteId);
      pushLog('info', '지역 시설 복구 완료', `${getRegion(e.regionId)?.name} · ${def?.name ?? e.siteId}`);
      events.emit('facility:complete', { uid: `${e.regionId}:${e.siteId}` });
    }
  }
  events.emit('clock:advance', { gameMinutes: s.clock.gameMinutes });
}

export function startClock() {
  if (timer) return;
  last = performance.now();
  timer = setInterval(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, ECON.maxCatchUpRealSeconds);
    last = now;
    if (!clockRunning()) { carry = 0; return; }
    const speed = useGame.getState().state!.clock.speed;
    carry += dt * CONFIG.time.gameMinutesPerRealSecond * speed;
    const whole = Math.floor(carry);
    if (whole >= 1) { carry -= whole; advance(whole); }
  }, 200);
}
export function stopClock() { if (timer) clearInterval(timer); timer = null; }
