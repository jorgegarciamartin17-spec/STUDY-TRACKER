import type { DateStr, Subject, Topic, TopicStatus } from '../db/types';
import { addDays, daysBetween } from './dates';

/** Cuánto vale cada estado en el avance de una asignatura (0 a 1). */
export const STATUS_WEIGHT: Record<TopicStatus, number> = { 0: 0, 1: 0.25, 2: 0.5, 3: 0.75, 4: 1 };

/** Días antes del examen reservados para repasar: el avance esperado llega al 100 % ahí. */
export const REVIEW_WINDOW_DAYS = 7;
export const YELLOW_GAP = 10;
export const RED_GAP = 25;
export const MAX_BACKLOG = 3;

export type RiskLevel = 'green' | 'yellow' | 'red' | 'none' | 'finished';

export interface Evaluation {
  name: string;
  date: DateStr;
  kind: 'exam' | 'partial';
  untilTopic?: number;
}

export interface SubjectProgress {
  /** Número de temas en cada estado, índice = estado. */
  counts: [number, number, number, number, number];
  total: number;
  /** Avance real, 0–100. */
  percent: number;
}

export interface SubjectRisk {
  level: RiskLevel;
  /** Próxima evaluación (parcial o final) que se usa para medir el riesgo. */
  target?: Evaluation;
  daysLeft?: number;
  actual: number;
  expected: number;
  /** Temas vistos en clase aún sin pasar a limpio. */
  backlog: number;
  reason: string;
}

export function computeProgress(topics: Topic[]): SubjectProgress {
  const counts: SubjectProgress['counts'] = [0, 0, 0, 0, 0];
  let sum = 0;
  for (const t of topics) {
    counts[t.status]++;
    sum += STATUS_WEIGHT[t.status];
  }
  const total = topics.length;
  return { counts, total, percent: total ? Math.round((sum / total) * 100) : 0 };
}

export function evaluations(subject: Subject): Evaluation[] {
  const list: Evaluation[] = subject.partials.map((p) => ({
    name: p.name,
    date: p.date,
    kind: 'partial',
    untilTopic: p.untilTopic,
  }));
  if (subject.examDate) list.push({ name: 'Examen final', date: subject.examDate, kind: 'exam' });
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

export function nextEvaluation(subject: Subject, today: DateStr): Evaluation | undefined {
  return evaluations(subject).find((e) => e.date >= today);
}

/** Temas ordenados que entran en una evaluación (un parcial puede cubrir solo los primeros). */
export function topicsForEvaluation(topics: Topic[], ev?: Evaluation): Topic[] {
  const sorted = [...topics].sort((a, b) => a.order - b.order);
  if (!ev?.untilTopic) return sorted;
  return sorted.slice(0, ev.untilTopic);
}

export function expectedPercent(semesterStart: DateStr, target: DateStr, today: DateStr): number {
  const prepEnd = addDays(target, -REVIEW_WINDOW_DAYS);
  const span = daysBetween(semesterStart, prepEnd);
  if (span <= 0) return 100;
  const frac = daysBetween(semesterStart, today) / span;
  return Math.round(Math.min(1, Math.max(0, frac)) * 100);
}

export function computeRisk(
  subject: Subject,
  topics: Topic[],
  today: DateStr,
  semesterStart: DateStr,
): SubjectRisk {
  const backlog = topics.filter((t) => t.status === 1).length;
  const target = nextEvaluation(subject, today);
  const overall = computeProgress(topics).percent;

  if (!target) {
    const finished = evaluations(subject).length > 0;
    return {
      level: finished ? 'finished' : 'none',
      actual: overall,
      expected: 0,
      backlog,
      reason: finished ? 'Evaluaciones terminadas' : 'Sin fecha de examen',
    };
  }

  const scoped = topicsForEvaluation(topics, target);
  const actual = computeProgress(scoped).percent;
  const expected = expectedPercent(semesterStart, target.date, today);
  const gap = expected - actual;
  const daysLeft = daysBetween(today, target.date);

  let level: RiskLevel = 'green';
  if (gap > RED_GAP || backlog > MAX_BACKLOG) level = 'red';
  else if (gap > YELLOW_GAP) level = 'yellow';

  let reason: string;
  if (backlog > MAX_BACKLOG) reason = `${backlog} temas vistos sin pasar a limpio`;
  else if (gap > 0) reason = `${gap} puntos por debajo de lo esperado`;
  else reason = 'Vas al día';

  return { level, target, daysLeft, actual, expected, backlog, reason };
}
