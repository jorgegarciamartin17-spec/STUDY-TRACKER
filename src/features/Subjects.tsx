import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button, Card, EmptyState, Modal, PageHeader, RiskBadge, StatusBar } from '../components/ui';
import { subjectStats, useSettings, useSubjects, useToday, useTopics, type SubjectStats } from '../data/hooks';
import { createSubject, setSubjectArchived } from '../data/repo';
import { daysBetween } from '../domain/dates';
import { SubjectForm } from './SubjectForm';

export default function Subjects() {
  const subjects = useSubjects();
  const topics = useTopics();
  const settings = useSettings();
  const today = useToday();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const stats = useMemo(
    () => (subjects && topics && settings ? subjectStats(subjects, topics, settings, today) : null),
    [subjects, topics, settings, today],
  );
  if (!stats) return null;
  const active = stats.filter((s) => !s.subject.archived);
  const archived = stats.filter((s) => s.subject.archived);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Asignaturas"
        subtitle={settings?.courseLabel}
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            + Nueva
          </Button>
        }
      />
      {active.length === 0 && <EmptyState title="No hay asignaturas">Pulsa «+ Nueva» para añadir la primera.</EmptyState>}
      <div className="grid gap-3 sm:grid-cols-2">
        {active.map((s) => (
          <SubjectCard key={s.subject.id} s={s} today={today} />
        ))}
      </div>

      {archived.length > 0 && (
        <section className="flex flex-col gap-2">
          <button type="button" className="self-start text-sm font-medium text-slate-500" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? '▾' : '▸'} Archivadas ({archived.length})
          </button>
          {showArchived &&
            archived.map(({ subject }) => (
              <Card key={subject.id} className="flex items-center justify-between !py-3">
                <Link to={`/asignaturas/${subject.id}`} className="font-medium text-slate-500">
                  {subject.name}
                </Link>
                <Button onClick={() => setSubjectArchived(subject.id, false)}>Recuperar</Button>
              </Card>
            ))}
        </section>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nueva asignatura">
        <SubjectForm
          onCancel={() => setCreating(false)}
          onSubmit={async (data, count) => {
            const id = await createSubject(data, count);
            setCreating(false);
            navigate(`/asignaturas/${id}`);
          }}
        />
      </Modal>
    </div>
  );
}

function SubjectCard({ s, today }: { s: SubjectStats; today: string }) {
  const { subject, progress, risk } = s;
  const days = risk.target ? daysBetween(today, risk.target.date) : undefined;
  return (
    <Link to={`/asignaturas/${subject.id}`}>
      <Card className="flex flex-col gap-3 transition hover:border-slate-300 dark:hover:border-slate-700">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: subject.color }} />
            <h2 className="truncate font-semibold">{subject.name}</h2>
          </div>
          <RiskBadge level={risk.level} />
        </div>
        <StatusBar counts={progress.counts} />
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            {progress.percent}% · {progress.total} temas
          </span>
          {days !== undefined && (
            <span>
              {risk.target!.kind === 'exam' ? 'Examen' : risk.target!.name} en {days} días
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}
