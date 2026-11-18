import { browserRandom, type RandomSource } from './random';

export const LEVELS = 8;
export const BIN_COUNT = LEVELS + 1;

/** Путь шарика: true означает поворот вправо. */
export function simulatePath(probabilityRight: number, random: RandomSource = browserRandom): boolean[] {
  const path: boolean[] = [];
  for (let level = 0; level < LEVELS; level += 1) {
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

export function binomialDistribution(probabilityRight: number): number[] {
  return Array.from(
    { length: BIN_COUNT },
    (_, bin) =>
      binomialCoefficient(LEVELS, bin) * probabilityRight ** bin * (1 - probabilityRight) ** (LEVELS - bin),
  );
}

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
