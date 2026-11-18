import { browserRandom, type RandomSource } from './random';

/** Число уровней по умолчанию. Доска поддерживает от MIN_LEVELS до MAX_LEVELS. */
export const LEVELS = 8;
export const BIN_COUNT = LEVELS + 1;
export const MIN_LEVELS = 4;
export const MAX_LEVELS = 16;

/** Путь шарика: true означает поворот вправо. Шарик тратит ровно levels случайных чисел. */
export function simulatePath(
  probabilityRight: number,
  random: RandomSource = browserRandom,
  levels: number = LEVELS,
): boolean[] {
  const path: boolean[] = [];
  for (let level = 0; level < levels; level += 1) {
    path.push(random() < probabilityRight);
  }
  return path;
}

export const binOfPath = (path: readonly boolean[]): number =>
  path.reduce((rights, isRight) => rights + (isRight ? 1 : 0), 0);

export function binomialCoefficient(n: number, k: number): number {
  let result = 1;
  for (let index = 1; index <= k; index += 1) {
    result = (result * (n - k + index)) / index;
  }
  return Math.round(result);
}

/** P(X = k) для биномиального распределения с m уровнями и вероятностью p. */
export function binomialDistribution(probabilityRight: number, levels: number = LEVELS): number[] {
  return Array.from(
    { length: levels + 1 },
    (_, bin) =>
      binomialCoefficient(levels, bin) * probabilityRight ** bin * (1 - probabilityRight) ** (levels - bin),
  );
}

/** E(X) = mp и D(X) = mp(1 − p). */
export const binomialMean = (levels: number, p: number): number => levels * p;
export const binomialVariance = (levels: number, p: number): number => levels * p * (1 - p);

export type PercentResult = { ok: true; value: number } | { ok: false; error: string };

export function parsePercent(raw: string): PercentResult {
  const text = raw.trim();
  if (!/^\d+$/.test(text) || Number(text) > 100) {
    return { ok: false, error: 'Введите целое число от 0 до 100.' };
  }
  return { ok: true, value: Number(text) };
}

const SCALE_STEPS = [10, 20, 30, 40, 60, 80, 100];

/** Верхняя граница процентной шкалы гистограммы. */
export function chartMaximum(shares: readonly number[]): number {
  const largest = Math.max(...shares) * 100;
  return SCALE_STEPS.find((step) => step >= largest) ?? 100;
}

/** Случайное блуждание по тем же шагам: r правых из k даёт положение 2r − k и ячейку r. */
export const walkPosition = (path: readonly boolean[]): number => 2 * binOfPath(path) - path.length;
