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
