import type { CSSProperties } from 'react';
import type { SpriteMeta } from '../../core/types';
import { asset } from './Icon';

/** Draws one frame of an atlas (rows = animations). `t` in seconds drives the frame. */
export function Sprite({ url, meta, anim, t, height, fps = 10, loop = true, style, className = '' }: {
  url: string; meta: SpriteMeta; anim: string; t: number; height: number; fps?: number; loop?: boolean; style?: CSSProperties; className?: string;
}) {
  const a = meta.anims[anim] ?? meta.anims.idle ?? meta.anims.wait ?? Object.values(meta.anims)[0];
  const n = a.frames;
  const f = loop ? Math.floor(t * fps) % n : Math.min(n - 1, Math.floor(t * fps));
  const k = height / meta.frameH;
  const w = meta.frameW * k;
  return (
    <div className={`sprite ${className}`} style={{
      width: w, height, backgroundImage: `url(${asset(url)})`, backgroundRepeat: 'no-repeat',
      backgroundSize: `${meta.cols * w}px auto`, backgroundPosition: `${-f * w}px ${-a.row * height}px`, ...style,
    }} />
  );
}
