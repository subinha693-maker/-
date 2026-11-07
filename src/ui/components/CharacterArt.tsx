import type { CSSProperties } from 'react';
import type { CharacterDef } from '../../core/types';
import { asset } from './Icon';

/**
 * Shows a full-body illustration inside a frame. zoom=1 fits the width; zoom>1 crops toward
 * the data-defined focus point (percent), used for bust/face crops on cards.
 */
export function CharacterArt({ def, zoom = 1, style, className = '' }: { def: CharacterDef; zoom?: number; style?: CSSProperties; className?: string }) {
  const [fx, fy] = def.art.focus;
  return (
    <div
      className={`portrait ${className}`}
      role="img"
      aria-label={def.name ?? def.id}
      style={{
        backgroundImage: `url(${asset(def.art.full)}), linear-gradient(180deg, #1c2730, #121a21)`,
        backgroundSize: `${zoom * 100}% auto, cover`,
        backgroundPosition: `${fx}% ${fy}%, center`,
        backgroundRepeat: 'no-repeat',
        ...style,
      }}
    />
  );
}
