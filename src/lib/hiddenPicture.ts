export const GRID_SIZE = 10;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;
export const FORECAST_ATTEMPTS = 100;

export interface PictureState {
  attempts: number;
  repeats: number;
  openedCount: number;
  opened: readonly boolean[];
  lastCell: number | null;
  lastWasRepeat: boolean;
  /** Сколько клеток было открыто ровно на сотой попытке. */
  openedAtForecast: number | null;
}

export function createPictureState(): PictureState {
  return {
    attempts: 0,
    repeats: 0,
    openedCount: 0,
    opened: Array<boolean>(CELL_COUNT).fill(false),
    lastCell: null,
    lastWasRepeat: false,
    openedAtForecast: null,
  };
}

export function applyAttempt(state: PictureState, cell: number): PictureState {
  const isRepeat = state.opened[cell];
  const opened = isRepeat ? state.opened : state.opened.map((value, index) => value || index === cell);
  const attempts = state.attempts + 1;
  const openedCount = state.openedCount + (isRepeat ? 0 : 1);
  return {
    attempts,
    repeats: state.repeats + (isRepeat ? 1 : 0),
    openedCount,
    opened,
    lastCell: cell,
    lastWasRepeat: isRepeat,
    openedAtForecast: attempts === FORECAST_ATTEMPTS ? openedCount : state.openedAtForecast,
  };
}

export type ForecastResult = { ok: true; value: number | null } | { ok: false; error: string };

export function parseForecast(raw: string): ForecastResult {
  const text = raw.trim();
  if (text === '') return { ok: true, value: null };
  if (!/^\d+$/.test(text)) return { ok: false, error: 'Введите целое число от 0 до 100.' };
  const value = Number(text);
  if (value > CELL_COUNT) return { ok: false, error: 'Введите целое число от 0 до 100.' };
  return { ok: true, value };
}

/** Вероятность того, что конкретная клетка ни разу не выпадет за n попыток. */
export const missProbability = (attempts: number): number => (99 / 100) ** attempts;

/** Среднее число открытых клеток по множеству запусков из n попыток. */
export const expectedOpened = (attempts: number): number => CELL_COUNT * (1 - missProbability(attempts));
