import { useState } from 'react';
import { useGame } from '../../core/gameStore';
import { act } from '../../core/actions';
import { charName, getCharacterDef } from '../../data';
import { GROWTH, equipSlots, expItems, expToNext, itemName, itemsHeld, levelCap, phaseDef, promoteAgent, promotionRequirements, raiseSkill, skillMax, trainAgent, trainingCost, traitState, unlockTrait, useExpItem } from '../../systems/growth';
import { Bar, Button, Notice, Panel, ScreenHeader, Tabs } from '../components/Common';
import { CharacterArt } from '../components/CharacterArt';
import { Icon } from '../components/Icon';
import { fmtInt } from '../format';

const UNDECIDED = <span className="dim">미정</span>;
const gradeClass = (g: string) => (g.startsWith('S') ? 'g-s' : g === 'A' ? 'g-a' : 'g-b');

export function SquadScreen() {
  const s = useGame((g) => g.state)!;
  const [sel, setSel] = useState(s.roster[0]?.charId);
  const [tab, setTab] = useState<'info' | 'growth' | 'story'>('info');
  const def = sel ? getCharacterDef(sel) : undefined;
  const c = s.roster.find((r) => r.charId === sel);

  return (
    <div className="screen" data-testid="screen-squad">
      <ScreenHeader title="개척부대" code="PIONEER CORPS ROSTER" tail={<>
        <div className="res-mini">
          {itemsHeld(s).map((i) => <span key={i.id} title={`${i.name}: ${i.use}`}><Icon name={i.icon} size={22} color="var(--warn)" /><b className="num" data-testid={`inv-${i.id}`}>{i.count}</b></span>)}
        </div>
        <span className="tag">보유 {s.roster.length}명</span>
      </>} />
      <div className="screen-main">
        <Panel title="부대원 목록" tut="squad-list" style={{ flex: 1.05 }} bodyClass="scroll grow">
          <div className="card-grid">
            {s.roster.map((r) => {
              const d = getCharacterDef(r.charId)!;
              return (
                <button key={r.charId} className={`char-card ${sel === r.charId ? 'sel' : ''}`} onClick={() => setSel(r.charId)} data-testid={`card-${r.charId}`} data-tut="char-card">
                  <CharacterArt def={d} zoom={2.1} className="char-card-art" />
                  <div className="char-card-info">
                    <b>{charName(d)}</b>
                    <span className="dim">{d.weapon ?? '—'} · Lv.{r.level}</span>
                  </div>
                  <span className="char-card-grade">P{r.phase}</span>
                </button>
              );
            })}
          </div>
        </Panel>
        {def && c && (
          <section className="char-detail panel" data-testid="char-detail" data-tut="char-detail">
            <CharacterArt def={def} className="char-full" />
            <div className="char-sheet">
              <div className="char-name-row">
                <div className="col" style={{ gap: 2 }}>
                  <span className="dim" style={{ fontSize: 'var(--fs-xs)', letterSpacing: '.18em' }}>{def.nameEn?.toUpperCase() ?? def.id}</span>
                  <h2 className="char-name" data-testid="char-name">{charName(def)}</h2>
                </div>
                <div className="col" style={{ gap: 6, alignItems: 'flex-end' }}>
                  <span className="tag accent" data-testid="char-phase">Phase {c.phase} · {phaseDef(c.phase).name}</span>
                  <span className="tag num" data-testid="char-level">전투 숙련도 Lv.{c.level} / {levelCap(c)}</span>
                </div>
              </div>
              <Tabs items={[{ id: 'info' as const, name: '기본 정보' }, { id: 'growth' as const, name: '육성 · 승급' }, { id: 'story' as const, name: '개인 기록' }]} value={tab} onChange={setTab} />
              <div className="scroll grow col" style={{ paddingTop: 16, gap: 18 }}>
                {tab === 'info' && <>
                  <dl className="kv">
                    <dt>출신</dt><dd>{def.origin ?? UNDECIDED}</dd>
                    <dt>전문 분야</dt><dd data-testid="char-specialty">{def.specialty ?? UNDECIDED}</dd>
                    <dt>무기</dt><dd>{def.weapon ?? UNDECIDED}</dd>
                    <dt>등급</dt><dd>{def.grade ?? UNDECIDED}</dd>
                  </dl>
                  <div className="col" style={{ gap: 8 }}>
                    <span className="dim" style={{ fontSize: 'var(--fs-xs)' }}>능력치 경향성</span>
                    <div className="tendencies">{def.tendencies?.map((t) => <span key={t.stat} className={`tend ${gradeClass(t.grade)}`}><b>{t.grade}</b>{t.stat}</span>)}</div>
                  </div>
                  {def.skill && (
                    <div className="skill-box">
                      <div className="row"><b className="grow">{def.skill.name}</b><span className="tag">스킬 Lv.{c.skillLevel} / {skillMax(c)}</span></div>
                      <span className="muted">{def.skill.desc}</span>
                      <span className="dim" style={{ fontSize: 18 }}>수치 효과는 PHASE 7(전투)에서 정합니다.</span>
                    </div>
                  )}
                  <dl className="kv"><dt>수치 능력치 (HP·공격력 등)</dt><dd>{UNDECIDED}</dd><dt>기본 공격</dt><dd>{UNDECIDED}</dd></dl>
                </>}
                {tab === 'growth' && <Growth charId={c.charId} />}
                {tab === 'story' && <p className="muted" style={{ margin: 0 }}>{def.story ?? '개인 스토리는 아직 정해지지 않았습니다.'}</p>}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Growth({ charId }: { charId: string }) {
  const s = useGame((g) => g.state)!;
  const c = s.roster.find((r) => r.charId === charId)!;
  const next = GROWTH.phases[c.phase];
  const reqs = promotionRequirements(s, c);
  const cap = levelCap(c);
  return (
    <>
      <div className="grow-sec">
        <div className="row"><b className="grow">전투 숙련도</b><span className="num">Lv.{c.level} / {cap}{c.level < cap ? ` · EXP ${c.exp} / ${expToNext(c.level)}` : ' · 상한'}</span></div>
        <Bar value={c.level < cap ? c.exp : 1} max={c.level < cap ? expToNext(c.level) : 1} />
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          {Object.entries(expItems).map(([it, amount]) => (
            <Button key={it} small disabled={(s.inventory[it] ?? 0) < 1 || c.level >= cap} onClick={() => act((st) => useExpItem(st, charId, it))} data-testid={`btn-exp-${it}`}>
              {itemName(it)} 사용<span className="btn-sub">EXP +{amount} · 보유 {s.inventory[it] ?? 0}</span>
            </Button>
          ))}
          <Button small disabled={c.level >= cap} onClick={() => act((st) => trainAgent(st, charId))} data-testid="btn-train">
            기본 훈련 (임시)<span className="btn-sub">예산 {fmtInt(trainingCost().budget)} · EXP +{GROWTH.training.exp}</span>
          </Button>
        </div>
        <span className="dim" style={{ fontSize: 18 }}>작전 경력서·실무 훈장은 원정 보상입니다(PHASE 8). 그 전까지는 임시 훈련으로 경험치를 얻습니다.</span>
      </div>

      <div className="grow-sec">
        <div className="row"><b className="grow">고유 스킬 심화</b><span className="num">Lv.{c.skillLevel} / {skillMax(c)} · 인사 공적 {c.merit}</span></div>
        <Button small disabled={c.skillLevel >= skillMax(c) || c.merit < GROWTH.skillLevelMeritCost} onClick={() => act((st) => raiseSkill(st, charId), '스킬 레벨이 올랐습니다.')} data-testid="btn-skill">
          스킬 레벨 올리기<span className="btn-sub">인사 공적 {GROWTH.skillLevelMeritCost}</span>
        </Button>
      </div>

      <div className="grow-sec">
        <b>특성</b>
        <div className="trait-row">
          {GROWTH.traitSlots.map((t) => {
            const st = traitState(c, t.id); const u = t.unlock as { merit?: number; phase?: number };
            return (
              <div key={t.id} className={`trait ${st}`} data-testid={`trait-${t.id}`}>
                <b>{t.name}</b>
                <span className="dim">내용 미정</span>
                {st === 'unlocked' ? <span className="tag accent">해금됨</span>
                  : st === 'locked' ? <span className="tag">{phaseDef(u.phase!).name} 필요</span>
                  : <Button small onClick={() => act((x) => unlockTrait(x, charId, t.id), `${t.name}을(를) 해금했습니다.`)} data-testid={`btn-trait-${t.id}`}>해금{u.merit ? <span className="btn-sub">인사 공적 {u.merit}</span> : null}</Button>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grow-sec">
        <div className="row"><b className="grow">전문가 등급 승급</b><span className="tag">장비 슬롯 {equipSlots(c)}</span></div>
        <div className="phase-track">
          {GROWTH.phases.map((p) => <div key={p.phase} className={`ph ${c.phase >= p.phase ? 'on' : ''}`}><b>Phase {p.phase}</b><span>{p.name}</span></div>)}
        </div>
        {next ? <>
          <span className="muted">다음: {next.name} — {next.unlocks.join(', ')}</span>
          <ul className="reqs" data-testid="promo-reqs">{reqs.map((r) => <li key={r.label} className={r.met ? 'met' : ''}>{r.met ? '✓' : '·'} {r.label}</li>)}</ul>
          <Button variant="primary" disabled={reqs.some((r) => !r.met)} onClick={() => act((st) => promoteAgent(st, charId), `${next.name}(으)로 승급했습니다.`)} data-testid="btn-promote">승급</Button>
        </> : <span className="tag accent">최고 등급</span>}
      </div>
      <Notice>승급 구조·재화·효과는 확정안 기준입니다. 레벨 상한, 스킬 최대치, 필요 수량 등 숫자는 임시값입니다.</Notice>
    </>
  );
}
