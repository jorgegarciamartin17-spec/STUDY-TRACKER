import { useState } from 'react';
import { Button, Card, cx, EmptyState, Field, Modal, PageHeader, useToast } from '../components/ui';
import { useSubjects, useTasks, useToday } from '../data/hooks';
import { createTask, deleteTask, setTaskDone, updateTask, type TaskInput } from '../data/repo';
import { TASK_KIND_LABELS, type Subject, type Task, type TaskKind } from '../db/types';
import { addDays, daysBetween, formatShort, relativeDays } from '../domain/dates';

export default function Tasks() {
  const tasks = useTasks();
  const subjects = useSubjects();
  const today = useToday();
  const toast = useToast();
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const [filter, setFilter] = useState('');
  const [showDone, setShowDone] = useState(false);

  if (!tasks || !subjects) return null;
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const visible = tasks.filter((t) => !filter || t.subjectId === filter);
  const pending = visible.filter((t) => !t.done);
  const done = visible.filter((t) => t.done).reverse();

  const groups = [
    { title: 'Vencidas', items: pending.filter((t) => t.dueDate < today) },
    { title: 'Esta semana', items: pending.filter((t) => t.dueDate >= today && daysBetween(today, t.dueDate) <= 7) },
    { title: 'Más adelante', items: pending.filter((t) => daysBetween(today, t.dueDate) > 7) },
  ];

  async function toggle(t: Task) {
    await setTaskDone(t.id, !t.done);
    if (!t.done) toast('Entrega completada', () => setTaskDone(t.id, false));
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Entregas"
        subtitle="Informes, boletines y trabajos"
        action={
          <Button variant="primary" onClick={() => setEditing('new')}>
            + Nueva
          </Button>
        }
      />
      {subjects.length > 0 && (
        <select aria-label="Filtrar por asignatura" value={filter} onChange={(e) => setFilter(e.target.value)} className="self-start">
          <option value="">Todas las asignaturas</option>
          {subjects.filter((s) => !s.archived).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}

      {pending.length === 0 && <EmptyState title="No tienes entregas pendientes" />}

      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <section key={g.title} className="flex flex-col gap-2">
              <h2 className={cx('text-xs font-semibold tracking-wide uppercase', g.title === 'Vencidas' ? 'text-red-600' : 'text-slate-500')}>
                {g.title} · {g.items.length}
              </h2>
              {g.items.map((t) => (
                <TaskRow key={t.id} task={t} subject={subjectMap.get(t.subjectId ?? '')} today={today} onToggle={toggle} onEdit={() => setEditing(t)} />
              ))}
            </section>
          ),
      )}

      {done.length > 0 && (
        <section className="flex flex-col gap-2">
          <button type="button" className="self-start text-sm font-medium text-slate-500" onClick={() => setShowDone((v) => !v)}>
            {showDone ? '▾' : '▸'} Completadas ({done.length})
          </button>
          {showDone &&
            done.map((t) => <TaskRow key={t.id} task={t} subject={subjectMap.get(t.subjectId ?? '')} today={today} onToggle={toggle} onEdit={() => setEditing(t)} />)}
        </section>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nueva entrega' : 'Editar entrega'}>
        {editing !== null && (
          <TaskForm
            initial={editing === 'new' ? undefined : editing}
            subjects={subjects.filter((s) => !s.archived)}
            defaultSubject={filter}
            today={today}
            onCancel={() => setEditing(null)}
            onDelete={
              editing === 'new'
                ? undefined
                : async () => {
                    await deleteTask(editing.id);
                    setEditing(null);
                  }
            }
            onSubmit={async (data) => {
              if (editing === 'new') await createTask(data);
              else await updateTask(editing.id, data);
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function TaskRow({ task, subject, today, onToggle, onEdit }: { task: Task; subject?: Subject; today: string; onToggle: (t: Task) => void; onEdit: () => void }) {
  const overdue = !task.done && task.dueDate < today;
  return (
    <Card className="flex items-center gap-3 !p-3">
      <input type="checkbox" className="h-5 w-5 shrink-0" checked={task.done} onChange={() => onToggle(task)} aria-label={`Completada: ${task.title}`} />
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span className={cx('block font-medium', task.done && 'text-slate-400 line-through')}>{task.title}</span>
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          {subject && <span className="h-2 w-2 rounded-full" style={{ background: subject.color }} />}
          {subject?.name ?? 'Sin asignatura'} · {TASK_KIND_LABELS[task.kind]}
        </span>
      </button>
      <span className={cx('shrink-0 text-right text-xs', overdue ? 'font-semibold text-red-600' : 'text-slate-500')}>
        {formatShort(task.dueDate)}
        <br />
        {!task.done && relativeDays(today, task.dueDate)}
      </span>
    </Card>
  );
}

function TaskForm({
  initial,
  subjects,
  defaultSubject,
  today,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Task;
  subjects: Subject[];
  defaultSubject: string;
  today: string;
  onSubmit: (d: TaskInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? defaultSubject ?? '');
  const [kind, setKind] = useState<TaskKind>(initial?.kind ?? 'boletin');
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? addDays(today, 7));
  const [minutes, setMinutes] = useState(initial?.estimatedMinutes ?? 60);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim() || !dueDate) return;
        onSubmit({ title: title.trim(), subjectId: subjectId || undefined, kind, dueDate, estimatedMinutes: minutes || undefined });
      }}
    >
      <Field label="Título">
        <input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Boletín 3" />
      </Field>
      <Field label="Asignatura">
        <select aria-label="Asignatura" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">Sin asignatura</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tipo">
        <select aria-label="Tipo" value={kind} onChange={(e) => setKind(e.target.value as TaskKind)}>
          {(Object.keys(TASK_KIND_LABELS) as TaskKind[]).map((k) => (
            <option key={k} value={k}>
              {TASK_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fecha de entrega">
          <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Tiempo estimado (min)">
          <input type="number" min={0} step={15} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
        </Field>
      </div>
      <div className="flex gap-2 pt-2">
        {onDelete && (
          <Button variant="ghost" className="text-red-600" onClick={onDelete}>
            Eliminar
          </Button>
        )}
        <Button variant="ghost" className="ml-auto" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary">
          Guardar
        </Button>
      </div>
    </form>
  );
}
