import { toCsv } from './csv';
import { browserRandom, randomIndex, type RandomSource } from './random';
import { countIntegers } from './statistics';

export const GRID_SIZES = [10, 20, 40] as const;
export const GRID_SIZE = 10;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;
/** Прогноз и ориентир считаются для числа попыток, равного числу клеток. */
export const FORECAST_ATTEMPTS = 100;

export interface PictureState {
  size: number;
  /** Число попаданий в каждую клетку, по строкам. */
  hits: readonly number[];
  attempts: number;
  repeats: number;
  openedCount: number;
  /** history[k] — сколько клеток открыто после k попыток; history[0] = 0. */
  history: readonly number[];
  lastCell: number | null;
  lastWasRepeat: boolean;
  /** Сколько клеток было открыто ровно на попытке номер size² (для прогноза). */
  openedAtForecast: number | null;
}

export function createPictureState(size: number = GRID_SIZE): PictureState {
  return {
    size,
    hits: Array<number>(size * size).fill(0),
    attempts: 0,
    repeats: 0,
    openedCount: 0,
    history: [0],
    lastCell: null,
    lastWasRepeat: false,
    openedAtForecast: null,
  };
}

/** Несколько попыток подряд; массив попаданий копируется один раз. */
export function applyAttempts(state: PictureState, cells: readonly number[]): PictureState {
  if (cells.length === 0) return state;
  const hits = [...state.hits];
  const history = [...state.history];
  const forecastAt = state.size * state.size;
  let { attempts, repeats, openedCount, openedAtForecast } = state;
  let lastWasRepeat = state.lastWasRepeat;
  for (const cell of cells) {
    lastWasRepeat = hits[cell] > 0;
    hits[cell] += 1;
    attempts += 1;
    if (lastWasRepeat) repeats += 1;
    else openedCount += 1;
    history.push(openedCount);
    if (attempts === forecastAt) openedAtForecast = openedCount;
  }
  return {
    size: state.size,
    hits,
    attempts,
    repeats,
    openedCount,
    history,
    lastCell: cells[cells.length - 1],
    lastWasRepeat,
    openedAtForecast,
  };
}

export const applyAttempt = (state: PictureState, cell: number): PictureState => applyAttempts(state, [cell]);

export type ForecastResult = { ok: true; value: number | null } | { ok: false; error: string };

export function parseForecast(raw: string, cells: number = CELL_COUNT): ForecastResult {
  const text = raw.trim();
  const error = `Введите целое число от 0 до ${cells}.`;
  if (text === '') return { ok: true, value: null };
  if (!/^\d+$/.test(text)) return { ok: false, error };
  const value = Number(text);
  if (value > cells) return { ok: false, error };
  return { ok: true, value };
}

/** Вероятность того, что конкретная клетка из M ни разу не выпадет за k попыток: (1 − 1/M)ᵏ. */
export const missProbability = (attempts: number, cells: number = CELL_COUNT): number => (1 - 1 / cells) ** attempts;

/** Ожидаемая доля открытого поля: 1 − (1 − 1/M)ᵏ. */
export const expectedShare = (attempts: number, cells: number = CELL_COUNT): number => 1 - missProbability(attempts, cells);

/** Среднее число открытых клеток по множеству запусков из k попыток. */
export const expectedOpened = (attempts: number, cells: number = CELL_COUNT): number => cells * expectedShare(attempts, cells);

/* ---------- Серия независимых опытов ---------- */

export interface TrialResult {
  attempts: number;
  opened: number;
  repeats: number;
}

export const SERIES_SIZES = [10, 100, 1000] as const;

/** Один опыт: полностью закрытое поле из cells клеток и заданное число попыток. */
export function runPictureTrial(
  random: RandomSource = browserRandom,
  cells: number = CELL_COUNT,
  attempts: number = FORECAST_ATTEMPTS,
): TrialResult {
  const opened = new Uint8Array(cells);
  let openedCount = 0;
  let repeats = 0;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const cell = randomIndex(cells, random);
    if (opened[cell]) {
      repeats += 1;
    } else {
      opened[cell] = 1;
      openedCount += 1;
    }
  }
  return { attempts, opened: openedCount, repeats };
}

/** Таблица серии: одна строка — один опыт. */
export function seriesToCsv(results: readonly TrialResult[], cells: number = CELL_COUNT): string {
  return toCsv(
    ['Опыт', 'Клеток в поле', 'Попытки', 'Открыто клеток', 'Повторы'],
    results.map((result, index) => [index + 1, cells, result.attempts, result.opened, result.repeats]),
  );
}

/**
 * Столбцы диаграммы серии. Ось охватывает все результаты и ориентир ±10;
 * при широком разбросе соседние значения объединяются в интервалы ширины width.
 */
export function seriesHistogram(
  opened: readonly number[],
  theory: number = expectedOpened(FORECAST_ATTEMPTS),
): { from: number; width: number; counts: number[] } {
  let from = Math.max(0, Math.min(Math.floor(theory) - 10, ...opened));
  const to = Math.max(Math.ceil(theory) + 10, ...opened);
  const width = Math.max(1, Math.ceil((to - from + 1) / 60));
  from -= from % width;
  const raw = countIntegers(opened, from, to);
  const counts = Array<number>(Math.ceil(raw.length / width)).fill(0);
  raw.forEach((count, index) => {
    counts[Math.floor(index / width)] += count;
  });
  return { from, width, counts };
}
