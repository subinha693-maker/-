import { useState } from 'react';
import { useGame } from '../../core/gameStore';
import { DATA, charName, getCharacterDef } from '../../data';
import { RECRUIT, bannerCost, poolOf, reviewResumes, type Applicant } from '../../systems/recruit';
import { missingCost } from '../../systems/government';
import { Button, Notice, Panel, ScreenHeader, Tabs } from '../components/Common';
import { CharacterArt } from '../components/CharacterArt';
import { ResourceMini } from '../components/ResourceMini';
import { useToast } from '../components/Toast';
import { costText } from '../format';

const RES_NAMES = Object.fromEntries(DATA.resources.map((r) => [r.id, r.name]));

export function RecruitScreen() {
  const s = useGame((g) => g.state)!;
  const [tab, setTab] = useState(RECRUIT.banners[0].id);
  const [results, setResults] = useState<Applicant[] | null>(null);
  const [idx, setIdx] = useState(0);
  const banner = RECRUIT.banners.find((b) => b.id === tab)!;

  const review = (count: number) => {
    const { result, applicants } = reviewResumes(useGame.getState().state!, banner.id, count);
    if (!result.ok) { useToast.getState().push(result.message, 'warn'); return; }
    useGame.setState({ state: result.state });
    setResults(applicants); setIdx(0);
  };
  const cur = results?.[idx];
  const curDef = cur ? getCharacterDef(cur.charId) : undefined;

  return (
    <div className="screen" data-testid="screen-recruit">
      <ScreenHeader title="이력서 확인" code="PERSONNEL APPLICATION REVIEW" tail={<ResourceMini ids={['budget']} />} />
      <div className="screen-main">
        <Panel title="모집 구분" style={{ flex: 1 }} bodyClass="col grow">
          <Tabs items={RECRUIT.banners} value={tab} onChange={(v) => { setTab(v); setResults(null); }} />
          <dl className="kv">
            <dt>검토 비용 (1건)</dt><dd>{costText(banner.cost, RES_NAMES)} <span className="dim">(임시)</span></dd>
            <dt>지원자 범위</dt><dd>{poolOf(banner).length}명 <span className="dim">(임시: 전체 요원 균등)</span></dd>
            <dt>등장 확률</dt><dd className="dim">미정</dd>
            <dt>천장</dt><dd className="dim">{banner.ceiling ?? '미정'}</dd>
            <dt>누적 검토</dt><dd className="num">{s.progress.recruit.reviews}건</dd>
          </dl>
          <Notice>초기 요원 6명은 배포 요원으로 처음부터 보유합니다. 모집 확률·천장·비용·지원자 범위는 미정이라 지금 설정은 시험용입니다. 이미 보유한 요원이 지원하면 그 요원의 인사 공적으로 전환됩니다.</Notice>
          <div className="grow" />
          <div className="row">
            <Button className="grow" disabled={missingCost(s, bannerCost(banner, 1)).length > 0} onClick={() => review(1)} data-testid="btn-review-1">이력서 1건 확인</Button>
            <Button className="grow" disabled={missingCost(s, bannerCost(banner, RECRUIT.multiCount)).length > 0} onClick={() => review(RECRUIT.multiCount)} data-testid="btn-review-10">이력서 {RECRUIT.multiCount}건 확인</Button>
          </div>
        </Panel>
        <section className="dossier" style={{ flex: 1.3 }} data-testid="dossier">
          <div className="dossier-head">
            <span>통합인류행정부 · 개척부대 지원서{results && results.length > 1 ? ` (${idx + 1}/${results.length})` : ''}</span>
            <span className={`stamp ${cur ? (cur.duplicate ? 'dup' : 'new') : ''}`} data-testid="dossier-stamp">{cur ? (cur.duplicate ? '중복 지원' : '영입 승인') : '검토 대기'}</span>
          </div>
          <div className="dossier-body">
            {curDef ? <CharacterArt def={curDef} zoom={1.7} className="dossier-photo" /> : <div className="dossier-photo"><span>?</span></div>}
            <dl className="kv dossier-kv">
              <dt>성명</dt><dd className={curDef ? '' : 'redact'} data-testid="dossier-name">{curDef ? `${charName(curDef)} (${curDef.nameEn})` : '████████'}</dd>
              <dt>출신</dt><dd className={curDef ? '' : 'redact'}>{curDef?.origin ?? '██████'}</dd>
              <dt>전문 분야</dt><dd className={curDef ? '' : 'redact'}>{curDef?.specialty ?? '█████████'}</dd>
              <dt>무기</dt><dd className={curDef ? '' : 'redact'}>{curDef?.weapon ?? '█████'}</dd>
              <dt>처리 결과</dt><dd data-testid="dossier-result">{cur ? (cur.duplicate ? `이미 소속된 요원 → 인사 공적 +${cur.merit}` : '개척부대 신규 편입') : '██████████'}</dd>
            </dl>
          </div>
          <div className="dossier-foot row">
            {results && results.length > 1 ? <>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{results.map((r, i) => <button key={i} className={`chip ${i === idx ? 'on' : ''} ${r.duplicate ? 'dup' : 'new'}`} onClick={() => setIdx(i)}>{charName(getCharacterDef(r.charId))}</button>)}</div>
              <div className="grow" />
              <Button small disabled={idx >= results.length - 1} onClick={() => setIdx(idx + 1)} data-testid="dossier-next">다음 지원서</Button>
            </> : <span>{cur ? '검토가 끝났습니다.' : '이력서를 확인하면 지원자의 정보가 공개됩니다.'}</span>}
          </div>
        </section>
      </div>
    </div>
  );
}
