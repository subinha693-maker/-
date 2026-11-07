import { useState } from 'react';
import { useRouter } from '../../core/router';
import { useGame } from '../../core/gameStore';
import { CONFIG } from '../../core/config';
import { Button, Notice, Panel, ScreenHeader, Tabs } from '../components/Common';

type Mode = 'save' | 'load';

export function SaveLoadScreen() {
  const params = useRouter((r) => r.params);
  const hasGame = useGame((g) => !!g.state);
  const [mode, setMode] = useState<Mode>(hasGame ? ((params.mode as Mode) ?? 'save') : 'load');
  const [sel, setSel] = useState(1);
  const slots = Array.from({ length: CONFIG.save.slotCount }, (_, i) => i + 1);
  const modes = hasGame ? [{ id: 'save' as const, name: '저장' }, { id: 'load' as const, name: '불러오기' }] : [{ id: 'load' as const, name: '불러오기' }];

  return (
    <div className="screen" data-testid="screen-saveLoad">
      <ScreenHeader title="저장 / 불러오기" code="DATA ARCHIVE" />
      <div className="screen-main">
        <Panel title="저장 슬롯" style={{ flex: 2 }} bodyClass="col grow">
          <Tabs items={modes} value={mode} onChange={setMode} />
          <table className="table">
            <thead><tr><th>슬롯</th><th>저장 일시</th><th>게임 내 날짜</th><th>진행 요약</th><th>원정</th><th>상태</th></tr></thead>
            <tbody>
              <tr className="dim"><td>자동</td><td>—</td><td>—</td><td>—</td><td>—</td><td>비어 있음</td></tr>
              {slots.map((n) => (
                <tr key={n} className={`click ${sel === n ? 'sel' : ''}`} onClick={() => setSel(n)} data-testid={`slot-${n}`}>
                  <td className="num">{String(n).padStart(2, '0')}</td><td>—</td><td>—</td><td>—</td><td>—</td><td className="dim">비어 있음</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grow" />
          <Notice>저장 슬롯 수({CONFIG.save.slotCount}개)는 설정값이며 아직 확정되지 않았습니다. 전투 중에는 저장할 수 없고, 불러오면 전투 시작 직전으로 돌아갑니다.</Notice>
        </Panel>
        <Panel title={`슬롯 ${String(sel).padStart(2, '0')}`} style={{ flex: 1 }} bodyClass="col grow">
          <div className="empty grow">저장 데이터 없음</div>
          {mode === 'save' ? <Button variant="primary" pendingPhase={2}>이 슬롯에 저장</Button> : <Button variant="primary" pendingPhase={2}>불러오기</Button>}
          <Button variant="danger" pendingPhase={2}>삭제</Button>
        </Panel>
      </div>
    </div>
  );
}
