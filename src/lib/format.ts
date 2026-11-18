const integerFormat = new Intl.NumberFormat('ru-RU');
const oneDecimalFormat = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const threeDecimalFormat = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

export const formatInteger = (value: number): string => integerFormat.format(value);
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
