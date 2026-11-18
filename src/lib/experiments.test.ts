import { describe, expect, it } from 'vitest';
import { ChaosRun, EQUAL_WEIGHTS, SKEWED_WEIGHTS, VERTICES, parseWeights, pickVertex, toProbabilities } from './chaosGame';
import { plural } from './format';
import {
  BIN_COUNT,
  LEVELS,
  binOfPath,
  binomialCoefficient,
  binomialDistribution,
  chartMaximum,
  parsePercent,
  simulatePath,
} from './galton';
import {
  CELL_COUNT,
  applyAttempt,
  createPictureState,
  expectedOpened,
  missProbability,
  parseForecast,
} from './hiddenPicture';
import { ART_SIZE, buildLighthousePixels } from './lighthouseArt';
import { browserRandom, randomIndex } from './random';

describe('случайный источник', () => {
  it('выдаёт значения из [0; 1) и все 100 клеток', () => {
    const seen = new Set<number>();
    for (let index = 0; index < 20000; index += 1) {
      const value = browserRandom();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      seen.add(randomIndex(CELL_COUNT));
    }
    expect(seen.size).toBe(CELL_COUNT);
  });
});

describe('скрытая картинка', () => {
  it('повтор увеличивает попытки и повторы, но не открытые клетки', () => {
    const first = applyAttempt(createPictureState(), 7);
    const second = applyAttempt(first, 7);
    expect(second).toMatchObject({ attempts: 2, repeats: 1, openedCount: 1, lastWasRepeat: true });
  });

  it('открытые клетки + повторы = попытки на каждом шаге', () => {
    let state = createPictureState();
    for (let index = 0; index < 1000; index += 1) {
      state = applyAttempt(state, randomIndex(CELL_COUNT));
      expect(state.openedCount + state.repeats).toBe(state.attempts);
      expect(state.opened.filter(Boolean).length).toBe(state.openedCount);
    }
  });

  it('запоминает результат именно на сотой попытке', () => {
    let state = createPictureState();
    for (let index = 0; index < 100; index += 1) state = applyAttempt(state, index % 50);
    expect(state.openedAtForecast).toBe(50);
    for (let index = 50; index < 80; index += 1) state = applyAttempt(state, index);
    expect(state.openedCount).toBe(80);
    expect(state.openedAtForecast).toBe(50);
  });

  it('проверяет прогноз', () => {
    expect(parseForecast('')).toEqual({ ok: true, value: null });
    expect(parseForecast('0')).toEqual({ ok: true, value: 0 });
    expect(parseForecast(' 100 ')).toEqual({ ok: true, value: 100 });
    for (const bad of ['101', '-1', '3.5', '3,5', 'abc', '1e2']) expect(parseForecast(bad).ok).toBe(false);
  });

  it('формула даёт около 63,4 клетки за 100 попыток', () => {
    expect(missProbability(100)).toBeCloseTo(0.366, 3);
    expect(expectedOpened(100)).toBeCloseTo(63.4, 1);
  });

  it('среднее по множеству запусков близко к теории', () => {
    let total = 0;
    const runs = 4000;
    for (let run = 0; run < runs; run += 1) {
      let state = createPictureState();
      for (let attempt = 0; attempt < 100; attempt += 1) state = applyAttempt(state, randomIndex(CELL_COUNT));
      total += state.openedCount;
    }
    expect(Math.abs(total / runs - expectedOpened(100))).toBeLessThan(0.3);
  });

  it('иллюстрация заполнена и разнообразна', () => {
    const pixels = buildLighthousePixels();
    const colors = new Set<string>();
    for (let offset = 0; offset < pixels.length; offset += 4) {
      expect(pixels[offset + 3]).toBe(255);
      colors.add(`${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]}`);
    }
    expect(pixels.length).toBe(ART_SIZE * ART_SIZE * 4);
    expect(colors.size).toBeGreaterThan(20);
  });
});

describe('треугольник Серпинского', () => {
  it('новая точка лежит посередине между текущей точкой и вершиной', () => {
    const run = new ChaosRun(EQUAL_WEIGHTS);
    for (let index = 0; index < 500; index += 1) {
      const { x, y } = run;
      const vertex = VERTICES[run.step()];
      expect(run.x).toBeCloseTo((x + vertex.x) / 2, 10);
      expect(run.y).toBeCloseTo((y + vertex.y) / 2, 10);
    }
  });

  it('сумма выборов равна числу шагов', () => {
    const run = new ChaosRun(SKEWED_WEIGHTS);
    for (let index = 1; index <= 5000; index += 1) {
      run.step();
      expect(run.counts[0] + run.counts[1] + run.counts[2]).toBe(index);
      expect(run.steps).toBe(index);
    }
  });

  it('вероятности считаются как доли от суммы весов', () => {
    expect(toProbabilities([60, 30, 10])).toEqual([0.6, 0.3, 0.1]);
    expect(toProbabilities([2, 0, 2])).toEqual([0.5, 0, 0.5]);
  });

  it('вершина с нулевым весом не выпадает даже на границе диапазона', () => {
    expect(pickVertex([1, 1, 0], () => 0.999999999)).toBe(1);
    expect(pickVertex([0, 1, 1], () => 0)).toBe(1);
    expect(pickVertex([1, 0, 0], () => 0.5)).toBe(0);
    const run = new ChaosRun([0, 5, 5]);
    for (let index = 0; index < 3000; index += 1) run.step();
    expect(run.counts[0]).toBe(0);
  });

  it('частоты 60/30/10 сходятся к заданным', () => {
    const run = new ChaosRun(SKEWED_WEIGHTS);
    for (let index = 0; index < 200000; index += 1) run.step();
    expect(run.counts[0] / run.steps).toBeCloseTo(0.6, 1);
    expect(run.counts[1] / run.steps).toBeCloseTo(0.3, 1);
    expect(run.counts[2] / run.steps).toBeCloseTo(0.1, 1);
  });

  it('проверяет веса', () => {
    expect(parseWeights(['0', '0', '0']).ok).toBe(false);
    expect(parseWeights(['-1', '2', '3']).ok).toBe(false);
    expect(parseWeights(['', '2', '3']).ok).toBe(false);
    expect(parseWeights(['9'.repeat(400), '2', '3']).ok).toBe(false);
    expect(parseWeights(['0', '0,5', '1.5'])).toEqual({ ok: true, weights: [0, 0.5, 1.5] });
  });
});

describe('доска Гальтона', () => {
  it('p = 0 % отправляет все шарики в ячейку 0', () => {
    for (let index = 0; index < 5000; index += 1) expect(binOfPath(simulatePath(0))).toBe(0);
  });

  it('p = 100 % отправляет все шарики в ячейку 8', () => {
    for (let index = 0; index < 5000; index += 1) expect(binOfPath(simulatePath(1))).toBe(8);
    expect(binOfPath(simulatePath(1, () => 0.9999999999))).toBe(8);
  });

  it('номер ячейки равен числу поворотов вправо', () => {
    expect(binOfPath([true, false, true, false, false, false, true, false])).toBe(3);
    expect(simulatePath(0.5)).toHaveLength(LEVELS);
  });

  it('теоретическое распределение верно', () => {
    expect(Array.from({ length: BIN_COUNT }, (_, bin) => binomialCoefficient(8, bin))).toEqual([
      1, 8, 28, 56, 70, 56, 28, 8, 1,
    ]);
    const half = binomialDistribution(0.5);
    expect(half[4]).toBeCloseTo(70 / 256, 10);
    expect(half[0]).toBeCloseTo(1 / 256, 10);
    expect(binomialDistribution(0)[0]).toBe(1);
    expect(binomialDistribution(1)[8]).toBe(1);
    for (const p of [0, 0.13, 0.5, 0.9, 1]) {
      expect(binomialDistribution(p).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
    }
  });

  it('частоты близки к биномиальным при p = 30 %', () => {
    const counts = Array<number>(BIN_COUNT).fill(0);
    const balls = 200000;
    for (let index = 0; index < balls; index += 1) counts[binOfPath(simulatePath(0.3))] += 1;
    binomialDistribution(0.3).forEach((theory, bin) => {
      expect(Math.abs(counts[bin] / balls - theory)).toBeLessThan(0.006);
    });
  });

  it('проверяет p и подбирает шкалу', () => {
    expect(parsePercent('0')).toEqual({ ok: true, value: 0 });
    expect(parsePercent('100')).toEqual({ ok: true, value: 100 });
    for (const bad of ['101', '-5', '', '2,5']) expect(parsePercent(bad).ok).toBe(false);
    expect(chartMaximum([0.273, 0.2])).toBe(30);
    expect(chartMaximum([1])).toBe(100);
  });
});

describe('склонение', () => {
  it('подбирает форму слова', () => {
    const word = (value: number) => plural(value, 'клетка', 'клетки', 'клеток');
    expect([1, 2, 5, 11, 12, 21, 24, 100, 101].map(word)).toEqual([
      'клетка', 'клетки', 'клеток', 'клеток', 'клеток', 'клетка', 'клетки', 'клеток', 'клетка',
    ]);
  });
});
