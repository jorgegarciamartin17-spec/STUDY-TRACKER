import type { ClassSlot, DateStr, TaskKind } from './types';

// Datos con los que se precarga la app la primera vez que se abre.
// Para cambiarlos más adelante no hace falta tocar esto: todo se edita desde la app.

export interface SeedSubject {
  name: string;
  color: string;
  teacher?: string;
  examDate?: DateStr;
  partials?: { name: string; date: DateStr; untilTopic?: number }[];
  /** Títulos de los temas, o solo cuántos hay (se llamarán "Tema 1", "Tema 2"…). */
  topics: string[] | number;
  /** Temas ya vistos en clase al empezar a usar la app (los N primeros pasan a "Visto en clase"). */
  seenUpTo?: number;
}

export interface SeedData {
  courseLabel?: string;
  semesterStart?: DateStr;
  minutesWeekday: number;
  minutesWeekend: number;
  schedule: Omit<ClassSlot, 'id'>[];
  subjects: SeedSubject[];
  tasks: { subject?: string; kind: TaskKind; title: string; dueDate: DateStr }[];
}

export const SEED: SeedData = {
  minutesWeekday: 120,
  minutesWeekend: 240,
  schedule: [],
  subjects: [],
  tasks: [],
};

export const SUBJECT_COLORS = [
  '#4f46e5', // índigo
  '#0891b2', // cian
  '#059669', // esmeralda
  '#d97706', // ámbar
  '#dc2626', // rojo
  '#db2777', // rosa
  '#7c3aed', // violeta
  '#65a30d', // lima
];
