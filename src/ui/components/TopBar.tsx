import { useGame } from '../../core/gameStore';
import { DATA } from '../../data';
import { formatGameTime } from '../../core/time';
import { Icon } from './Icon';
import { PhaseTag } from './Common';

const fmt = new Intl.NumberFormat('ko-KR');

/** Top resource / time bar shared by government screens. */
export function TopBar() {
  const s = useGame((g) => g.state);
  if (!s) return null;
  const t = formatGameTime(s.clock.gameMinutes);
  return (
    <header className="topbar" data-tut="topbar">
      <div className="brand">
        <span className="emblem" />
        <div className="col" style={{ gap: 0 }}>
          <b>통합인류행정부</b>
          <span className="dim" style={{ fontSize: 16, letterSpacing: '.2em' }}>UNIFIED HUMAN ADMINISTRATION</span>
        </div>
      </div>
      <div className="res-strip" data-tut="resources">
        {DATA.resources.map((r) => (
          <div key={r.id} className={`res ${r.category}`} title={r.name} data-testid={`res-${r.id}`}>
            <Icon name={r.icon} size={30} color={r.category === 'special' ? 'var(--warn)' : 'var(--accent)'} />
            <div className="col" style={{ gap: 0 }}>
              <span className="res-name">{r.name}</span>
              <span className="res-val num">{fmt.format(s.resources[r.id])}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="clock" data-tut="clock">
        <div className="col" style={{ gap: 0, alignItems: 'flex-end' }}>
          <span className="clock-date num">{t.date}</span>
          <span className="clock-time num">{t.time}</span>
        </div>
        <PhaseTag phase={4} />
      </div>
    </header>
  );
}
