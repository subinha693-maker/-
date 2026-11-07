import { useEffect, useState } from 'react';
import { Button, Modal } from '../components/Common';
import { useProfile } from '../../save/profile';

/** Settings. Fullscreen works now (important on mobile); sound/other options arrive with the save phase. */
export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [fs, setFs] = useState(!!document.fullscreenElement);
  const canFs = !!document.documentElement.requestFullscreen;
  const sound = useProfile((p) => p.profile.settings.sound);
  const update = useProfile((p) => p.update);
  const setSound = (k: keyof typeof sound, v: number) => update((p) => ({ ...p, settings: { ...p.settings, sound: { ...p.settings.sound, [k]: v } } }));
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
        {([['master', '전체 음량'], ['bgm', '배경음'], ['sfx', '효과음']] as const).map(([k, label]) => (
          <label key={k} className="row setting-row" htmlFor={`vol-${k}`}>
            <span className="grow">{label}</span>
            <input id={`vol-${k}`} className="slider" type="range" min={0} max={100} step={5} value={sound[k]} onChange={(e) => setSound(k, Number(e.target.value))} data-testid={`vol-${k}`} />
            <span className="num" style={{ width: 60, textAlign: 'right' }}>{sound[k]}</span>
          </label>
        ))}
        <span className="dim" style={{ fontSize: 'var(--fs-xs)' }}>사운드 설정은 기기에 저장됩니다. 실제 음향은 아직 없습니다.</span>
        <div className="row setting-row"><span className="grow">게임 속도 기본값</span><Button small pendingPhase={4}>조정</Button></div>
      </div>
    </Modal>
  );
}
