/**
 * Описательная статистика выборки. Доска Гальтона и серия опытов со скрытой картинкой
 * считают характеристики одними и теми же формулами из этого файла.
 */

export interface SampleSummary {
  /** Объём выборки N. */
  size: number;
  mean: number | null;
  median: number | null;
  /** Все значения с наибольшей частотой, по возрастанию. */
  modes: number[];
  /** Исправленная выборочная дисперсия s² со знаменателем N − 1. */
  variance: number | null;
  /** Стандартное отклонение s = √s². */
  standardDeviation: number | null;
}

/** Пара «значение — сколько раз оно встретилось». */
export type Frequency = readonly [value: number, count: number];

const EMPTY: SampleSummary = {
  size: 0,
  mean: null,
  median: null,
  modes: [],
  variance: null,
  standardDeviation: null,
};

/** Основной расчёт: частоты должны идти по возрастанию значений. */
export function summarizeFrequencies(frequencies: readonly Frequency[]): SampleSummary {
  const used = frequencies.filter(([, count]) => count > 0);
  const size = used.reduce((total, [, count]) => total + count, 0);
  if (size === 0) return EMPTY;

  const mean = used.reduce((total, [value, count]) => total + value * count, 0) / size;
  const squares = used.reduce((total, [value, count]) => total + count * (value - mean) ** 2, 0);
  const variance = size < 2 ? null : squares / (size - 1);

  const topCount = Math.max(...used.map(([, count]) => count));
  const modes = used.filter(([, count]) => count === topCount).map(([value]) => value);

  // Медиана — среднее двух центральных элементов упорядоченной выборки (при нечётном N они совпадают).
  const valueAt = (position: number): number => {
    let passed = 0;
    for (const [value, count] of used) {
      passed += count;
      if (position < passed) return value;
    }
    return used[used.length - 1][0];
  };
  const median = (valueAt(Math.floor((size - 1) / 2)) + valueAt(Math.floor(size / 2))) / 2;

  return {
    size,
    mean,
    median,
    modes,
    variance,
    standardDeviation: variance === null ? null : Math.sqrt(variance),
  };
}

/** Характеристики по таблице частот: counts[i] — сколько раз встретилось значение offset + i. */
export function summarizeCounts(counts: readonly number[], offset = 0): SampleSummary {
  return summarizeFrequencies(counts.map((count, index) => [offset + index, count] as const));
}

/** Характеристики по списку наблюдений. */
export function summarize(values: readonly number[]): SampleSummary {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return summarizeFrequencies([...counts.entries()].sort(([first], [second]) => first - second));
}

/** Частоты целых значений на отрезке [from; to]: результат[i] — сколько раз встретилось from + i. */
export function countIntegers(values: readonly number[], from: number, to: number): number[] {
  const counts = Array<number>(to - from + 1).fill(0);
  for (const value of values) {
    if (value >= from && value <= to) counts[value - from] += 1;
  }
  return counts;
}

/** Шкала для оси частот: «круглый» верхний предел и шаг делений (1, 2 или 5 · 10ᵏ). */
export function countAxis(largest: number): { maximum: number; step: number } {
  if (largest <= 0) return { maximum: 5, step: 1 };
  const rough = largest / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= rough) ?? 10 * power;
  const wholeStep = Math.max(1, step);
  return { maximum: Math.ceil(largest / wholeStep) * wholeStep, step: wholeStep };
}
