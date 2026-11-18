import { describe, expect, it } from 'vitest';
import { ChaosRun, VERTICES, describePattern, patternName, type Triple } from './chaosGame';
import { runningMeans } from './chart';
import { DensityMap } from './densityMap';
import {
  OUTLIER_START,
  OUTLIER_VALUE,
  SPREAD_SCENE,
  commit,
  describe as describeSample,
  histogram,
  stackLevels,
  startEditable,
  undo,
} from './drawDistribution';
import { binOfPath, binomialDistribution, binomialMean, binomialVariance, simulatePath, walkPosition } from './galton';
import { applyAttempts, createPictureState, expectedOpened, expectedShare, runPictureTrial } from './hiddenPicture';
import { NOISE_SIZE, NoiseSeries, geometricGray, lighthouseGray, luminance, noiseSigma } from './noiseImage';
import { createRng, hashUniform, randomIndex } from './random';
import { finalDistribution, finalPosition, generateWalks, walkMean, walkVariance } from './randomWalk';
import { summarize, summarizeCounts } from './statistics';

const SEED = 20261118;

describe('воспроизводимый генератор', () => {
  it('одинаковый seed — одинаковая последовательность, разный — разная', () => {
    const a = createRng(SEED);
    const b = createRng(SEED);
    const c = createRng(SEED + 1);
    const first = Array.from({ length: 50 }, () => a());
    expect(Array.from({ length: 50 }, () => b())).toEqual(first);
    expect(Array.from({ length: 50 }, () => c())).not.toEqual(first);
    for (const value of first) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('hashUniform зависит только от аргументов и лежит в [0; 1)', () => {
    expect(hashUniform(1, 2, 3)).toBe(hashUniform(1, 2, 3));
    expect(hashUniform(1, 2, 3)).not.toBe(hashUniform(1, 3, 2));
    let sum = 0;
    for (let i = 0; i < 20000; i += 1) {
      const value = hashUniform(SEED, i, 7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      sum += value;
    }
    expect(sum / 20000).toBeCloseTo(0.5, 1);
  });
});

describe('доска Гальтона: m уровней', () => {
  it('8 уровней, p = 50 %: E = 4, D = 2, P(4) = 70/256', () => {
    expect(binomialMean(8, 0.5)).toBe(4);
    expect(binomialVariance(8, 0.5)).toBe(2);
    expect(binomialDistribution(0.5, 8)[4]).toBeCloseTo(70 / 256, 12);
  });

  it('распределение для 4…16 уровней в сумме даёт 1 и имеет m + 1 ячейку', () => {
    for (let m = 4; m <= 16; m += 1) {
      const distribution = binomialDistribution(0.3, m);
      expect(distribution).toHaveLength(m + 1);
      expect(distribution.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12);
    }
  });

  it('p = 100 %: все шарики в последней ячейке при любом числе уровней', () => {
    const rng = createRng(SEED);
    for (let m = 4; m <= 16; m += 1) {
      for (let ball = 0; ball < 200; ball += 1) expect(binOfPath(simulatePath(1, rng, m))).toBe(m);
    }
  });

  it('результат не зависит от размера партий: 1000 сразу = 10 по 100', () => {
    const whole = createRng(SEED);
    const parts = createRng(SEED);
    const a = Array.from({ length: 1000 }, () => binOfPath(simulatePath(0.5, whole, 8)));
    const b: number[] = [];
    for (let batch = 0; batch < 10; batch += 1) for (let i = 0; i < 100; i += 1) b.push(binOfPath(simulatePath(0.5, parts, 8)));
    expect(b).toEqual(a);
  });

  it('среднее и дисперсия большой выборки близки к mp и mp(1 − p)', () => {
    const rng = createRng(SEED);
    const counts = Array<number>(13).fill(0);
    for (let ball = 0; ball < 50000; ball += 1) counts[binOfPath(simulatePath(0.3, rng, 12))] += 1;
    const summary = summarizeCounts(counts);
    expect(summary.mean).toBeCloseTo(12 * 0.3, 1);
    expect(Math.abs((summary.variance ?? 0) - 12 * 0.3 * 0.7)).toBeLessThan(0.08);
  });

  it('накопленное среднее идёт в порядке учёта', () => {
    expect(runningMeans([0, 2, 4, 6])).toEqual([0, 1, 2, 3]);
  });
});

describe('скрытая картинка: сетки и карта попаданий', () => {
  it('открытые + повторы = попытки, сумма карты попаданий = попытки', () => {
    for (const size of [10, 20, 40]) {
      const rng = createRng(SEED + size);
      const cells = Array.from({ length: 3000 }, () => randomIndex(size * size, rng));
      const state = applyAttempts(createPictureState(size), cells);
      expect(state.openedCount + state.repeats).toBe(state.attempts);
      expect(state.hits.reduce((sum, hits) => sum + hits, 0)).toBe(state.attempts);
      expect(state.hits.filter((hits) => hits > 0).length).toBe(state.openedCount);
      expect(state.history).toHaveLength(3001);
    }
  });

  it('теория 1 − (1 − 1/M)^k: для 10×10 и 100 попыток около 63,4 клетки', () => {
    expect(expectedOpened(100, 100)).toBeCloseTo(63.4, 1);
    expect(expectedShare(0, 1600)).toBe(0);
    expect(expectedShare(1600, 1600)).toBeCloseTo(1 - (1 - 1 / 1600) ** 1600, 12);
  });

  it('в каждом опыте серии открытые + повторы = попытки', () => {
    const rng = createRng(SEED);
    for (let trial = 0; trial < 200; trial += 1) {
      const result = runPictureTrial(rng, 400, 250);
      expect(result.opened + result.repeats).toBe(250);
    }
  });

  it('серия с seed не зависит от размера порций', () => {
    const a = createRng(SEED);
    const b = createRng(SEED);
    const whole = Array.from({ length: 60 }, () => runPictureTrial(a, 100, 100).opened);
    const parts: number[] = [];
    for (let portion = 0; portion < 6; portion += 1) for (let i = 0; i < 10; i += 1) parts.push(runPictureTrial(b, 100, 100).opened);
    expect(parts).toEqual(whole);
  });
});

describe('игра хаоса', () => {
  const build = (weights: Triple, seed: number, fraction = 0.5) => {
    const map = new DensityMap(300, 270, 1, 0.5);
    const run = new ChaosRun(weights, createRng(seed), fraction);
    for (let i = 0; i < 20000; i += 1) {
      const vertex = run.step();
      map.add(run.x, run.y, vertex);
    }
    return { map, run };
  };

  it('одинаковые настройки и seed — одинаковый рисунок', () => {
    const left = build([1, 1, 1], SEED);
    const right = build([1, 1, 1], SEED);
    expect(Array.from(right.map.counts)).toEqual(Array.from(left.map.counts));
    expect(right.run.counts).toEqual(left.run.counts);
  });

  it('вершина с нулевым весом ни разу не выбирается', () => {
    expect(build([6, 0, 1], SEED).run.counts[1]).toBe(0);
    expect(build([0, 3, 1], SEED, 0.37).run.counts[0]).toBe(0);
  });

  it('веса [1, 0, 0] и старт в A: точка остаётся в A при любом t', () => {
    for (const t of [0.5, 0.3, 0.8]) {
      const run = new ChaosRun([1, 0, 0], createRng(SEED), t);
      for (let i = 0; i < 100; i += 1) run.step();
      expect(run.x).toBe(VERTICES[0].x);
      expect(run.y).toBe(VERTICES[0].y);
    }
  });

  it('новая точка P + t(V − P)', () => {
    const run = new ChaosRun([1, 1, 1], createRng(SEED), 0.3);
    for (let i = 0; i < 200; i += 1) {
      const { x, y } = run;
      const vertex = VERTICES[run.step()];
      expect(run.x).toBeCloseTo(x + 0.3 * (vertex.x - x), 10);
      expect(run.y).toBeCloseTo(y + 0.3 * (vertex.y - y), 10);
    }
  });

  it('частоты фиксируются после 30, 300 и 3000 шагов', () => {
    const run = new ChaosRun([1, 1, 1], createRng(SEED));
    for (let i = 0; i < 3000; i += 1) run.step();
    for (const step of [30, 300, 3000]) {
      const counts = run.checkpoints[step] as Triple;
      expect(counts[0] + counts[1] + counts[2]).toBe(step);
    }
  });

  it('подписи: [0, 1, 1] при t = 0,5 и название узора', () => {
    expect(describePattern([0, 1, 1], 0.5)).toContain('Точки постепенно приближаются к стороне BC');
    expect(patternName(0.5)).toBe('Треугольник Серпинского');
    expect(patternName(0.4)).toContain('Узор игры хаоса');
  });
});

describe('от шума к изображению', () => {
  const source = geometricGray();

  it('при одном кадре среднее совпадает с кадром', () => {
    const series = new NoiseSeries(source, NOISE_SIZE, 80, SEED);
    series.addFrame();
    for (let pixel = 0; pixel < source.length; pixel += 97) expect(series.mean(pixel)).toBeCloseTo(series.current[pixel], 4);
  });

  it('при нулевом шуме обе картинки совпадают с исходником и ошибка 0', () => {
    const series = new NoiseSeries(source, NOISE_SIZE, 0, SEED);
    series.addFrames(25);
    expect(series.rmse.every((value) => value === 0)).toBe(true);
    expect(series.frameRmse).toBe(0);
    for (let pixel = 0; pixel < source.length; pixel += 53) {
      expect(series.mean(pixel)).toBeCloseTo(source[pixel], 4);
      expect(series.current[pixel]).toBe(source[pixel]);
    }
  });

  it('отдельный кадр остаётся шумным, а ошибка среднего падает как σ/√n', () => {
    const series = new NoiseSeries(source, NOISE_SIZE, 90, SEED);
    series.addFrames(400);
    const sigma = noiseSigma(90);
    expect(series.frameRmse / sigma).toBeGreaterThan(0.9);
    expect(series.frameRmse / sigma).toBeLessThan(1.1);
    const last = series.rmse[series.rmse.length - 1];
    expect(last / (sigma / Math.sqrt(400))).toBeGreaterThan(0.85);
    expect(last / (sigma / Math.sqrt(400))).toBeLessThan(1.15);
  });

  it('история пикселя восстанавливается по seed, среднее считается до ограничения 0–255', () => {
    const bright = new Float32Array(NOISE_SIZE * NOISE_SIZE).fill(250);
    const series = new NoiseSeries(bright, NOISE_SIZE, 100, SEED);
    series.addFrames(50);
    const history = series.pixelHistory(1234);
    expect(history).toHaveLength(50);
    expect(history[49]).toBeCloseTo(series.current[1234], 3);
    expect(history.some((value) => value > 255)).toBe(true);
    expect(series.mean(1234)).toBeCloseTo(history.reduce((sum, value) => sum + value, 0) / 50, 3);
  });

  it('яркость Rec. 601 и встроенные картинки', () => {
    expect(luminance(255, 255, 255)).toBeCloseTo(255, 6);
    expect(luminance(255, 0, 0)).toBeCloseTo(76.245, 3);
    expect(lighthouseGray()).toHaveLength(NOISE_SIZE * NOISE_SIZE);
  });
});

describe('нарисуй распределение', () => {
  it('одинаковое среднее 4, разный разброс', () => {
    const [first, second] = SPREAD_SCENE.map(describeSample);
    expect(first.mean).toBe(4);
    expect(second.mean).toBe(4);
    expect(first.standardDeviation).toBe(0);
    expect(second.standardDeviation).toBeGreaterThan(0);
    expect(first.range).toBe(0);
    expect(second.range).toBe(4);
  });

  it('выброс: среднее 12 → 26,67, медиана 12 → 12,5; «Отменить» возвращает исходное', () => {
    const start = startEditable([OUTLIER_START]);
    expect(describeSample(start.samples[0])).toMatchObject({ mean: 12, median: 12 });
    const after = commit(start, [[...start.samples[0], OUTLIER_VALUE]]);
    const info = describeSample(after.samples[0]);
    expect(info.mean).toBeCloseTo(26.67, 2);
    expect(info.median).toBe(12.5);
    const back = undo(after);
    expect(describeSample(back.samples[0])).toMatchObject({ mean: 12, median: 12 });
  });

  it('ширина интервала меняет только группировку', () => {
    const values = [0, 4, 4, 9, 10, 55, 99, 100];
    for (const width of [1, 5, 10, 25]) {
      const { counts } = histogram(values, width);
      expect(counts.reduce((sum, count) => sum + count, 0)).toBe(values.length);
    }
    expect(histogram(values, 10).counts[9]).toBe(2);
    expect(summarize(values).mean).toBe(describeSample(values).mean);
  });

  it('одинаковые значения складываются в столбик', () => {
    expect(stackLevels([5, 7, 5, 5, 7])).toEqual([0, 0, 1, 2, 1]);
  });
});

describe('случайное блуждание', () => {
  it('p = 1: 8 шагов заканчиваются в +8', () => {
    const walks = generateWalks(20, 8, 1, createRng(SEED));
    expect(Array.from(walks.finals)).toEqual(Array(20).fill(8));
  });

  it('5 правых и 3 левых шага: положение +2, ячейка 5 на доске', () => {
    const path = [1, 0, 1, 1, 0, 1, 0, 1];
    expect(finalPosition(path)).toBe(2);
    const booleans = path.map((step) => step === 1);
    expect(binOfPath(booleans)).toBe(5);
    expect(walkPosition(booleans)).toBe(2);
  });

  it('после чётного числа шагов положения чётные, после нечётного — нечётные', () => {
    for (const steps of [2, 7, 10, 33]) {
      const walks = generateWalks(300, steps, 0.4, createRng(SEED + steps));
      for (const final of walks.finals) expect(Math.abs(final % 2)).toBe(steps % 2);
      const { counts } = finalDistribution(walks.finals, steps);
      expect(counts.reduce((sum, count) => sum + count, 0)).toBe(300);
    }
  });

  it('среднее и дисперсия конечного положения близки к k(2p − 1) и 4kp(1 − p)', () => {
    const walks = generateWalks(20000, 30, 0.6, createRng(SEED));
    const summary = summarize(Array.from(walks.finals));
    expect(walkMean(30, 0.6)).toBeCloseTo(6, 10);
    expect(walkVariance(30, 0.6)).toBeCloseTo(28.8, 10);
    expect(Math.abs((summary.mean ?? 0) - 6)).toBeLessThan(0.15);
    expect(Math.abs((summary.variance ?? 0) - 28.8)).toBeLessThan(1);
    expect(walks.sums[30] / 20000).toBeCloseTo(summary.mean ?? 0, 6);
  });
});

describe('как одна точка меняет среднее', () => {
  it('14 → 44: среднее 12 → 18, медиана остаётся 12, объяснение 30 ÷ 5 = 6', async () => {
    const { MEAN_START, MEAN_EXAMPLE_TO, singleChange, explainChange, describe: describeLine } = await import('./drawDistribution');
    const { formatStatistic } = await import('./format');
    const after = MEAN_START.map((value) => (value === 14 ? MEAN_EXAMPLE_TO : value));
    expect(describeLine(MEAN_START)).toMatchObject({ mean: 12, median: 12 });
    expect(describeLine(after)).toMatchObject({ mean: 18, median: 12 });
    const change = singleChange(MEAN_START, after);
    expect(change).toMatchObject({ from: 14, to: 44, delta: 30, meanDelta: 6, medianBefore: 12, medianAfter: 12 });
    expect(explainChange(change!, formatStatistic)).toBe(
      'Одно значение выросло на 30. Точек пять, поэтому среднее выросло на 30 ÷ 5 = 6. Центральное число осталось равным 12.',
    );
    expect(singleChange(MEAN_START, MEAN_START)).toBeNull();
  });
});

describe('нарисуй силуэт точками', () => {
  it('пустой холст — всегда 0 %, закрашенный — 100 %', async () => {
    const { Throws, emptyMask, fullMask, maskShare } = await import('./silhouette');
    const empty = new Throws(emptyMask(), createRng(SEED));
    empty.add(2000);
    expect(empty.estimate).toBe(0);
    expect(empty.estimates.every((value) => value === 0)).toBe(true);
    expect(maskShare(emptyMask())).toBe(0);
    const full = new Throws(fullMask(), createRng(SEED));
    full.add(2000);
    expect(full.estimate).toBe(1);
    expect(maskShare(fullMask())).toBe(1);
  });

  it('в кольце точки внутри отверстия считаются внешними', async () => {
    const { RING_INNER, RING_OUTER, Throws, isInside, maskShare, ringMask } = await import('./silhouette');
    const ring = ringMask();
    expect(isInside(ring, 0.5, 0.5)).toBe(false);
    expect(isInside(ring, 0.5 + (RING_INNER + RING_OUTER) / 2, 0.5)).toBe(true);
    expect(isInside(ring, 0.02, 0.02)).toBe(false);
    expect(maskShare(ring)).toBeCloseTo(Math.PI * (RING_OUTER ** 2 - RING_INNER ** 2), 2);
    const throws = new Throws(ring, createRng(SEED));
    throws.add(1000);
    expect(throws.hits).toBe(throws.inside.filter(Boolean).length);
    expect(throws.estimate).toBe(throws.hits / 1000);
    for (let index = 0; index < throws.total; index += 1) {
      const dx = throws.xs[index] - 0.5;
      const dy = throws.ys[index] - 0.5;
      if (dx * dx + dy * dy < (RING_INNER - 0.01) ** 2) expect(throws.inside[index]).toBe(false);
    }
    expect(Math.abs(throws.estimate - maskShare(ring))).toBeLessThan(0.05);
  });

  it('кисть и ластик меняют маску', async () => {
    const { emptyMask, maskShare, stroke } = await import('./silhouette');
    const mask = emptyMask();
    stroke(mask, [20, 20], [180, 20], 10, 1);
    const painted = maskShare(mask);
    expect(painted).toBeGreaterThan(0.03);
    stroke(mask, [20, 20], [180, 20], 12, 0);
    expect(maskShare(mask)).toBe(0);
  });
});

describe('анимация случайного блуждания', () => {
  it('контрольный путь +1, +1, −1, +1: положения 0 → 1 → 2 → 1 → 2, столбец +2 растёт только после 4-го шага', async () => {
    const { completedDistribution, completedPaths, generateWalks, positionAt, positionTable, walkStagger } = await import('./randomWalk');
    const walks = generateWalks(1, 4, 0.5, createRng(14));
    expect(Array.from(walks.paths[0])).toEqual([1, 1, 0, 1]);
    const table = positionTable(walks.paths[0]);
    expect(Array.from(table)).toEqual([0, 1, 2, 1, 2]);
    expect([0, 1, 2, 3, 4].map((step) => positionAt(table, step))).toEqual([0, 1, 2, 1, 2]);
    expect(positionAt(table, 2.5)).toBeCloseTo(1.5, 10);
    const stagger = walkStagger(1, 4);
    const plusTwo = (clock: number) => completedDistribution(walks.finals, completedPaths(clock, 1, stagger, 4), 4)[(2 + 4) / 2];
    expect([0, 1, 2, 3, 3.999].map(plusTwo)).toEqual([0, 0, 0, 0, 0]);
    expect(plusTwo(4)).toBe(1);
    expect(plusTwo(10)).toBe(1);
  });

  it('каждый путь попадает в гистограмму ровно один раз и постепенно', async () => {
    const { completedPaths, walkEnd, walkStagger } = await import('./randomWalk');
    for (const [count, steps] of [[10, 20], [100, 7], [1000, 50]]) {
      const stagger = walkStagger(count, steps);
      let previous = 0;
      const seen = new Set<number>();
      for (let clock = 0; clock <= walkEnd(count, steps) + 1; clock += 0.25) {
        const done = completedPaths(clock, count, stagger, steps);
        expect(done).toBeGreaterThanOrEqual(previous);
        seen.add(done);
        previous = done;
      }
      expect(previous).toBe(count);
      expect(completedPaths(walkEnd(count, steps), count, stagger, steps)).toBe(count);
      expect(seen.size).toBeGreaterThan(Math.min(count, 5));
    }
  });
});
