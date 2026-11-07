import { useRouter } from '../../core/router';
import { useGame } from '../../core/gameStore';
import { finishExpedition } from '../../core/session';
import { DATA } from '../../data';
import { Button, Notice, Panel, PlaceholderTag } from '../components/Common';
import { Icon } from '../components/Icon';

const OUTCOME: Record<string, { title: string; tone: string; desc: string }> = {
  return: { title: '원정 종료 · 귀환', tone: 'accent', desc: '개척부대가 기지로 귀환했습니다.' },
  defeat: { title: '원정 실패', tone: 'danger', desc: '임시 거점을 잃어 원정이 실패로 처리되었습니다.' },
  victory: { title: '원정 완료', tone: 'accent', desc: '모든 노드를 완료했습니다.' },
};

export function ResultScreen() {
  const { params, reset } = useRouter();
  const inExpedition = useGame((g) => !!g.state?.expedition);
  const o = OUTCOME[(params.outcome as string) ?? 'return'] ?? OUTCOME.return;
  return (
    <div className="screen result" data-testid="screen-result">
      <div className="result-head">
        <span className="dim" style={{ letterSpacing: '.3em', fontSize: 'var(--fs-xs)' }}>OPERATION REPORT</span>
        <h1 className={`result-title ${o.tone}`}>{o.title}</h1>
        <span className="muted">{o.desc}</span>
      </div>
      <div className="screen-main" style={{ justifyContent: 'center' }}>
        <Panel title="획득 자원" tail={<PlaceholderTag label="정산 PHASE 8" />} style={{ width: 760 }} bodyClass="col">
          <table className="table">
            <tbody>
              {DATA.resources.map((r) => (
                <tr key={r.id}><td><span className="row" style={{ gap: 12 }}><Icon name={r.icon} size={26} color="var(--accent)" />{r.name}</span></td><td className="num" style={{ textAlign: 'right' }}>+0</td></tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="작전 기록" style={{ width: 620 }} bodyClass="col">
          <dl className="kv">
            <dt>탐사 노드</dt><dd>—</dd><dt>전투 횟수</dt><dd>—</dd><dt>획득 유물</dt><dd>— (원정 종료 시 소멸)</dd><dt>합류 후발대</dt><dd>—</dd>
          </dl>
          <Notice>원정 보상 정산과 정부 반영은 PHASE 8에서 연결됩니다.</Notice>
          <div className="grow" />
          <Button variant="primary" onClick={() => (inExpedition ? finishExpedition((params.outcome as string) ?? 'return') : reset('main'))} data-testid="btn-to-base">기지로 복귀</Button>
        </Panel>
      </div>
    </div>
  );
}
