// Repositorio: la única API de lectura/escritura que usa la interfaz.
// Si algún día se añade sincronización (p. ej. Supabase), se engancha aquí.
import { db } from '../db/db';
import { SEED, type SeedData } from '../db/seed';
import type { Base, DateStr, ID, ItemAction, Settings, Subject, Task, Topic, TopicStatus } from '../db/types';
import { addDays, toDateStr } from '../domain/dates';

export const newId = (): ID => crypto.randomUUID();

function stamp<T extends object>(data: T): T & Base {
  const now = Date.now();
  return { id: newId(), createdAt: now, updatedAt: now, deletedAt: null, ...data };
}

const touch = <T extends object>(changes: T) => ({ ...changes, updatedAt: Date.now() });

export const alive = <T extends Base>(x: T) => x.deletedAt == null;

// ---------- Ajustes e inicialización ----------

export const DEFAULT_SETTINGS: Omit<Settings, keyof Base> & { id: 'app' } = {
  id: 'app',
  minutesWeekday: 120,
  minutesWeekend: 240,
  theme: 'system',
  cleanupThresholdDays: 3,
  schedule: [],
};

/** Crea los ajustes y precarga los datos la primera vez que se abre la app. */
export async function ensureInitialized(seed: SeedData = SEED, today: DateStr = toDateStr()) {
  await db.transaction('rw', [db.settings, db.subjects, db.topics, db.tasks], async () => {
    if (await db.settings.get('app')) return;
    const now = Date.now();
    await db.settings.put({
      ...DEFAULT_SETTINGS,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      courseLabel: seed.courseLabel,
      semesterStart: seed.semesterStart,
      minutesWeekday: seed.minutesWeekday,
      minutesWeekend: seed.minutesWeekend,
      schedule: seed.schedule.map((s) => ({ ...s, id: newId() })),
    });
    const byName = new Map<string, ID>();
    for (const [i, s] of seed.subjects.entries()) {
      const subject = stamp<Omit<Subject, keyof Base>>({
        name: s.name,
        color: s.color,
        teacher: s.teacher,
        examDate: s.examDate,
        partials: (s.partials ?? []).map((p) => ({ ...p, id: newId() })),
        archived: false,
        order: i,
      });
      byName.set(s.name, subject.id);
      await db.subjects.add(subject);
      const titles = typeof s.topics === 'number' ? Array.from({ length: s.topics }, (_, k) => `Tema ${k + 1}`) : s.topics;
      await db.topics.bulkAdd(
        titles.map((title, k) => {
          const seen = k < (s.seenUpTo ?? 0);
          return makeTopic(subject.id, k, title, seen ? 1 : 0, seen ? today : undefined);
        }),
      );
    }
    await db.tasks.bulkAdd(
      seed.tasks.map((t) =>
        stamp<Omit<Task, keyof Base>>({
          subjectId: t.subject ? byName.get(t.subject) : undefined,
          kind: t.kind,
          title: t.title,
          dueDate: t.dueDate,
          done: false,
        }),
      ),
    );
  });
  // Pide al navegador que no borre los datos si se queda sin espacio.
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* no disponible */
  }
}

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('app');
  if (!s) throw new Error('Ajustes no inicializados');
  return s;
}

export async function updateSettings(changes: Partial<Omit<Settings, keyof Base>>) {
  await db.settings.update('app', touch(changes));
}

// ---------- Asignaturas ----------

export type SubjectInput = Pick<Subject, 'name' | 'color' | 'teacher' | 'examDate' | 'partials'>;

export async function createSubject(input: SubjectInput, topicCount = 0): Promise<ID> {
  const order = await db.subjects.count();
  const subject = stamp<Omit<Subject, keyof Base>>({ ...input, archived: false, order });
  await db.transaction('rw', db.subjects, db.topics, async () => {
    await db.subjects.add(subject);
    await db.topics.bulkAdd(
      Array.from({ length: topicCount }, (_, k) => makeTopic(subject.id, k, `Tema ${k + 1}`, 0)),
    );
  });
  return subject.id;
}

export async function updateSubject(id: ID, changes: Partial<SubjectInput>) {
  await db.subjects.update(id, touch(changes));
}

export async function setSubjectArchived(id: ID, archived: boolean) {
  await db.subjects.update(id, touch({ archived }));
}

export async function deleteSubject(id: ID) {
  const now = Date.now();
  await db.transaction('rw', db.subjects, db.topics, db.tasks, async () => {
    await db.subjects.update(id, { deletedAt: now, updatedAt: now });
    await db.topics.where('subjectId').equals(id).modify({ deletedAt: now, updatedAt: now });
    await db.tasks.where('subjectId').equals(id).modify({ deletedAt: now, updatedAt: now });
  });
}

// ---------- Temas ----------

function makeTopic(subjectId: ID, order: number, title: string, status: TopicStatus, seenAt?: DateStr): Topic {
  return stamp<Omit<Topic, keyof Base>>({
    subjectId,
    order,
    title,
    status,
    seenAt,
    statusHistory: status ? [{ status, at: Date.now() }] : [],
    notes: '',
    forTutoring: false,
  });
}

export async function addTopic(subjectId: ID, title: string) {
  const siblings = (await db.topics.where('subjectId').equals(subjectId).toArray()).filter(alive);
  const order = siblings.reduce((m, t) => Math.max(m, t.order + 1), 0);
  await db.topics.add(makeTopic(subjectId, order, title, 0));
}

export async function updateTopic(id: ID, changes: Partial<Pick<Topic, 'title' | 'notes' | 'forTutoring'>>) {
  await db.topics.update(id, touch(changes));
}

export async function setTopicStatus(id: ID, status: TopicStatus, today: DateStr = toDateStr()) {
  const t = await db.topics.get(id);
  if (!t || t.status === status) return;
  await db.topics.update(id, touch({
    status,
    // La fecha de "visto en clase" se fija la primera vez que sale de Pendiente.
    seenAt: status === 0 ? undefined : (t.seenAt ?? today),
    statusHistory: [...t.statusHistory, { status, at: Date.now() }],
  }));
}

export async function moveTopic(id: ID, direction: -1 | 1) {
  const t = await db.topics.get(id);
  if (!t) return;
  const siblings = (await db.topics.where('subjectId').equals(t.subjectId).toArray())
    .filter(alive)
    .sort((a, b) => a.order - b.order);
  const i = siblings.findIndex((s) => s.id === id);
  const j = i + direction;
  if (j < 0 || j >= siblings.length) return;
  [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
  await db.transaction('rw', db.topics, async () => {
    for (const [k, s] of siblings.entries()) {
      if (s.order !== k) await db.topics.update(s.id, touch({ order: k }));
    }
  });
}

export async function deleteTopic(id: ID) {
  await db.topics.update(id, touch({ deletedAt: Date.now() }));
}

// ---------- Tareas ----------

export type TaskInput = Pick<Task, 'subjectId' | 'kind' | 'title' | 'dueDate' | 'estimatedMinutes'>;

export async function createTask(input: TaskInput) {
  await db.tasks.add(stamp<Omit<Task, keyof Base>>({ ...input, done: false }));
}

export async function updateTask(id: ID, changes: Partial<TaskInput>) {
  await db.tasks.update(id, touch(changes));
}

export async function setTaskDone(id: ID, done: boolean) {
  await db.tasks.update(id, touch({ done, doneAt: done ? Date.now() : undefined }));
}

export async function deleteTask(id: ID) {
  await db.tasks.update(id, touch({ deletedAt: Date.now() }));
}

// ---------- Acciones de la pantalla Hoy ----------

export async function recordAction(
  data: Pick<ItemAction, 'itemKey' | 'action' | 'label' | 'subjectId'>,
  today: DateStr = toDateStr(),
): Promise<ID> {
  const action = stamp<Omit<ItemAction, keyof Base>>({
    ...data,
    date: today,
    until: data.action === 'snoozed' ? addDays(today, 1) : undefined,
  });
  await db.itemActions.add(action);
  return action.id;
}

export async function deleteAction(id: ID) {
  await db.itemActions.update(id, touch({ deletedAt: Date.now() }));
}
