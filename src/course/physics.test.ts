import { describe, expect, it } from 'vitest';
import { dropBallsMP, dropPathsMP } from './math2';
import { SEESAW, type SeesawState, galtonBallPosition, isSettled, seesawStart, seesawStep } from './physics';

const run = (state: SeesawState, pivot: number, seconds: number) => {
  let s = state;
  for (let t = 0; t < seconds; t += 1 / 60) s = seesawStep(s, pivot, 1 / 60);
  return s;
};
const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('качели', () => {
  it('опора в среднем: доска остаётся ровной, шарики стоят', () => {
    const start = seesawStart([3, 5, 6, 11, 15]);
    const end = run(start, 8, 3);
    expect(Math.abs(end.theta)).toBeLessThan(0.5);
    end.xs.forEach((x, i) => expect(Math.abs(x - start.xs[i])).toBeLessThan(0.01));
    expect(isSettled(end)).toBe(true);
  });

  it('опора левее среднего: перевешивает правая сторона, шарики катятся вправо', () => {
    const end = run(seesawStart([3, 5, 6, 11, 15]), 6, 0.6);
    expect(end.theta).toBeGreaterThan(3);
    expect(end.vs.every((v) => v >= 0)).toBe(true);
    expect(mean(end.xs)).toBeGreaterThan(8);
  });

  it('наклон не больше предельного, шарики не вылетают за упоры и не проходят друг сквозь друга', () => {
    const end = run(seesawStart([3, 5, 6, 11, 15]), 2, 30);
    expect(Math.abs(end.theta)).toBeLessThanOrEqual(SEESAW.maxTilt + 1e-9);
    const sorted = [...end.xs].sort((a, b) => a - b);
    expect(sorted[0]).toBeGreaterThanOrEqual(0);
    expect(sorted[sorted.length - 1]).toBeLessThanOrEqual(SEESAW.length);
    for (let i = 1; i < sorted.length; i += 1) expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(SEESAW.ballGap - 1e-6);
  });

  it('после перекоса опору вернули в среднее — система успокаивается', () => {
    const tilted = run(seesawStart([3, 5, 6, 11, 15]), 6, 0.4);
    const end = run(tilted, mean(tilted.xs), 6);
    // Почти в равновесии доска чуть наклонена, но шарики держит трение покоя.
    expect(Math.abs(end.theta)).toBeLessThan(SEESAW.staticTilt);
    expect(end.vs.every((v) => Math.abs(v) < 0.05)).toBe(true);
  });
});


describe('шарик на доске Гальтона', () => {
  const path = [true, false, true, true];
  it('стартует над первым штырьком', () => {
    expect(galtonBallPosition(path, 0)).toEqual({ u: 0, v: 0 });
  });
  it('на целом t стоит над штырьком ряда t: u = вправо − t/2', () => {
    expect(galtonBallPosition(path, 1).u).toBeCloseTo(0.5);
    expect(galtonBallPosition(path, 2).u).toBeCloseTo(0);
    expect(galtonBallPosition(path, 3).v).toBeCloseTo(3);
  });
  it('после m уровней — над центром своей ячейки и дальше падает вниз', () => {
    const end = galtonBallPosition(path, 4);
    expect(end.u).toBeCloseTo(3 - 2);
    expect(galtonBallPosition(path, 5).u).toBeCloseTo(1);
    expect(galtonBallPosition(path, 5).v).toBeGreaterThan(end.v);
  });
});

describe('dropPathsMP', () => {
  it('ячейки путей совпадают с dropBallsMP', () => {
    const paths = dropPathsMP(9, 50, 8, 0.4);
    expect(paths.map((p) => p.filter(Boolean).length)).toEqual(dropBallsMP(9, 50, 8, 0.4));
    expect(paths.every((p) => p.length === 8)).toBe(true);
  });
});
