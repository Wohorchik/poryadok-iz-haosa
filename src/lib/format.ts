import type { SampleSummary } from './statistics';

const integerFormat = new Intl.NumberFormat('ru-RU');
const oneDecimalFormat = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const threeDecimalFormat = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

/** Статистика выборки: до двух знаков после запятой, лишние нули не пишутся (8, 2,5, 2,67). */
const statisticFormat = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatInteger = (value: number): string => integerFormat.format(value);
export const formatStatistic = (value: number): string => statisticFormat.format(Object.is(value, -0) ? 0 : value);
export const formatOneDecimal = (value: number): string => oneDecimalFormat.format(value);
export const formatThreeDecimals = (value: number): string => threeDecimalFormat.format(value);

/** Доля 0,273 превращается в строку «27,3 %». */
export const formatShare = (share: number): string => `${oneDecimalFormat.format(share * 100)} %`;

/** Русское склонение: plural(5, 'клетка', 'клетки', 'клеток') → «клеток». */
export function plural(value: number, one: string, few: string, many: string): string {
  const lastTwo = Math.abs(value) % 100;
  const last = lastTwo % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

export const NO_DATA = 'Нет данных';
export const NEED_TWO_OBSERVATIONS = 'Нужно 2 наблюдения';

/** Подписи характеристик выборки для таблиц: пустая выборка и N = 1 дают понятный текст вместо числа. */
export function formatSummary(summary: SampleSummary) {
  const orNoData = (value: number | null) => (value === null ? NO_DATA : formatStatistic(value));
  const spread = (value: number | null) =>
    summary.size === 0 ? NO_DATA : value === null ? NEED_TWO_OBSERVATIONS : formatStatistic(value);
  return {
    size: formatInteger(summary.size),
    mean: orNoData(summary.mean),
    median: orNoData(summary.median),
    modes: summary.modes.length === 0 ? NO_DATA : summary.modes.map(formatStatistic).join('; '),
    variance: spread(summary.variance),
    standardDeviation: spread(summary.standardDeviation),
  };
}

/** Знак перед теоретическим значением: «=», если при округлении до сотых ничего не потеряно, иначе «≈». */
export const equalsSign = (value: number): string => (Math.abs(Math.round(value * 100) - value * 100) < 1e-9 ? '=' : '≈');
