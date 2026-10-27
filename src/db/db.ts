import Dexie, { type EntityTable } from 'dexie';
import type { ItemAction, Settings, Subject, Task, Topic } from './types';

// Solo la capa de datos (src/data) debería importar este módulo.
export class StudyDB extends Dexie {
  subjects!: EntityTable<Subject, 'id'>;
  topics!: EntityTable<Topic, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  itemActions!: EntityTable<ItemAction, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor(name = 'study-tracker') {
    super(name);
    this.version(1).stores({
      subjects: 'id, updatedAt',
      topics: 'id, subjectId, updatedAt',
      tasks: 'id, subjectId, dueDate, updatedAt',
      itemActions: 'id, date, itemKey, updatedAt',
      settings: 'id',
    });
  }
}

export const TABLES = ['subjects', 'topics', 'tasks', 'itemActions', 'settings'] as const;
export type TableName = (typeof TABLES)[number];

export let db = new StudyDB();

/** Solo para tests: usa una base de datos distinta. */
export function useTestDb(name: string) {
  db = new StudyDB(name);
  return db;
}
