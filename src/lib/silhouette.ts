/**
 * «Нарисуй силуэт точками»: маска рисунка на квадратной сетке и метод Монте-Карло.
 * Точка равномерно падает в квадрат; доля попаданий внутрь маски оценивает долю площади рисунка.
 */
import type { RandomSource } from './random';

export const SILHOUETTE_SIZE = 200;

export type Mask = Uint8Array;

export const emptyMask = (size: number = SILHOUETTE_SIZE): Mask => new Uint8Array(size * size);

export const fullMask = (size: number = SILHOUETTE_SIZE): Mask => new Uint8Array(size * size).fill(1);

/** Маска по условию для центра каждого пикселя (координаты в долях стороны, 0…1). */
function maskFrom(inside: (x: number, y: number) => boolean, size: number = SILHOUETTE_SIZE): Mask {
  const mask = emptyMask(size);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (inside((column + 0.5) / size, (row + 0.5) / size)) mask[row * size + column] = 1;
    }
  }
  return mask;
}

export const circleMask = (size?: number): Mask => maskFrom((x, y) => (x - 0.5) ** 2 + (y - 0.5) ** 2 <= 0.38 ** 2, size);

/** Кольцо: внешний радиус 0,42, отверстие радиуса 0,22 — точки в отверстии считаются внешними. */
export const RING_OUTER = 0.42;
export const RING_INNER = 0.22;
export const ringMask = (size?: number): Mask =>
  maskFrom((x, y) => {
    const d = (x - 0.5) ** 2 + (y - 0.5) ** 2;
    return d <= RING_OUTER ** 2 && d >= RING_INNER ** 2;
  }, size);

/** Пятиконечная звезда: проверка попадания в многоугольник по правилу чётности пересечений. */
export function starMask(size?: number): Mask {
  const points: [number, number][] = [];
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? 0.45 : 0.19;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    points.push([0.5 + radius * Math.cos(angle), 0.53 + radius * Math.sin(angle)]);
  }
  return maskFrom((x, y) => {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }, size);
}

/** Круглая кисть или ластик радиуса radius (в пикселях маски) с центром (cx; cy). */
export function paint(mask: Mask, cx: number, cy: number, radius: number, value: 0 | 1, size: number = SILHOUETTE_SIZE): void {
  const r2 = radius * radius;
  for (let row = Math.max(0, Math.floor(cy - radius)); row <= Math.min(size - 1, Math.ceil(cy + radius)); row += 1) {
    for (let column = Math.max(0, Math.floor(cx - radius)); column <= Math.min(size - 1, Math.ceil(cx + radius)); column += 1) {
      if ((column + 0.5 - cx) ** 2 + (row + 0.5 - cy) ** 2 <= r2) mask[row * size + column] = value;
    }
  }
}

/** Мазок от одной точки к другой: кисть ставится с шагом в полрадиуса, чтобы линия была сплошной. */
export function stroke(mask: Mask, from: [number, number], to: [number, number], radius: number, value: 0 | 1, size: number = SILHOUETTE_SIZE): void {
  const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const steps = Math.max(1, Math.ceil(distance / Math.max(0.5, radius / 2)));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    paint(mask, from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, radius, value, size);
  }
}

/** Доля закрашенных пикселей маски — точное значение, с которым сравнивается оценка. */
export const maskShare = (mask: Mask): number => {
  let filled = 0;
  for (let index = 0; index < mask.length; index += 1) filled += mask[index];
  return filled / mask.length;
};

export const isInside = (mask: Mask, x: number, y: number, size: number = SILHOUETTE_SIZE): boolean =>
  mask[Math.min(size - 1, Math.floor(y * size)) * size + Math.min(size - 1, Math.floor(x * size))] === 1;

/** Серия бросков: координаты точек, попадания и оценка после каждого броска. */
export class Throws {
  readonly xs: number[] = [];
  readonly ys: number[] = [];
  readonly inside: boolean[] = [];
  readonly estimates: number[] = [];
  hits = 0;

  constructor(readonly mask: Mask, private readonly random: RandomSource, readonly size: number = SILHOUETTE_SIZE) {}

  get total(): number {
    return this.xs.length;
  }

  get estimate(): number {
    return this.total === 0 ? 0 : this.hits / this.total;
  }

  add(count: number): void {
    for (let index = 0; index < count; index += 1) {
      const x = this.random();
      const y = this.random();
      const hit = isInside(this.mask, x, y, this.size);
      this.xs.push(x);
      this.ys.push(y);
      this.inside.push(hit);
      if (hit) this.hits += 1;
      this.estimates.push(this.hits / this.xs.length);
    }
  }
}
