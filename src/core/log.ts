import { create } from 'zustand';

/** Event log shown in "알림 및 경고" (runtime only). Live warnings are derived from state separately. */
export interface LogItem { id: number; tone: 'info' | 'warn' | 'danger'; title: string; body: string; at: number }
let seq = 0;
export const useLog = create<{ items: LogItem[] }>(() => ({ items: [] }));
export function pushLog(tone: LogItem['tone'], title: string, body: string) {
  useLog.setState((s) => ({ items: [{ id: ++seq, tone, title, body, at: Date.now() }, ...s.items].slice(0, 20) }));
}
export function clearLog() { useLog.setState({ items: [] }); }
