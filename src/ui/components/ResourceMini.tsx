import { useGame } from '../../core/gameStore';
import { DATA } from '../../data';
import { fmtInt } from '../format';
import { Icon } from './Icon';

/** Compact stock readout for management screens (so costs can be compared with what you have). */
export function ResourceMini({ ids }: { ids?: string[] }) {
  const s = useGame((g) => g.state);
  if (!s) return null;
  const list = DATA.resources.filter((r) => !ids || ids.includes(r.id));
  return (
    <div className="res-mini">
      {list.map((r) => (
        <span key={r.id} title={r.name}>
          <Icon name={r.icon} size={22} color={r.category === 'special' ? 'var(--warn)' : 'var(--accent)'} />
          <b className="num" data-testid={`res-val-${r.id}`}>{fmtInt(s.resources[r.id])}</b>
        </span>
      ))}
    </div>
  );
}
