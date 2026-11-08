import { useState } from 'react';
import { useRouter } from '../../core/router';
import { useGame } from '../../core/gameStore';
import { DATA, getOp, getRegion } from '../../data';
import type { GameState, RegionDef } from '../../core/types';
import { canRunGeneral, checklist, followUpRegions, opStatus, type OpStatus } from '../../systems/regions';
import { Button, Panel, PlaceholderTag, ScreenHeader } from '../components/Common';
import { Icon } from '../components/Icon';
import { costText } from '../format';

const TYPE_ICON: Record<string, string> = { industrial: 'parts', research: 'research', residential: 'population', energy: 'power', military: 'defense' };
const STATE_CLS = ['', 's1', 's2', 's3', 's4', 's5'];
const OP_LABEL: Record<OpStatus, string> = { completed: '작전 완료', available: '개시 가능', blocked: '조건 미충족', locked: '지역 미해금' };
const RES = Object.fromEntries(DATA.resources.map((r) => [r.id, r.name]));
const ITEMS = Object.fromEntries(DATA.items.map((i) => [i.id, i.name]));
const stateName = (n: number) => DATA.regionStates.find((x) => x.id === n)?.name ?? '';
const BASE: [number, number] = [7, 88];

function badges(s: GameState, r: RegionDef) {
  const p = s.regions[r.id];
  const general = p.unlocked && canRunGeneral(s, r.id).length === 0;
  const ops = r.strategicOps.map((o) => opStatus(s, o));
  return { general, opOpen: ops.includes('available'), opsDone: ops.filter((o) => o === 'completed').length, opsTotal: ops.length };
}

export function RegionMapScreen() {
  const s = useGame((g) => g.state)!;
  const [sel, setSel] = useState<string>(DATA.regions.find((r) => s.regions[r.id]?.unlocked)?.id ?? DATA.regions[0].id);
  const region = getRegion(sel)!;
  const controlled = DATA.regions.filter((r) => s.regions[r.id].state >= 4).length;

  return (
    <div className="screen" data-testid="screen-regionMap">
      <ScreenHeader title="외부 오염권 전략 지도" code="OUTER CONTAMINATION ZONE · STRATEGIC MAP"
        tail={<><PlaceholderTag label="지역 구성 임시" /><span className="tag accent" data-testid="controlled-count">통제 지역 {controlled} / {DATA.regions.length}</span></>} />
      <div className="screen-main">
        <section className="panel strat-map grow" style={{ flex: 1.55 }} data-testid="strat-map">
          <svg className="strat-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
            {DATA.regions.filter((r) => r.initiallyUnlocked).map((r) => (
              <line key={`base-${r.id}`} x1={BASE[0]} y1={BASE[1]} x2={r.pos[0]} y2={r.pos[1]} className="route open" />
            ))}
            {DATA.regions.flatMap((r) => r.connections.filter((c) => c > r.id).map((c) => {
              const o = getRegion(c)!; const open = s.regions[r.id].unlocked && s.regions[c].unlocked;
              return <line key={`${r.id}-${c}`} x1={r.pos[0]} y1={r.pos[1]} x2={o.pos[0]} y2={o.pos[1]} className={`route ${open ? 'open' : ''}`} />;
            }))}
          </svg>
          <div className="strat-base" style={{ left: `${BASE[0]}%`, top: `${BASE[1]}%` }}><span className="emblem" /><b>행정 구역</b></div>
          {DATA.regions.map((r) => {
            const p = s.regions[r.id]; const bd = badges(s, r);
            return (
              <button key={r.id} className={`region-node ${STATE_CLS[p.state]} ${p.unlocked ? '' : 'locked'} ${sel === r.id ? 'sel' : ''}`}
                style={{ left: `${r.pos[0]}%`, top: `${r.pos[1]}%` }} onClick={() => setSel(r.id)} data-testid={`region-${r.id}`} data-state={p.state} data-unlocked={p.unlocked}>
                <span className="rn-mark">{p.unlocked ? (p.state === 1 ? '?' : <Icon name={TYPE_ICON[r.type]} size={34} />) : <Icon name="node-boss" size={28} />}</span>
                <span className="rn-label"><b>{r.name}</b><span>{p.unlocked ? stateName(p.state) : '해금 조건 미충족'}</span></span>
                <span className="rn-badges">
                  {bd.general && <i className="b-gen" title="일반 원정 가능">원정</i>}
                  {bd.opOpen && <i className="b-op" title="전략 작전 개시 가능">작전</i>}
                  {bd.opsDone > 0 && <i className="b-done" title="완료한 전략 작전">{bd.opsDone}/{bd.opsTotal}</i>}
                </span>
              </button>
            );
          })}
          <div className="strat-legend">
            {DATA.regionStates.map((st) => <span key={st.id}><i className={`lg ${STATE_CLS[st.id]}`} />{st.name}</span>)}
            <span><i className="lg locked" />해금 조건 미충족</span>
            <span><i className="b-gen">원정</i>일반 원정 가능</span>
            <span><i className="b-op">작전</i>전략 작전 개시 가능</span>
          </div>
        </section>
        <RegionDetail key={region.id} s={s} r={region} />
      </div>
    </div>
  );
}

function RegionDetail({ s, r }: { s: GameState; r: RegionDef }) {
  const go = useRouter((x) => x.go);
  const p = s.regions[r.id];
  const type = DATA.regionTypes.find((t) => t.id === r.type)!;
  const generalWhy = canRunGeneral(s, r.id);
  const [purpose, setPurpose] = useState(r.general.purposes[0]);
  const follow = followUpRegions(r.id);
  return (
    <aside className="col scroll region-detail" style={{ flex: 1, minWidth: 0 }} data-testid="region-detail">
      <Panel title="지역 정보" bodyClass="col">
        <div className="row"><Icon name={TYPE_ICON[r.type]} size={44} color="var(--accent)" /><div className="col grow" style={{ gap: 0 }}><h2 className="h2" data-testid="region-name">{r.name}</h2><span className="dim">{type.name} · {type.feature}</span></div></div>
        <div className="state-track" data-testid="state-track">
          {DATA.regionStates.map((st) => <div key={st.id} className={`st ${p.state >= st.id ? 'on' : ''} ${p.state === st.id ? 'cur' : ''}`}><b>{st.id}</b><span>{st.name}</span></div>)}
        </div>
        <p className="muted" style={{ margin: 0 }}>{r.description}</p>
        <dl className="kv">
          <dt>개발 가능성</dt><dd>{type.develop}</dd>
          <dt>권장 침식 난이도</dt><dd className="num">{r.difficulty}</dd>
          <dt>연결 지역</dt><dd>{r.connections.map((c) => getRegion(c)?.name).join(', ')}</dd>
          <dt>후속 지역</dt><dd>{follow.length ? follow.map((c) => getRegion(c)?.name).join(', ') : '없음'}</dd>
        </dl>
        {p.state >= 4 && <Button variant="primary" onClick={() => go('regionManage', { regionId: r.id })} data-testid="btn-region-manage">지역 관리 · 개발</Button>}
        {!p.unlocked && (
          <div className="col" style={{ gap: 6 }} data-testid="unlock-conditions">
            <b>해금 조건</b>
            <ul className="reqs">{checklist(s, r.unlock, r.id).map((c) => <li key={c.label} className={c.met ? 'met' : ''}>{c.met ? '✓' : '·'} {c.label}</li>)}</ul>
          </div>
        )}
      </Panel>

      <section className="panel op-general" data-testid="general-section">
        <header className="panel-head"><Icon name="expedition" size={22} color="var(--accent)" />일반 원정<span className="tag accent" style={{ marginLeft: 'auto' }}>반복 가능</span></header>
        <div className="panel-body col">
          <span className="dim" style={{ fontSize: 'var(--fs-xs)' }}>반복해도 지역 통제권이나 영토는 늘어나지 않습니다.</span>
          <div className="purpose-list">{r.general.purposes.map((id) => { const g = DATA.generalPurposes.find((x) => x.id === id)!; return <button key={id} className={`purpose ${purpose === id ? 'on' : ''}`} onClick={() => setPurpose(id)} data-testid={`purpose-${id}`}><b>{g.name}</b><span className="dim">{g.focus}</span></button>; })}</div>
          <dl className="kv">
            <dt>예상 위험</dt><dd>침식 난이도 {r.difficulty} 수준</dd>
            <dt>이전 탐사 기록</dt><dd className="num" data-testid="general-record">출격 {p.generalRuns}회 · 완수 {p.generalClears}회</dd>
          </dl>
          {generalWhy.length ? <span className="neg" style={{ fontSize: 'var(--fs-xs)' }}>{generalWhy.join(' ')}</span> : null}
          <Button variant="primary" disabled={generalWhy.length > 0 || !!s.expedition} onClick={() => go('expeditionPrep', { regionId: r.id, purpose })} data-testid="btn-general-sortie">
            {s.expedition ? '진행 중인 원정이 있습니다' : '일반 원정 출격'}
          </Button>
        </div>
      </section>

      {r.strategicOps.map((id) => {
        const op = getOp(id)!; const st = opStatus(s, id); const rec = s.strategicOps[id];
        return (
          <section key={id} className={`panel op-strategic ${st}`} data-testid={`op-${id}`}>
            <header className="panel-head"><span className="op-diamond" />전략 작전<span className={`tag ${st === 'completed' ? 'accent' : st === 'available' ? 'warn' : ''}`} style={{ marginLeft: 'auto' }} data-testid={`op-status-${id}`}>{OP_LABEL[st]}</span></header>
            <div className="panel-body col">
              <b style={{ fontSize: 'var(--fs-m)' }}>{op.name}</b>
              <span className="muted">{op.description}</span>
              <dl className="kv">
                <dt>주요 목표</dt><dd>{op.primary.label}</dd>
                {op.optional.length > 0 && <><dt>부가 목표</dt><dd>{op.optional.map((o) => o.label).join(', ')}</dd></>}
                <dt>성공 조건</dt><dd>목표 달성 후 귀환</dd>
                <dt>확보 결과</dt><dd>{op.grantsControl ? '지역 통제권 확보' : stateName(op.grantsState)}</dd>
                <dt>성공 보상</dt><dd>{[costText(op.rewards.resources, RES), costText(op.rewards.items, ITEMS)].filter(Boolean).join(' · ') || '없음'}</dd>
                {op.grantsControl && <><dt>후속 지역 해금</dt><dd>{follow.length ? follow.map((c) => getRegion(c)?.name).join(', ') : '없음'}</dd></>}
                <dt>작전 기록</dt><dd className="num">시도 {rec?.attempts ?? 0}회{rec?.completedAt != null ? ' · 완료' : ''}</dd>
              </dl>
              {st !== 'completed' && (
                <ul className="reqs" data-testid={`op-reqs-${id}`}>
                  {checklist(s, op.requires, op.regionId).map((c) => <li key={c.label} className={c.met ? 'met' : ''}>{c.met ? '✓' : '·'} {c.label}</li>)}
                  {op.prereqOps.map((po) => { const met = s.strategicOps[po]?.rewardGranted; return <li key={po} className={met ? 'met' : ''}>{met ? '✓' : '·'} 선행 작전: {getOp(po)?.name}</li>; })}
                </ul>
              )}
              {st === 'completed'
                ? <span className="tag accent">완료 · 보상 지급됨 (중복 지급 없음)</span>
                : <Button variant="primary" className="op-launch" disabled={st !== 'available' || !!s.expedition} onClick={() => go('expeditionPrep', { opId: id })} data-testid={`btn-op-${id}`}>{s.expedition ? '진행 중인 원정이 있습니다' : '작전 개시'}</Button>}
            </div>
          </section>
        );
      })}
    </aside>
  );
}
