import { useState } from 'react';
import { useRouter } from '../../core/router';
import { useGame } from '../../core/gameStore';
import { enterBattle, enterExpeditionNode, goDeeperExpedition } from '../../core/session';
import { activeSynergies } from '../../systems/battle';
import { DATA, charName, getCharacterDef, getNodeType, getOp, getRelic } from '../../data';
import type { ExpeditionMap } from '../../core/types';
import { columnOf, effectiveDifficulty, isCleared, isCombat, nodeOf, party, reachable } from '../../systems/expedition';
import { Bar, Button, ConfirmDialog, Panel, PlaceholderTag, ScreenHeader } from '../components/Common';
import { Icon } from '../components/Icon';
import { CharacterArt } from '../components/CharacterArt';
import { NodeEvent, relicFx } from '../components/NodeEvent';
import { costText } from '../format';

const RES = Object.fromEntries(DATA.resources.map((r) => [r.id, r.name]));

/** Lays out columns left->right; positions are percentages so any stage width works. */
function layout(map: ExpeditionMap) {
  const maxRows = Math.max(...map.columns.map((c) => c.length));
  const n = map.columns.length;
  const pos = new Map<string, { x: number; y: number; type: string }>();
  map.columns.forEach((col, ci) => col.forEach((node, ri) => {
    pos.set(node.id, { x: 6 + (ci / Math.max(1, n - 1)) * 88, y: 12 + ((ri + (maxRows - col.length) / 2 + 0.5) / maxRows) * 70, type: node.type });
  }));
  return pos;
}

export function ExpeditionMapScreen() {
  const { params, go, replace } = useRouter();
  const ex = useGame((g) => g.state?.expedition);
  const training = !!params.training || !ex; // tutorial practice map / dev preview: no expedition state
  const map: ExpeditionMap = training ? DATA.sampleMap : ex!.map;
  const members = training ? ((params.party as string[] | undefined) ?? []) : party(ex!);
  const difficulty = ex?.difficulty ?? (params.difficulty as number | undefined) ?? 1;
  const [sel, setSel] = useState<string | null>(null);
  const op = ex?.opId ? getOp(ex.opId) : undefined;
  const opRec = useGame((g) => (ex?.opId ? g.state?.strategicOps[ex.opId] : undefined));
  const [quit, setQuit] = useState(false);
  const pos = layout(map);
  const reach = new Set(training ? [map.columns[0][0].id] : reachable(ex!));
  const done = new Set(training ? [] : ex!.path);
  const node = sel ? nodeOf(map, sel) : undefined;
  const nt = node && getNodeType(node.type);
  const cleared = !training && isCleared(ex!);

  const enter = () => {
    if (!node) return;
    if (training) { go('battle', { training: true, party: members }); return; }
    if (isCombat(node.type)) void enterBattle(node.id);
    else if (enterExpeditionNode(node.id)) setSel(null);
  };

  return (
    <div className="screen" data-testid="screen-expeditionMap">
      <ScreenHeader title={op ? `전략 작전 · ${op.name}` : '외부 오염권 · 원정 지도'} code={`EXPEDITION MAP · 침식 난이도 ${difficulty}${ex && ex.depth > 0 ? ` · 심층 ${ex.depth}단계 (실효 난이도 ${effectiveDifficulty(ex)})` : ''}${ex ? ` · ${DATA.regions.find((r) => r.id === ex.regionId)?.name}${ex.kind === 'general' ? ` · ${DATA.generalPurposes.find((g) => g.id === ex.purpose)?.name}` : ''}` : ''}`} onBack={() => replace('main')}
        tail={training ? <span className="tag accent">훈련 · 튜토리얼</span> : <>
          <PlaceholderTag label="노드 구성·수치 임시" />
          <Button small onClick={() => go('saveLoad', { mode: 'save' })} data-testid="btn-map-save">저장</Button>
          <Button small variant="danger" onClick={() => setQuit(true)} data-testid="btn-return">작전 중단 · 귀환</Button>
        </>} />
      <div className="screen-main">
        <section className="panel map-area grow" style={{ flex: 2.4 }} data-tut="map-area">
          <svg className="map-lines" width="100%" height="100%">
            {map.edges.map(([a, b]) => {
              const p = pos.get(a)!, q = pos.get(b)!;
              const walked = done.has(a) && done.has(b);
              const next = (ex?.currentNode === a || (!ex?.currentNode && false)) && reach.has(b);
              return <line key={a + b} className={walked ? 'walked' : next ? 'next' : ''} x1={`${p.x}%`} y1={`${p.y}%`} x2={`${q.x}%`} y2={`${q.y}%`} />;
            })}
          </svg>
          <div className="map-start" style={{ left: `${pos.get(map.columns[0][0].id)!.x}%`, top: `${pos.get(map.columns[0][0].id)!.y}%` }}>진입 지점</div>
          {[...pos.entries()].map(([id, p]) => {
            const t = getNodeType(p.type)!;
            const cls = [`map-node t-${p.type}`, reach.has(id) && 'reach', done.has(id) && 'done', ex?.currentNode === id && 'here', sel === id && 'sel'].filter(Boolean).join(' ');
            return (
              <button key={id} className={cls} style={{ left: `${p.x}%`, top: `${p.y}%` }} onClick={() => setSel(id)} aria-label={t.name} data-testid={`node-${id}`} data-tut={`node-${id}`} data-type={p.type}>
                <Icon name={t.icon} size={44} />
              </button>
            );
          })}
          <div className="map-legend" data-tut="map-legend">
            {DATA.nodeTypes.map((t) => <span key={t.id}><Icon name={t.icon} size={22} />{t.name}</span>)}
          </div>
          {cleared && (
            <div className="map-clear" data-testid="map-cleared">
              <b>모든 노드를 완료했습니다{ex!.depth > 0 ? ` · 심층 ${ex!.depth}단계` : ''}</b>
              <span className="dim" style={{ fontSize: 'var(--fs-xs)' }}>심층 원정은 부대·유물·강화 상태·획득물을 유지한 채 더 위험한 지역으로 이어집니다. 실패하면 정산이 줄어듭니다.</span>
              <div className="row" style={{ gap: 12 }}>
                <Button variant="primary" onClick={() => replace('result', { outcome: 'victory' })} data-testid="btn-clear-return">원정 종료 · 기지 귀환</Button>
                <Button onClick={goDeeperExpedition} data-testid="btn-deeper">심층 원정 도전{ex!.depth > 0 ? ` (${ex!.depth + 1}단계)` : ''}</Button>
              </div>
            </div>
          )}
        </section>
        <aside className="col scroll map-side" style={{ flex: 1, minWidth: 0 }}>
          {op && (
            <section className="panel op-strategic" data-testid="op-objective-panel">
              <header className="panel-head"><span className="op-diamond" />작전 목표<span className={`tag ${opRec?.objectiveAchieved ? 'accent' : 'warn'}`} style={{ marginLeft: 'auto' }} data-testid="op-objective-state">{opRec?.objectiveAchieved ? '목표 달성 · 귀환 필요' : '미달성'}</span></header>
              <div className="panel-body col">
                <b>{op.primary.label}</b>
                {op.optional.map((o) => <span key={o.id} className="dim">부가 목표: {o.label} (판정 기준 미정)</span>)}
                <span className="dim" style={{ fontSize: 'var(--fs-xs)' }}>목표 달성 후 귀환해야 {op.grantsControl ? '통제권을' : '전진 거점을'} 확보합니다.</span>
              </div>
            </section>
          )}
          <Panel title="노드 정보" bodyClass="col">
            {nt && sel ? (<>
              <div className="row"><Icon name={nt.icon} size={44} color="var(--accent)" /><h2 className="h2 grow">{nt.name}</h2></div>
              {node?.type === 'objective' && op && <span className="tag warn" style={{ height: 'auto', whiteSpace: 'normal', padding: 6 }}>{op.primary.label}</span>}
              <span className="dim">{done.has(sel) ? '완료한 노드입니다.' : reach.has(sel) ? '이동할 수 있는 노드입니다.' : '현재 위치에서 연결되지 않았습니다.'}</span>
              <Button variant="primary" disabled={!reach.has(sel)} onClick={enter} data-testid="btn-enter" data-tut="btn-enter">{isCombat(node!.type) ? '전투 진입' : '진입'}</Button>
            </>) : <div className="empty">{reach.size ? '이동할 노드를 선택하세요.' : '진행할 노드가 없습니다.'}</div>}
          </Panel>
          <Panel tut="map-party" title={`원정 부대 (${members.length})`} bodyClass="col" >
            {members.map((id) => {
              const d = getCharacterDef(id)!; const hp = ex?.hp[id] ?? 1;
              return (
                <div key={id} className="row party-mini" data-testid={`party-${id}`}>
                  <CharacterArt def={d} zoom={2.3} className="mini-art" />
                  <div className="col grow" style={{ gap: 4 }}>
                    <span>{charName(d)}{ex?.reinforcements.includes(id) && <span className="tag accent" style={{ marginLeft: 8 }}>후발대</span>}</span>
                    <Bar value={hp} max={1} tone={hp < 0.35 ? 'danger' : hp < 0.7 ? 'warn' : undefined} />
                  </div>
                </div>
              );
            })}
            {!members.length && <span className="dim">출전 부대원 없음 (미리보기)</span>}
            {ex && <div className="row" style={{ gap: 8 }}><span className="dim grow">임시 거점</span><span className="num">{ex.outpost.hp} / {ex.outpost.maxHp}</span></div>}
            {ex?.buffs.map((b) => <div key={b.id} className="buff-line">{b.text}</div>)}
          </Panel>
          <Panel title={`보유 유물 (${ex?.relics.length ?? 0})`} bodyClass="col" >
            {ex && activeSynergies(ex.relics).map((syn) => <div key={syn.name + syn.count} className="buff-line syn" data-testid="synergy">시너지 · {syn.name} ({syn.tag} {syn.count}개)</div>)}
            {ex?.relics.length ? ex.relics.map((r) => <span key={r} className="relic-line" data-testid="relic-owned">{getRelic(r)?.name}<span className="dim" style={{ display: 'block', fontSize: 18 }}>{relicFx(r)}</span></span>) : <div className="empty" style={{ padding: 16 }}>획득한 유물 없음</div>}
          </Panel>
          {ex && <Panel title="원정 획득물" bodyClass="col"><span data-testid="loot">{costText(ex.loot, RES) || '없음'}</span><span className="dim" style={{ fontSize: 18 }}>원정 종료 시 결과에 따라 정부 자원으로 정산됩니다.</span></Panel>}
        </aside>
      </div>
      {ex?.pending && !training && <NodeEvent offer={ex.pending} />}
      {quit && <ConfirmDialog warn title="작전 중단" confirmLabel="귀환" onCancel={() => setQuit(false)} onConfirm={() => { setQuit(false); replace('result', { outcome: 'return' }); }}
        message={`작전을 중단하고 기지로 귀환합니다. 원정에서 얻은 유물은 사라집니다. 진행: ${ex ? columnOf(ex.map, ex.currentNode ?? '') + 1 : 0} / ${map.columns.length}열`} />}
    </div>
  );
}
