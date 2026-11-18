import type { VertexIndex } from './chaosGame';

export type ColorMode = 'vertex' | 'density' | 'order';

const VERTEX_RGB = [
  [255, 197, 61],
  [98, 220, 235],
  [255, 156, 138],
] as const;

/** Шкала плотности: тёмно-синий → бирюзовый → жёлтый → почти белый. */
export const DENSITY_STOPS = [
  [40, 70, 130],
  [98, 220, 235],
  [255, 197, 61],
  [255, 246, 214],
] as const;

/** Шкала порядка: ранние шаги → поздние. */
export const ORDER_STOPS = [
  [98, 220, 235],
  [180, 150, 255],
  [255, 156, 138],
] as const;

function gradient(stops: readonly (readonly number[])[], value: number): [number, number, number] {
  const position = Math.min(1, Math.max(0, value)) * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(position));
  const fraction = position - index;
  const from = stops[index];
  const to = stops[index + 1];
  return [
    from[0] + (to[0] - from[0]) * fraction,
    from[1] + (to[1] - from[1]) * fraction,
    from[2] + (to[2] - from[2]) * fraction,
  ];
}

export const cssGradient = (stops: readonly (readonly number[])[]): string =>
  `linear-gradient(90deg, ${stops.map((stop) => `rgb(${stop.join(' ')})`).join(', ')})`;

/**
 * Карта точек. Для каждого пикселя хранит число попаданий, последнюю вершину и номер последнего шага,
 * поэтому накопленный рисунок можно перекрасить любым способом без пересчёта.
 */
export class DensityMap {
  readonly counts: Uint32Array;
  private readonly owners: Uint8Array;
  private readonly lastStep: Uint32Array;
  maxCount = 0;
  steps = 0;
  private image: ImageData | null = null;

  constructor(
    readonly width: number,
    readonly height: number,
    private readonly dotSize: number,
    private readonly scale = 1,
  ) {
    this.counts = new Uint32Array(width * height);
    this.owners = new Uint8Array(width * height);
    this.lastStep = new Uint32Array(width * height);
  }

  add(x: number, y: number, vertex: VertexIndex): void {
    this.steps += 1;
    const left = Math.floor(x * this.scale);
    const top = Math.floor(y * this.scale);
    for (let row = top; row < top + this.dotSize && row < this.height; row += 1) {
      for (let column = left; column < left + this.dotSize && column < this.width; column += 1) {
        const index = row * this.width + column;
        const count = this.counts[index] + 1;
        this.counts[index] = count;
        this.owners[index] = vertex;
        this.lastStep[index] = this.steps;
        if (count > this.maxCount) this.maxCount = count;
      }
    }
  }

  clear(): void {
    this.counts.fill(0);
    this.lastStep.fill(0);
    this.maxCount = 0;
    this.steps = 0;
  }

  /** sharedMax — общий максимум для нескольких карт, чтобы яркость была сопоставимой. */
  draw(context: CanvasRenderingContext2D, mode: ColorMode = 'vertex', sharedMax?: number): void {
    this.image ??= context.createImageData(this.width, this.height);
    const pixels = this.image.data;
    const logMax = Math.log1p(sharedMax ?? this.maxCount) || 1;
    const steps = this.steps || 1;
    for (let index = 0; index < this.counts.length; index += 1) {
      const offset = index * 4;
      const count = this.counts[index];
      if (count === 0) {
        pixels[offset + 3] = 0;
        continue;
      }
      const level = Math.log1p(count) / logMax;
      let color: readonly number[];
      let alpha = 255;
      if (mode === 'density') {
        color = gradient(DENSITY_STOPS, level);
      } else if (mode === 'order') {
        color = gradient(ORDER_STOPS, this.lastStep[index] / steps);
      } else {
        color = VERTEX_RGB[this.owners[index]];
        alpha = 90 + 165 * level;
      }
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = alpha;
    }
    context.putImageData(this.image, 0, 0);
  }
}
