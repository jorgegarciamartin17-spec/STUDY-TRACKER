import type { DateStr, ID, ItemAction, Subject, Task, Topic } from '../db/types';
import { daysBetween, isWeekend, relativeDays } from './dates';
import type { SubjectRisk } from './progress';

export type TodayGroup = 'urgent' | 'today' | 'extra';

export interface TodayItem {
  key: string;
  kind: 'cleanup' | 'exercises' | 'task';
  title: string;
  reason: string;
  score: number;
  minutes: number;
  group: TodayGroup;
  subjectId?: ID;
  topicId?: ID;
  taskId?: ID;
}

export interface TodayInput {
  today: DateStr;
  subjects: Subject[];
  topics: Topic[];
  tasks: Task[];
  actions: ItemAction[];
  risks: Record<ID, SubjectRisk>;
  minutesWeekday: number;
  minutesWeekend: number;
  cleanupThresholdDays: number;
}

export interface TodayPlan {
  items: TodayItem[];
  budgetMinutes: number;
  plannedMinutes: number;
}

export const MINUTES = { cleanup: 40, exercises: 50, task: 60 };
export const URGENT_SCORE = 90;
/** Máximo de temas "hacer ejercicios" por asignatura, para no inundar la lista. */
export const MAX_EXERCISE_ITEMS_PER_SUBJECT = 2;
const EXAM_BOOST_DAYS = 14;

export const topicKey = (t: Topic) => `topic:${t.id}:s${t.status}`;
export const taskKey = (t: Task) => `task:${t.id}`;

export function buildToday(input: TodayInput): TodayPlan {
  const { today, risks } = input;
  const subjects = new Map(input.subjects.filter((s) => !s.archived).map((s) => [s.id, s]));

  const hidden = new Set<string>();
  for (const a of input.actions) {
    if (a.action === 'snoozed' && a.until && a.until > today) hidden.add(a.itemKey);
    if (a.action === 'done' && a.date === today) hidden.add(a.itemKey);
  }

  const items: Omit<TodayItem, 'group'>[] = [];
  const examBoost = (subjectId: ID) => {
    const r = risks[subjectId];
    return r?.daysLeft !== undefined && r.daysLeft <= EXAM_BOOST_DAYS ? 10 : 0;
  };

  const exercisesBySubject = new Map<ID, number>();
  const topics = input.topics
    .filter((t) => subjects.has(t.subjectId))
    .sort((a, b) => a.order - b.order);

  for (const t of topics) {
    const subject = subjects.get(t.subjectId)!;
    const label = `${t.title} · ${subject.name}`;

    if (t.status === 1) {
      const days = Math.max(0, daysBetween(t.seenAt ?? today, today));
      const late = days > input.cleanupThresholdDays;
      items.push({
        key: topicKey(t),
        kind: 'cleanup',
        title: `Pasar a limpio: ${label}`,
        reason: days === 0 ? 'Visto hoy en clase' : `Visto hace ${days} ${days === 1 ? 'día' : 'días'}`,
        score: (late ? 70 + days * 3 : 55) + examBoost(t.subjectId),
        minutes: MINUTES.cleanup,
        subjectId: t.subjectId,
        topicId: t.id,
      });
    } else if (t.status === 2) {
      const n = exercisesBySubject.get(t.subjectId) ?? 0;
      if (n >= MAX_EXERCISE_ITEMS_PER_SUBJECT) continue;
      exercisesBySubject.set(t.subjectId, n + 1);
      const level = risks[t.subjectId]?.level;
      const base = level === 'red' ? 50 : level === 'yellow' ? 35 : 20;
      items.push({
        key: topicKey(t),
        kind: 'exercises',
        title: `Hacer ejercicios: ${label}`,
        reason: level === 'red' ? 'Asignatura en riesgo' : 'Apuntes listos, faltan problemas',
        score: base + examBoost(t.subjectId),
        minutes: MINUTES.exercises,
        subjectId: t.subjectId,
        topicId: t.id,
      });
    }
  }

  for (const task of input.tasks) {
    if (task.done) continue;
    if (task.subjectId && !subjects.has(task.subjectId)) continue;
    const d = daysBetween(today, task.dueDate);
    if (d > 7) continue;
    const subject = task.subjectId ? subjects.get(task.subjectId) : undefined;
    const score = d <= 1 ? 100 + Math.max(0, -d) * 5 : 40 + (7 - d) * 5;
    items.push({
      key: taskKey(task),
      kind: 'task',
      title: subject ? `${task.title} · ${subject.name}` : task.title,
      reason: d < 0 ? `Vencida ${relativeDays(today, task.dueDate)}` : `Entrega ${relativeDays(today, task.dueDate)}`,
      score,
      minutes: task.estimatedMinutes ?? MINUTES.task,
      subjectId: task.subjectId,
      taskId: task.id,
    });
  }

  const visible = items.filter((i) => !hidden.has(i.key)).sort((a, b) => b.score - a.score);
  const budgetMinutes = isWeekend(today) ? input.minutesWeekend : input.minutesWeekday;

  let used = 0;
  const result: TodayItem[] = visible.map((i) => {
    let group: TodayGroup;
    if (i.score >= URGENT_SCORE) group = 'urgent';
    else if (used + i.minutes <= budgetMinutes) group = 'today';
    else group = 'extra';
    if (group !== 'extra') used += i.minutes;
    return { ...i, group };
  });

  return { items: result, budgetMinutes, plannedMinutes: used };
}
