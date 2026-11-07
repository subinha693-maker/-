import { useEffect, useState, type ReactNode } from 'react';
import { CONFIG } from '../../core/config';

const { baseWidth, baseHeight, maxWidth } = CONFIG.display;

/** Computes the logical stage size: height fixed at 1080, width grows (1920..2400) to fill wide phones. */
function measure() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const width = Math.round(Math.min(maxWidth, Math.max(baseWidth, (vw / vh) * baseHeight)));
  const scale = Math.min(vw / width, vh / baseHeight);
  return { width, scale };
}

export function Stage({ children }: { children: ReactNode }) {
  const [m, setM] = useState(measure);
  useEffect(() => {
    const on = () => setM(measure());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); };
  }, []);
  return (
    <div className="viewport">
      <div
        className="stage"
        data-testid="stage"
        style={{ width: m.width, height: baseHeight, transform: `scale(${m.scale}) translate(-50%, -50%)` }}
      >
        {children}
      </div>
      <div className="rotate-hint">
        <div className="phone" />
        기기를 가로로 회전해 주세요
      </div>
    </div>
  );
}
