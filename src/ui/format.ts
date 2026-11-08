const nf = new Intl.NumberFormat('ko-KR');
export const fmtInt = (v: number) => nf.format(Math.floor(v));
export const fmtRate = (v: number) => {
  const a = Math.abs(v);
  const t = a >= 100 ? Math.round(a).toString() : a >= 10 ? a.toFixed(1) : a.toFixed(2).replace(/\.?0+$/, '') || '0';
  return `${v > 0.004 ? '+' : v < -0.004 ? '−' : '±'}${a < 0.005 ? '0' : t}`;
};
export const fmtHours = (minutes: number) => {
  const h = minutes / 60;
  return h >= 24 ? `${Math.floor(h / 24)}일 ${Math.round(h % 24)}시간` : h >= 1 ? `${Math.floor(h)}시간 ${Math.round(minutes % 60)}분` : `${Math.ceil(minutes)}분`;
};
export const costText = (cost: Record<string, number | undefined>, names: Record<string, string>) =>
  Object.entries(cost).filter(([, v]) => v).map(([k, v]) => `${names[k] ?? k} ${nf.format(v!)}`).join(' · ');
