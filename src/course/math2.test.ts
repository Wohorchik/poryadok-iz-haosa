import { describe, expect, it } from 'vitest';
import { binomialDistribution } from '../lib/galton';
import {
  SUMMARY_QUESTIONS_2,
  ballPath,
  dropBallsMP,
  maxApproxError,
  momentsQuestion,
  normalDensity,
  normalQuestion,
  pathsQuestion,
  shareWithin,
  walkPositions,
  walkQuestion,
} from './math2';

describe('путь шарика', () => {
  it('крайние p дают детерминированный путь', () => {
    expect(ballPath(3, 8, 0)).toEqual(Array(8).fill(false));
    expect(ballPath(3, 8, 1)).toEqual(Array(8).fill(true));
  });
  it('распределение вырождено без NaN', () => {
    expect(binomialDistribution(0, 6).every(Number.isFinite)).toBe(true);
    expect(binomialDistribution(1, 6)[6]).toBe(1);
  });
});

describe('dropBallsMP', () => {
  it('воспроизводим, префиксно устойчив, в пределах 0..m', () => {
    expect(dropBallsMP(5, 40, 12, 0.3).slice(0, 10)).toEqual(dropBallsMP(5, 10, 12, 0.3));
    expect(dropBallsMP(5, 200, 12, 0.3).every((b) => b >= 0 && b <= 12)).toBe(true);
  });
});

describe('walkPositions', () => {
  it('пути начинаются в нуле и идут шагами ±1', () => {
    const walks = walkPositions(1, 3, 10, 0.5);
    expect(walks).toHaveLength(3);
    for (const walk of walks) {
      expect(walk).toHaveLength(11);
      expect(walk[0]).toBe(0);
      for (let k = 1; k < walk.length; k += 1) expect(Math.abs(walk[k] - walk[k - 1])).toBe(1);
    }
  });
});

describe('нормальное приближение', () => {
  it('плотность в центре равна 1 / (σ√2π)', () => {
    expect(normalDensity(5, 5, 2)).toBeCloseTo(1 / (2 * Math.sqrt(2 * Math.PI)));
  });
  it('при m = 100, p = 0,5 в μ ± 2σ лежит около 95 %', () => {
    const share = shareWithin(100, 0.5, 40, 60);
    expect(share).toBeGreaterThan(0.95);
    expect(share).toBeLessThan(0.97);
  });
  it('расхождение падает с ростом m', () => {
    expect(maxApproxError(64, 0.5)).toBeLessThan(maxApproxError(8, 0.5));
  });
});

describe('вопросы курса 2', () => {
  it('пути: C(8, 3) = 56', () => {
    const q = pathsQuestion(8, 3);
    expect(q.options[q.correct]).toBe('56');
  });
  it('пути: три различных варианта при любых m и k', () => {
    for (let m = 1; m <= 10; m += 1) {
      for (let k = 0; k <= m; k += 1) expect(new Set(pathsQuestion(m, k).options).size).toBe(3);
    }
  });
  it('моменты: m = 10, p = 0,3 → E = 3, D = 2,1', () => {
    const q = momentsQuestion(10, 0.3);
    expect(q.options[q.correct]).toContain('E = 3');
    expect(q.options[q.correct]).toContain('D = 2,1');
    expect(new Set(q.options).size).toBe(3);
  });
  it('моменты: варианты различны на всей сетке m и p', () => {
    for (let m = 2; m <= 16; m += 1) {
      for (let p = 5; p <= 95; p += 5) expect(new Set(momentsQuestion(m, p / 100).options).size).toBe(3);
    }
  });
  it('блуждание: k = 16, p = 0,5 → σ = 4; варианты различны', () => {
    const q = walkQuestion(16, 0.5);
    expect(q.options[q.correct]).toBe('4');
    for (const k of [4, 16, 64]) for (const p of [0.05, 0.5, 0.95]) expect(new Set(walkQuestion(k, p).options).size).toBe(3);
  });
  it('нормальное: m = 100, p = 0,5 → от 40 до 60', () => {
    const q = normalQuestion(100, 0.5);
    expect(q.options[q.correct]).toBe('от 40 до 60');
    expect(new Set(q.options).size).toBe(3);
  });
  it('итог курса 2: 4 вопроса по 3 различных варианта', () => {
    expect(SUMMARY_QUESTIONS_2).toHaveLength(4);
    for (const q of SUMMARY_QUESTIONS_2) expect(new Set(q.options).size).toBe(3);
  });
});
