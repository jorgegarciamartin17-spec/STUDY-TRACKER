import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button, Card, cx, EmptyState, Modal, RiskBadge, StatusBar, StatusChip, STATUS_STYLES, useToast } from '../components/ui';
import { subjectStats, useSettings, useSubject, useTasks, useToday, useTopics } from '../data/hooks';
import {
  addTopic,
  deleteSubject,
  deleteTopic,
  moveTopic,
  setSubjectArchived,
  setTopicStatus,
  updateSubject,
  updateTopic,
} from '../data/repo';
import { STATUS_LABELS, type Topic, type TopicStatus } from '../db/types';
import { daysBetween, formatShort, relativeDays } from '../domain/dates';
import { evaluations } from '../domain/progress';
import { SubjectForm } from './SubjectForm';

export default function SubjectDetail() {
  const { id } = useParams();
  const subject = useSubject(id);
  const topics = useTopics(id);
  const tasks = useTasks();
  const settings = useSettings();
  const today = useToday();
  const navigate = useNavigate();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState('');

  const stats = useMemo(
    () => (subject && topics && settings ? subjectStats([subject], topics, settings, today)[0] : null),
    [subject, topics, settings, today],
  );

  if (subject === null) {
    return (
      <EmptyState title="Asignatura no encontrada">
        <Link to="/asignaturas" className="text-indigo-600">
          Volver a asignaturas
        </Link>
      </EmptyState>
    );
  }
  if (!subject || !topics || !stats) return null;
  const { progress, risk } = stats;
  const subjectTasks = (tasks ?? []).filter((t) => t.subjectId === subject.id && !t.done);

  async function advance(t: Topic) {
    if (t.status === 4) {
      setOpenTopic(t.id);
      return;
    }
    const prev = t.status;
    await setTopicStatus(t.id, (t.status + 1) as TopicStatus, today);
    toast(`${t.title}: ${STATUS_LABELS[(t.status + 1) as TopicStatus]}`, () => setTopicStatus(t.id, prev, today));
  }

  return (
    <div className="flex flex-col gap-4">
      <Link to="/asignaturas" className="text-sm text-slate-500">
        ← Asignaturas
      </Link>

      <Card className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: subject.color }} />
              <span className="truncate">{subject.name}</span>
            </h1>
            {subject.teacher && <p className="text-sm text-slate-500">{subject.teacher}</p>}
          </div>
          <RiskBadge level={risk.level} />
        </div>
        <StatusBar counts={progress.counts} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
          <span>{progress.percent}% de avance total</span>
          {risk.target && (
            <span>
              {risk.target.untilTopic ? `${risk.target.name}: ${risk.actual}%` : `Avance ${risk.actual}%`} · esperado {risk.expected}%
            </span>
          )}
          <span>{risk.reason}</span>
        </div>
        {evaluations(subject).length > 0 && (
          <ul className="flex flex-wrap gap-2 text-xs">
            {evaluations(subject).map((ev) => {
              const d = daysBetween(today, ev.date);
              return (
                <li key={ev.name + ev.date} className={cx('rounded-full px-2.5 py-1', d < 0 ? 'bg-slate-100 text-slate-400 line-through dark:bg-slate-800' : 'bg-slate-100 dark:bg-slate-800')}>
                  {ev.name} · {formatShort(ev.date)}
                  {d >= 0 && ` (${relativeDays(today, ev.date)})`}
                  {ev.untilTopic ? ` · hasta tema ${ev.untilTopic}` : ''}
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setEditing(true)}>Editar</Button>
          <Button onClick={() => setSubjectArchived(subject.id, !subject.archived)}>{subject.archived ? 'Recuperar' : 'Archivar'}</Button>
          <Button
            variant="ghost"
            className="text-red-600"
            onClick={async () => {
              if (!window.confirm(`¿Eliminar «${subject.name}» con todos sus temas y entregas?`)) return;
              await deleteSubject(subject.id);
              navigate('/asignaturas');
            }}
          >
            Eliminar
          </Button>
        </div>
      </Card>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Temas</h2>
          <span className="text-xs text-slate-500">Toca el estado para avanzarlo</span>
        </div>
        {topics.length === 0 && <EmptyState title="Sin temas todavía" />}
        {topics.map((t, i) => (
          <TopicRow
            key={t.id}
            topic={t}
            index={i}
            isFirst={i === 0}
            isLast={i === topics.length - 1}
            open={openTopic === t.id}
            onToggle={() => setOpenTopic(openTopic === t.id ? null : t.id)}
            onAdvance={() => advance(t)}
            today={today}
          />
        ))}
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const title = newTopic.trim() || `Tema ${topics.length + 1}`;
            await addTopic(subject.id, title);
            setNewTopic('');
          }}
        >
          <input className="min-w-0 flex-1" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder={`Tema ${topics.length + 1}`} aria-label="Nuevo tema" />
          <Button type="submit">+ Tema</Button>
        </form>
      </section>

      {subjectTasks.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Entregas pendientes</h2>
          {subjectTasks.map((t) => (
            <Card key={t.id} className="flex justify-between !py-3 text-sm">
              <span>{t.title}</span>
              <span className="text-slate-500">{relativeDays(today, t.dueDate)}</span>
            </Card>
          ))}
        </section>
      )}

      <Modal open={editing} onClose={() => setEditing(false)} title="Editar asignatura">
        <SubjectForm
          initial={subject}
          onCancel={() => setEditing(false)}
          onSubmit={async (data) => {
            await updateSubject(subject.id, data);
            setEditing(false);
          }}
        />
      </Modal>
    </div>
  );
}

function TopicRow({
  topic,
  index,
  isFirst,
  isLast,
  open,
  onToggle,
  onAdvance,
  today,
}: {
  topic: Topic;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  open: boolean;
  onToggle: () => void;
  onAdvance: () => void;
  today: string;
}) {
  const [title, setTitle] = useState(topic.title);
  const [notes, setNotes] = useState(topic.notes);

  return (
    <Card className="!p-0">
      <div className="flex items-center gap-2 p-3">
        <span className="w-6 shrink-0 text-center text-xs text-slate-400">{index + 1}</span>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
          <span className="block truncate font-medium">{topic.title}</span>
          {(topic.notes || topic.forTutoring) && (
            <span className="block truncate text-xs text-slate-500">
              {topic.forTutoring && '🙋 Tutoría · '}
              {topic.notes}
            </span>
          )}
        </button>
        <StatusChip status={topic.status} onClick={onAdvance} title={`${STATUS_LABELS[topic.status]} (toca para avanzar)`} />
      </div>
      {open && (
        <div className="flex flex-col gap-3 border-t border-slate-100 p-3 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
            {([0, 1, 2, 3, 4] as TopicStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTopicStatus(topic.id, s, today)}
                className={cx(
                  'rounded-lg px-2 py-1.5 text-xs font-medium',
                  topic.status === s ? STATUS_STYLES[s] + ' ring-2 ring-current' : 'bg-slate-50 text-slate-500 dark:bg-slate-800',
                )}
              >
                {s + 1}. {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          {topic.seenAt && <p className="text-xs text-slate-500">Visto en clase el {formatShort(topic.seenAt)}</p>}
          <input aria-label="Título del tema" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== topic.title && updateTopic(topic.id, { title: title.trim() })} />
          <textarea
            aria-label="Notas del tema"
            rows={3}
            placeholder="Dudas, cosas para la tutoría…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== topic.notes && updateTopic(topic.id, { notes })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={topic.forTutoring} onChange={(e) => updateTopic(topic.id, { forTutoring: e.target.checked })} />
            Llevar a tutoría
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={isFirst} onClick={() => moveTopic(topic.id, -1)} aria-label="Subir tema">
              ↑
            </Button>
            <Button disabled={isLast} onClick={() => moveTopic(topic.id, 1)} aria-label="Bajar tema">
              ↓
            </Button>
            <Button
              variant="ghost"
              className="ml-auto text-red-600"
              onClick={() => window.confirm(`¿Eliminar «${topic.title}»?`) && deleteTopic(topic.id)}
            >
              Eliminar tema
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
