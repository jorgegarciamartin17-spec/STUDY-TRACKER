import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { exportBackup, importBackup, parseBackup } from '../src/data/backup';
import * as repo from '../src/data/repo';
import { db, useTestDb } from '../src/db/db';
import type { SeedData } from '../src/db/seed';

const seed: SeedData = {
  courseLabel: '2º, 1er cuatrimestre',
  minutesWeekday: 120,
  minutesWeekend: 240,
  schedule: [{ weekday: 1, start: '09:00', end: '14:00', label: 'Clases' }],
  subjects: [
    { name: 'Orgánica I', color: '#4f46e5', examDate: '2027-01-15', topics: 10, seenUpTo: 3 },
    { name: 'Física I', color: '#0891b2', topics: ['Gases', 'Termo'] },
  ],
  tasks: [{ subject: 'Física I', kind: 'informe', title: 'Informe 1', dueDate: '2026-11-03' }],
};

let n = 0;
beforeEach(async () => {
  useTestDb(`test-${n++}`);
  await repo.ensureInitialized(seed, '2026-10-27');
});

describe('precarga', () => {
  it('crea asignaturas, temas, entregas y ajustes una sola vez', async () => {
    await repo.ensureInitialized(seed, '2026-10-27');
    expect(await db.subjects.count()).toBe(2);
    expect(await db.topics.count()).toBe(12);
    const seen = (await db.topics.toArray()).filter((t) => t.status === 1);
    expect(seen).toHaveLength(3);
    expect(seen[0].seenAt).toBe('2026-10-27');
    const task = (await db.tasks.toArray())[0];
    const fisica = (await db.subjects.toArray()).find((s) => s.name === 'Física I')!;
    expect(task.subjectId).toBe(fisica.id);
    expect((await repo.getSettings()).schedule).toHaveLength(1);
  });
});

describe('temas', () => {
  it('guarda la fecha de visto y el historial al cambiar de estado', async () => {
    const t = (await db.topics.toArray()).find((x) => x.status === 0)!;
    await repo.setTopicStatus(t.id, 1, '2026-10-28');
    await repo.setTopicStatus(t.id, 2, '2026-10-30');
    const after = (await db.topics.get(t.id))!;
    expect(after.status).toBe(2);
    expect(after.seenAt).toBe('2026-10-28');
    expect(after.statusHistory.map((h) => h.status)).toEqual([1, 2]);
  });

  it('reordena temas', async () => {
    const s = (await db.subjects.toArray()).find((x) => x.name === 'Física I')!;
    const [a] = (await db.topics.where('subjectId').equals(s.id).sortBy('order'));
    await repo.moveTopic(a.id, 1);
    const titles = (await db.topics.where('subjectId').equals(s.id).sortBy('order')).map((t) => t.title);
    expect(titles).toEqual(['Termo', 'Gases']);
  });

  it('borrar una asignatura borra (lógicamente) sus temas y entregas', async () => {
    const s = (await db.subjects.toArray()).find((x) => x.name === 'Física I')!;
    await repo.deleteSubject(s.id);
    const topics = await db.topics.where('subjectId').equals(s.id).toArray();
    expect(topics.every((t) => t.deletedAt)).toBe(true);
    expect((await db.tasks.toArray()).every((t) => t.deletedAt)).toBe(true);
  });
});

describe('copia de seguridad', () => {
  it('exportar, borrar todo e importar deja los mismos datos', async () => {
    const backup = await exportBackup();
    const json = JSON.stringify(backup);
    const before = await exportBackup();

    useTestDb(`empty-${n++}`);
    await repo.ensureInitialized({ ...seed, subjects: [], tasks: [] });
    const parsed = parseBackup(json);
    expect(parsed.summary).toMatchObject({ subjects: 2, topics: 12, tasks: 1 });
    await importBackup(parsed.backup, 'replace');

    const after = await exportBackup();
    expect(after.data).toEqual(before.data);
  });

  it('fusionar se queda con la versión más reciente', async () => {
    const backup = await exportBackup();
    const t = (await db.topics.toArray())[0];
    await new Promise((r) => setTimeout(r, 5));
    await repo.updateTopic(t.id, { notes: 'nota local más nueva' });
    await repo.createTask({ kind: 'otro', title: 'Solo local', dueDate: '2026-11-01' });

    await importBackup(backup, 'merge');
    expect((await db.topics.get(t.id))!.notes).toBe('nota local más nueva');
    expect(await db.tasks.count()).toBe(2);
  });

  it('rechaza archivos que no son copias', () => {
    expect(() => parseBackup('hola')).toThrow(/JSON válido/);
    expect(() => parseBackup('{"app":"otra"}')).toThrow(/copia válida/);
  });
});
