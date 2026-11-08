import { useState } from 'react';
import { useGame } from '../../core/gameStore';
import { useRouter } from '../../core/router';
import { act } from '../../core/actions';
import { DATA, getRegion } from '../../data';
import { assignedWorkers } from '../../systems/government';
import { devOf, developmentProgress, erosionFactor, regionEconomy, repairSite, setCleanupWorkers, setSiteWorkers, siteDefs, toggleSite } from '../../systems/regionDev';
import { Bar, Button, Notice, Panel, PlaceholderTag, ScreenHeader } from '../components/Common';
import { ResourceMini } from '../components/ResourceMini';
import { Icon } from '../components/Icon';
import { costText, fmtHours, fmtInt, fmtRate } from '../format';

const RES = Object.fromEntries(DATA.resources.map((r) => [r.id, r.name]));
const STEP = DATA.regionDev.workerStep;
const TYPE_ICON: Record<string, string> = { industrial: 'parts', research: 'research', residential: 'population', energy: 'power', military: 'defense' };
const STATUS: Record<string, [string, string]> = { damaged: ['손상', 'danger'], repairing: ['복구 중', 'warn'], active: ['운영 중', 'accent'], idle: ['운영 중지', ''] };
const rateText = (m: Record<string, number | undefined>, sign: 1 | -1) => Object.entries(m).filter(([, v]) => (v ?? 0) > 0.004).map(([k, v]) => `${RES[k]} ${fmtRate(sign * (v ?? 0))}`).join(' · ') || '없음';

export function RegionManageScreen() {
  const s = useGame((g) => g.state)!;
  const params = useRouter((r) => r.params);
  const managed = DATA.regions.filter((r) => s.regions[r.id].state >= 4);
  const [sel, setSel] = useState<string | undefined>((params.regionId as string) ?? managed[0]?.id);
  const r = sel ? getRegion(sel) : undefined;
  const laborFree = s.population.labor - assignedWorkers(s, 'labor');

  return (
    <div className="screen" data-testid="screen-regionManage">
      <ScreenHeader title="지역 관리" code="REGIONAL ADMINISTRATION" tail={<><ResourceMini ids={['material', 'parts', 'budget', 'power']} /><span className="tag num" data-testid="labor-free">가용 노동 인구 {fmtInt(laborFree)}</span></>} />
      <div className="screen-main">
        <Panel title="관리 지역" style={{ flex: 0.8 }} bodyClass="col scroll grow">
          {managed.length === 0 && <div className="empty">통제권을 확보한 지역이 없습니다. 전략 작전으로 지역 통제권을 확보하면 이곳에서 개발할 수 있습니다.</div>}
          {managed.map((x) => {
            const pr = developmentProgress(s, x.id); const st = s.regions[x.id].state;
            return (
              <button key={x.id} className={`rm-item ${sel === x.id ? 'sel' : ''}`} onClick={() => setSel(x.id)} data-testid={`rm-${x.id}`}>
                <Icon name={TYPE_ICON[x.type]} size={36} color="var(--accent)" />
                <div className="col grow" style={{ gap: 2 }}>
                  <b>{x.name}</b>
                  <span className="dim">{DATA.regionStates.find((z) => z.id === st)?.name}</span>
                  <span className="dim num">시설 {pr.active}/{pr.total} · 잔존 침식 {Math.round(pr.erosion)}</span>
                </div>
                {st === 5 && <span className="tag accent">개발 완료</span>}
              </button>
            );
          })}
        </Panel>
        {r ? <RegionDevPanel regionId={r.id} /> : <div className="grow" />}
      </div>
    </div>
  );
}

function RegionDevPanel({ regionId }: { regionId: string }) {
  const s = useGame((g) => g.state)!;
  const r = getRegion(regionId)!;
  const type = DATA.regionTypes.find((t) => t.id === r.type)!;
  const d = devOf(s, regionId);
  const eco = regionEconomy(s, regionId);
  const pr = developmentProgress(s, regionId);
  const other = (exclude: number) => assignedWorkers(s, 'labor') - exclude;
  const state = s.regions[regionId].state;
  return (
    <div className="col grow scroll rm-detail" style={{ flex: 2, minWidth: 0 }}>
      <Panel title="지역 현황" tail={<PlaceholderTag label="개발 수치 임시" />} bodyClass="col">
        <div className="row"><Icon name={TYPE_ICON[r.type]} size={44} color="var(--accent)" /><div className="col grow" style={{ gap: 0 }}><h2 className="h2" data-testid="rm-name">{r.name}</h2><span className="dim">{type.name} · {type.develop}</span></div>
          <span className={`tag ${state === 5 ? 'accent' : 'warn'}`} data-testid="rm-state">{DATA.regionStates.find((z) => z.id === state)?.name}</span></div>
        <div className="rm-grid">
          <div className="col" style={{ gap: 6 }}>
            <div className="row"><span className="grow dim">개발 진행 (시설 운영)</span><span className="num" data-testid="rm-progress">{pr.active} / {pr.total}</span></div>
            <Bar value={pr.active} max={pr.total || 1} />
          </div>
          <div className="col" style={{ gap: 6 }}>
            <div className="row"><span className="grow dim">잔존 침식 위험 (목표 {pr.target} 이하)</span><span className="num" data-testid="rm-erosion">{Math.round(d.erosion)}</span></div>
            <Bar value={d.erosion} max={100} tone={d.erosion > 40 ? 'danger' : d.erosion > pr.target ? 'warn' : undefined} />
          </div>
        </div>
        <dl className="kv">
          <dt>지역 생산 /h</dt><dd className="pos" data-testid="rm-produce">{rateText(eco.produce, 1)}</dd>
          <dt>지역 소비·유지비 /h</dt><dd className="neg" data-testid="rm-consume">{rateText(eco.consume, -1)}</dd>
          {eco.research > 0 && <><dt>연구 속도 증가</dt><dd className="num">+{eco.research.toFixed(2)}</dd></>}
          {eco.survivorsPerDay > 0 && <><dt>생존자 구조</dt><dd className="num">노동 인구 +{Math.round(eco.survivorsPerDay)}/일 <span className="dim">(임시 규칙)</span></dd></>}
          <dt>시설 효율 (침식 영향)</dt><dd className="num">{Math.round(erosionFactor(d.erosion) * 100)}%</dd>
        </dl>
        <Notice>통제권 확보만으로 시설이 작동하지 않습니다. 시설을 복구하고 인력을 배치해야 생산하며, 지역마다 유지비와 잔존 침식 관리비가 듭니다. 모든 시설을 운영하고 잔존 침식을 {pr.target} 이하로 낮추면 개발 완료가 됩니다.</Notice>
      </Panel>

      <Panel title="잔존 침식 관리" bodyClass="col">
        <span className="dim" style={{ fontSize: 'var(--fs-xs)' }}>정화 인력 1,000명당 하루 {DATA.regionDev.erosion.cleanupPerDayPer1000} 감소 · 침식 1당 예산 {DATA.regionDev.upkeep.erosionBudgetPerPoint}/h 관리비</span>
        <div className="stepper">
          <Button small onClick={() => act((x) => setCleanupWorkers(x, regionId, d.cleanupWorkers - STEP, other(d.cleanupWorkers)))} data-testid="rm-clean-minus">−</Button>
          <span className="val num" data-testid="rm-clean">{fmtInt(d.cleanupWorkers)}</span>
          <Button small onClick={() => act((x) => setCleanupWorkers(x, regionId, d.cleanupWorkers + STEP, other(d.cleanupWorkers)))} data-testid="rm-clean-plus">+</Button>
          <Button small onClick={() => act((x) => setCleanupWorkers(x, regionId, DATA.regionDev.erosion.cleanupMaxWorkers, other(d.cleanupWorkers)))} data-testid="rm-clean-max">최대</Button>
        </div>
      </Panel>

      {siteDefs(regionId).map((def) => {
        const st = d.sites[def.id]; const [label, tone] = STATUS[st.status];
        const locked = def.requires && !s.research.completed.includes(def.requires);
        return (
          <section key={def.id} className="panel rm-site" data-testid={`site-${def.id}`}>
            <header className="panel-head">{def.name}<span className={`tag ${tone}`} style={{ marginLeft: 'auto' }} data-testid={`site-status-${def.id}`}>{label}</span></header>
            <div className="panel-body col">
              <dl className="kv">
                <dt>생산 /h (최대)</dt><dd>{rateText(def.produce, 1)}{def.research ? ` · 연구 속도 +${def.research}` : ''}{def.survivorsPerDay ? ` · 생존자 +${def.survivorsPerDay}/일` : ''}{def.outpostBonus ? ` · 원정 임시 거점 +${def.outpostBonus}` : ''}</dd>
                <dt>소비 /h</dt><dd>{rateText(def.consume, -1)}</dd>
                <dt>필요 인력</dt><dd className="num">{fmtInt(def.workers)}</dd>
                {(st.status === 'active' || st.status === 'idle') && <><dt>현재 효율</dt><dd className="num">{Math.round((eco.sites[def.id] ?? 0) * 100)}%</dd></>}
              </dl>
              {st.status === 'damaged' && (
                <Button variant="primary" disabled={!!locked} onClick={() => act((x) => repairSite(x, regionId, def.id), `${def.name} 복구를 시작했습니다.`)} data-testid={`site-repair-${def.id}`}>
                  {locked ? `연구 필요: ${DATA.researchNodes.find((n) => n.id === def.requires)?.name}` : '시설 복구'}<span className="btn-sub">{costText(def.repairCost, RES)} · {fmtHours(def.repairHours * 60)}</span>
                </Button>
              )}
              {st.status === 'repairing' && (
                <div className="job"><div className="row"><b className="grow">복구 중</b><span className="num">남은 시간 {fmtHours(st.remainingMinutes)}</span></div><Bar value={st.totalMinutes - st.remainingMinutes} max={st.totalMinutes} tone="warn" /></div>
              )}
              {(st.status === 'active' || st.status === 'idle') && (
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  <div className="stepper">
                    <Button small onClick={() => act((x) => setSiteWorkers(x, regionId, def.id, st.workers - STEP, other(st.workers)))} data-testid={`site-minus-${def.id}`}>−</Button>
                    <span className="val num" data-testid={`site-workers-${def.id}`}>{fmtInt(st.workers)}</span>
                    <Button small onClick={() => act((x) => setSiteWorkers(x, regionId, def.id, st.workers + STEP, other(st.workers)))} data-testid={`site-plus-${def.id}`}>+</Button>
                    <Button small onClick={() => act((x) => setSiteWorkers(x, regionId, def.id, def.workers, other(st.workers)))} data-testid={`site-max-${def.id}`}>최대</Button>
                  </div>
                  <div className="grow" />
                  <Button small onClick={() => act((x) => toggleSite(x, regionId, def.id))} data-testid={`site-toggle-${def.id}`}>{st.status === 'idle' ? '운영 재개' : '운영 중지'}</Button>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
