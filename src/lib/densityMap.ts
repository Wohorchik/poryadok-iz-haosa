import type { VertexIndex } from './chaosGame';

const VERTEX_RGB = [
  [255, 197, 61],
  [98, 220, 235],
  [255, 156, 138],
] as const;

/**
 * Карта плотности точек. Яркость пикселя растёт с логарифмом числа попаданий,
 * поэтому разница в плотности заметна и после сотен тысяч шагов.
 */
export class DensityMap {
  private readonly counts: Uint32Array;
  private readonly owners: Uint8Array;
  private maxCount = 0;
  private image: ImageData | null = null;

  constructor(
    readonly width: number,
    readonly height: number,
    private readonly dotSize: number,
    private readonly scale = 1,
  ) {
    this.counts = new Uint32Array(width * height);
    this.owners = new Uint8Array(width * height);
  }

  add(x: number, y: number, vertex: VertexIndex): void {
    const left = Math.floor(x * this.scale);
    const top = Math.floor(y * this.scale);
    for (let row = top; row < top + this.dotSize && row < this.height; row += 1) {
      for (let column = left; column < left + this.dotSize && column < this.width; column += 1) {
        const index = row * this.width + column;
        const count = this.counts[index] + 1;
        this.counts[index] = count;
        this.owners[index] = vertex;
        if (count > this.maxCount) this.maxCount = count;
      }
    }
  }

  clear(): void {
    this.counts.fill(0);
    this.maxCount = 0;
  }

  draw(context: CanvasRenderingContext2D): void {
    this.image ??= context.createImageData(this.width, this.height);
    const pixels = this.image.data;
    const logMax = Math.log1p(this.maxCount) || 1;
    for (let index = 0; index < this.counts.length; index += 1) {
      const offset = index * 4;
      const count = this.counts[index];
      if (count === 0) {
        pixels[offset + 3] = 0;
        continue;
      }
      const color = VERTEX_RGB[this.owners[index]];
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = 90 + 165 * (Math.log1p(count) / logMax);
    }
    context.putImageData(this.image, 0, 0);
  }
}
