// Tipos del modelo de datos. Todas las entidades llevan id (UUID) y marcas de tiempo
// para poder sincronizarlas con la nube más adelante sin conflictos.

export type ID = string;
/** Fecha de calendario en formato YYYY-MM-DD (sin hora ni zona horaria). */
export type DateStr = string;

export interface Base {
  id: ID;
  createdAt: number;
  updatedAt: number;
  /** Borrado lógico: si tiene valor, el registro está eliminado. */
  deletedAt: number | null;
}

export interface ExamPartial {
  id: ID;
  name: string;
  date: DateStr;
  /** Último tema (por orden) que entra en el parcial. Vacío = todos. */
  untilTopic?: number;
}

export interface Subject extends Base {
  name: string;
  color: string;
  teacher?: string;
  examDate?: DateStr;
  partials: ExamPartial[];
  archived: boolean;
  order: number;
}

/** 0 Pendiente · 1 Visto en clase · 2 Apuntes a limpio · 3 Ejercicios hechos · 4 Repasado */
export type TopicStatus = 0 | 1 | 2 | 3 | 4;

export interface Topic extends Base {
  subjectId: ID;
  order: number;
  title: string;
  status: TopicStatus;
  /** Día en que se vio en clase (al pasar a estado 1 o superior). */
  seenAt?: DateStr;
  statusHistory: { status: TopicStatus; at: number }[];
  notes: string;
  forTutoring: boolean;
}

export type TaskKind = 'informe' | 'boletin' | 'trabajo' | 'otro';

export interface Task extends Base {
  subjectId?: ID;
  kind: TaskKind;
  title: string;
  dueDate: DateStr;
  estimatedMinutes?: number;
  done: boolean;
  doneAt?: number;
}

/** Lo que el usuario hizo con un elemento de la lista de Hoy (hecho o pospuesto). */
export interface ItemAction extends Base {
  itemKey: string;
  date: DateStr;
  action: 'done' | 'snoozed';
  /** Para pospuestos: no se muestra hasta esta fecha. */
  until?: DateStr;
  label: string;
  subjectId?: ID;
}

export type Theme = 'system' | 'light' | 'dark';

export interface ClassSlot {
  id: ID;
  /** 1 = lunes … 7 = domingo */
  weekday: number;
  start: string; // HH:mm
  end: string; // HH:mm
  label: string;
}

export interface Settings extends Base {
  /** Siempre 'app': hay un único registro de ajustes. */
  id: 'app';
  courseLabel?: string;
  semesterStart?: DateStr;
  minutesWeekday: number;
  minutesWeekend: number;
  theme: Theme;
  lastBackupAt?: number;
  /** Días tras los que un tema visto sin pasar a limpio se considera atrasado. */
  cleanupThresholdDays: number;
  schedule: ClassSlot[];
}

export const STATUS_LABELS: Record<TopicStatus, string> = {
  0: 'Pendiente',
  1: 'Visto en clase',
  2: 'Apuntes a limpio',
  3: 'Ejercicios hechos',
  4: 'Repasado',
};

export const STATUS_SHORT: Record<TopicStatus, string> = {
  0: 'Pendiente',
  1: 'Visto',
  2: 'Limpio',
  3: 'Ejercicios',
  4: 'Repasado',
};

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  informe: 'Informe de prácticas',
  boletin: 'Boletín de problemas',
  trabajo: 'Trabajo',
  otro: 'Otro',
};
