import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../db/db';
import type { ID, Settings, Subject, Topic } from '../db/types';
import { defaultSemesterStart, toDateStr } from '../domain/dates';
import { computeProgress, computeRisk, type SubjectProgress, type SubjectRisk } from '../domain/progress';
import { alive } from './repo';

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => db.settings.get('app'));
}

export function useSubjects() {
  return useLiveQuery(async () => (await db.subjects.toArray()).filter(alive).sort((a, b) => a.order - b.order));
}

export function useSubject(id: ID | undefined) {
  return useLiveQuery(async () => {
    const s = id ? await db.subjects.get(id) : undefined;
    return s && alive(s) ? s : null;
  }, [id]);
}

export function useTopics(subjectId?: ID) {
  return useLiveQuery(async () => {
    const rows = subjectId ? await db.topics.where('subjectId').equals(subjectId).toArray() : await db.topics.toArray();
    return rows.filter(alive).sort((a, b) => a.order - b.order);
  }, [subjectId]);
}

export function useTasks() {
  return useLiveQuery(async () => (await db.tasks.toArray()).filter(alive).sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
}

export function useActions() {
  return useLiveQuery(async () => (await db.itemActions.toArray()).filter(alive));
}

/** Fecha de hoy que se actualiza sola al pasar la medianoche o al volver a la app. */
export function useToday() {
  const [today, setToday] = useState(toDateStr);
  useEffect(() => {
    const check = () => setToday(toDateStr());
    const timer = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return today;
}

export interface SubjectStats {
  subject: Subject;
  topics: Topic[];
  progress: SubjectProgress;
  risk: SubjectRisk;
}

export function subjectStats(subjects: Subject[], topics: Topic[], settings: Settings, today: string): SubjectStats[] {
  const start = settings.semesterStart ?? defaultSemesterStart(today);
  return subjects.map((subject) => {
    const own = topics.filter((t) => t.subjectId === subject.id);
    return { subject, topics: own, progress: computeProgress(own), risk: computeRisk(subject, own, today, start) };
  });
}
