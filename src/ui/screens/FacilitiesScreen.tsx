import { useState } from 'react';
import { useGame } from '../../core/gameStore';
import { useRouter } from '../../core/router';
import { BALANCE } from '../../core/config';
import { act } from '../../core/actions';
import { DATA, getFacilityDef, getResearch } from '../../data';
import type { FacilityCategoryId, FacilityInstance } from '../../core/types';
import { buildFacility, freeGridCell, isUnlocked, missingCost, repairCost, repairFacility, setWorkers, toggleFacility, upgradeFacility, availableWorkers } from '../../systems/government';
import { Bar, Button, Modal, Panel, PlaceholderTag, ScreenHeader, Tabs } from '../components/Common';
import { asset } from '../components/Icon';
import { ResourceMini } from '../components/ResourceMini';
import { useEconomy } from '../useEconomy';
import { costText, fmtHours, fmtInt, fmtRate } from '../format';

const RES_NAMES = Object.fromEntries(DATA.resources.map((r) => [r.id, r.name]));
const POP_NAMES = Object.fromEntries(DATA.population.map((p) => [p.id, p.name]));
const STEP = BALANCE.economy.workerStep;
const ISSUE: Record<string, [string, string]> = {
  building: ['공사 중', 'warn'], stopped: ['운영 중지', ''], unstaffed: ['인력 없음', 'danger'], understaffed: ['인력 부족', 'warn'],
  shortage: ['자원 부족', 'danger'], worn: ['정비 필요', 'warn'],
};
export const statusLabel = (f: FacilityInstance) => (f.job ? (f.job.kind === 'build' ? '건설 중' : '업그레이드 중') : f.status === 'idle' ? '운영 중지' : '운영 중');

export function FacilitiesScreen() {
  const s = useGame((g) => g.state)!;
  const eco = useEconomy()!;
  const focus = useRouter((r) => r.params.focus as string | undefined);
  const [cat, setCat] = useState<'all' | FacilityCategoryId>('all');
  const [sel, setSel] = useState<string>(focus ?? s.facilities[0]?.uid);
  const [building, setBuilding] = useState(false);
  const list = s.facilities.filter((f) => cat === 'all' || getFacilityDef(f.defId)?.category === cat);
  const f = s.facilities.find((x) => x.uid === sel);
  const def = f && getFacilityDef(f.defId);
  const lv = def?.levels[(f?.level ?? 1) - 1];
  const rep = f ? eco.facilities.get(f.uid) : undefined;
  const nextLv = def && f ? def.levels[f.level] : undefined;

  return (
    <div className="screen" data-testid="screen-facilities">
      <ScreenHeader title="시설 관리" code="FACILITY MANAGEMENT" tail={<><ResourceMini ids={['material', 'parts', 'budget', 'power']} /><Button onClick={() => setBuilding(true)} data-testid="btn-build">시설 건설</Button></>} />
      <div className="screen-main">
        <Panel title="시설 목록" tut="fac-list" tail={<PlaceholderTag label="수치 임시" />} className="grow" bodyClass="col grow" style={{ flex: 1.4 }}>
          <Tabs items={[{ id: 'all' as const, name: '전체' }, ...DATA.facilityCategories]} value={cat} onChange={setCat} />
          <div className="scroll grow">
            <table className="table">
              <thead><tr><th>시설</th><th>레벨</th><th>인력</th><th>가동률</th><th>상태</th></tr></thead>
              <tbody>
                {list.map((x) => {
                  const d = getFacilityDef(x.defId)!; const r = eco.facilities.get(x.uid);
                  const need = d.levels[x.level - 1].workers;
                  return (
                    <tr key={x.uid} className={`click ${x.uid === sel ? 'sel' : ''}`} onClick={() => setSel(x.uid)} data-testid={`fac-row-${x.uid}`}>
                      <td>{d.name}<div className="dim" style={{ fontSize: 18 }}>{DATA.facilityCategories.find((c) => c.id === d.category)?.name}</div></td>
                      <td className="num">Lv.{x.level}</td>
                      <td className="num">{fmtInt(x.workers)} / {fmtInt(need)}</td>
                      <td className="num">{Math.round((r?.efficiency ?? 0) * 100)}%</td>
                      <td><span className={`tag ${x.job ? 'warn' : x.status === 'idle' ? '' : (r?.issues.some((i) => i !== 'building') ? 'warn' : 'accent')}`}>{statusLabel(x)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!list.length && <div className="empty">이 분류의 시설이 없습니다.</div>}
          </div>
        </Panel>
        <Panel title="시설 상세" tut="fac-detail" className="grow" bodyClass="col scroll grow" style={{ flex: 1 }}>
          {f && def && lv && rep ? (<>
            <div className="row" style={{ alignItems: 'stretch' }}>
              <div className="fac-hero" style={{ width: 240, height: 180 }}><img src={asset(`sprites/kenney/${def.sprite}.png`)} alt="" style={{ maxHeight: 150 }} /></div>
              <div className="col grow" style={{ gap: 8 }}>
                <h2 className="h2" data-testid="fac-name">{def.name}</h2>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <span className="tag" data-testid="fac-level">Lv.{f.level} / {def.levels.length}</span>
                  <span className="tag">{statusLabel(f)}</span>
                  <span className="tag accent num">가동률 {Math.round(rep.efficiency * 100)}%</span>
                </div>
                <div className="issues">{rep.issues.filter((i) => ISSUE[i]).map((i) => <span key={i} className={`tag ${ISSUE[i][1]}`}>{ISSUE[i][0]}</span>)}</div>
              </div>
            </div>
            {f.job && (
              <div className="job" data-testid="fac-job">
                <div className="row"><b className="grow">{f.job.kind === 'build' ? '건설 중' : `Lv.${f.level + 1} 업그레이드 중`}</b><span className="num">남은 시간 {fmtHours(f.job.remainingMinutes)}</span></div>
                <Bar value={f.job.totalMinutes - f.job.remainingMinutes} max={f.job.totalMinutes} tone="warn" />
              </div>
            )}
            <dl className="kv">
              <dt>배치 인력 ({POP_NAMES[def.workerType]})</dt><dd className="num">{fmtInt(f.workers)} / {fmtInt(lv.workers)}</dd>
              <dt>생산량 /h</dt><dd className={`num ${Object.keys(lv.produce).length ? 'pos' : 'dim'}`}>{Object.keys(lv.produce).length ? Object.entries(rep.produce).map(([k, v]) => `${RES_NAMES[k]} ${fmtRate(v!)}`).join(' · ') : '없음'}</dd>
              <dt>소비량 /h</dt><dd className={`num ${Object.keys(lv.consume).length ? 'neg' : 'dim'}`}>{Object.keys(lv.consume).length ? Object.entries(rep.consume).map(([k, v]) => `${RES_NAMES[k]} ${fmtRate(-v!)}`).join(' · ') : '없음'}</dd>
              <dt>전력 사용량 /h</dt><dd className="num">{fmtRate(-rep.power)}</dd>
              {lv.research ? <><dt>연구 속도</dt><dd className="num">{rep.research.toFixed(2)}</dd></> : null}
              <dt>최대 효율 시 생산</dt><dd className="num dim">{Object.entries(lv.produce).map(([k, v]) => `${RES_NAMES[k]} ${v}`).join(' · ') || '—'}</dd>
            </dl>
            <div className="col" style={{ gap: 8 }}>
              <div className="row"><span className="dim grow" style={{ fontSize: 'var(--fs-xs)' }}>유지보수 상태</span><span className="num" data-testid="fac-condition">{Math.round(f.condition)}%</span></div>
              <Bar value={f.condition} tone={f.condition < 25 ? 'danger' : f.condition < 50 ? 'warn' : undefined} />
            </div>
            <div className="col" style={{ gap: 8 }}>
              <span className="dim" style={{ fontSize: 'var(--fs-xs)' }}>인력 배치 · 남은 {POP_NAMES[def.workerType]} {fmtInt(availableWorkers(s, def.workerType))}명</span>
              <div className="stepper">
                <Button small onClick={() => act((st) => setWorkers(st, f.uid, 0))} data-testid="w-zero">0</Button>
                <Button small onClick={() => act((st) => setWorkers(st, f.uid, f.workers - STEP))} data-testid="w-minus">−</Button>
                <span className="val num" data-testid="w-val">{fmtInt(f.workers)}</span>
                <Button small onClick={() => act((st) => setWorkers(st, f.uid, f.workers + STEP))} data-testid="w-plus">+</Button>
                <Button small onClick={() => act((st) => setWorkers(st, f.uid, lv.workers))} data-testid="w-max">최대</Button>
              </div>
            </div>
            <div className="col" style={{ gap: 10 }}>
              <Button small disabled={!nextLv || !!f.job} onClick={() => act((st) => upgradeFacility(st, f.uid), '업그레이드를 시작했습니다.')} data-testid="btn-upgrade">
                {nextLv ? `Lv.${f.level + 1} 업그레이드` : '최대 레벨'}
                {nextLv && <span className="btn-sub">{costText(nextLv.cost, RES_NAMES)} · {fmtHours(nextLv.buildHours * 60)}</span>}
              </Button>
              <div className="row" style={{ gap: 10 }}>
                <Button small className="grow" disabled={f.status === 'building'} onClick={() => act((st) => toggleFacility(st, f.uid))} data-testid="btn-toggle">{f.status === 'idle' ? '운영 재개' : '운영 중지'}</Button>
                <Button small className="grow" disabled={f.condition >= 99.5} onClick={() => act((st) => repairFacility(st, f.uid), '정비를 완료했습니다.')} data-testid="btn-repair">
                  정비{f.condition < 99.5 && <span className="btn-sub">{costText(repairCost(s, f.uid), RES_NAMES)}</span>}
                </Button>
              </div>
            </div>
          </>) : <div className="empty">시설을 선택하세요.</div>}
        </Panel>
      </div>
      {building && <BuildModal onClose={() => setBuilding(false)} onBuilt={(uid) => { setBuilding(false); setSel(uid); setCat('all'); }} />}
    </div>
  );
}

function BuildModal({ onClose, onBuilt }: { onClose: () => void; onBuilt: (uid: string) => void }) {
  const s = useGame((g) => g.state)!;
  const noSpace = !freeGridCell(s);
  return (
    <Modal wide title="시설 건설" actions={<Button onClick={onClose} data-testid="build-close">닫기</Button>}>
      {noSpace && <div className="notice danger-notice" style={{ marginBottom: 12 }}>건설할 공간이 없습니다.</div>}
      <div className="build-list scroll">
        {DATA.facilities.map((d) => {
          const lv = d.levels[0]; const unlocked = isUnlocked(s, d); const miss = missingCost(s, lv.cost);
          return (
            <button key={d.id} className="build-item" disabled={!unlocked || miss.length > 0 || noSpace} data-testid={`build-${d.id}`}
              onClick={() => { if (act((st) => buildFacility(st, d.id), `${d.name} 건설을 시작했습니다.`)) onBuilt(useGame.getState().state!.facilities.at(-1)!.uid); }}>
              <img src={asset(`sprites/kenney/${d.sprite}.png`)} alt="" />
              <div className="col grow" style={{ gap: 4 }}>
                <b>{d.name}</b>
                <span className="dim">{DATA.facilityCategories.find((c) => c.id === d.category)?.name} · 필요 인력 {fmtInt(lv.workers)} · 건설 {fmtHours(lv.buildHours * 60)}</span>
                <span className={miss.length ? 'neg' : 'muted'}>{costText(lv.cost, RES_NAMES)}</span>
              </div>
              <span className={`tag ${unlocked ? (miss.length ? 'danger' : 'accent') : ''}`}>{!unlocked ? `연구 필요: ${getResearch(d.requires!)?.name}` : miss.length ? '자원 부족' : '건설 가능'}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
