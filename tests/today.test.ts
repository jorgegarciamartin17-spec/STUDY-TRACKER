import { describe, expect, it } from 'vitest';
import type { ItemAction, Task } from '../src/db/types';
import { buildToday, type TodayInput } from '../src/domain/today';
import { base, subject, topics } from './fixtures';

const task = (id: string, dueDate: string, over: Partial<Task> = {}): Task => ({
  ...base, id, subjectId: 's1', kind: 'boletin', title: `Boletín ${id}`, dueDate, done: false, ...over,
});
const input = (over: Partial<TodayInput>): TodayInput => ({
  today: '2026-10-27', // martes
  subjects: [subject()],
  topics: [],
  tasks: [],
  actions: [],
  risks: {},
  minutesWeekday: 120,
  minutesWeekend: 240,
  cleanupThresholdDays: 3,
  ...over,
});

describe('pantalla Hoy', () => {
  it('prioriza lo visto hace más de 3 días sobre lo reciente', () => {
    const ts = topics([1, 1]);
    ts[0].seenAt = '2026-10-26';
    ts[1].seenAt = '2026-10-21';
    const plan = buildToday(input({ topics: ts }));
    expect(plan.items.map((i) => i.topicId)).toEqual([ts[1].id, ts[0].id]);
    expect(plan.items[0].reason).toBe('Visto hace 6 días');
  });

  it('una entrega para mañana es urgente; una a 10 días no aparece', () => {
    const plan = buildToday(input({ tasks: [task('a', '2026-10-28'), task('b', '2026-11-06')] }));
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].group).toBe('urgent');
    expect(plan.items[0].reason).toBe('Entrega mañana');
  });

  it('ignora entregas hechas y asignaturas archivadas', () => {
    const plan = buildToday(input({
      subjects: [subject({ archived: true })],
      topics: topics([1]),
      tasks: [task('a', '2026-10-27')],
    }));
    expect(plan.items).toHaveLength(0);
    const plan2 = buildToday(input({ tasks: [task('a', '2026-10-27', { done: true })] }));
    expect(plan2.items).toHaveLength(0);
  });

  it('oculta lo pospuesto hasta mañana', () => {
    const ts = topics([1]);
    const snooze: ItemAction = { ...base, id: 'x', itemKey: `topic:${ts[0].id}:s1`, date: '2026-10-27', action: 'snoozed', until: '2026-10-28', label: '' };
    expect(buildToday(input({ topics: ts, actions: [snooze] })).items).toHaveLength(0);
    expect(buildToday(input({ topics: ts, actions: [snooze], today: '2026-10-28' })).items).toHaveLength(1);
  });

  it('lo que no cabe en el tiempo disponible va a "Si te da tiempo"', () => {
    const ts = topics([1, 1, 1, 1]).map((t) => ({ ...t, seenAt: '2026-10-27' }));
    const plan = buildToday(input({ topics: ts }));
    // 120 min / 40 min por tema = 3 caben
    expect(plan.items.filter((i) => i.group === 'today')).toHaveLength(3);
    expect(plan.items.filter((i) => i.group === 'extra')).toHaveLength(1);
    expect(plan.budgetMinutes).toBe(120);
  });

  it('limita los "hacer ejercicios" a 2 por asignatura', () => {
    const plan = buildToday(input({ topics: topics([2, 2, 2, 2]) }));
    expect(plan.items.filter((i) => i.kind === 'exercises')).toHaveLength(2);
  });

  it('usa el tiempo del fin de semana el sábado', () => {
    expect(buildToday(input({ today: '2026-10-31' })).budgetMinutes).toBe(240);
  });
});
