import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { TopicStatus } from '../db/types';
import { STATUS_SHORT } from '../db/types';
import type { RiskLevel } from '../domain/progress';

export function cx(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900', className)}>
      {children}
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700',
  secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  danger: 'bg-red-600 text-white hover:bg-red-500',
};

export function Button({
  variant = 'secondary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
    />
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 first-letter:uppercase dark:text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

/** Ventana modal; en el móvil se muestra como hoja desde abajo. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="bottom-safe max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-lg sm:rounded-3xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="rounded-full p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const STATUS_STYLES: Record<TopicStatus, string> = {
  0: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  1: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  2: 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300',
  3: 'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300',
  4: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
};

export const STATUS_BAR: Record<TopicStatus, string> = {
  0: 'bg-slate-300 dark:bg-slate-700',
  1: 'bg-amber-400',
  2: 'bg-sky-500',
  3: 'bg-violet-500',
  4: 'bg-emerald-500',
};

export function StatusChip({ status, onClick, title }: { status: TopicStatus; onClick?: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cx('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition active:scale-95', STATUS_STYLES[status])}
    >
      {STATUS_SHORT[status]}
    </button>
  );
}

/** Barra apilada con el reparto de temas por estado. */
export function StatusBar({ counts }: { counts: number[] }) {
  const total = counts.reduce((a, b) => a + b, 0);
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      {total > 0 &&
        ([4, 3, 2, 1] as TopicStatus[]).map((s) =>
          counts[s] ? <div key={s} className={STATUS_BAR[s]} style={{ width: `${(counts[s] / total) * 100}%` }} /> : null,
        )}
    </div>
  );
}

const RISK_STYLE: Record<RiskLevel, { dot: string; label: string }> = {
  green: { dot: 'bg-emerald-500', label: 'Al día' },
  yellow: { dot: 'bg-amber-400', label: 'Atención' },
  red: { dot: 'bg-red-500', label: 'En riesgo' },
  none: { dot: 'bg-slate-300 dark:bg-slate-600', label: 'Sin examen' },
  finished: { dot: 'bg-slate-300 dark:bg-slate-600', label: 'Terminada' },
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  const s = RISK_STYLE[level];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
      <span className={cx('h-2.5 w-2.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{children}</div>}
    </div>
  );
}

// ---------- Avisos con "Deshacer" ----------

interface ToastData {
  id: number;
  text: string;
  undo?: () => void;
}
const ToastCtx = createContext<(text: string, undo?: () => void) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((text: string, undo?: () => void) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), text, undo });
    timer.current = window.setTimeout(() => setToast(null), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 sm:bottom-6">
          <div role="status" className="pointer-events-auto flex items-center gap-4 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
            <span>{toast.text}</span>
            {toast.undo && (
              <button
                type="button"
                className="font-semibold text-indigo-300 dark:text-indigo-600"
                onClick={() => {
                  toast.undo?.();
                  setToast(null);
                }}
              >
                Deshacer
              </button>
            )}
          </div>
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
