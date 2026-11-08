// UI-facing wrapper: applies a pure government action to the live state and reports failures.
import { useGame } from './gameStore';
import { useToast } from '../ui/components/Toast';
import type { ActionResult } from '../systems/government';
import type { GameState } from './types';

export function act(fn: (s: GameState) => ActionResult, success?: string): boolean {
  const s = useGame.getState().state;
  if (!s) return false;
  const r = fn(s);
  if (!r.ok) { useToast.getState().push(r.message, 'warn'); return false; }
  useGame.setState({ state: r.state });
  if (success) useToast.getState().push(success);
  return true;
}
