const BASE = import.meta.env.BASE_URL;
/** Monochrome icon from public/assets/icons/mil (SVG). Color follows CSS currentColor. */
export function Icon({ name, size = 32, color, title }: { name: string; size?: number; color?: string; title?: string }) {
  return (
    <i
      className="icon"
      aria-label={title}
      role={title ? 'img' : undefined}
      style={{ width: size, height: size, color, WebkitMaskImage: `url(${BASE}assets/icons/mil/${name}.svg)`, maskImage: `url(${BASE}assets/icons/mil/${name}.svg)` }}
    />
  );
}
/** Small teal system icon (Wenrexa hologram set, PNG). */
export function SysIcon({ name, size = 30 }: { name: string; size?: number }) {
  return <img src={`${BASE}assets/icons/sys/${name}.png`} width={size} height={size} alt="" style={{ objectFit: 'contain', flex: 'none' }} />;
}
export const asset = (path: string) => `${BASE}assets/${path}`;
