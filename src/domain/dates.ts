import type { DateStr } from '../db/types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha local de hoy (o de `d`) como YYYY-MM-DD. */
export function toDateStr(d: Date = new Date()): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDate(s: DateStr): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: DateStr, n: number): DateStr {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** Días de calendario de `a` a `b` (positivo si b es posterior). */
export function daysBetween(a: DateStr, b: DateStr): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);
}

export function isWeekend(s: DateStr): boolean {
  const day = parseDate(s).getDay();
  return day === 0 || day === 6;
}

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function formatLong(s: DateStr): string {
  const d = parseDate(s);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

export function formatShort(s: DateStr): string {
  const d = parseDate(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

/** "hoy", "mañana", "en 5 días", "hace 2 días" */
export function relativeDays(from: DateStr, to: DateStr): string {
  const n = daysBetween(from, to);
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  return n > 0 ? `en ${n} días` : `hace ${-n} días`;
}

/** Inicio de cuatrimestre por defecto si el usuario no lo ha indicado. */
export function defaultSemesterStart(today: DateStr): DateStr {
  const d = parseDate(today);
  const m = d.getMonth() + 1;
  const y = d.getFullYear();
  if (m >= 9) return `${y}-09-08`;
  if (m === 1) return `${y - 1}-09-08`;
  return `${y}-02-01`;
}
