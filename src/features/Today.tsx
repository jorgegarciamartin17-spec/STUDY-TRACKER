import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Button, Card, cx, EmptyState, PageHeader, useToast } from '../components/ui';
import { subjectStats, useActions, useSettings, useSubjects, useTasks, useToday, useTopics } from '../data/hooks';
import { deleteAction, recordAction, setTaskDone, setTopicStatus } from '../data/repo';
import type { TopicStatus } from '../db/types';
import { daysBetween, formatLong } from '../domain/dates';
import { nextEvaluation } from '../domain/progress';
import { buildToday, type TodayGroup, type TodayItem } from '../domain/today';
import { BackupReminder } from './Settings';

const GROUP_TITLES: Record<TodayGroup, string> = {
  urgent: 'Urgente',
  today: 'Para hoy',
  extra: 'Si te da tiempo',
};

export function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export default function Today() {
  const today = useToday();
  const settings = useSettings();
  const subjects = useSubjects();
  const topics = useTopics();
  const tasks = useTasks();
  const actions = useActions();
  const toast = useToast();
  const [showExtra, setShowExtra] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const data = useMemo(() => {
    if (!settings || !subjects || !topics || !tasks || !actions) return null;
    const active = subjects.filter((s) => !s.archived);
    const stats = subjectStats(active, topics, settings, today);
    const risks = Object.fromEntries(stats.map((s) => [s.subject.id, s.risk]));
    const plan = buildToday({
      today,
      subjects: active,
      topics,
      tasks,
      actions,
      risks,
      minutesWeekday: settings.minutesWeekday,
      minutesWeekend: settings.minutesWeekend,
      cleanupThresholdDays: settings.cleanupThresholdDays,
    });
    const nextExams = active
      .map((s) => ({ subject: s, ev: nextEvaluation(s, today) }))
      .filter((x) => x.ev && daysBetween(today, x.ev.date) <= 30)
      .sort((a, b) => a.ev!.date.localeCompare(b.ev!.date));
    const doneToday = actions.filter((a) => a.action === 'done' && a.date === today);
    return { active, plan, nextExams, doneToday, colors: new Map(active.map((s) => [s.id, s.color])) };
  }, [settings, subjects, topics, tasks, actions, today]);

  if (!data || !settings) return null;
  const { plan, active, nextExams, doneToday, colors } = data;

  async function done(item: TodayItem) {
    let undoChange: () => Promise<void>;
    if (item.kind === 'task' && item.taskId) {
      await setTaskDone(item.taskId, true);
      undoChange = () => setTaskDone(item.taskId!, false);
    } else {
      const from: TopicStatus = item.kind === 'cleanup' ? 1 : 2;
      await setTopicStatus(item.topicId!, (from + 1) as TopicStatus, today);
      undoChange = () => setTopicStatus(item.topicId!, from, today);
    }
    const actionId = await recordAction({ itemKey: item.key, action: 'done', label: item.title, subjectId: item.subjectId }, today);
    toast('¡Hecho!', async () => {
      await undoChange();
      await deleteAction(actionId);
    });
  }

  async function snooze(item: TodayItem) {
    const actionId = await recordAction({ itemKey: item.key, action: 'snoozed', label: item.title, subjectId: item.subjectId }, today);
    toast('Pospuesto a mañana', () => deleteAction(actionId));
  }

  const groups = (['urgent', 'today', 'extra'] as TodayGroup[]).map((g) => ({ g, items: plan.items.filter((i) => i.group === g) }));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Hoy" subtitle={formatLong(today)} />

      <BackupReminder settings={settings} hasData={active.length > 0} />

      {nextExams.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {nextExams.map(({ subject, ev }) => {
            const d = daysBetween(today, ev!.date);
            return (
              <div
                key={subject.id + ev!.date}
                className={cx(
                  'shrink-0 rounded-xl border px-3 py-2 text-sm',
                  d <= 7 ? 'border-red-300 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
                )}
              >
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: subject.color }} />
                <span className="font-medium">{subject.name}</span>
                <span className="text-slate-500"> · {ev!.kind === 'exam' ? 'examen' : ev!.name} {d === 0 ? 'hoy' : `en ${d} d`}</span>
              </div>
            );
          })}
        </div>
      )}

      {active.length === 0 ? (
        <EmptyState title="Aún no tienes asignaturas">
          <Link to="/asignaturas" className="font-medium text-indigo-600 dark:text-indigo-400">
            Añade tus asignaturas
          </Link>{' '}
          y aquí verás cada día qué te toca.
        </EmptyState>
      ) : (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Plan de hoy: <strong className="text-slate-900 dark:text-slate-100">{formatMinutes(plan.plannedMinutes)}</strong> de{' '}
            {formatMinutes(plan.budgetMinutes)} disponibles
            {plan.plannedMinutes > plan.budgetMinutes && <span className="text-red-600 dark:text-red-400"> (lo urgente no cabe: prioriza)</span>}
          </p>

          {plan.items.length === 0 && <EmptyState title="Nada pendiente para hoy 🎉">Vas al día. Aprovecha para adelantar ejercicios o descansar.</EmptyState>}

          {groups.map(({ g, items }) => {
            if (!items.length) return null;
            const collapsed = g === 'extra' && !showExtra;
            return (
              <section key={g} className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={g !== 'extra'}
                  onClick={() => setShowExtra((v) => !v)}
                  className="flex items-center justify-between text-left text-xs font-semibold tracking-wide text-slate-500 uppercase"
                >
                  <span className={g === 'urgent' ? 'text-red-600 dark:text-red-400' : undefined}>
                    {GROUP_TITLES[g]} · {items.length}
                  </span>
                  {g === 'extra' && <span>{collapsed ? 'Mostrar' : 'Ocultar'}</span>}
                </button>
                {!collapsed && items.map((item) => <TodayRow key={item.key} item={item} color={colors.get(item.subjectId ?? '')} onDone={done} onSnooze={snooze} />)}
              </section>
            );
          })}

          {doneToday.length > 0 && (
            <section className="flex flex-col gap-2">
              <button type="button" onClick={() => setShowDone((v) => !v)} className="flex justify-between text-xs font-semibold tracking-wide text-emerald-600 uppercase">
                <span>Hecho hoy · {doneToday.length}</span>
                <span className="text-slate-500">{showDone ? 'Ocultar' : 'Mostrar'}</span>
              </button>
              {showDone &&
                doneToday.map((a) => (
                  <p key={a.id} className="rounded-xl px-3 py-1 text-sm text-slate-500 line-through">
                    {a.label}
                  </p>
                ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function TodayRow({
  item,
  color,
  onDone,
  onSnooze,
}: {
  item: TodayItem;
  color?: string;
  onDone: (i: TodayItem) => void;
  onSnooze: (i: TodayItem) => void;
}) {
  const doneLabel = item.kind === 'task' ? 'Entregado' : 'Hecho';
  return (
    <Card className="flex items-center gap-3 !p-3">
      <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: color ?? '#94a3b8' }} />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-snug font-medium">{item.title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {item.reason} · {formatMinutesShort(item.minutes)}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button variant="ghost" className="!px-2.5" title="Posponer a mañana" aria-label={`Posponer: ${item.title}`} onClick={() => onSnooze(item)}>
          Mañana
        </Button>
        <Button variant="primary" className="!px-3" aria-label={`${doneLabel}: ${item.title}`} onClick={() => onDone(item)}>
          ✓
        </Button>
      </div>
    </Card>
  );
}

const formatMinutesShort = (m: number) => `~${m} min`;
