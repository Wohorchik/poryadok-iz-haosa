/** Вспомогательные расчёты для графиков: «круглые» деления осей и прореживание точек. */

/** Деления оси от min до max с «круглым» шагом 1, 2 или 5 · 10ᵏ. */
export function niceTicks(min: number, max: number, approxCount = 5): { ticks: number[]; min: number; max: number } {
  if (!(max > min)) {
    const pad = Math.abs(min) > 0 ? Math.abs(min) * 0.1 : 1;
    return niceTicks(min - pad, max + pad, approxCount);
  }
  const rough = (max - min) / approxCount;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= rough) ?? 10 * power;
  const from = Math.floor(min / step + 1e-9) * step;
  const to = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let value = from; value <= to + step / 2; value += step) ticks.push(Number(value.toFixed(10)));
  return { ticks, min: from, max: to };
}

/** Оставляет не больше limit точек, сохраняя первую и последнюю. */
export function thin<T>(points: readonly T[], limit: number): T[] {
  if (points.length <= limit) return [...points];
  const result: T[] = [];
  const step = (points.length - 1) / (limit - 1);
  for (let index = 0; index < limit; index += 1) result.push(points[Math.round(index * step)]);
  return result;
}

/** Накопленное среднее: i-я точка — среднее первых i наблюдений в порядке учёта. */
export function runningMeans(values: readonly number[]): number[] {
  const result: number[] = [];
  let sum = 0;
  values.forEach((value, index) => {
    sum += value;
    result.push(sum / (index + 1));
  });
  return result;
}
