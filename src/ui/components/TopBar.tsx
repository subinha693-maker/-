import { useState } from 'react';
import { useGame } from '../../core/gameStore';
import { useRouter } from '../../core/router';
import { CONFIG } from '../../core/config';
import { DATA } from '../../data';
import { formatGameTime } from '../../core/time';
import { useEconomy } from '../useEconomy';
import { fmtInt, fmtRate } from '../format';
import { Icon } from './Icon';

/** Top resource / time bar shared by government screens. */
export function TopBar() {
  const s = useGame((g) => g.state);
  const inBattle = useGame((g) => g.inBattle);
  const { setSpeed, setPaused } = useGame.getState();
  const screen = useRouter((r) => r.screen);
  const eco = useEconomy();
  const [open, setOpen] = useState<string | null>(null);
  if (!s || !eco) return null;
  const t = formatGameTime(s.clock.gameMinutes);
  const openDef = DATA.resources.find((r) => r.id === open);
  const halted = s.tutorial.active ? '튜토리얼 중 정지' : inBattle ? '전투 중 정지' : screen === 'screenIndex' ? '정지' : null;
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
        {DATA.resources.map((r) => {
          const rate = eco.perHour[r.id];
          return (
            <button key={r.id} className={`res ${r.category} ${open === r.id ? 'on' : ''}`} title={r.name} data-testid={`res-${r.id}`} onClick={() => setOpen(open === r.id ? null : r.id)}>
              <Icon name={r.icon} size={30} color={r.category === 'special' ? 'var(--warn)' : 'var(--accent)'} />
              <div className="col" style={{ gap: 0, minWidth: 0 }}>
                <span className="res-name">{r.name}</span>
                <span className={`res-val num ${s.resources[r.id] <= 0.01 && rate < 0 ? 'neg' : ''}`} data-testid={`res-val-${r.id}`}>{fmtInt(s.resources[r.id])}</span>
                <span className={`res-rate num ${rate > 0.004 ? 'pos' : rate < -0.004 ? 'neg' : ''}`}>{fmtRate(rate)}/h</span>
              </div>
            </button>
          );
        })}
        {openDef && (
          <div className="res-pop" data-testid="res-pop">
            <div className="row" style={{ gap: 12 }}>
              <Icon name={openDef.icon} size={36} color={openDef.category === 'special' ? 'var(--warn)' : 'var(--accent)'} />
              <b className="grow">{openDef.name}</b>
              <span className="tag">{openDef.category === 'special' ? '연구·특수 자원' : '기본 자원'}</span>
            </div>
            <dl className="kv">
              <dt>보유량</dt><dd className="num">{fmtInt(s.resources[openDef.id])}</dd>
              <dt>시간당 생산</dt><dd className="num pos">{fmtRate(eco.gross.produce[openDef.id])}</dd>
              <dt>시간당 소비</dt><dd className="num neg">{fmtRate(-eco.gross.consume[openDef.id])}</dd>
              {openDef.id === 'food' && <><dt>인구 소비 (포함)</dt><dd className="num dim">{fmtRate(-eco.populationFood)}</dd></>}
              <dt>순변화</dt><dd className="num">{fmtRate(eco.perHour[openDef.id])} / 게임 1시간</dd>
            </dl>
            <span className="dim" style={{ fontSize: 'var(--fs-xs)' }}>수치는 임시 설정값입니다.</span>
            <button className="link-btn" style={{ alignSelf: 'flex-end', padding: 0 }} onClick={() => setOpen(null)}>닫기</button>
          </div>
        )}
      </div>
      <div className="clock" data-tut="clock">
        <div className="col" style={{ gap: 0, alignItems: 'flex-end' }}>
          <span className="clock-date num" data-testid="clock-date">{t.date}</span>
          <span className="clock-time num" data-testid="clock-time">{t.time}</span>
        </div>
        <div className="col" style={{ gap: 6 }}>
          <div className="speed">
            <button className={`spd ${s.clock.paused ? 'on' : ''}`} onClick={() => setPaused(!s.clock.paused)} aria-label="일시정지" data-testid="spd-pause">❚❚</button>
            {CONFIG.time.speeds.map((v) => (
              <button key={v} className={`spd ${!s.clock.paused && s.clock.speed === v ? 'on' : ''}`} onClick={() => setSpeed(v)} data-testid={`spd-${v}`}>x{v}</button>
            ))}
          </div>
          <span className="clock-state">{halted ?? (s.clock.paused ? '일시정지' : `1초 = ${CONFIG.time.gameMinutesPerRealSecond * s.clock.speed}분`)}</span>
        </div>
      </div>
    </header>
  );
}
