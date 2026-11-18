/** Источник случайных чисел: равномерное значение из полуинтервала [0; 1). */
export type RandomSource = () => number;

const buffer = new Uint32Array(2048);
let cursor = buffer.length;

function nextUint32(): number {
  if (cursor >= buffer.length) {
    crypto.getRandomValues(buffer);
    cursor = 0;
  }
  return buffer[cursor++];
}

/** 53 случайных бита из криптографического генератора браузера. */
export const browserRandom: RandomSource = () => {
  const high = nextUint32() >>> 5;
  const low = nextUint32() >>> 6;
  return (high * 67108864 + low) / 9007199254740992;
};

/** Равновероятное целое число от 0 до size − 1. */
export function randomIndex(size: number, random: RandomSource = browserRandom): number {
  return Math.floor(random() * size);
}

/** Новый seed для воспроизводимого запуска: целое от 1 до 2³² − 1. */
export const newSeed = (): number => nextUint32() || 1;

/**
 * Воспроизводимый генератор (sfc32) по seed. Одинаковый seed даёт одинаковую последовательность,
 * поэтому повтор запуска не зависит от скорости анимации и размера порций вычислений.
 */
export function createRng(seed: number): RandomSource {
  let a = 0x9e3779b9;
  let b = 0x243f6a88;
  let c = 0xb7e15162;
  let d = seed >>> 0;
  const next = () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return t >>> 0;
  };
  for (let index = 0; index < 15; index += 1) next();
  return () => (next() >>> 5) / 134217728 + (next() >>> 6) / 9007199254740992;
}

/**
 * Случайное число в [0; 1), которое зависит только от (seed, a, b). Позволяет восстановить
 * отдельное измерение — например, шум пикселя b в кадре a — без хранения всех кадров.
 */
export function hashUniform(seed: number, a: number, b: number): number {
  let h = Math.imul(seed ^ 0x85ebca6b, 0x9e3779b1) ^ Math.imul(a + 0x632be5ab, 0x85ebca77) ^ Math.imul(b + 0x1b873593, 0xc2b2ae3d);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
