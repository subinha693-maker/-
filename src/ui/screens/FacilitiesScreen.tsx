import { useState } from 'react';
import { useGame } from '../../core/gameStore';
import { useRouter } from '../../core/router';
import { DATA, getFacilityDef } from '../../data';
import type { FacilityCategoryId } from '../../core/types';
import { Bar, Button, Notice, Panel, PlaceholderTag, ScreenHeader, Tabs } from '../components/Common';
import { asset } from '../components/Icon';

const STATUS: Record<string, string> = { active: '운영 중', idle: '대기', building: '건설 중', disabled: '정지' };

export function FacilitiesScreen() {
  const s = useGame((g) => g.state)!;
  const focus = useRouter((r) => r.params.focus as string | undefined);
  const [cat, setCat] = useState<'all' | FacilityCategoryId>('all');
  const [sel, setSel] = useState<string>(focus ?? s.facilities[0]?.uid);
  const list = s.facilities.filter((f) => cat === 'all' || getFacilityDef(f.defId)?.category === cat);
  const f = s.facilities.find((x) => x.uid === sel);
  const def = f && getFacilityDef(f.defId);
  const lv = def?.levels[(f?.level ?? 1) - 1];

  return (
    <div className="screen" data-testid="screen-facilities">
      <ScreenHeader title="시설 관리" code="FACILITY MANAGEMENT" tail={<Button pendingPhase={4}>시설 건설</Button>} />
      <div className="screen-main">
        <Panel title="시설 목록" tail={<PlaceholderTag />} className="grow" bodyClass="col grow" style={{ flex: 1.4 }}>
          <Tabs items={[{ id: 'all' as const, name: '전체' }, ...DATA.facilityCategories]} value={cat} onChange={setCat} />
          <div className="scroll grow">
            <table className="table">
              <thead><tr><th>시설</th><th>분류</th><th>레벨</th><th>배치 인력</th><th>전력</th><th>상태</th></tr></thead>
              <tbody>
                {list.map((x) => {
                  const d = getFacilityDef(x.defId)!;
                  return (
                    <tr key={x.uid} className={`click ${x.uid === sel ? 'sel' : ''}`} onClick={() => setSel(x.uid)} data-testid={`fac-row-${x.uid}`}>
                      <td>{d.name}</td>
                      <td className="muted">{DATA.facilityCategories.find((c) => c.id === d.category)?.name}</td>
                      <td className="num">Lv.{x.level}</td>
                      <td className="num">{x.workers}</td>
                      <td className="num">{d.levels[x.level - 1].power}</td>
                      <td><span className="tag accent">{STATUS[x.status]}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!list.length && <div className="empty">이 분류의 시설이 없습니다.</div>}
          </div>
        </Panel>
        <Panel title="시설 상세" className="grow" bodyClass="col scroll grow" style={{ flex: 1 }}>
          {f && def && lv ? (<>
            <div className="fac-hero"><img src={asset(`sprites/kenney/${def.sprite}.png`)} alt="" /></div>
            <div className="row"><h2 className="h2 grow">{def.name}</h2><span className="tag">Lv.{f.level}</span></div>
            <dl className="kv">
              <dt>분류</dt><dd>{DATA.facilityCategories.find((c) => c.id === def.category)?.name}</dd>
              <dt>운영 상태</dt><dd>{STATUS[f.status]}</dd>
              <dt>배치 인력</dt><dd className="num">{f.workers} / {lv.workers}</dd>
              <dt>생산량</dt><dd className="dim">미정</dd>
              <dt>소비량</dt><dd className="dim">미정</dd>
              <dt>전력 사용량</dt><dd className="num">{lv.power}</dd>
            </dl>
            <div className="col" style={{ gap: 8 }}>
              <span className="dim" style={{ fontSize: 'var(--fs-xs)' }}>유지보수 상태 {f.condition}%</span>
              <Bar value={f.condition} />
            </div>
            <Notice>생산·소비 수치와 공식은 아직 정해지지 않았습니다.</Notice>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <Button small pendingPhase={4}>인력 배치</Button>
              <Button small pendingPhase={4}>업그레이드</Button>
              <Button small pendingPhase={4}>운영 중지</Button>
            </div>
          </>) : <div className="empty">시설을 선택하세요.</div>}
        </Panel>
      </div>
    </div>
  );
}
