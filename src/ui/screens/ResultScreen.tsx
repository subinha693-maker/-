import { useRouter } from '../../core/router';
import { useGame } from '../../core/gameStore';
import { finishExpedition } from '../../core/session';
import { DATA, charName, getCharacterDef, getOp, getRelic, getRegion } from '../../data';
import { costText } from '../format';
import { settlementFor } from '../../systems/expedition';
import { Button, Notice, Panel } from '../components/Common';
import { Icon } from '../components/Icon';
import { fmtInt } from '../format';

const OUTCOME: Record<string, { title: string; tone: string; desc: string }> = {
  return: { title: '작전 중단 · 귀환', tone: 'accent', desc: '개척부대가 작전을 중단하고 기지로 귀환했습니다.' },
  defeat: { title: '원정 실패', tone: 'danger', desc: '전투에서 패배해 원정이 실패로 처리되었습니다.' },
  victory: { title: '원정 완료', tone: 'accent', desc: '외부 오염권의 모든 노드를 완료했습니다.' },
};
const ITEM = Object.fromEntries(DATA.items.map((i) => [i.id, i.name]));

export function ResultScreen() {
  const { params, reset } = useRouter();
  const s = useGame((g) => g.state);
  const ex = s?.expedition;
  const outcome = (params.outcome as string) ?? 'return';
  const o = OUTCOME[outcome] ?? OUTCOME.return;
  const nextDiff = ex && outcome === 'victory' ? DATA.difficulties.find((d) => d.level === ex.difficulty + 1) : undefined;
  const st = ex ? settlementFor(ex, outcome) : null;
  const region = ex ? getRegion(ex.regionId) : undefined;
  const rp = ex ? s!.regions[ex.regionId] : undefined;
  const willInfo = ex?.kind === 'general' && outcome === 'victory' && rp && rp.state < 2;
  const op = ex?.opId ? getOp(ex.opId) : undefined;
  const rec = op ? s!.strategicOps[op.id] : undefined;
  const opSuccess = !!op && !!rec?.objectiveAchieved && outcome !== 'defeat';
  const RES = Object.fromEntries(DATA.resources.map((r) => [r.id, r.name]));
  return (
    <div className="screen result" data-testid="screen-result">
      <div className="result-head">
        <span className="dim" style={{ letterSpacing: '.3em', fontSize: 'var(--fs-xs)' }}>OPERATION REPORT{ex ? ` · ${region?.name} · 침식 난이도 ${ex.difficulty}` : ''}</span>
        <h1 className={`result-title ${o.tone}`} data-testid="result-title">{o.title}</h1>
        <span className="muted">{o.desc}</span>
      </div>
      <div className="screen-main" style={{ justifyContent: 'center' }}>
        <Panel title={`원정 정산 · 회수율 ${Math.round((st?.ratio ?? 0) * 100)}%`} style={{ width: 760 }} bodyClass="col">
          <table className="table" data-testid="settlement">
            <thead><tr><th>자원</th><th style={{ textAlign: 'right' }}>원정 획득</th><th style={{ textAlign: 'right' }}>정부 반영</th></tr></thead>
            <tbody>
              {DATA.resources.map((r) => (
                <tr key={r.id}><td><span className="row" style={{ gap: 12 }}><Icon name={r.icon} size={26} color="var(--accent)" />{r.name}</span></td>
                  <td className="num dim" style={{ textAlign: 'right' }}>{fmtInt(ex?.loot[r.id] ?? 0)}</td>
                  <td className="num pos" style={{ textAlign: 'right' }} data-testid={`settle-${r.id}`}>+{fmtInt(st?.resources[r.id] ?? 0)}</td></tr>
              ))}
            </tbody>
          </table>
          <dl className="kv">
            <dt>육성 재화</dt><dd data-testid="settle-items">{st && Object.keys(st.items).length ? Object.entries(st.items).map(([k, v]) => `${ITEM[k] ?? k} +${v}`).join(', ') : '없음'}</dd>
          </dl>
          <span className="dim" style={{ fontSize: 'var(--fs-xs)' }}>회수율과 재화 지급량은 임시값입니다. 기지로 복귀하면 반영됩니다.</span>
        </Panel>
        <Panel title="작전 기록" style={{ width: 680 }} bodyClass="col">
          <dl className="kv">
            <dt>작전 종류</dt><dd>{ex?.kind === 'general' ? `일반 원정 · ${DATA.generalPurposes.find((g) => g.id === ex.purpose)?.name}` : ex ? '전략 작전' : '—'}</dd>
            <dt>탐사 노드</dt><dd className="num" data-testid="result-nodes">{ex ? `${ex.pastNodes + ex.path.length}` : '—'}</dd>
            <dt>심층 원정</dt><dd className="num" data-testid="result-depth">{ex ? (ex.depth ? `${ex.depth}단계까지 진입 · 보스 ${ex.bossClears}회 처치` : '없음') : '—'}</dd>
            <dt>출전 부대</dt><dd>{ex ? ex.members.map((m) => charName(getCharacterDef(m))).join(', ') : '—'}</dd>
            <dt>합류 후발대</dt><dd>{ex?.reinforcements.length ? ex.reinforcements.map((m) => charName(getCharacterDef(m))).join(', ') : '없음'}</dd>
            <dt>유물 (소멸)</dt><dd>{ex?.relics.length ? ex.relics.map((r) => getRelic(r)?.name).join(', ') : '없음'}</dd>
            {outcome === 'victory' && <><dt>난이도</dt><dd className="pos">{nextDiff ? `${nextDiff.name} 해금` : '최고 난이도 완수'}</dd></>}
            {ex?.kind === 'general' ? <>
              <dt>지역 기록</dt><dd data-testid="result-region">{willInfo ? '정보 확보 달성' : '탐사 기록 추가'}</dd>
              <dt>지역 통제권</dt><dd className="dim" data-testid="result-control">변화 없음 (일반 원정)</dd>
            </> : op ? <>
              <dt>전략 작전</dt><dd>{op.name}</dd>
              <dt>주요 목표</dt><dd data-testid="result-objective" className={rec?.objectiveAchieved ? 'pos' : 'neg'}>{rec?.objectiveAchieved ? '달성' : '미달성'}</dd>
              <dt>귀환</dt><dd>{outcome === 'defeat' ? '실패' : '귀환'}</dd>
              <dt>작전 판정</dt><dd data-testid="result-op" className={opSuccess ? 'pos' : 'neg'}>{opSuccess ? (op.grantsControl ? '성공 · 지역 통제권 확보' : '성공 · 전진 거점 확보') : '실패 · 확보 없음'}</dd>
              {opSuccess && <><dt>작전 보상</dt><dd>{[costText(op.rewards.resources, RES), costText(op.rewards.items, ITEM)].filter(Boolean).join(' · ')}</dd></>}
            </> : null}
          </dl>
          {op && !opSuccess && <Notice>전략 작전은 주요 목표를 달성하고 귀환해야 성공합니다. 이번 작전으로는 아무것도 확보하지 않습니다.</Notice>}
          {ex?.kind === 'general' && <Notice>일반 원정은 반복해도 지역 통제권이나 영토가 늘지 않습니다. 통제권은 전략 작전으로만 확보합니다.</Notice>}
          <div className="grow" />
          <Button variant="primary" onClick={() => (ex ? finishExpedition(outcome) : reset('main'))} data-testid="btn-to-base">기지로 복귀 · 정산</Button>
        </Panel>
      </div>
    </div>
  );
}
