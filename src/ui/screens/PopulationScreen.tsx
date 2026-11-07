import { useGame } from '../../core/gameStore';
import { DATA, getFacilityDef } from '../../data';
import { Bar, Button, Panel, PlaceholderTag, ScreenHeader } from '../components/Common';

const fmt = new Intl.NumberFormat('ko-KR');

export function PopulationScreen() {
  const s = useGame((g) => g.state)!;
  const total = Object.values(s.population).reduce((a, b) => a + b, 0);
  return (
    <div className="screen" data-testid="screen-population">
      <ScreenHeader title="인구 관리" code="POPULATION & LABOR" />
      <div className="screen-main">
        <Panel title="인구 구성" tail={<PlaceholderTag />} style={{ flex: 1 }} bodyClass="col">
          <div className="pop-total"><span className="dim">총 인구</span><b className="num">{fmt.format(total)}</b></div>
          {DATA.population.map((p) => (
            <div key={p.id} className="col" style={{ gap: 8 }}>
              <div className="row"><span className="grow">{p.name}</span><span className="num">{fmt.format(s.population[p.id])}</span><span className="dim num" style={{ width: 90, textAlign: 'right' }}>{((s.population[p.id] / total) * 100).toFixed(1)}%</span></div>
              <Bar value={s.population[p.id]} max={total} />
            </div>
          ))}
        </Panel>
        <Panel title="시설별 노동력 배치" style={{ flex: 1.5 }} className="grow" bodyClass="col grow">
          <div className="scroll grow">
            <table className="table">
              <thead><tr><th>시설</th><th>필요 인력</th><th>배치 인력</th><th style={{ width: 280 }}>조정</th></tr></thead>
              <tbody>
                {s.facilities.map((f) => {
                  const d = getFacilityDef(f.defId)!;
                  return (
                    <tr key={f.uid}>
                      <td>{d.name}</td>
                      <td className="num dim">{d.levels[f.level - 1].workers}</td>
                      <td className="num">{f.workers}</td>
                      <td><div className="row" style={{ gap: 8 }}><Button small disabled>−</Button><Button small disabled>+</Button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button pendingPhase={4}>배치 적용</Button>
        </Panel>
      </div>
    </div>
  );
}
