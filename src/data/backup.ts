// Copia de seguridad: exportar e importar todos los datos como un único JSON.
import { z } from 'zod';
import { db, TABLES, type TableName } from '../db/db';
import type { Base } from '../db/types';

export const BACKUP_APP = 'study-tracker';
export const BACKUP_VERSION = 1;

const base = {
  id: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
};
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const status = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

const subject = z.looseObject({
  ...base,
  name: z.string(),
  color: z.string(),
  teacher: z.string().optional(),
  examDate: date.optional(),
  partials: z.array(z.looseObject({ id: z.string(), name: z.string(), date, untilTopic: z.number().optional() })),
  archived: z.boolean(),
  order: z.number(),
});
const topic = z.looseObject({
  ...base,
  subjectId: z.string(),
  order: z.number(),
  title: z.string(),
  status,
  seenAt: date.optional(),
  statusHistory: z.array(z.object({ status, at: z.number() })),
  notes: z.string(),
  forTutoring: z.boolean(),
});
const task = z.looseObject({
  ...base,
  subjectId: z.string().optional(),
  kind: z.enum(['informe', 'boletin', 'trabajo', 'otro']),
  title: z.string(),
  dueDate: date,
  estimatedMinutes: z.number().optional(),
  done: z.boolean(),
  doneAt: z.number().optional(),
});
const itemAction = z.looseObject({
  ...base,
  itemKey: z.string(),
  date,
  action: z.enum(['done', 'snoozed']),
  until: date.optional(),
  label: z.string(),
  subjectId: z.string().optional(),
});
const settings = z.looseObject({
  ...base,
  id: z.literal('app'),
  minutesWeekday: z.number(),
  minutesWeekend: z.number(),
  theme: z.enum(['system', 'light', 'dark']),
  cleanupThresholdDays: z.number(),
  schedule: z.array(z.looseObject({ id: z.string(), weekday: z.number(), start: z.string(), end: z.string(), label: z.string() })),
});

export const backupSchema = z.object({
  app: z.literal(BACKUP_APP),
  version: z.number().int().max(BACKUP_VERSION, 'La copia es de una versión más nueva de la app'),
  exportedAt: z.string(),
  data: z.object({
    subjects: z.array(subject),
    topics: z.array(topic),
    tasks: z.array(task),
    itemActions: z.array(itemAction),
    settings: z.array(settings),
  }),
});

export type Backup = z.infer<typeof backupSchema>;

export async function exportBackup(): Promise<Backup> {
  const data = {} as Record<TableName, unknown[]>;
  await db.transaction('r', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) data[t] = await db.table(t).toArray();
  });
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: data as Backup['data'],
  };
}

export function backupFileName(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `estudios-copia-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

export interface ParsedBackup {
  backup: Backup;
  summary: { subjects: number; topics: number; tasks: number; exportedAt: string };
}

export function parseBackup(text: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const result = backupSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`El archivo no es una copia válida de esta app (${issue.path.join('.') || 'raíz'}: ${issue.message}).`);
  }
  const live = <T extends { deletedAt: number | null }>(xs: T[]) => xs.filter((x) => x.deletedAt == null).length;
  const { data } = result.data;
  return {
    backup: result.data,
    summary: {
      subjects: live(data.subjects),
      topics: live(data.topics),
      tasks: live(data.tasks),
      exportedAt: result.data.exportedAt,
    },
  };
}

/**
 * replace: borra todo y deja exactamente lo que hay en la copia.
 * merge: combina; si un registro existe en ambos sitios gana el modificado más recientemente.
 */
export async function importBackup(backup: Backup, mode: 'replace' | 'merge') {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      const table = db.table<Base, string>(t);
      const incoming = backup.data[t] as Base[];
      if (mode === 'replace') {
        await table.clear();
        await table.bulkPut(incoming);
        continue;
      }
      const existing = new Map((await table.toArray()).map((r) => [r.id, r]));
      const winners = incoming.filter((r) => {
        const cur = existing.get(r.id);
        return !cur || r.updatedAt > cur.updatedAt;
      });
      await table.bulkPut(winners);
    }
  });
}
