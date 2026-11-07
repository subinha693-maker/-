import { useMemo, useState } from 'react';
import { useGame } from '../../core/gameStore';
import { DATA } from '../../data';
import { Button, Notice, Panel, PlaceholderTag, ScreenHeader, Tabs } from '../components/Common';

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
  const status = (id: string) => s.research.completed.includes(id) ? 'done' : s.research.active === id ? 'active' : DATA.researchNodes.find((n) => n.id === id)!.prereq.every((p) => s.research.completed.includes(p)) ? 'open' : 'locked';
  const LABEL = { done: '완료', active: '진행 중', open: '연구 가능', locked: '선행 연구 필요' };

  return (
    <div className="screen" data-testid="screen-research">
      <ScreenHeader title="연구 개발" code="RESEARCH & DEVELOPMENT" tail={<span className="tag">진행 중: {s.research.active ?? '없음'}</span>} />
      <div className="screen-main">
        <Panel title="연구 트리" tail={<PlaceholderTag label="연구 항목 임시" />} className="grow" style={{ flex: 2 }} bodyClass="col grow">
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
                  <span className="st">{LABEL[st]}</span>
                </button>
              );
            })}
          </div>
        </Panel>
        <Panel title="연구 정보" style={{ flex: 1 }} bodyClass="col">
          {node ? (<>
            <h2 className="h2">{node.name}</h2>
            <dl className="kv">
              <dt>분야</dt><dd>{DATA.researchFields.find((f) => f.id === node.field)?.name}</dd>
              <dt>단계</dt><dd>T{node.tier}</dd>
              <dt>상태</dt><dd>{LABEL[status(node.id)]}</dd>
              <dt>필요 자원</dt><dd className="dim">미정</dd>
              <dt>소요 시간</dt><dd className="dim">미정</dd>
              <dt>해금</dt><dd className="dim">{node.unlocks.length ? node.unlocks.map((u) => u.id).join(', ') : '미정'}</dd>
            </dl>
            <Button variant="primary" pendingPhase={4}>연구 시작</Button>
          </>) : <div className="empty">연구 항목을 선택하세요.</div>}
          <Notice>연구 항목, 비용, 해금 내용은 아직 정해지지 않았습니다. 분야 6개는 확정입니다.</Notice>
        </Panel>
      </div>
    </div>
  );
}
