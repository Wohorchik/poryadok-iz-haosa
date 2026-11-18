/** «Нарисуй распределение»: выборка целых значений на шкале 0–100 и её показатели. */
import { summarize } from './statistics';

export const DOMAIN_MIN = 0;
export const DOMAIN_MAX = 100;

export const SPREAD_SCENE: readonly (readonly number[])[] = [
  [4, 4, 4, 4],
  [2, 3, 5, 6],
];
export const OUTLIER_START: readonly number[] = [10, 11, 12, 13, 14];
export const OUTLIER_VALUE = 100;
export const FREE_START: readonly number[] = [22, 35, 40, 40, 47, 55, 60, 60, 60, 72];

export const clampValue = (value: number, min = DOMAIN_MIN, max = DOMAIN_MAX): number =>
  Math.min(max, Math.max(min, Math.round(value)));

export interface Description {
  size: number;
  mean: number | null;
  median: number | null;
  range: number | null;
  standardDeviation: number | null;
}

/** N, среднее, медиана, размах и стандартное отклонение s (знаменатель N − 1, как во всём проекте). */
export function describe(values: readonly number[]): Description {
  const summary = summarize(values);
  return {
    size: summary.size,
    mean: summary.mean,
    median: summary.median,
    range: values.length === 0 ? null : Math.max(...values) - Math.min(...values),
    standardDeviation: summary.standardDeviation,
  };
}

/**
 * Уровень точки в столбике одинаковых значений: первая точка значения — 0, следующая — 1 и т. д.
 * Порядок совпадает с порядком в выборке, поэтому точки не перескакивают при перерисовке.
 */
export function stackLevels(values: readonly number[]): number[] {
  const seen = new Map<number, number>();
  return values.map((value) => {
    const level = seen.get(value) ?? 0;
    seen.set(value, level + 1);
    return level;
  });
}

/** Гистограмма на [0; 100] с интервалами ширины width; значение 100 входит в последний интервал. */
export function histogram(values: readonly number[], width: number): { starts: number[]; counts: number[] } {
  const bins = Math.ceil((DOMAIN_MAX - DOMAIN_MIN) / width);
  const counts = Array<number>(bins).fill(0);
  for (const value of values) {
    counts[Math.min(bins - 1, Math.floor((value - DOMAIN_MIN) / width))] += 1;
  }
  return { starts: counts.map((_, index) => DOMAIN_MIN + index * width), counts };
}

/** История изменений для «Отменить». */
export interface Editable {
  samples: number[][];
  history: number[][][];
}

export const startEditable = (samples: readonly (readonly number[])[]): Editable => ({
  samples: samples.map((sample) => [...sample]),
  history: [],
});

export const commit = (state: Editable, samples: number[][]): Editable => ({
  samples,
  history: [...state.history, state.samples],
});

export const undo = (state: Editable): Editable =>
  state.history.length === 0
    ? state
    : { samples: state.history[state.history.length - 1], history: state.history.slice(0, -1) };

/* ---------- «Как одна точка меняет среднее» ---------- */

export const MEAN_START: readonly number[] = [10, 11, 12, 13, 14];
export const MEAN_EXAMPLE_TO = 44;
export const MEAN_DOMAIN: readonly [number, number] = [0, 60];

const COUNT_WORDS = ['ноль', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять'];

export interface Change {
  index: number;
  from: number;
  to: number;
  delta: number;
  size: number;
  meanDelta: number;
  medianBefore: number;
  medianAfter: number;
}

/** Если изменилось ровно одно значение (размер выборки тот же), описывает это изменение. */
export function singleChange(before: readonly number[], after: readonly number[]): Change | null {
  if (before.length !== after.length || before.length === 0) return null;
  const changed = before.map((value, index) => (value === after[index] ? -1 : index)).filter((index) => index >= 0);
  if (changed.length !== 1) return null;
  const index = changed[0];
  const delta = after[index] - before[index];
  return {
    index,
    from: before[index],
    to: after[index],
    delta,
    size: before.length,
    meanDelta: delta / before.length,
    medianBefore: describe(before).median ?? 0,
    medianAfter: describe(after).median ?? 0,
  };
}

/** Объяснение изменения простыми словами, числа — в русском формате. */
export function explainChange(change: Change, format: (value: number) => string): string {
  const grew = change.delta > 0;
  const size = change.size <= 10 ? COUNT_WORDS[change.size] : String(change.size);
  const median =
    change.medianAfter === change.medianBefore
      ? `Центральное число осталось равным ${format(change.medianAfter)}.`
      : `Центральное число изменилось: ${format(change.medianBefore)} → ${format(change.medianAfter)}.`;
  return `Одно значение ${grew ? 'выросло' : 'уменьшилось'} на ${format(Math.abs(change.delta))}. Точек ${size}, поэтому среднее ${
    grew ? 'выросло' : 'уменьшилось'
  } на ${format(Math.abs(change.delta))} ÷ ${change.size} = ${format(Math.abs(change.meanDelta))}. ${median}`;
}
