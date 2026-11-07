// Minimal typed event bus so systems can announce things (e.g. "research complete")
// without knowing who listens (autosave, alerts, tutorial...).
export interface GameEvents {
  'expedition:start': { difficulty: number };
  'expedition:end': { outcome: string };
  'battle:enter': { node: string };
  'facility:complete': { uid: string };
  'research:complete': { id: string };
  'story:complete': { id: string };
  'tutorial:step': { step: number };
  'clock:advance': { gameMinutes: number };
}
type Handler<K extends keyof GameEvents> = (payload: GameEvents[K]) => void;
type AnyHandler = (payload: unknown) => void;

const handlers = new Map<keyof GameEvents, Set<AnyHandler>>();

export const events = {
  on<K extends keyof GameEvents>(type: K, fn: Handler<K>) {
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type)!.add(fn as AnyHandler);
    return () => { handlers.get(type)?.delete(fn as AnyHandler); };
  },
  emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]) {
    handlers.get(type)?.forEach((fn) => fn(payload));
  },
};
