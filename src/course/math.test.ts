import { describe, expect, it } from 'vitest';
import { formatShare, formatStatistic } from '../lib/format';
import { summarize } from '../lib/statistics';
import {
  BOARD_BINS,
  SPREAD_BASE,
  SPREAD_QUESTION,
  SUMMARY_QUESTIONS,
  beamAngle,
  centerQuestion,
  dropBalls,
  frequencyQuestion,
  frequencyTable,
  isBalanced,
  outlierQuestion,
  outlierRow,
  rangeOf,
  stretch,
  torque,
  variance,
} from './math';

describe('dropBalls', () => {
  it('воспроизводим и префиксно устойчив', () => {
    expect(dropBalls(7, 50).slice(0, 10)).toEqual(dropBalls(7, 10));
    expect(dropBalls(7, 30)).toEqual(dropBalls(7, 30));
    expect(dropBalls(7, 100).every((b) => b >= 0 && b <= 8)).toBe(true);
  });
  it('разные seed дают разные выборки', () => {
    expect(dropBalls(7, 40)).not.toEqual(dropBalls(8, 40));
  });
});

describe('frequencyTable', () => {
  it('частоты в сумме дают N, доли — 1', () => {
    const t = frequencyTable([3, 4, 4, 5]);
    expect(t.counts).toHaveLength(BOARD_BINS);
    expect(t.counts[4]).toBe(2);
    expect(t.shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  it('пустая выборка — нули', () => expect(frequencyTable([]).shares.every((s) => s === 0)).toBe(true));
});

describe('качели', () => {
  it('равновесие ровно в среднем', () => {
    expect(torque([2, 4, 9], 5)).toBe(0);
    expect(isBalanced([2, 4, 9], 5.1)).toBe(true);
    expect(isBalanced([2, 4, 9], 5.3)).toBe(false);
  });
  it('угол ограничен ±12°, знак — сторона перевеса', () => {
    expect(beamAngle([20, 20, 20], 0)).toBe(12);
    expect(beamAngle([0, 0], 20)).toBe(-12);
    expect(beamAngle([4, 6], 5)).toBe(0);
  });
});

describe('разброс', () => {
  it('D базовой выборки = 13,2, растяжение в k раз даёт k² · D', () => {
    expect(variance(SPREAD_BASE)).toBeCloseTo(13.2);
    expect(variance(stretch(SPREAD_BASE, 2))).toBeCloseTo(52.8);
    expect(rangeOf(stretch(SPREAD_BASE, 0.5))).toBeCloseTo(5.5);
  });
  it('одно наблюдение — D = 0', () => expect(variance([5])).toBe(0));
  it('растяжение не двигает среднее', () => {
    expect(summarize(stretch(SPREAD_BASE, 1.75)).mean).toBeCloseTo(7);
  });
});

describe('выбросы', () => {
  it('сдвиг максимума меняет среднее на Δ/N, медиану — нет', () => {
    const a = summarize(outlierRow(10, 0));
    const b = summarize(outlierRow(10, 50));
    expect(b.mean! - a.mean!).toBeCloseTo(5);
    expect(b.median).toBe(a.median);
  });
  it('ряд идёт по возрастанию от 40 до 60', () => {
    const row = outlierRow(5, 0);
    expect(row[0]).toBe(40);
    expect(row[row.length - 1]).toBe(60);
    expect([...row].sort((x, y) => x - y)).toEqual(row);
  });
});

describe('вопросы', () => {
  it('частота: нет шариков — нет вопроса', () => expect(frequencyQuestion(7, 0, 4)).toBeNull());
  it('частота: варианты различны и верный — n_k / N', () => {
    for (const bin of [0, 4, 8]) {
      const q = frequencyQuestion(7, 100, bin)!;
      expect(new Set(q.options).size).toBe(3);
      const nk = frequencyTable(dropBalls(7, 100)).counts[bin];
      expect(q.options[q.correct]).toBe(formatShare(nk / 100));
    }
  });
  it('частота: ни один вариант не больше 100 %', () => {
    for (const bin of [3, 4, 5, 6]) {
      const q = frequencyQuestion(2026, 110, bin)!;
      for (const option of q.options) expect(parseFloat(option.replace(',', '.'))).toBeLessThanOrEqual(100);
    }
  });
  it('частота: пустая ячейка тоже даёт три разных варианта', () => {
    const q = frequencyQuestion(7, 3, 0)!;
    expect(new Set(q.options).size).toBe(3);
  });
  it('центр: верный вариант — сдвиг на 5/N, а само среднее в вопросе не раскрыто', () => {
    const q = centerQuestion([2, 4, 6, 8, 10]);
    expect(q.options[q.correct]).toContain('на ' + formatStatistic(1));
    expect(q.text).not.toContain(formatStatistic(6));
    expect(new Set(q.options).size).toBe(3);
  });
  it('центр: вопрос не меняется, пока число точек то же', () => {
    expect(centerQuestion([2, 4, 6, 8, 10])).toEqual(centerQuestion([1, 1, 3, 9, 20]));
  });
  it('разброс: верный ответ — в 9 раз', () => {
    expect(SPREAD_QUESTION.options[SPREAD_QUESTION.correct]).toContain('9');
  });
  it('выбросы: верный вариант содержит 50/N', () => {
    const q = outlierQuestion(20);
    expect(q.options[q.correct]).toContain(formatStatistic(2.5));
    expect(new Set(q.options).size).toBe(3);
  });
  it('итог курса: 4 вопроса, у каждого 3 различных варианта', () => {
    expect(SUMMARY_QUESTIONS).toHaveLength(4);
    for (const q of SUMMARY_QUESTIONS) {
      expect(new Set(q.options).size).toBe(3);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(3);
    }
  });
});
