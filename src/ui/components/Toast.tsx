import { useEffect } from 'react';
import { create } from 'zustand';

interface ToastItem { id: number; text: string; tone: 'info' | 'warn' | 'danger' }
interface ToastStore { items: ToastItem[]; push: (text: string, tone?: ToastItem['tone']) => void; drop: (id: number) => void }
let seq = 0;
export const useToast = create<ToastStore>((set) => ({
  items: [],
  push: (text, tone = 'info') => set((s) => ({ items: [...s.items.slice(-2), { id: ++seq, text, tone }] })),
  drop: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

function Item({ t }: { t: ToastItem }) {
  const drop = useToast((s) => s.drop);
  useEffect(() => { const h = setTimeout(() => drop(t.id), t.tone === 'info' ? 2600 : 6000); return () => clearTimeout(h); }, [t, drop]);
  return <div className={`toast ${t.tone}`} role="status" data-testid="toast" onClick={() => drop(t.id)}>{t.text}</div>;
}
export function ToastHost() {
  const items = useToast((s) => s.items);
  return <div className="toast-host">{items.map((t) => <Item key={t.id} t={t} />)}</div>;
}
