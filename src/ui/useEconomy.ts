import { useMemo } from 'react';
import { useGame } from '../core/gameStore';
import { computeEconomy } from '../systems/economy';

/** Current economy report for the live state (recomputed when the state changes). */
export function useEconomy() {
  const s = useGame((g) => g.state);
  return useMemo(() => (s ? computeEconomy(s) : null), [s]);
}
