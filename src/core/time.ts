import { CONFIG } from './config';

const pad = (n: number) => String(n).padStart(2, '0');
/** Converts elapsed game minutes to a calendar label. Calendar naming is a placeholder (30-day months). */
export function formatGameTime(gameMinutes: number) {
  const s = CONFIG.time.startDate;
  let total = gameMinutes + s.hour * 60 + s.minute;
  const minute = total % 60; total = Math.floor(total / 60);
  const hour = total % 24; let days = Math.floor(total / 24) + (s.day - 1);
  let month = s.month - 1 + Math.floor(days / 30); days %= 30;
  const year = s.year + Math.floor(month / 12); month %= 12;
  return { date: `${year}년차 ${pad(month + 1)}.${pad(days + 1)}`, time: `${pad(hour)}:${pad(minute)}` };
}
