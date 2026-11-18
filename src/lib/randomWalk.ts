/**
 * Случайное блуждание: на каждом шаге положение меняется на +1 с вероятностью p или на −1.
 * Шаг вправо на доске Гальтона — это шаг +1: r правых шагов из k дают положение 2r − k и ячейку r.
 */
import type { RandomSource } from './random';

export interface WalkSet {
  steps: number;
  p: number;
  /** paths[i][k] = 1, если k-й шаг i-й траектории равен +1. */
  paths: Uint8Array[];
  finals: Int32Array;
  /** sums[k] — сумма положений всех траекторий после k шагов. */
  sums: Float64Array;
}

export function generateWalks(count: number, steps: number, p: number, random: RandomSource): WalkSet {
  const paths: Uint8Array[] = [];
  const finals = new Int32Array(count);
  const sums = new Float64Array(steps + 1);
  for (let index = 0; index < count; index += 1) {
    const path = new Uint8Array(steps);
    let position = 0;
    for (let step = 0; step < steps; step += 1) {
      const right = random() < p;
      path[step] = right ? 1 : 0;
      position += right ? 1 : -1;
      sums[step + 1] += position;
    }
    paths.push(path);
    finals[index] = position;
  }
  return { steps, p, paths, finals, sums };
}

/** Положения после 0, 1, …, k шагов. */
export function positions(path: ArrayLike<number>, upTo: number = path.length): number[] {
  const result = [0];
  let position = 0;
  for (let step = 0; step < upTo; step += 1) {
    position += path[step] ? 1 : -1;
    result.push(position);
  }
  return result;
}

export const rightSteps = (path: ArrayLike<number>): number => {
  let r = 0;
  for (let step = 0; step < path.length; step += 1) r += path[step] ? 1 : 0;
  return r;
};

export const finalPosition = (path: ArrayLike<number>): number => 2 * rightSteps(path) - path.length;

export const toBooleans = (path: ArrayLike<number>): boolean[] => Array.from(path, (step) => step === 1);

/** E(S_k) = k(2p − 1) и D(S_k) = 4kp(1 − p). */
export const walkMean = (steps: number, p: number): number => steps * (2 * p - 1);
export const walkVariance = (steps: number, p: number): number => 4 * steps * p * (1 - p);

/** Частоты конечных положений от −steps до +steps с шагом 2 (другая чётность невозможна). */
export function finalDistribution(finals: ArrayLike<number>, steps: number): { positions: number[]; counts: number[] } {
  const positionsList = Array.from({ length: steps + 1 }, (_, index) => -steps + 2 * index);
  const counts = Array<number>(steps + 1).fill(0);
  for (let index = 0; index < finals.length; index += 1) counts[(finals[index] + steps) / 2] += 1;
  return { positions: positionsList, counts };
}

/* ---------- Анимация: всё определяется «часами» clock в единицах шагов ---------- */

/** Сдвиг старта соседних путей (в шагах): пути стартуют волной, гистограмма копится постепенно. */
export const walkStagger = (count: number, steps: number): number => (count <= 1 ? 0 : (1.5 * steps) / (count - 1));

/** Значение часов, при котором завершается последний путь. */
export const walkEnd = (count: number, steps: number): number => steps + (count - 1) * walkStagger(count, steps);

/** Сколько шагов прошёл путь index к моменту clock. */
export const pathProgress = (clock: number, index: number, stagger: number, steps: number): number =>
  Math.min(steps, Math.max(0, clock - index * stagger));

/** Сколько путей уже сделали последний шаг. Каждый путь попадает в гистограмму ровно один раз. */
export function completedPaths(clock: number, count: number, stagger: number, steps: number): number {
  if (clock + 1e-9 < steps) return 0;
  if (stagger === 0) return count;
  return Math.min(count, Math.floor((clock - steps) / stagger + 1e-9) + 1);
}

/** Положения пути после 0, 1, …, steps шагов. */
export function positionTable(path: ArrayLike<number>): Int16Array {
  const table = new Int16Array(path.length + 1);
  for (let step = 0; step < path.length; step += 1) table[step + 1] = table[step] + (path[step] ? 1 : -1);
  return table;
}

/** Положение в момент progress: между шагами — плавно, на целых шагах — точно. */
export function positionAt(table: ArrayLike<number>, progress: number): number {
  const step = Math.floor(progress + 1e-9);
  if (step >= table.length - 1) return table[table.length - 1];
  const fraction = progress - step;
  return table[step] + (table[step + 1] - table[step]) * Math.max(0, fraction);
}

/** Частоты конечных положений только для завершённых путей. */
export function completedDistribution(finals: ArrayLike<number>, completed: number, steps: number): number[] {
  const counts = Array<number>(steps + 1).fill(0);
  for (let index = 0; index < completed; index += 1) counts[(finals[index] + steps) / 2] += 1;
  return counts;
}
