import type { Subject, Topic, TopicStatus } from '../src/db/types';

export const base = { createdAt: 0, updatedAt: 0, deletedAt: null };
export const subject = (over: Partial<Subject> = {}): Subject => ({
  ...base, id: 's1', name: 'Orgánica', color: '#000', partials: [], archived: false, order: 0, ...over,
});
export const topics = (statuses: TopicStatus[], subjectId = 's1'): Topic[] =>
  statuses.map((status, i) => ({
    ...base, id: `${subjectId}-t${i}`, subjectId, order: i, title: `Tema ${i + 1}`, status,
    statusHistory: [], notes: '', forTutoring: false, seenAt: status ? '2026-10-20' : undefined,
  }));
