import type { ReactNode, ButtonHTMLAttributes, CSSProperties } from 'react';
import { useRouter } from '../../core/router';
import { SysIcon } from './Icon';

export function Panel({ title, tail, children, className = '', bodyClass = '', style, flat, tut }: {
  title?: ReactNode; tail?: ReactNode; children?: ReactNode; className?: string; bodyClass?: string; style?: CSSProperties; flat?: boolean; tut?: string;
}) {
  return (
    <section className={`panel ${flat ? 'flat' : ''} ${className}`} style={style} data-tut={tut}>
      {title && <header className="panel-head">{title}{tail && <div className="tail">{tail}</div>}</header>}
      <div className={`panel-body ${bodyClass}`}>{children}</div>
    </section>
  );
}

/** Marks a control whose function arrives in a later phase. Rendered disabled so no button lies about working. */
export function PhaseTag({ phase }: { phase: number }) {
  return <span className="tag placeholder phase-tag">PHASE {phase} 예정</span>;
}
export function PlaceholderTag({ label = '임시 데이터' }: { label?: string }) {
  return <span className="tag placeholder">{label}</span>;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger'; small?: boolean; block?: boolean; pendingPhase?: number };
export function Button({ variant, small, block, pendingPhase, className = '', children, disabled, ...rest }: BtnProps) {
  const cls = ['btn', variant, small && 'small', block && 'block', className].filter(Boolean).join(' ');
  return (
    <button className={cls} disabled={disabled || pendingPhase !== undefined} {...rest}>
      {children}
      {pendingPhase !== undefined && <PhaseTag phase={pendingPhase} />}
    </button>
  );
}

export function ScreenHeader({ title, code, tail, onBack }: { title: string; code?: string; tail?: ReactNode; onBack?: () => void }) {
  const back = useRouter((s) => s.back);
  return (
    <header className="screen-head">
      <Button className="back-btn" aria-label="뒤로" onClick={onBack ?? back} data-testid="back">
        <span style={{ fontSize: 36, lineHeight: 1 }}>‹</span>
      </Button>
      <div className="col" style={{ gap: 2 }}>
        {code && <span className="code">{code}</span>}
        <h1>{title}</h1>
      </div>
      <div className="tail">{tail}</div>
    </header>
  );
}

export function Tabs<T extends string>({ items, value, onChange }: { items: { id: T; name: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((t) => (
        <button key={t.id} role="tab" className={`tab ${t.id === value ? 'on' : ''}`} aria-selected={t.id === value} onClick={() => onChange(t.id)}>
          {t.name}
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, children, actions, warn }: { title: string; children: ReactNode; actions: ReactNode; warn?: boolean }) {
  return (
    <div className="modal-veil" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`modal ${warn ? 'warn' : ''}`}>
        <header className="panel-head">{title}</header>
        <div className="panel-body" style={{ fontSize: 'var(--fs-m)' }}>{children}</div>
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = '확인', onConfirm, onCancel, warn }: {
  title: string; message: ReactNode; confirmLabel?: string; onConfirm: () => void; onCancel: () => void; warn?: boolean;
}) {
  return (
    <Modal title={title} warn={warn} actions={<>
      <Button variant="ghost" onClick={onCancel}>취소</Button>
      <Button variant="primary" onClick={onConfirm} data-testid="confirm">{confirmLabel}</Button>
    </>}>
      {message}
    </Modal>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="notice"><SysIcon name="info" size={24} />{children}</div>;
}

export function Bar({ value, max = 100, tone }: { value: number; max?: number; tone?: 'warn' | 'danger' }) {
  return <div className={`bar ${tone ?? ''}`}><i style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} /></div>;
}
