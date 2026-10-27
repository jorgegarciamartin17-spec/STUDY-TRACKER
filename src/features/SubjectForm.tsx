import { useState } from 'react';
import { Button, cx, Field } from '../components/ui';
import { newId, type SubjectInput } from '../data/repo';
import { SUBJECT_COLORS } from '../db/seed';
import type { ExamPartial, Subject } from '../db/types';

export function SubjectForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Subject;
  onSubmit: (data: SubjectInput, topicCount: number) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? SUBJECT_COLORS[0]);
  const [teacher, setTeacher] = useState(initial?.teacher ?? '');
  const [examDate, setExamDate] = useState(initial?.examDate ?? '');
  const [partials, setPartials] = useState<ExamPartial[]>(initial?.partials ?? []);
  const [topicCount, setTopicCount] = useState(initial ? 0 : 10);

  const valid = name.trim().length > 0 && partials.every((p) => p.name.trim() && p.date);

  const updatePartial = (id: string, changes: Partial<ExamPartial>) =>
    setPartials((ps) => ps.map((p) => (p.id === id ? { ...p, ...changes } : p)));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit(
          {
            name: name.trim(),
            color,
            teacher: teacher.trim() || undefined,
            examDate: examDate || undefined,
            partials: [...partials].sort((a, b) => a.date.localeCompare(b.date)),
          },
          topicCount,
        );
      }}
    >
      <Field label="Nombre">
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Química Orgánica I" required />
      </Field>
      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">Color</span>
        <div className="flex flex-wrap gap-2">
          {SUBJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              onClick={() => setColor(c)}
              className={cx('h-8 w-8 rounded-full ring-offset-2 dark:ring-offset-slate-900', color === c && 'ring-2 ring-slate-900 dark:ring-white')}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      <Field label="Profesor (opcional)">
        <input value={teacher} onChange={(e) => setTeacher(e.target.value)} />
      </Field>
      <Field label="Fecha del examen final">
        <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
      </Field>

      <div className="flex flex-col gap-2 text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">Parciales</span>
        {partials.map((p) => (
          <div key={p.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl bg-slate-50 p-2 dark:bg-slate-800/50">
            <input aria-label="Nombre del parcial" value={p.name} onChange={(e) => updatePartial(p.id, { name: e.target.value })} placeholder="Parcial 1" />
            <Button variant="ghost" aria-label="Quitar parcial" onClick={() => setPartials((ps) => ps.filter((x) => x.id !== p.id))}>
              ✕
            </Button>
            <input aria-label="Fecha del parcial" type="date" value={p.date} onChange={(e) => updatePartial(p.id, { date: e.target.value })} />
            <input
              aria-label="Entra hasta el tema"
              type="number"
              min={1}
              className="w-28"
              placeholder="Hasta tema"
              value={p.untilTopic ?? ''}
              onChange={(e) => updatePartial(p.id, { untilTopic: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
        ))}
        <Button
          className="self-start"
          onClick={() => setPartials((ps) => [...ps, { id: newId(), name: `Parcial ${ps.length + 1}`, date: '' }])}
        >
          + Añadir parcial
        </Button>
      </div>

      {!initial && (
        <Field label="Número de temas" hint="Se crearán como «Tema 1», «Tema 2»… y podrás renombrarlos.">
          <input type="number" min={0} max={60} value={topicCount} onChange={(e) => setTopicCount(Math.max(0, Number(e.target.value)))} />
        </Field>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={!valid}>
          {initial ? 'Guardar' : 'Crear asignatura'}
        </Button>
      </div>
    </form>
  );
}
