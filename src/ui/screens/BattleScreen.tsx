import { useEffect } from 'react';
import { useRouter } from '../../core/router';
import { useGame } from '../../core/gameStore';
import { leaveBattle } from '../../core/session';
import { CONFIG } from '../../core/config';
import { DATA, charName, getCharacterDef } from '../../data';
import { Bar, Button, PlaceholderTag } from '../components/Common';
import { CharacterArt } from '../components/CharacterArt';
import { asset } from '../components/Icon';

const LANES = ['1열', '2열'];

export function BattleScreen() {
  const { params, replace, back } = useRouter();
  const ex = useGame((g) => g.state?.expedition);
  const party = ex?.members ?? ((params.party as string[] | undefined)?.length ? params.party as string[] : DATA.startingRoster.slice(0, 3));
  useEffect(() => { useGame.getState().setInBattle(true); return leaveBattle; }, []);
  const { slotsPerLane } = CONFIG.battle;
  // Layout preview: members fill lane 1 then lane 2. Real placement & swapping come in PHASE 7.
  const slots = LANES.map((_, li) => Array.from({ length: slotsPerLane }, (_, si) => party[li * slotsPerLane + si] ?? null));

  return (
    <div className="screen battle" data-testid="screen-battle">
      <header className="battle-hud">
        <div className="col" style={{ gap: 4, width: 460 }}>
          <span className="dim" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '.15em' }}>임시 거점 HP</span>
          <Bar value={100} />
        </div>
        <div className="wave"><span className="dim">WAVE</span><b className="num">1 / 3</b></div>
        <PlaceholderTag label="전투 화면 레이아웃 · 로직은 PHASE 7" />
        <span className="tag" data-testid="battle-nosave">전투 중 저장 불가</span>
        <div className="grow" />
        <Button small pendingPhase={7}>일시정지</Button>
        <Button small pendingPhase={7}>x2</Button>
        <Button small variant="danger" onClick={() => replace('result', { outcome: 'defeat' })} data-testid="btn-retreat">후퇴</Button>
        <Button small onClick={back} data-testid="btn-battle-back">지도로</Button>
      </header>
      <div className="battle-field" data-tut="battle-lanes">
        <div className="outpost" data-tut="battle-outpost">
          <img src={asset('sprites/kenney/sp-gate-door.png')} alt="" />
          <span>임시 거점</span>
        </div>
        {LANES.map((lane, li) => (
          <div key={lane} className="lane" data-testid={`lane-${li + 1}`}>
            <span className="lane-label">{lane}</span>
            <div className="lane-slots">
              {slots[li].map((id, si) => {
                const d = id ? getCharacterDef(id) : undefined;
                return (
                  <div key={si} className={`slot ${d ? 'filled' : ''}`}>
                    {d ? <>
                      <CharacterArt def={d} zoom={2.2} className="slot-art" />
                      <div className="slot-hp"><Bar value={100} /></div>
                    </> : <span className="dim">빈 자리</span>}
                  </div>
                );
              })}
            </div>
            <div className="lane-path">
              {[0, 1, 2].map((e) => <div key={e} className="enemy" style={{ right: 140 + e * 190 + li * 60 }}><span>부토스</span></div>)}
            </div>
          </div>
        ))}
      </div>
      <footer className="battle-deck">
        <div className="deck-units" data-tut="battle-deck">
          {party.map((id) => {
            const d = getCharacterDef(id)!;
            return (
              <div key={id} className="unit-card">
                <CharacterArt def={d} zoom={2.3} className="unit-art" />
                <div className="col grow" style={{ gap: 8 }}>
                  <b>{charName(d)}</b>
                  <div className="row" style={{ gap: 8 }}><span className="dim" style={{ width: 52 }}>HP</span><div className="grow"><Bar value={100} /></div></div>
                  <div className="row" style={{ gap: 8 }}><span className="dim" style={{ width: 52 }}>SP</span><div className="grow"><Bar value={35} tone="warn" /></div></div>
                </div>
                <button className="skill-btn" disabled>스킬</button>
              </div>
            );
          })}
        </div>
        <div className="queue" data-tut="battle-queue">
          <span className="dim" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '.12em' }}>대기열</span>
          <div className="empty" style={{ padding: 16 }}>대기 중인 부대원 없음</div>
        </div>
      </footer>
    </div>
  );
}
