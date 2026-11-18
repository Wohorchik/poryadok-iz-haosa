import { describe, expect, it } from 'vitest';
import { describePattern } from './chaosGame';
import { toCsv } from './csv';
import { NEED_TWO_OBSERVATIONS, NO_DATA, equalsSign, formatStatistic, formatSummary } from './format';
import { BIN_COUNT, LEVELS, binOfPath, simulatePath } from './galton';
import { FORECAST_ATTEMPTS, runPictureTrial, seriesHistogram, seriesToCsv } from './hiddenPicture';
import { countAxis, countIntegers, summarize, summarizeCounts } from './statistics';

describe('характеристики выборки', () => {
  it('выборка 0, 2, 2, 4: N = 4, среднее и медиана 2, мода 2, s² = 8/3', () => {
    const summary = summarize([0, 2, 2, 4]);
    expect(summary.size).toBe(4);
    expect(summary.mean).toBe(2);
    expect(summary.median).toBe(2);
    expect(summary.modes).toEqual([2]);
    expect(summary.variance).toBeCloseTo(8 / 3, 12);
    expect(summary.standardDeviation).toBeCloseTo(Math.sqrt(8 / 3), 12);
    expect(formatSummary(summary)).toMatchObject({ size: '4', mean: '2', median: '2', modes: '2', variance: '2,67' });
  });

  it('по таблице частот считает то же, что по списку наблюдений', () => {
    expect(summarizeCounts([1, 0, 2, 0, 1])).toEqual(summarize([0, 2, 2, 4]));
    expect(summarizeCounts([2, 1], 60)).toEqual(summarize([61, 60, 60]));
  });

  it('медиана при чётном и нечётном объёме', () => {
    expect(summarize([5, 1, 3]).median).toBe(3);
    expect(summarize([1, 2, 3, 10]).median).toBe(2.5);
    expect(summarize([7]).median).toBe(7);
  });

  it('показывает все моды', () => {
    expect(summarize([1, 1, 3, 3, 2]).modes).toEqual([1, 3]);
    expect(formatSummary(summarize([4, 1, 1, 4])).modes).toBe('1; 4');
  });

  it('пустая выборка — «Нет данных»', () => {
    const shown = formatSummary(summarize([]));
    expect(shown.size).toBe('0');
    for (const key of ['mean', 'median', 'modes', 'variance', 'standardDeviation'] as const) {
      expect(shown[key]).toBe(NO_DATA);
    }
  });

  it('при N = 1 для s² и s нужно минимум 2 наблюдения', () => {
    const summary = summarize([5]);
    expect(summary.variance).toBeNull();
    const shown = formatSummary(summary);
    expect(shown.mean).toBe('5');
    expect(shown.variance).toBe(NEED_TWO_OBSERVATIONS);
    expect(shown.standardDeviation).toBe(NEED_TWO_OBSERVATIONS);
  });

  it('знаменатель дисперсии N − 1', () => {
    expect(summarize([1, 3]).variance).toBe(2);
  });

  it('форматирует без лишних нулей и подбирает знак', () => {
    expect(formatStatistic(8)).toBe('8');
    expect(formatStatistic(2.5)).toBe('2,5');
    expect(formatStatistic(-0)).toBe('0');
    expect(equalsSign(4)).toBe('=');
    expect(equalsSign(1.04)).toBe('=');
    expect(equalsSign(Math.SQRT2)).toBe('≈');
  });

  it('шкала частот круглая и вмещает максимум', () => {
    for (const largest of [1, 3, 7, 13, 48, 99, 160, 1000]) {
      const { maximum, step } = countAxis(largest);
      expect(maximum).toBeGreaterThanOrEqual(largest);
      expect(maximum % step).toBe(0);
      expect(maximum / step).toBeLessThanOrEqual(5);
    }
  });
});

describe('доска Гальтона: выборка', () => {
  it('p = 100 %, 10 шариков: все в ячейке 8, среднее 8, s = 0', () => {
    const counts = Array<number>(BIN_COUNT).fill(0);
    for (let ball = 0; ball < 10; ball += 1) counts[binOfPath(simulatePath(1))] += 1;
    expect(counts[8]).toBe(10);
    const summary = summarizeCounts(counts);
    expect(summary).toMatchObject({ size: 10, mean: 8, median: 8, modes: [8], variance: 0, standardDeviation: 0 });
    expect(formatSummary(summary).standardDeviation).toBe('0');
  });

  it('при большой выборке среднее и дисперсия близки к 8p и 8p(1 − p)', () => {
    const p = 0.3;
    const counts = Array<number>(BIN_COUNT).fill(0);
    for (let ball = 0; ball < 100000; ball += 1) counts[binOfPath(simulatePath(p))] += 1;
    const summary = summarizeCounts(counts);
    expect(Math.abs((summary.mean ?? 0) - LEVELS * p)).toBeLessThan(0.03);
    expect(Math.abs((summary.variance ?? 0) - LEVELS * p * (1 - p))).toBeLessThan(0.05);
  });
});

describe('скрытая картинка: серия опытов', () => {
  it('100 опытов: в CSV 100 строк данных, открытые + повторы = 100, сумма частот 100', () => {
    const results = Array.from({ length: 100 }, () => runPictureTrial());
    const lines = seriesToCsv(results).trimEnd().split('\r\n');
    expect(lines[0]).toBe('Опыт;Клеток в поле;Попытки;Открыто клеток;Повторы');
    expect(lines).toHaveLength(101);
    lines.slice(1).forEach((line, index) => {
      const [number, cells, attempts, opened, repeats] = line.split(';').map(Number);
      expect(number).toBe(index + 1);
      expect(cells).toBe(100);
      expect(attempts).toBe(FORECAST_ATTEMPTS);
      expect(opened + repeats).toBe(100);
    });
    const { counts } = seriesHistogram(results.map((result) => result.opened));
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(100);
  });

  it('диаграмма расширяет ось для редких значений', () => {
    const { from, counts } = seriesHistogram([40, 63, 63, 90]);
    expect(from).toBe(40);
    expect(counts).toHaveLength(51);
    expect(counts[63 - from]).toBe(2);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(4);
  });

  it('каждый опыт начинается с закрытого поля', () => {
    // Генератор всегда выбирает клетку 0: в каждом опыте открыта ровно одна клетка и 99 повторов.
    expect(runPictureTrial(() => 0)).toEqual({ attempts: 100, opened: 1, repeats: 99 });
    expect(runPictureTrial(() => 0)).toEqual({ attempts: 100, opened: 1, repeats: 99 });
  });

  it('среднее серии близко к 63,4', () => {
    const summary = summarize(Array.from({ length: 4000 }, () => runPictureTrial().opened));
    expect(Math.abs((summary.mean ?? 0) - 63.4)).toBeLessThan(0.3);
  });

  it('частоты целых значений', () => {
    expect(countIntegers([1, 1, 3, 9], 0, 4)).toEqual([0, 2, 0, 1, 0]);
  });

  it('CSV экранирует разделитель и кавычки', () => {
    expect(toCsv(['a', 'b'], [['x;y', 'say "hi"']])).toBe('a;b\r\n"x;y";"say ""hi"""\r\n');
  });
});

describe('треугольник Серпинского: пояснения', () => {
  it('веса [0, 1, 1]: точки приближаются к стороне BC', () => {
    const text = describePattern([0, 1, 1]);
    expect(text).toContain('Точка стартует в A');
    expect(text).toContain('уменьшается вдвое');
    expect(text).toContain('Точки постепенно приближаются к стороне BC');
  });

  it('равные веса: три области заполнены примерно одинаково плотно', () => {
    expect(describePattern([1, 1, 1])).toContain('три области заполнены примерно одинаково плотно');
  });

  it('веса [1, 1, 0]: старт в A уже на стороне AB', () => {
    expect(describePattern([1, 1, 0])).toContain('ложатся на эту сторону');
  });
});
