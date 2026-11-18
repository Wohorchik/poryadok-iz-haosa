import { formatShare, formatStatistic } from './format';
import { browserRandom, type RandomSource } from './random';

export type VertexIndex = 0 | 1 | 2;
export type Triple = readonly [number, number, number];

export const VERTEX_NAMES = ['A', 'B', 'C'] as const;
export const CANVAS_WIDTH = 600;
export const CANVAS_HEIGHT = 540;

/** Равносторонний треугольник в координатах холста. */
export const VERTICES = [
  { x: 300, y: 36 },
  { x: 30, y: 504 },
  { x: 570, y: 504 },
] as const;

export const EQUAL_WEIGHTS: Triple = [1, 1, 1];
export const SKEWED_WEIGHTS: Triple = [60, 30, 10];
export const COMPARE_WEIGHTS: Triple = [6, 3, 1];
/** Классическая доля пути до вершины. */
export const CLASSIC_FRACTION = 0.5;
/** Шаги, после которых результат фиксируется автоматически. */
export const CHECKPOINTS = [30, 300, 3000] as const;
const MAX_WEIGHT = 1_000_000;

export function toProbabilities(weights: Triple): Triple {
  const total = weights[0] + weights[1] + weights[2];
  return [weights[0] / total, weights[1] / total, weights[2] / total];
}

export function pickVertex(weights: Triple, random: RandomSource = browserRandom): VertexIndex {
  const total = weights[0] + weights[1] + weights[2];
  const target = random() * total;
  let cumulative = 0;
  let lastPositive: VertexIndex = 0;
  for (const index of [0, 1, 2] as const) {
    if (weights[index] <= 0) continue;
    lastPositive = index;
    cumulative += weights[index];
    if (target < cumulative) return index;
  }
  return lastPositive;
}

/** Один опыт: хранит текущую точку и считает выборы вершин. Новая точка: P + t(V − P). */
export class ChaosRun {
  steps = 0;
  counts: [number, number, number] = [0, 0, 0];
  x: number = VERTICES[0].x;
  y: number = VERTICES[0].y;
  previousX: number = VERTICES[0].x;
  previousY: number = VERTICES[0].y;
  lastVertex: VertexIndex | null = null;
  /** Выборы вершин за первые 30 шагов: нужны для ответа на вопрос. */
  countsAtThirty: Triple | null = null;
  /** Автоматически зафиксированные частоты после 30, 300 и 3000 шагов. */
  checkpoints: Partial<Record<number, Triple>> = {};

  constructor(
    readonly weights: Triple,
    private readonly random: RandomSource = browserRandom,
    readonly fraction: number = CLASSIC_FRACTION,
  ) {}

  step(): VertexIndex {
    const vertex = pickVertex(this.weights, this.random);
    const target = VERTICES[vertex];
    this.previousX = this.x;
    this.previousY = this.y;
    this.x += this.fraction * (target.x - this.x);
    this.y += this.fraction * (target.y - this.y);
    this.counts[vertex] += 1;
    this.steps += 1;
    this.lastVertex = vertex;
    if (this.steps === 30) this.countsAtThirty = [...this.counts];
    if ((CHECKPOINTS as readonly number[]).includes(this.steps)) this.checkpoints[this.steps] = [...this.counts];
    return vertex;
  }
}

export type WeightsResult = { ok: true; weights: Triple } | { ok: false; error: string };

export function parseWeights(raw: readonly [string, string, string]): WeightsResult {
  const values: number[] = [];
  for (let index = 0; index < 3; index += 1) {
    const text = raw[index].trim().replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(text)) {
      return {
        ok: false,
        error: `Вес вершины ${VERTEX_NAMES[index]} должен быть неотрицательным числом.`,
      };
    }
    const value = Number(text);
    if (value > MAX_WEIGHT) {
      return { ok: false, error: `Вес вершины ${VERTEX_NAMES[index]} должен быть не больше 1 000 000.` };
    }
    values.push(value);
  }
  if (values.every((value) => value === 0)) {
    return { ok: false, error: 'Хотя бы один вес должен быть больше нуля.' };
  }
  return { ok: true, weights: [values[0], values[1], values[2]] };
}

const VERTEX_INDEXES = [0, 1, 2] as const;

/** Название рисунка: классика только при t = 0,5. */
export const patternName = (fraction: number): string =>
  fraction === CLASSIC_FRACTION ? 'Треугольник Серпинского' : `Узор игры хаоса (t = ${formatStatistic(fraction)})`;

/** Пояснение к узору при заданных весах и доле пути t. Опыт всегда стартует в вершине A. */
export function describePattern(weights: Triple, fraction: number = CLASSIC_FRACTION): string {
  const probabilities = toProbabilities(weights);
  const active = VERTEX_INDEXES.filter((index) => weights[index] > 0);
  const shrink =
    fraction === CLASSIC_FRACTION
      ? 'уменьшается вдвое'
      : `умножается на 1 − t = ${formatStatistic(1 - fraction)}`;
  if (active.length === 1) {
    const name = VERTEX_NAMES[active[0]];
    if (active[0] === 0) return 'Участвует только вершина A, а точка стартует в ней же, поэтому она всё время остаётся в A.';
    return `Участвует только вершина ${name}. Расстояние до неё на каждом шаге ${shrink}, поэтому точка быстро приближается к ${name}.`;
  }
  if (active.length === 2) {
    const side = `${VERTEX_NAMES[active[0]]}${VERTEX_NAMES[active[1]]}`;
    if (active[0] === 0) {
      return `Участвуют только вершины ${VERTEX_NAMES[active[0]]} и ${VERTEX_NAMES[active[1]]}. Точка стартует в A, которая лежит на стороне ${side}, поэтому все точки ложатся на эту сторону.`;
    }
    return `Точка стартует в A, t = ${formatStatistic(fraction)}. При выборе ${VERTEX_NAMES[active[0]]} или ${VERTEX_NAMES[active[1]]} расстояние до стороны ${side} на каждом шаге ${shrink}. Точки постепенно приближаются к стороне ${side}.`;
  }
  if (fraction !== CLASSIC_FRACTION) {
    return `При t = ${formatStatistic(fraction)} получается не треугольник Серпинского, а другой узор игры хаоса: ${
      fraction < CLASSIC_FRACTION ? 'копии перекрываются и заполняют треугольник плотнее' : 'точки жмутся к вершинам, копии расходятся'
    }.`;
  }
  if (weights[0] === weights[1] && weights[1] === weights[2]) {
    return 'Равные шансы: точки складываются в фрактальный узор из трёх уменьшенных копий целого с пустотой в центре. Каждая копия получает около трети точек, поэтому три области заполнены примерно одинаково плотно.';
  }
  const ordered = [...VERTEX_INDEXES].sort((first, second) => probabilities[second] - probabilities[first]);
  const densest = ordered[0];
  const sparsest = ordered[2];
  return `Неравные шансы: контур узора сохраняется, а плотность меняется. Часть у вершины ${VERTEX_NAMES[densest]} получает около ${formatShare(probabilities[densest])} точек, часть у вершины ${VERTEX_NAMES[sparsest]} около ${formatShare(probabilities[sparsest])}.`;
}
