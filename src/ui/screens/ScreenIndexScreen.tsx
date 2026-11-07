import { useEffect } from 'react';
import { useGame } from '../../core/gameStore';
import { useRouter, type ScreenId } from '../../core/router';
import { Button, Notice, ScreenHeader } from '../components/Common';

const LIST: [ScreenId, string, Record<string, unknown>?][] = [
  ['title', '1. 타이틀 화면'], ['saveLoad', '2·3. 새 게임/이어하기 · 세이브/로드'], ['main', '4. 메인 정부 운영'],
  ['facilities', '5. 시설 관리'], ['population', '6. 인구 관리'], ['research', '7. 연구 개발'], ['squad', '8. 개척부대'],
  ['recruit', '9. 이력서 확인'], ['expeditionPrep', '10. 개척 작전 준비'], ['expeditionMap', '11. 원정 지도', { party: ['aion', 'ling', 'zerag'], difficulty: 1 }],
  ['battle', '12. 실시간 전투', { party: ['shion_shirayuko', 'james_harold', 'aion'] }], ['result', '13. 원정 결과 및 정산', { outcome: 'return' }],
  ['tutorialPreview', '14. 튜토리얼 대화'],
];

/** Developer screen list for layout review. Creates a temporary session so every screen has data. */
export function ScreenIndexScreen() {
  const { state, newGame } = useGame();
  const go = useRouter((r) => r.go);
  useEffect(() => { if (!state) newGame(); }, [state, newGame]);
  return (
    <div className="screen" data-testid="screen-screenIndex">
      <ScreenHeader title="화면 목록 (개발용)" code="DEV · LAYOUT REVIEW" />
      <div className="screen-main col" style={{ flexDirection: 'column' }}>
        <Notice>레이아웃 검토용 화면입니다. 미리보기용 임시 세션이 자동으로 만들어집니다.</Notice>
        <div className="index-grid">
          {LIST.map(([id, label, params]) => (
            <Button key={id} block onClick={() => go(id, params)} data-testid={`idx-${id}`}>{label}</Button>
          ))}
        </div>
      </div>
    </div>
  );
}
