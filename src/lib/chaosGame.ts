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

/** Один опыт: хранит текущую точку и считает выборы вершин. */
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

  constructor(
    readonly weights: Triple,
    private readonly random: RandomSource = browserRandom,
  ) {}

  step(): VertexIndex {
    const vertex = pickVertex(this.weights, this.random);
    const target = VERTICES[vertex];
    this.previousX = this.x;
    this.previousY = this.y;
    this.x = (this.x + target.x) / 2;
    this.y = (this.y + target.y) / 2;
    this.counts[vertex] += 1;
    this.steps += 1;
    this.lastVertex = vertex;
    if (this.steps === 30) this.countsAtThirty = [...this.counts];
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
