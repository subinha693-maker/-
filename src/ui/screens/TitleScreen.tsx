import { useState } from 'react';
import { useGame } from '../../core/gameStore';
import { useRouter } from '../../core/router';
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
  const newGame = useGame((g) => g.newGame);
  const reset = useRouter((r) => r.reset);
  const go = useRouter((r) => r.go);
  const [settings, setSettings] = useState(false);

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
          <Button variant="primary" block onClick={() => { newGame(); reset('main'); }} data-testid="btn-new-game">새 게임</Button>
          <Button block pendingPhase={2}>이어하기</Button>
          <Button block onClick={() => go('saveLoad', { mode: 'load' })} data-testid="btn-load">불러오기</Button>
          <Button block onClick={() => setSettings(true)} data-testid="btn-settings">설정</Button>
        </nav>
      </div>
      <footer className="title-foot">
        <span className="dim">v{CONFIG.version} · PHASE 1 프로토타입</span>
        <button className="link-btn" onClick={() => go('screenIndex')} data-testid="btn-screen-index">화면 목록 (개발용)</button>
      </footer>
      {settings && <SettingsModal onClose={() => setSettings(false)} />}
    </div>
  );
}
