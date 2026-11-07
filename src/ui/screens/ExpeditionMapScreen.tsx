import { useState } from 'react';
import { useRouter } from '../../core/router';
import { useGame } from '../../core/gameStore';
import { enterBattle } from '../../core/session';
import { DATA, charName, getCharacterDef, getNodeType } from '../../data';
import { Button, Notice, Panel, PlaceholderTag, ScreenHeader } from '../components/Common';
import { Icon } from '../components/Icon';
import { CharacterArt } from '../components/CharacterArt';

const COMBAT = ['combat', 'elite', 'boss'];

export function ExpeditionMapScreen() {
  const { params, go, replace } = useRouter();
  const ex = useGame((g) => g.state?.expedition);
  // Real expeditions live in the game state; the dev screen index passes a preview party instead.
  const party = ex?.members ?? (params.party as string[] | undefined) ?? [];
  const difficulty = ex?.difficulty ?? (params.difficulty as number | undefined) ?? 1;
  const [sel, setSel] = useState<string | null>(null);
  const map = DATA.sampleMap;
  const maxRows = Math.max(...map.columns.map((c) => c.length));
  const pos = new Map<string, { x: number; y: number; type: string }>();
  // Positions in percent of the map area so the graph fits any stage width (desktop or phone).
  const nCols = map.columns.length;
  map.columns.forEach((col, ci) => col.forEach((n, ri) => {
    pos.set(n.id, { x: 7 + (ci / (nCols - 1)) * 86, y: 12 + ((ri + (maxRows - col.length) / 2 + 0.5) / maxRows) * 72, type: n.type });
  }));
  const reachable = new Set(['n0']); // Phase 6 will compute this from the current position.
  const node = sel ? pos.get(sel) : undefined;
  const nt = node && getNodeType(node.type);

  return (
    <div className="screen" data-testid="screen-expeditionMap">
      <ScreenHeader title="외부 오염권 · 원정 지도" code={`EXPEDITION MAP · 침식 난이도 ${difficulty}`}
        tail={<><PlaceholderTag label="샘플 지도" /><Button small onClick={() => go('saveLoad', { mode: 'save' })} data-testid="btn-map-save">저장</Button><Button small variant="danger" onClick={() => replace('result', { outcome: 'return' })} data-testid="btn-return">원정 종료 · 귀환</Button></>} />
      <div className="screen-main">
        <section className="panel map-area grow" style={{ flex: 2.4 }}>
          <svg className="map-lines" width="100%" height="100%">
            {map.edges.map(([a, b]) => {
              const p = pos.get(a)!, q = pos.get(b)!;
              return <line key={a + b} x1={`${p.x}%`} y1={`${p.y}%`} x2={`${q.x}%`} y2={`${q.y}%`} />;
            })}
          </svg>
          <div className="map-start" style={{ left: `${pos.get('n0')!.x}%`, top: `${pos.get('n0')!.y}%` }}>진입 지점</div>
          {[...pos.entries()].map(([id, p]) => {
            const t = getNodeType(p.type)!;
            return (
              <button key={id} className={`map-node t-${p.type} ${reachable.has(id) ? 'reach' : ''} ${sel === id ? 'sel' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} onClick={() => setSel(id)} aria-label={t.name} data-testid={`node-${id}`}>
                <Icon name={t.icon} size={50} />
              </button>
            );
          })}
          <div className="map-legend">
            {DATA.nodeTypes.map((t) => <span key={t.id}><Icon name={t.icon} size={22} />{t.name}</span>)}
          </div>
        </section>
        <aside className="col" style={{ flex: 1, minWidth: 0 }}>
          <Panel title="노드 정보" bodyClass="col">
            {nt && sel ? (<>
              <div className="row"><Icon name={nt.icon} size={48} color="var(--accent)" /><h2 className="h2 grow">{nt.name}</h2></div>
              <span className="dim">{reachable.has(sel) ? '이동 가능한 노드입니다.' : '현재 위치에서 연결되지 않았습니다.'}</span>
              {COMBAT.includes(node!.type)
                ? <Button variant="primary" disabled={!reachable.has(sel)} onClick={() => enterBattle(sel)} data-testid="btn-enter">진입</Button>
                : <Button pendingPhase={6}>진입</Button>}
            </>) : <div className="empty">노드를 선택하세요.</div>}
          </Panel>
          <Panel title={`원정 부대 (${party.length})`} bodyClass="col">
            {party.map((id) => {
              const d = getCharacterDef(id)!;
              return <div key={id} className="row party-mini"><CharacterArt def={d} zoom={2.3} className="mini-art" /><span className="grow">{charName(d)}</span><span className="dim">HP —</span></div>;
            })}
            {!party.length && <span className="dim">출전 부대원 없음 (미리보기)</span>}
          </Panel>
          <Panel title="보유 유물" bodyClass="col"><div className="empty" style={{ padding: 20 }}>획득한 유물 없음</div></Panel>
          <Notice>노드 생성·이동·이벤트는 PHASE 6에서 구현합니다.</Notice>
        </aside>
      </div>
    </div>
  );
}
