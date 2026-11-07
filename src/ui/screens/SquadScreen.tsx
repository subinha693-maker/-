import { Fragment, useState } from 'react';
import { useGame } from '../../core/gameStore';
import { charName, getCharacterDef } from '../../data';
import { Button, Panel, ScreenHeader, Tabs } from '../components/Common';
import { CharacterArt } from '../components/CharacterArt';

const UNDECIDED = <span className="dim">미정</span>;

export function SquadScreen() {
  const s = useGame((g) => g.state)!;
  const [sel, setSel] = useState(s.roster[0]?.charId);
  const [tab, setTab] = useState<'info' | 'combat' | 'growth' | 'story'>('info');
  const def = sel ? getCharacterDef(sel) : undefined;
  const inst = s.roster.find((r) => r.charId === sel);

  return (
    <div className="screen" data-testid="screen-squad">
      <ScreenHeader title="개척부대" code="PIONEER CORPS ROSTER" tail={<span className="tag">보유 {s.roster.length}명</span>} />
      <div className="screen-main">
        <Panel title="부대원 목록" style={{ flex: 1.15 }} bodyClass="scroll grow">
          <div className="card-grid">
            {s.roster.map((r) => {
              const d = getCharacterDef(r.charId)!;
              return (
                <button key={r.charId} className={`char-card ${sel === r.charId ? 'sel' : ''}`} onClick={() => setSel(r.charId)} data-testid={`card-${r.charId}`}>
                  <CharacterArt def={d} zoom={2.1} className="char-card-art" />
                  <div className="char-card-info">
                    <b>{charName(d)}</b>
                    <span className="dim">{d.specialty ?? '전문 분야 미정'}</span>
                  </div>
                  <span className="char-card-grade">{d.grade ?? '—'}</span>
                </button>
              );
            })}
          </div>
        </Panel>
        {def && inst && (
          <section className="char-detail panel" data-testid="char-detail">
            <CharacterArt def={def} className="char-full" />
            <div className="char-sheet">
              <div className="char-name-row">
                <div className="col" style={{ gap: 2 }}>
                  <span className="dim" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '.18em' }}>ID {def.id.toUpperCase()}</span>
                  <h2 className="char-name">{charName(def)}</h2>
                </div>
                <span className="tag">등급 {def.grade ?? '미정'}</span>
                <span className="tag accent">Lv.{inst.level}</span>
              </div>
              <Tabs items={[{ id: 'info' as const, name: '기본 정보' }, { id: 'combat' as const, name: '전투' }, { id: 'growth' as const, name: '육성' }, { id: 'story' as const, name: '개인 기록' }]} value={tab} onChange={setTab} />
              <div className="scroll grow" style={{ paddingTop: 16 }}>
                {tab === 'info' && <dl className="kv">
                  <dt>출신</dt><dd>{def.origin ?? UNDECIDED}</dd>
                  <dt>전문 분야</dt><dd>{def.specialty ?? UNDECIDED}</dd>
                  <dt>고유 특성</dt><dd>{def.traits.length ? def.traits.join(', ') : UNDECIDED}</dd>
                  <dt>장비</dt><dd>{inst.equipment.length ? inst.equipment.join(', ') : UNDECIDED}</dd>
                </dl>}
                {tab === 'combat' && <dl className="kv">
                  {['HP', '공격력', '방어력', '공격 속도', '사거리', '스킬 충전'].map((k) => <Fragment key={k}><dt>{k}</dt><dd>{UNDECIDED}</dd></Fragment>)}
                  <dt>기본 공격</dt><dd>{UNDECIDED}</dd>
                  <dt>고유 스킬</dt><dd>{UNDECIDED}</dd>
                </dl>}
                {tab === 'growth' && <div className="col"><dl className="kv"><dt>레벨</dt><dd>{inst.level}</dd><dt>육성 단계</dt><dd>{UNDECIDED}</dd></dl><Button pendingPhase={5}>육성</Button></div>}
                {tab === 'story' && <p className="muted" style={{ margin: 0 }}>{def.story ?? '개인 스토리는 아직 정해지지 않았습니다.'}</p>}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
