import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'pretendard/dist/web/variable/pretendardvariable.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';
import { App } from './ui/App';
import { validateData } from './data';
import { initSession } from './core/session';
import { startClock } from './core/loop';

const errors = validateData();
if (errors.length) console.error('[data] integrity errors:\n' + errors.join('\n'));

const { repaired } = initSession();
if (repaired.length) console.warn('[save] recovered interrupted writes for slots', repaired);

startClock();

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
