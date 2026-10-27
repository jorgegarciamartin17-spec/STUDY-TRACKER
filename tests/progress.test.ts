import { describe, expect, it } from 'vitest';
import { subject, topics } from './fixtures';
import { computeProgress, computeRisk, expectedPercent } from '../src/domain/progress';

describe('progreso', () => {
  it('pondera cada estado', () => {
    const p = computeProgress(topics([0, 1, 2, 3, 4]));
    expect(p.counts).toEqual([1, 1, 1, 1, 1]);
    expect(p.percent).toBe(50);
  });
  it('sin temas es 0 %', () => expect(computeProgress([]).percent).toBe(0));
});

describe('avance esperado', () => {
  it('crece en línea recta hasta una semana antes del examen', () => {
    // 8 sep → 7 dic hay 90 días (examen el 14 dic)
    expect(expectedPercent('2026-09-08', '2026-12-14', '2026-09-08')).toBe(0);
    expect(expectedPercent('2026-09-08', '2026-12-14', '2026-10-23')).toBe(50);
    expect(expectedPercent('2026-09-08', '2026-12-14', '2026-12-10')).toBe(100);
  });
});

describe('riesgo', () => {
  const start = '2026-09-08';
  it('sin examen no hay riesgo', () => {
    expect(computeRisk(subject(), topics([0]), '2026-10-23', start).level).toBe('none');
  });
  it('verde si va al ritmo', () => {
    const r = computeRisk(subject({ examDate: '2026-12-14' }), topics([4, 4, 2, 0]), '2026-10-23', start);
    expect(r.actual).toBe(63);
    expect(r.expected).toBe(50);
    expect(r.level).toBe('green');
  });
  it('amarillo y rojo según la distancia', () => {
    const s = subject({ examDate: '2026-12-14' });
    expect(computeRisk(s, topics([2, 2, 1, 0]), '2026-10-23', start).level).toBe('yellow'); // 31 vs 50
    expect(computeRisk(s, topics([1, 0, 0, 0]), '2026-10-23', start).level).toBe('red'); // 6 vs 50
  });
  it('rojo si hay más de 3 temas sin pasar a limpio', () => {
    const r = computeRisk(subject({ examDate: '2027-06-01' }), topics([1, 1, 1, 1, 4, 4]), '2026-09-20', start);
    expect(r.level).toBe('red');
    expect(r.reason).toMatch(/4 temas/);
  });
  it('usa el próximo parcial y solo sus temas', () => {
    const s = subject({ examDate: '2027-01-20', partials: [{ id: 'p', name: 'Parcial 1', date: '2026-11-07', untilTopic: 2 }] });
    const r = computeRisk(s, topics([4, 4, 0, 0, 0]), '2026-10-23', start);
    expect(r.target?.name).toBe('Parcial 1');
    expect(r.actual).toBe(100);
    expect(r.level).toBe('green');
  });
  it('terminada cuando ya pasó el examen', () => {
    expect(computeRisk(subject({ examDate: '2026-10-01' }), topics([4]), '2026-10-23', start).level).toBe('finished');
  });
});
