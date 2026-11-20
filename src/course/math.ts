/**
 * Математика курса 1 «Описательная статистика»: расчёты для учебных виджетов и вопросы,
 * которые строятся по их текущему состоянию. Всё здесь чистые функции без интерфейса.
 */
import { binOfPath, simulatePath } from '../lib/galton';
import { formatShare, formatStatistic } from '../lib/format';
import { createRng } from '../lib/random';

export interface QuizQuestion {
  text: string;
  options: string[];
  correct: number;
  explanation: string;
}

export const BOARD_LEVELS = 8;
export const BOARD_BINS = BOARD_LEVELS + 1;

const mean = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;
const f = formatStatistic;

/* ---------- 1.1 Выборка и частоты ---------- */

/** Номера ячеек первых count шариков доски с 8 уровнями при p = 0,5. Первые k шариков не зависят от count. */
export function dropBalls(seed: number, count: number): number[] {
  const random = createRng(seed);
  return Array.from({ length: count }, () => binOfPath(simulatePath(0.5, random, BOARD_LEVELS)));
}

/** Абсолютные и относительные частоты по 9 ячейкам. */
export function frequencyTable(bins: readonly number[]): { counts: number[]; shares: number[] } {
  const counts = Array<number>(BOARD_BINS).fill(0);
  for (const bin of bins) counts[bin] += 1;
  const total = bins.length;
  return { counts, shares: counts.map((count) => (total === 0 ? 0 : count / total)) };
}

/** Вопрос про относительную частоту выбранной ячейки; без шариков вопроса нет. */
export function frequencyQuestion(seed: number, thrown: number, bin: number): QuizQuestion | null {
  if (thrown <= 0) return null;
  const nk = frequencyTable(dropBalls(seed, thrown)).counts[bin];
  const right = formatShare(nk / thrown);
  // Типичные ошибки: n_k как проценты, «все ячейки равны» (1/9), деление на число ячеек. Долей больше 100 % не бывает.
  const candidates = [nk / 100, 1 / 9, nk / 9, (2 * nk) / thrown, (nk + 1) / thrown, 1 / thrown]
    .filter((share) => share <= 1)
    .map(formatShare);
  const wrong: string[] = [];
  for (const candidate of candidates) {
    if (candidate !== right && !wrong.includes(candidate)) wrong.push(candidate);
    if (wrong.length === 2) break;
  }
  const correct = bin % 3;
  const options = [...wrong];
  options.splice(correct, 0, right);
  return {
    text: `В ячейку ${bin} попало ${nk} из ${thrown} шариков. Какова относительная частота ячейки ${bin}?`,
    options,
    correct,
    explanation: `Относительная частота — доля наблюдений: w = n / N = ${nk} / ${thrown} ≈ ${right}. Делить на число ячеек (9) нельзя: ячейки заполняются неравномерно.`,
  };
}

/* ---------- 1.2 Среднее и медиана: качели ---------- */

/** Сумма отклонений от опоры: положительная — перевешивает правая сторона. */
export const torque = (values: readonly number[], pivot: number): number =>
  values.reduce((sum, value) => sum + (value - pivot), 0);

/** Наклон доски в градусах, не больше 12° в каждую сторону; плюс — правый край опускается. */
export const beamAngle = (values: readonly number[], pivot: number): number =>
  Math.max(-12, Math.min(12, torque(values, pivot) * 1.2));

/** Доска в равновесии, когда опора стоит в среднем (с точностью 0,15). */
export const isBalanced = (values: readonly number[], pivot: number): boolean =>
  values.length > 0 && Math.abs(pivot - mean(values)) < 0.15;

/** Вопрос зависит только от числа точек: само среднее не раскрывается, его студент находит на качелях. */
export function centerQuestion(values: readonly number[]): QuizQuestion {
  const n = values.length;
  return {
    text: `На доске ${n} шариков. Самый правый сдвинули на 5 делений вправо. Что станет со средним и медианой?`,
    options: [
      'Среднее вырастет на 5, медиана не изменится',
      `Среднее вырастет на ${f(5 / n)}, медиана не изменится`,
      `Среднее вырастет на ${f(5 / n)}, медиана вырастет на 5`,
    ],
    correct: 1,
    explanation: `Сумма выросла на 5, а точек по-прежнему ${n}, поэтому среднее выросло на 5 / ${n} = ${f(5 / n)}. Самая правая точка так и осталась последней в упорядоченном ряду, середина ряда не сдвинулась — медиана прежняя.`,
  };
}

/* ---------- 1.3 Разброс ---------- */

export const SPREAD_BASE: readonly number[] = [2, 5, 7, 8, 13];

/** Выборочная дисперсия со знаменателем N: средний квадрат отклонения от среднего. */
export function variance(values: readonly number[]): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  return values.reduce((sum, value) => sum + (value - m) ** 2, 0) / values.length;
}

export const rangeOf = (values: readonly number[]): number =>
  values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);

/** Растяжение выборки в k раз относительно её среднего. */
export function stretch(values: readonly number[], k: number): number[] {
  const m = mean(values);
  return values.map((value) => m + k * (value - m));
}

export const SPREAD_QUESTION: QuizQuestion = {
  text: 'Все отклонения от среднего увеличили в 3 раза. Как изменится дисперсия D?',
  options: ['Вырастет в 3 раза', 'Вырастет в 9 раз', 'Не изменится'],
  correct: 1,
  explanation:
    'Каждое отклонение стало втрое больше, а его квадрат — в 3² = 9 раз больше. Значит, и средний квадрат D вырос в 9 раз. Стандартное отклонение σ = √D выросло ровно в 3 раза.',
};

/* ---------- 1.4 Выбросы ---------- */

/** n значений по возрастанию от 40 до 60; к самому большому прибавлен shift. */
export function outlierRow(n: number, shift: number): number[] {
  const row = Array.from({ length: n }, (_, i) => 40 + Math.round((20 * i) / (n - 1)));
  row[n - 1] += shift;
  return row;
}

export function outlierQuestion(n: number): QuizQuestion {
  const delta = 50 / n;
  return {
    text: `В выборке N = ${n} значений. Самое большое из них увеличили на 50. На сколько вырастет среднее и что станет с медианой?`,
    options: [
      `На ${f(delta)}, медиана не изменится`,
      'На 50, медиана не изменится',
      `На ${f(delta)}, медиана тоже вырастет на ${f(delta)}`,
    ],
    correct: 0,
    explanation: `Сумма выросла на 50, поэтому среднее выросло на 50 / ${n} = ${f(delta)}. Самое большое значение и раньше стояло в конце упорядоченного ряда, середина не изменилась — медиана прежняя. Поэтому медиана устойчива к выбросам, а среднее — нет.`,
  };
}

/* ---------- Итог курса ---------- */

export const SUMMARY_QUESTIONS: readonly QuizQuestion[] = [
  {
    text: 'Из 200 шариков в ячейку 5 попали 30. Какова относительная частота ячейки 5?',
    options: ['15 %', '30 %', '6 %'],
    correct: 0,
    explanation: 'w = n / N = 30 / 200 = 0,15, то есть 15 %. Число 30 — абсолютная частота, а 6 % получится, если по ошибке разделить 30 на 500.',
  },
  {
    text: 'Выборка: 1, 2, 3, 4, 100. Что больше — среднее или медиана?',
    options: ['Медиана: 3 против 22', 'Среднее: 22 против 3', 'Они равны'],
    correct: 1,
    explanation: 'Среднее (1 + 2 + 3 + 4 + 100) / 5 = 22, медиана — середина ряда, 3. Одно большое значение утянуло среднее вправо, а медиану не сдвинуло.',
  },
  {
    text: 'У выборки D = 4. Её растянули в 3 раза относительно среднего. Чему теперь равно стандартное отклонение σ?',
    options: ['12', '36', '6'],
    correct: 2,
    explanation: 'Было σ = √4 = 2. Растяжение в 3 раза умножает σ на 3: σ = 6. Дисперсия при этом выросла в 9 раз и стала 36.',
  },
  {
    text: 'N = 25. Одно значение по ошибке записали на 100 больше. Насколько исказилось среднее?',
    options: ['На 4', 'На 100', 'На 25'],
    correct: 0,
    explanation: 'Сумма выросла на 100, а делим по-прежнему на 25: 100 / 25 = 4. Чем больше выборка, тем слабее одна ошибка влияет на среднее.',
  },
];
