import type { FacilityInstance } from '../../core/types';
import { getFacilityDef } from '../../data';
import { asset } from './Icon';

const TW = 260, TH = 150, N = 7; // isometric tile size and grid extent

/** Isometric view of the administration district built from pre-rendered Kenney sprites. */
export function BaseView({ facilities, selected, onSelect }: { facilities: FacilityInstance[]; selected: string | null; onSelect: (uid: string | null) => void }) {
  const iso = (gx: number, gy: number) => ({ x: (gx - gy) * (TW / 2), y: (gx + gy) * (TH / 2) });
  const tiles = [];
  for (let gx = 0; gx < N; gx++) for (let gy = 0; gy < N; gy++) {
    const p = iso(gx, gy);
    tiles.push(<polygon key={`${gx}-${gy}`} points={`${p.x},${p.y - TH / 2} ${p.x + TW / 2},${p.y} ${p.x},${p.y + TH / 2} ${p.x - TW / 2},${p.y}`} className={(gx + gy) % 2 ? 't1' : 't2'} />);
  }
  const sorted = [...facilities].sort((a, b) => a.grid[0] + a.grid[1] - (b.grid[0] + b.grid[1]));
  const center = iso((N - 1) / 2, (N - 1) / 2);
  return (
    <div className="base-view" onClick={() => onSelect(null)}>
      <div className="base-world" style={{ transform: `translate(${-center.x}px, ${-center.y}px)` }}>
        <svg className="base-ground" width={N * TW} height={N * TH} viewBox={`${-N * TW / 2} ${-TH / 2} ${N * TW} ${N * TH}`} style={{ left: -N * TW / 2, top: -TH / 2 }}>
          {tiles}
        </svg>
        {sorted.map((f) => {
          const def = getFacilityDef(f.defId);
          if (!def) return null;
          const p = iso(f.grid[0], f.grid[1]);
          return (
            <button
              key={f.uid}
              className={`base-bld ${selected === f.uid ? 'sel' : ''}`}
              style={{ left: p.x, top: p.y + TH * 0.28, width: def.spriteWidth, zIndex: 10 + f.grid[0] + f.grid[1] }}
              onClick={(e) => { e.stopPropagation(); onSelect(f.uid); }}
              aria-label={def.name}
              data-testid={`bld-${f.uid}`}
            >
              <img src={asset(`sprites/kenney/${def.sprite}.png`)} alt="" draggable={false} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
