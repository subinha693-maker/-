import { useGame } from '../../core/gameStore';
import { BALANCE } from '../../core/config';
import { act } from '../../core/actions';
import { DATA, getFacilityDef } from '../../data';
import type { WorkerType } from '../../core/types';
import { assignedWorkers, setWorkers } from '../../systems/government';
import { Bar, Button, Notice, Panel, PlaceholderTag, ScreenHeader } from '../components/Common';
import { useEconomy } from '../useEconomy';
import { fmtInt } from '../format';

const STEP = BALANCE.economy.workerStep;
const POP_NAMES = Object.fromEntries(DATA.population.map((p) => [p.id, p.name]));

export function PopulationScreen() {
  const s = useGame((g) => g.state)!;
  const eco = useEconomy()!;
  const total = Object.values(s.population).reduce((a, b) => a + b, 0);
  return (
    <div className="screen" data-testid="screen-population">
      <ScreenHeader title="인구 관리" code="POPULATION & LABOR" />
      <div className="screen-main">
        <Panel title="인구 구성" tail={<PlaceholderTag label="인구 수치 임시" />} style={{ flex: 1 }} bodyClass="col">
          <div className="pop-total"><span className="dim">총 인구</span><b className="num">{fmtInt(total)}</b></div>
          {DATA.population.map((p) => {
            const working = p.id === 'inactive' ? null : assignedWorkers(s, p.id as WorkerType);
            return (
              <div key={p.id} className="col" style={{ gap: 6 }}>
                <div className="row"><span className="grow">{p.name}</span><span className="num">{fmtInt(s.population[p.id])}</span></div>
                <Bar value={working ?? 0} max={s.population[p.id] || 1} />
                <span className="dim num" style={{ fontSize: 18 }} data-testid={`pop-${p.id}`}>
                  {working === null ? '시설 배치 대상 아님' : `배치 ${fmtInt(working)} · 대기 ${fmtInt(s.population[p.id] - working)}`}
                </span>
              </div>
            );
          })}
          <Notice>인구 증감 규칙은 아직 정해지지 않아 인구 수는 변하지 않습니다. 인구는 시간당 식량 {eco.populationFood.toFixed(1)}을 소비합니다.</Notice>
        </Panel>
        <Panel title="시설별 노동력 배치" style={{ flex: 1.6 }} className="grow" bodyClass="col grow">
          <div className="scroll grow">
            <table className="table">
              <thead><tr><th>시설</th><th>인력 유형</th><th>배치 / 필요</th><th>가동률</th><th style={{ width: 330 }}>조정 ({fmtInt(STEP)}명 단위)</th></tr></thead>
              <tbody>
                {s.facilities.map((f) => {
                  const d = getFacilityDef(f.defId)!; const need = d.levels[f.level - 1].workers;
                  return (
                    <tr key={f.uid} data-testid={`labor-${f.uid}`}>
                      <td>{d.name}</td>
                      <td className="dim">{POP_NAMES[d.workerType]}</td>
                      <td className="num">{fmtInt(f.workers)} / {fmtInt(need)}</td>
                      <td className="num">{Math.round((eco.facilities.get(f.uid)?.efficiency ?? 0) * 100)}%</td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <Button small onClick={() => act((st) => setWorkers(st, f.uid, f.workers - STEP))} data-testid={`labor-minus-${f.uid}`}>−</Button>
                          <Button small onClick={() => act((st) => setWorkers(st, f.uid, f.workers + STEP))} data-testid={`labor-plus-${f.uid}`}>+</Button>
                          <Button small onClick={() => act((st) => setWorkers(st, f.uid, need))}>최대</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
