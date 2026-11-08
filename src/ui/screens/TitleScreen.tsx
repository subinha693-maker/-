import { useMemo, useState } from 'react';
import { useRouter } from '../../core/router';
import { continueLatest, newGameSession, saves } from '../../core/session';
import { CONFIG } from '../../core/config';
import { Button } from '../components/Common';
import { asset } from '../components/Icon';
import { SettingsModal } from './SettingsModal';

// Skyline composition for the title backdrop (rendered Kenney sprites).
const SKYLINE: [string, number, number][] = [
  ['com-skyscraper-d', 46, 120], ['ind-chimney-large', 52, 90], ['com-skyscraper-b', 57, 130], ['ind-building-m', 64, 200],
  ['com-skyscraper-e', 71, 150], ['ind-water-tower', 77, 80], ['com-skyscraper-c', 82, 130], ['ind-building-l', 88, 170],
  ['com-skyscraper-a', 94, 120], ['ind-chimney-medium', 98, 70],
];

export function TitleScreen() {
  const go = useRouter((r) => r.go);
  const [settings, setSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useMemo(() => saves.latest(), []);
  const onContinue = () => { const r = continueLatest(); if (r && !r.ok) setError(r.message); };

  return (
    <div className="screen title-screen" data-testid="screen-title">
      <div className="title-sky">
        {SKYLINE.map(([s, x, w]) => (
          <img key={s + x} src={asset(`sprites/kenney/${s}.png`)} alt="" style={{ left: `${x}%`, width: w }} />
        ))}
        <div className="title-fog" />
      </div>
      <div className="title-grid" />
      <div className="title-block">
        <div className="title-kicker">INTEGRATED GOVERNMENT TERMINAL</div>
        <h1 className="title-main">통합인류행정부</h1>
        <div className="title-sub">UNIFIED HUMAN ADMINISTRATION</div>
        <nav className="title-menu">
          <Button variant="primary" block onClick={newGameSession} data-testid="btn-new-game">새 게임</Button>
          <Button block disabled={!latest} onClick={onContinue} data-testid="btn-continue">
            이어하기
            {latest?.meta && <span className="btn-sub">{latest.slot === 'auto' ? '자동' : `슬롯 ${latest.slot}`} · {latest.meta.summary.gameDate} {latest.meta.summary.gameTime}</span>}
          </Button>
          <Button block onClick={() => go('saveLoad', { mode: 'load' })} data-testid="btn-load">불러오기</Button>
          <Button block onClick={() => setSettings(true)} data-testid="btn-settings">설정</Button>
        </nav>
        {error && <div className="notice danger-notice" style={{ marginTop: 16, width: 480 }} data-testid="title-error">{error}</div>}
      </div>
      <footer className="title-foot">
        <span className="dim">v{CONFIG.version} · PHASE 9 프로토타입</span>
        <button className="link-btn" onClick={() => go('screenIndex')} data-testid="btn-screen-index">화면 목록 (개발용)</button>
      </footer>
      {settings && <SettingsModal onClose={() => setSettings(false)} />}
    </div>
  );
}
