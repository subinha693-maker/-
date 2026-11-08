import { useMemo, useState } from 'react';
import { useGame } from '../../core/gameStore';
import { DATA } from '../../data';
import { Bar, Button, Notice, Panel, PlaceholderTag, ScreenHeader, Tabs } from '../components/Common';
import { act } from '../../core/actions';
import { getResearch, getFacilityDef } from '../../data';
import { missingCost, researchStatus, startResearch } from '../../systems/government';
import { useEconomy } from '../useEconomy';
import { ResourceMini } from '../components/ResourceMini';
import { costText, fmtHours } from '../format';

const RES_NAMES = Object.fromEntries(DATA.resources.map((r) => [r.id, r.name]));

const COL_W = 360, ROW_H = 150, NODE_W = 290, NODE_H = 96;

export function ResearchScreen() {
  const s = useGame((g) => g.state)!;
  const [field, setField] = useState(DATA.researchFields[0].id);
  const nodes = DATA.researchNodes.filter((n) => n.field === field);
  const [sel, setSel] = useState<string | null>(null);

  // Layout: column = tier, row = order within tier.
  const pos = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    const rows: Record<number, number> = {};
    for (const n of nodes) { const r = rows[n.tier] ?? 0; rows[n.tier] = r + 1; m.set(n.id, { x: 30 + (n.tier - 1) * COL_W, y: 30 + r * ROW_H }); }
    return m;
  }, [nodes]);
  const node = nodes.find((n) => n.id === sel);
  const eco = useEconomy()!;
  const status = (id: string) => researchStatus(s, id);
  const active = s.research.active ? getResearch(s.research.active) : undefined;
  const remainingMin = active && eco.researchRate > 0 ? ((1 - s.research.progress) * active.hours * 60) / eco.researchRate : null;
  const LABEL = { done: '완료', active: '진행 중', open: '연구 가능', locked: '선행 연구 필요' };

  return (
    <div className="screen" data-testid="screen-research">
      <ScreenHeader title="연구 개발" code="RESEARCH & DEVELOPMENT" tail={<><ResourceMini ids={['data', 'budget', 'biosample']} /><span className="tag" data-testid="research-active">진행 중: {active?.name ?? '없음'}{active ? ` · ${Math.floor(s.research.progress * 100)}%` : ''}</span></>} />
      <div className="screen-main">
        <Panel title="연구 트리" tut="research-tree" tail={<PlaceholderTag label="연구 항목 임시" />} className="grow" style={{ flex: 2 }} bodyClass="col grow">
          <Tabs items={DATA.researchFields} value={field} onChange={(v) => { setField(v); setSel(null); }} />
          <div className="tree scroll grow">
            <svg className="tree-lines" width={4 * COL_W} height={4 * ROW_H}>
              {nodes.flatMap((n) => n.prereq.map((p) => {
                const a = pos.get(p), b = pos.get(n.id);
                if (!a || !b) return null;
                const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y + NODE_H / 2, mx = (x1 + x2) / 2;
                return <path key={p + n.id} d={`M${x1},${y1} H${mx} V${y2} H${x2}`} />;
              }))}
            </svg>
            {nodes.map((n) => {
              const p = pos.get(n.id)!; const st = status(n.id);
              return (
                <button key={n.id} className={`tree-node ${st} ${sel === n.id ? 'sel' : ''}`} style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }} onClick={() => setSel(n.id)} data-testid={`rnode-${n.id}`}>
                  <span className="tier">T{n.tier}</span>
                  <b>{n.name}</b>
                  <span className="st">{LABEL[st]}{st === 'active' ? ` ${Math.floor(s.research.progress * 100)}%` : ''}</span>
                  {st === 'active' && <i className="tree-prog" style={{ width: `${s.research.progress * 100}%` }} />}
                </button>
              );
            })}
          </div>
        </Panel>
        <Panel title="연구 정보" tut="research-info" style={{ flex: 1 }} bodyClass="col">
          {node ? (<>
            <h2 className="h2">{node.name}</h2>
            <dl className="kv">
              <dt>분야</dt><dd>{DATA.researchFields.find((f) => f.id === node.field)?.name}</dd>
              <dt>단계</dt><dd>T{node.tier}</dd>
              <dt>상태</dt><dd>{LABEL[status(node.id)]}</dd>
              <dt>필요 자원</dt><dd className={missingCost(s, node.cost).length && status(node.id) === 'open' ? 'neg' : ''}>{costText(node.cost, RES_NAMES)}</dd>
              <dt>기준 소요 시간</dt><dd>{fmtHours(node.hours * 60)} <span className="dim">(연구 속도 1 기준)</span></dd>
              <dt>해금</dt><dd>{node.unlocks.length ? node.unlocks.map((u) => (u.type === 'facility' ? `시설: ${getFacilityDef(u.id)?.name}` : u.id)).join(', ') : <span className="dim">미정</span>}</dd>
            </dl>
            {status(node.id) === 'active' && (
              <div className="job">
                <div className="row"><b className="grow">진행 중 {Math.floor(s.research.progress * 100)}%</b><span className="num">{remainingMin !== null ? `남은 시간 약 ${fmtHours(remainingMin)}` : '연구 정지'}</span></div>
                <Bar value={s.research.progress} max={1} />
              </div>
            )}
            <Button variant="primary" disabled={status(node.id) !== 'open' || !!s.research.active || missingCost(s, node.cost).length > 0} onClick={() => act((st) => startResearch(st, node.id), `연구 '${node.name}'을(를) 시작했습니다.`)} data-testid="btn-research">
              {status(node.id) === 'done' ? '완료한 연구' : status(node.id) === 'locked' ? '선행 연구 필요' : s.research.active ? (status(node.id) === 'active' ? '진행 중' : '다른 연구 진행 중') : missingCost(s, node.cost).length ? `자원 부족: ${missingCost(s, node.cost).join(', ')}` : '연구 시작'}
            </Button>
          </>) : <div className="empty">연구 항목을 선택하세요.</div>}
          <dl className="kv"><dt>현재 연구 속도</dt><dd className="num" data-testid="research-rate">{eco.researchRate.toFixed(2)}</dd></dl>
          <Notice>연구 항목, 비용, 해금 내용은 임시입니다. 분야 6개는 확정입니다. 연구 속도는 가동 중인 연구 시설에서 나옵니다.</Notice>
        </Panel>
      </div>
    </div>
  );
}
