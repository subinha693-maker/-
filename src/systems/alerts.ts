// Live warnings derived from the current state (not stored).
import { DATA, getFacilityDef } from '../data';
import type { GameState } from '../core/types';
import type { EconomyReport } from './economy';

export interface Warning { key: string; tone: 'warn' | 'danger'; title: string; body: string }
const fmtH = (h: number) => (h < 24 ? `${Math.floor(h)}시간` : `${Math.floor(h / 24)}일`);

export function computeWarnings(s: GameState, eco: EconomyReport): Warning[] {
  const w: Warning[] = [];
  for (const r of DATA.resources) {
    const rate = eco.perHour[r.id];
    if (rate < -1e-6) {
      const left = s.resources[r.id] / -rate;
      if (s.resources[r.id] <= 0.01) w.push({ key: `res-${r.id}`, tone: 'danger', title: `${r.name} 고갈`, body: `${r.name}이(가) 바닥났습니다. 관련 시설과 인구가 영향을 받습니다.` });
      else if (left < 72) w.push({ key: `res-${r.id}`, tone: left < 24 ? 'danger' : 'warn', title: `${r.name} 감소 중`, body: `현재 추세면 약 ${fmtH(left)} 뒤 바닥납니다 (시간당 ${rate.toFixed(1)}).` });
    }
  }
  for (const f of s.facilities) {
    const rep = eco.facilities.get(f.uid); const def = getFacilityDef(f.defId);
    if (!rep || !def) continue;
    if (rep.issues.includes('shortage')) w.push({ key: `short-${f.uid}`, tone: 'warn', title: '자원 부족으로 가동 저하', body: `${def.name} 가동률 ${Math.round(rep.efficiency * 100)}%` });
    if (rep.issues.includes('unstaffed') && f.status === 'active' && !f.job) w.push({ key: `staff-${f.uid}`, tone: 'warn', title: '인력 미배치', body: `${def.name}에 배치된 인력이 없습니다.` });
    if (rep.issues.includes('worn')) w.push({ key: `worn-${f.uid}`, tone: f.condition < 25 ? 'danger' : 'warn', title: '유지보수 필요', body: `${def.name} 상태 ${Math.round(f.condition)}%` });
  }
  for (const [rid, d] of Object.entries(s.regionDev ?? {})) {
    if ((s.regions[rid]?.state ?? 0) < 4) continue;
    const re = eco.regions.get(rid); const name = DATA.regions.find((r) => r.id === rid)?.name ?? rid;
    if (re) for (const [sid, st] of Object.entries(d.sites)) if (st.status === 'active' && (re.sites[sid] ?? 0) === 0) w.push({ key: `rsite-${rid}-${sid}`, tone: 'warn', title: '지역 시설 인력 미배치', body: `${name}: 복구된 시설에 인력이 없습니다.` });
    if (d.erosion > 40) w.push({ key: `eros-${rid}`, tone: 'warn', title: '잔존 침식 위험', body: `${name} 잔존 침식 ${Math.round(d.erosion)} · 효율 저하와 관리비 발생` });
  }
  if (s.research.active && eco.researchRate <= 0) w.push({ key: 'research-stall', tone: 'warn', title: '연구 정지', body: '가동 중인 연구 시설이 없어 연구가 진행되지 않습니다.' });
  return w;
}
