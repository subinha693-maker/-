import { useState } from 'react';
import { useGame } from '../../core/gameStore';
import { useRouter } from '../../core/router';
import { CONFIG } from '../../core/config';
import { DATA, charName, getCharacterDef } from '../../data';
import { Button, Notice, Panel, PlaceholderTag, ScreenHeader } from '../components/Common';
import { CharacterArt } from '../components/CharacterArt';

export function ExpeditionPrepScreen() {
  const s = useGame((g) => g.state)!;
  const go = useRouter((r) => r.go);
  const size = CONFIG.expedition.partySize;
  const [difficulty, setDifficulty] = useState(1);
  const [party, setParty] = useState<string[]>([]);
  const toggle = (id: string) => setParty((p) => p.includes(id) ? p.filter((x) => x !== id) : p.length < size ? [...p, id] : p);

  return (
    <div className="screen" data-testid="screen-expeditionPrep">
      <ScreenHeader title="개척 작전 준비" code="PIONEER OPERATION BRIEFING" />
      <div className="screen-main">
        <Panel title="01  침식 난이도" tail={<PlaceholderTag label="수치 미정" />} style={{ flex: 0.95 }} bodyClass="col scroll grow">
          {DATA.difficulties.map((d) => {
            const unlocked = s.progress.unlockedDifficulties.includes(d.level);
            return (
              <button key={d.level} className={`diff-item ${difficulty === d.level ? 'sel' : ''}`} disabled={!unlocked} onClick={() => setDifficulty(d.level)} data-testid={`diff-${d.level}`}>
                <span className="diff-lv num">{String(d.level).padStart(2, '0')}</span>
                <span className="grow">{d.name}</span>
                <span className={`tag ${unlocked ? 'accent' : ''}`}>{unlocked ? '진입 가능' : '잠김'}</span>
              </button>
            );
          })}
        </Panel>
        <Panel title={`02  출전 부대원 선발 (${party.length}/${size})`} style={{ flex: 1.6 }} bodyClass="scroll grow">
          <div className="card-grid pick">
            {s.roster.map((r) => {
              const d = getCharacterDef(r.charId)!; const idx = party.indexOf(r.charId);
              return (
                <button key={r.charId} className={`char-card ${idx >= 0 ? 'sel' : ''}`} onClick={() => toggle(r.charId)} data-testid={`pick-${r.charId}`}>
                  <CharacterArt def={d} zoom={2.1} className="char-card-art" />
                  <div className="char-card-info"><b>{charName(d)}</b><span className="dim">{d.specialty ?? '전문 분야 미정'}</span></div>
                  {idx >= 0 && <span className="pick-no">{idx + 1}</span>}
                </button>
              );
            })}
          </div>
        </Panel>
        <Panel title="03  작전 개요" style={{ flex: 0.9 }} bodyClass="col grow">
          <dl className="kv">
            <dt>작전 구역</dt><dd>외부 오염권</dd>
            <dt>침식 난이도</dt><dd>{DATA.difficulties.find((d) => d.level === difficulty)?.name}</dd>
            <dt>출전 인원</dt><dd className="num">{party.length} / {size}</dd>
          </dl>
          <div className="col" style={{ gap: 8 }}>
            {party.map((id, i) => <div key={id} className="party-line"><span className="num dim">{i + 1}</span>{charName(getCharacterDef(id))}</div>)}
            {Array.from({ length: size - party.length }).map((_, i) => <div key={i} className="party-line empty-line">선발 대기</div>)}
          </div>
          <div className="grow" />
          <span className="dim" style={{ fontSize: 'var(--fs-xs)' }}>잠긴 난이도는 이전 난이도를 완수하면 해금됩니다.</span>
          <Notice>PHASE 6 전까지 원정 지도는 고정된 샘플 지도로 표시됩니다.</Notice>
          <Button variant="primary" disabled={party.length !== size} onClick={() => go('expeditionMap', { difficulty, party })} data-testid="btn-launch">작전 개시</Button>
        </Panel>
      </div>
    </div>
  );
}
