import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'pretendard/dist/web/variable/pretendardvariable.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';
import { App } from './ui/App';
import { validateData } from './data';
import { validateRegionData } from './systems/regions';
import { initSession } from './core/session';
import { startClock } from './core/loop';
import { useGame } from './core/gameStore';

const errors = [...validateData(), ...validateRegionData()];
if (errors.length) console.error('[data] integrity errors:\n' + errors.join('\n'));

const { repaired } = initSession();
if (repaired.length) console.warn('[save] recovered interrupted writes for slots', repaired);

startClock();
// Test hook (only with ?e2e): lets automated tests set up game states.
if (location.search.includes('e2e')) (window as unknown as { __uhaGame?: unknown }).__uhaGame = useGame;

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
