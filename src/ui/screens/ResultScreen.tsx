import { useRouter } from '../../core/router';
import { useGame } from '../../core/gameStore';
import { finishExpedition } from '../../core/session';
import { DATA, charName, getCharacterDef, getRelic } from '../../data';
import { Button, Notice, Panel } from '../components/Common';
import { Icon } from '../components/Icon';
import { fmtInt } from '../format';

const OUTCOME: Record<string, { title: string; tone: string; desc: string }> = {
  return: { title: '작전 중단 · 귀환', tone: 'accent', desc: '개척부대가 작전을 중단하고 기지로 귀환했습니다.' },
  defeat: { title: '원정 실패', tone: 'danger', desc: '전투에서 패배해 원정이 실패로 처리되었습니다.' },
  victory: { title: '원정 완료', tone: 'accent', desc: '외부 오염권의 모든 노드를 완료했습니다.' },
};

export function ResultScreen() {
  const { params, reset } = useRouter();
  const ex = useGame((g) => g.state?.expedition);
  const outcome = (params.outcome as string) ?? 'return';
  const o = OUTCOME[outcome] ?? OUTCOME.return;
  const nextDiff = ex && outcome === 'victory' ? DATA.difficulties.find((d) => d.level === ex.difficulty + 1) : undefined;
  return (
    <div className="screen result" data-testid="screen-result">
      <div className="result-head">
        <span className="dim" style={{ letterSpacing: '.3em', fontSize: 'var(--fs-xs)' }}>OPERATION REPORT{ex ? ` · 침식 난이도 ${ex.difficulty}` : ''}</span>
        <h1 className={`result-title ${o.tone}`} data-testid="result-title">{o.title}</h1>
        <span className="muted">{o.desc}</span>
      </div>
      <div className="screen-main" style={{ justifyContent: 'center' }}>
        <Panel title="원정 획득물" style={{ width: 720 }} bodyClass="col">
          <table className="table">
            <tbody>
              {DATA.resources.map((r) => (
                <tr key={r.id}><td><span className="row" style={{ gap: 12 }}><Icon name={r.icon} size={26} color="var(--accent)" />{r.name}</span></td><td className="num" style={{ textAlign: 'right' }}>+{fmtInt(ex?.loot[r.id] ?? 0)}</td></tr>
              ))}
            </tbody>
          </table>
          <Notice>획득물을 정부 자원에 반영하는 정산은 PHASE 8에서 연결됩니다. 지금은 기록만 표시합니다.</Notice>
        </Panel>
        <Panel title="작전 기록" style={{ width: 680 }} bodyClass="col">
          <dl className="kv">
            <dt>탐사 노드</dt><dd className="num" data-testid="result-nodes">{ex ? `${ex.path.length} / ${ex.map.columns.flat().length}` : '—'}</dd>
            <dt>출전 부대</dt><dd>{ex ? ex.members.map((m) => charName(getCharacterDef(m))).join(', ') : '—'}</dd>
            <dt>합류 후발대</dt><dd>{ex?.reinforcements.length ? ex.reinforcements.map((m) => charName(getCharacterDef(m))).join(', ') : '없음'}</dd>
            <dt>유물 (소멸)</dt><dd>{ex?.relics.length ? ex.relics.map((r) => getRelic(r)?.name).join(', ') : '없음'}</dd>
            {outcome === 'victory' && <><dt>해금</dt><dd className="pos">{nextDiff ? `${nextDiff.name} 해금` : '최고 난이도 완수'}</dd></>}
          </dl>
          <div className="grow" />
          {outcome === 'victory' && <Button pendingPhase={9}>심층 원정 도전</Button>}
          <Button variant="primary" onClick={() => (ex ? finishExpedition(outcome) : reset('main'))} data-testid="btn-to-base">기지로 복귀</Button>
        </Panel>
      </div>
    </div>
  );
}
