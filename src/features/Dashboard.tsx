import { useMemo } from 'react';
import { Link } from 'react-router';
import { Card, EmptyState, PageHeader, RiskBadge, StatusBar, STATUS_BAR } from '../components/ui';
import { subjectStats, useSettings, useSubjects, useToday, useTopics } from '../data/hooks';
import { STATUS_SHORT, type TopicStatus } from '../db/types';
import { formatShort } from '../domain/dates';
import type { RiskLevel } from '../domain/progress';

const RISK_ORDER: Record<RiskLevel, number> = { red: 0, yellow: 1, green: 2, none: 3, finished: 4 };

export default function Dashboard() {
  const subjects = useSubjects();
  const topics = useTopics();
  const settings = useSettings();
  const today = useToday();

  const stats = useMemo(() => {
    if (!subjects || !topics || !settings) return null;
    return subjectStats(subjects.filter((s) => !s.archived), topics, settings, today).sort(
      (a, b) => RISK_ORDER[a.risk.level] - RISK_ORDER[b.risk.level] || (a.risk.daysLeft ?? 999) - (b.risk.daysLeft ?? 999),
    );
  }, [subjects, topics, settings, today]);

  if (!stats) return null;
  if (!stats.length)
    return (
      <>
        <PageHeader title="Panel" />
        <EmptyState title="Añade asignaturas para ver tu progreso" />
      </>
    );

  const totals = [0, 0, 0, 0, 0];
  stats.forEach((s) => s.progress.counts.forEach((c, i) => (totals[i] += c)));
  const tutoring = stats.flatMap((s) => s.topics.filter((t) => t.forTutoring).map((t) => ({ t, s: s.subject })));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Panel" subtitle={settings?.courseLabel} />

      <Card className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-500">Todos los temas</h2>
        <StatusBar counts={totals} />
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
          {([0, 1, 2, 3, 4] as TopicStatus[]).map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${STATUS_BAR[s]}`} />
              {STATUS_SHORT[s]}: <strong>{totals[s]}</strong>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-col gap-3">
        {stats.map(({ subject, progress, risk }) => (
          <Link key={subject.id} to={`/asignaturas/${subject.id}`}>
            <Card className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 font-semibold">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: subject.color }} />
                  <span className="truncate">{subject.name}</span>
                </span>
                <RiskBadge level={risk.level} />
              </div>
              <StatusBar counts={progress.counts} />
              <div className="grid grid-cols-5 gap-1 text-center text-[11px] text-slate-500">
                {([0, 1, 2, 3, 4] as TopicStatus[]).map((s) => (
                  <div key={s}>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {progress.total ? Math.round((progress.counts[s] / progress.total) * 100) : 0}%
                    </div>
                    {STATUS_SHORT[s]}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                <span>
                  {risk.target?.untilTopic ? `${risk.target.name}: ${risk.actual}%` : `Avance ${risk.actual}%`}
                  {risk.target && ` · esperado ${risk.expected}%`} · {risk.reason}
                </span>
                {risk.target && (
                  <span className="font-medium">
                    {risk.target.kind === 'exam' ? 'Examen' : risk.target.name} {formatShort(risk.target.date)} ·{' '}
                    {risk.daysLeft === 0 ? 'hoy' : `${risk.daysLeft} días`}
                  </span>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {tutoring.length > 0 && (
        <Card className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-slate-500">🙋 Para tutoría</h2>
          {tutoring.map(({ t, s }) => (
            <Link key={t.id} to={`/asignaturas/${s.id}`} className="text-sm">
              <span className="font-medium">{t.title}</span> <span className="text-slate-500">· {s.name}</span>
              {t.notes && <span className="block text-xs text-slate-500">{t.notes}</span>}
            </Link>
          ))}
        </Card>
      )}

      <p className="text-xs text-slate-500">
        El riesgo compara tu avance con el que deberías llevar para tenerlo todo listo una semana antes de la próxima evaluación. Verde: vas al día o casi.
        Amarillo: más de 10 puntos por detrás. Rojo: más de 25 puntos por detrás, o más de 3 temas vistos sin pasar a limpio.
      </p>
    </div>
  );
}
