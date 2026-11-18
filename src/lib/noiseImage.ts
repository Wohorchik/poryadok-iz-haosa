/**
 * «От шума к изображению»: каждое измерение = истинная яркость + независимый шум U(−a, a).
 * Храним только сумму измерений и текущий кадр. Шум конкретного пикселя в конкретном кадре
 * однозначно восстанавливается по (seed, номер кадра, номер пикселя), поэтому историю любого
 * пикселя можно показать без хранения всех кадров.
 */
import { ART_SIZE, buildLighthousePixels } from './lighthouseArt';
import { hashUniform } from './random';

export const NOISE_SIZE = 96;

/** Яркость цветного пикселя по ГОСТ/Rec. 601: Y = 0,299 R + 0,587 G + 0,114 B, шкала 0–255. */
export const luminance = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b;

/** RGBA → яркость каждого пикселя. */
export function toGray(rgba: ArrayLike<number>, pixels: number): Float32Array {
  const gray = new Float32Array(pixels);
  for (let index = 0; index < pixels; index += 1) {
    gray[index] = luminance(rgba[index * 4], rgba[index * 4 + 1], rgba[index * 4 + 2]);
  }
  return gray;
}

/** Встроенный маяк, увеличенный до NOISE_SIZE методом ближайшего соседа. */
export function lighthouseGray(size: number = NOISE_SIZE): Float32Array {
  const art = toGray(buildLighthousePixels(), ART_SIZE * ART_SIZE);
  const gray = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      gray[y * size + x] = art[Math.floor((y * ART_SIZE) / size) * ART_SIZE + Math.floor((x * ART_SIZE) / size)];
    }
  }
  return gray;
}

/** Контрастный геометрический рисунок: круг, полосы и шахматные квадраты. */
export function geometricGray(size: number = NOISE_SIZE): Float32Array {
  const gray = new Float32Array(size * size);
  const c = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let value = 25;
      const dx = x - c;
      const dy = y - c * 0.9;
      if (dx * dx + dy * dy < (size * 0.28) ** 2) value = 235;
      if (dx * dx + dy * dy < (size * 0.14) ** 2) value = 25;
      if (y > size * 0.8) value = Math.floor(x / (size / 12)) % 2 === 0 ? 235 : 25;
      if (y < size * 0.16 && x < size * 0.3) value = (Math.floor(x / (size / 24)) + Math.floor(y / (size / 24))) % 2 === 0 ? 235 : 25;
      if (y < size * 0.16 && x > size * 0.7) value = 130;
      gray[y * size + x] = value;
    }
  }
  return gray;
}

/** Шум пикселя pixel в кадре frame (кадры нумеруются с 1). */
export const noiseAt = (seed: number, frame: number, pixel: number, amplitude: number): number =>
  amplitude === 0 ? 0 : (hashUniform(seed, frame, pixel) * 2 - 1) * amplitude;

/** Стандартное отклонение равномерного шума U(−a, a): σ = a / √3. */
export const noiseSigma = (amplitude: number): number => amplitude / Math.sqrt(3);

export const clampByte = (value: number): number => (value < 0 ? 0 : value > 255 ? 255 : value);

export class NoiseSeries {
  frames = 0;
  readonly sum: Float64Array;
  readonly current: Float32Array;
  /** Среднеквадратическая ошибка восстановления (корень из MSE) после каждого кадра, по всему изображению. */
  readonly rmse: number[] = [];
  /** Та же ошибка для отдельного последнего кадра. */
  frameRmse = 0;

  constructor(
    readonly source: Float32Array,
    readonly size: number,
    readonly amplitude: number,
    readonly seed: number,
  ) {
    this.sum = new Float64Array(source.length);
    this.current = new Float32Array(source.length);
  }

  addFrame(): void {
    const frame = this.frames + 1;
    const { source, sum, current } = this;
    let squares = 0;
    let frameSquares = 0;
    for (let pixel = 0; pixel < source.length; pixel += 1) {
      const measurement = source[pixel] + noiseAt(this.seed, frame, pixel, this.amplitude);
      current[pixel] = measurement;
      sum[pixel] += measurement;
      // Ошибку считаем до ограничения диапазоном 0–255.
      const error = sum[pixel] / frame - source[pixel];
      squares += error * error;
      const frameError = measurement - source[pixel];
      frameSquares += frameError * frameError;
    }
    this.frames = frame;
    this.rmse.push(Math.sqrt(squares / source.length));
    this.frameRmse = Math.sqrt(frameSquares / source.length);
  }

  addFrames(count: number): void {
    for (let index = 0; index < count; index += 1) this.addFrame();
  }

  mean(pixel: number): number {
    return this.frames === 0 ? 0 : this.sum[pixel] / this.frames;
  }

  /** Все измерения пикселя по кадрам 1…frames, восстановленные по seed. */
  pixelHistory(pixel: number): number[] {
    return Array.from({ length: this.frames }, (_, index) => this.source[pixel] + noiseAt(this.seed, index + 1, pixel, this.amplitude));
  }

  /** Изображение для показа: значения ограничиваются диапазоном 0–255 только здесь. */
  toRgba(values: (pixel: number) => number): Uint8ClampedArray {
    const rgba = new Uint8ClampedArray(this.source.length * 4);
    for (let pixel = 0; pixel < this.source.length; pixel += 1) {
      const value = clampByte(values(pixel));
      rgba[pixel * 4] = value;
      rgba[pixel * 4 + 1] = value;
      rgba[pixel * 4 + 2] = value;
      rgba[pixel * 4 + 3] = 255;
    }
    return rgba;
  }
}
