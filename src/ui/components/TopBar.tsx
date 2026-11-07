import { useState } from 'react';
import { useGame } from '../../core/gameStore';
import { DATA } from '../../data';
import { formatGameTime } from '../../core/time';
import { Icon } from './Icon';
import { PhaseTag } from './Common';

const fmt = new Intl.NumberFormat('ko-KR');

/** Top resource / time bar shared by government screens. */
export function TopBar() {
  const s = useGame((g) => g.state);
  const [open, setOpen] = useState<string | null>(null);
  if (!s) return null;
  const openDef = DATA.resources.find((r) => r.id === open);
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
          <button key={r.id} className={`res ${r.category} ${open === r.id ? 'on' : ''}`} title={r.name} data-testid={`res-${r.id}`} onClick={() => setOpen(open === r.id ? null : r.id)}>
            <Icon name={r.icon} size={30} color={r.category === 'special' ? 'var(--warn)' : 'var(--accent)'} />
            <div className="col" style={{ gap: 0 }}>
              <span className="res-name">{r.name}</span>
              <span className="res-val num">{fmt.format(s.resources[r.id])}</span>
            </div>
          </button>
        ))}
        {openDef && (
          <div className="res-pop" data-testid="res-pop">
            <div className="row" style={{ gap: 12 }}>
              <Icon name={openDef.icon} size={36} color={openDef.category === 'special' ? 'var(--warn)' : 'var(--accent)'} />
              <b className="grow">{openDef.name}</b>
              <span className="tag">{openDef.category === 'special' ? '연구·특수 자원' : '기본 자원'}</span>
            </div>
            <dl className="kv">
              <dt>보유량</dt><dd className="num">{fmt.format(s.resources[openDef.id])}</dd>
              <dt>시간당 생산</dt><dd className="dim">미정 (PHASE 4)</dd>
              <dt>시간당 소비</dt><dd className="dim">미정 (PHASE 4)</dd>
            </dl>
            <button className="link-btn" style={{ alignSelf: 'flex-end', padding: 0 }} onClick={() => setOpen(null)}>닫기</button>
          </div>
        )}
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
