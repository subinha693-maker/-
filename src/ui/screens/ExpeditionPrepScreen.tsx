import { useEffect, useState } from 'react';
import { tutorialSignal } from '../../tutorial/controller';
import { useGame } from '../../core/gameStore';
import { launchExpedition, launchStrategicOp } from '../../core/session';
import { getOp } from '../../data';
import { useRouter } from '../../core/router';
import { canRunGeneral } from '../../systems/regions';
import { CONFIG } from '../../core/config';
import { DATA, charName, getCharacterDef } from '../../data';
import { Button, Notice, Panel, PlaceholderTag, ScreenHeader } from '../components/Common';
import { CharacterArt } from '../components/CharacterArt';

export function ExpeditionPrepScreen() {
  const s = useGame((g) => g.state)!;
  const size = CONFIG.expedition.partySize;
  const params = useRouter((r) => r.params);
  const op = params.opId ? getOp(params.opId as string) : undefined;
  const openRegions = DATA.regions.filter((r) => canRunGeneral(s, r.id).length === 0);
  // (strategic op mode keeps its own region)
  const [regionId, setRegionId] = useState<string>(op?.regionId ?? (params.regionId as string) ?? openRegions[0]?.id);
  const [purpose, setPurpose] = useState<string>((params.purpose as string) ?? 'resource');
  const region = DATA.regions.find((r) => r.id === regionId);
  const [difficulty, setDifficulty] = useState(1);
  const [party, setParty] = useState<string[]>([]);
  useEffect(() => { tutorialSignal('party-full', party.length === size ? party : null); }, [party, size]);
  const toggle = (id: string) => setParty((p) => p.includes(id) ? p.filter((x) => x !== id) : p.length < size ? [...p, id] : p);

  return (
    <div className="screen" data-testid="screen-expeditionPrep">
      <ScreenHeader title={op ? '전략 작전 준비' : '개척 작전 준비'} code={op ? 'STRATEGIC OPERATION BRIEFING' : 'PIONEER OPERATION BRIEFING'} />
      <div className="screen-main">
        <Panel tut="prep-difficulty" title="01  침식 난이도" tail={<PlaceholderTag label="수치 미정" />} style={{ flex: 0.95 }} bodyClass="col scroll grow">
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
        <Panel tut="prep-party" title={`02  출전 부대원 선발 (${party.length}/${size})`} style={{ flex: 1.6 }} bodyClass="scroll grow">
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
        <Panel tut="prep-summary" title="03  작전 개요" style={{ flex: 0.9 }} bodyClass="col grow">
          {op ? (
            <div className="op-brief" data-testid="prep-op">
              <span className="row" style={{ gap: 8 }}><span className="op-diamond" /><b>전략 작전</b></span>
              <b style={{ fontSize: 'var(--fs-m)' }}>{op.name}</b>
              <span className="muted">주요 목표: {op.primary.label}</span>
              <span className="dim" style={{ fontSize: 'var(--fs-xs)' }}>지도 끝의 '작전 목표' 노드를 완료하고 귀환해야 성공합니다.</span>
            </div>
          ) : (
          <div className="col" style={{ gap: 6 }} data-testid="prep-region">
            <span className="dim" style={{ fontSize: 'var(--fs-xs)' }}>작전 지역 · 일반 원정</span>
            <div className="chip-row">{openRegions.map((r) => <button key={r.id} className={`sel-chip ${regionId === r.id ? 'on' : ''}`} onClick={() => setRegionId(r.id)} data-testid={`prep-region-${r.id}`}>{r.name}</button>)}</div>
            <div className="chip-row">{(region?.general.purposes ?? []).map((id) => <button key={id} className={`sel-chip ${purpose === id ? 'on' : ''}`} onClick={() => setPurpose(id)} data-testid={`prep-purpose-${id}`}>{DATA.generalPurposes.find((g) => g.id === id)?.name}</button>)}</div>
          </div>
          )}
          <dl className="kv">
            <dt>작전 지역</dt><dd data-testid="prep-region-name">{region?.name ?? '없음'}</dd>
            <dt>권장 난이도</dt><dd className="num">{region?.difficulty ?? '-'}</dd>
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
          <Button variant="primary" disabled={party.length !== size || !region} onClick={() => (op ? launchStrategicOp(op.id, difficulty, party) : launchExpedition(difficulty, party, { regionId, purpose, kind: 'general' }))} data-testid="btn-launch">{op ? '전략 작전 개시' : '작전 개시'}</Button>
        </Panel>
      </div>
    </div>
  );
}
