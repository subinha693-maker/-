import { useState } from 'react';
import { Button, Notice, Panel, ScreenHeader, Tabs } from '../components/Common';

export function RecruitScreen() {
  const [tab, setTab] = useState<'normal' | 'special'>('normal');
  return (
    <div className="screen" data-testid="screen-recruit">
      <ScreenHeader title="이력서 확인" code="PERSONNEL APPLICATION REVIEW" />
      <div className="screen-main">
        <Panel title="모집 구분" style={{ flex: 1 }} bodyClass="col grow">
          <Tabs items={[{ id: 'normal' as const, name: '일반 모집' }, { id: 'special' as const, name: '특별 모집' }]} value={tab} onChange={setTab} />
          <dl className="kv">
            <dt>모집 비용</dt><dd className="dim">미정</dd>
            <dt>등장 등급</dt><dd className="dim">미정</dd>
            <dt>확률 정보</dt><dd className="dim">미정</dd>
            <dt>천장</dt><dd className="dim">미정</dd>
          </dl>
          <Notice>모집 확률, 등급, 천장은 아직 정해지지 않았습니다. 이미 보유한 부대원이 나오면 중복 보상으로 전환됩니다(보상 내용 미정).</Notice>
          <div className="grow" />
          <div className="row">
            <Button className="grow" pendingPhase={5}>이력서 1건 확인</Button>
            <Button className="grow" pendingPhase={5}>이력서 10건 확인</Button>
          </div>
        </Panel>
        <section className="dossier" style={{ flex: 1.3 }}>
          <div className="dossier-head">
            <span>통합인류행정부 · 개척부대 지원서</span>
            <span className="stamp">검토 대기</span>
          </div>
          <div className="dossier-body">
            <div className="dossier-photo"><span>?</span></div>
            <dl className="kv dossier-kv">
              <dt>성명</dt><dd className="redact">████████</dd>
              <dt>출신</dt><dd className="redact">██████</dd>
              <dt>전문 분야</dt><dd className="redact">█████████</dd>
              <dt>등급</dt><dd className="redact">██</dd>
              <dt>경력 요약</dt><dd className="redact">██████████████</dd>
            </dl>
          </div>
          <div className="dossier-foot">지원서를 확인하면 지원자의 정보가 공개됩니다.</div>
        </section>
      </div>
    </div>
  );
}
