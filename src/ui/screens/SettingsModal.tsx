import { useEffect, useState } from 'react';
import { Button, Modal } from '../components/Common';

/** Settings. Fullscreen works now (important on mobile); sound/other options arrive with the save phase. */
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [fs, setFs] = useState(!!document.fullscreenElement);
  const canFs = !!document.documentElement.requestFullscreen;
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFs = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        await document.documentElement.requestFullscreen();
        const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
        await o.lock?.('landscape').catch(() => {});
      }
    } catch { /* browser refused (e.g. iOS Safari) */ }
  };
  return (
    <Modal title="설정" actions={<Button variant="primary" onClick={onClose} data-testid="settings-close">닫기</Button>}>
      <div className="col">
        <div className="row setting-row">
          <span className="grow">전체 화면</span>
          <Button small onClick={toggleFs} disabled={!canFs} data-testid="toggle-fullscreen">{fs ? '해제' : '전환'}</Button>
        </div>
        {!canFs && <span className="dim" style={{ fontSize: 'var(--fs-xs)' }}>이 브라우저는 전체 화면을 지원하지 않습니다. 홈 화면에 추가하면 전체 화면으로 실행됩니다.</span>}
        <div className="row setting-row"><span className="grow">사운드</span><Button small pendingPhase={2}>조정</Button></div>
        <div className="row setting-row"><span className="grow">게임 속도 기본값</span><Button small pendingPhase={4}>조정</Button></div>
      </div>
    </Modal>
  );
}
