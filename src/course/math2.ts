/**
 * Математика курса 2 «Распределения»: пути шарика, моменты биномиального распределения,
 * случайное блуждание и нормальное приближение. Чистые функции без интерфейса.
 */
import { binOfPath, binomialCoefficient, binomialDistribution, simulatePath } from '../lib/galton';
import { formatStatistic } from '../lib/format';
import { createRng } from '../lib/random';
import { generateWalks, positions } from '../lib/randomWalk';
import type { QuizQuestion } from './math';

const f = formatStatistic;
/** До трёх знаков: при малых m и p значения mp и mp(1 − p) различаются только в третьем знаке. */
const f3 = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(value);

/** Ставит верный вариант на место correct среди двух первых различных неверных. */
function arrange(right: string, candidates: readonly string[], correct: number): string[] {
  const wrong: string[] = [];
  for (const candidate of candidates) {
    if (candidate !== right && !wrong.includes(candidate)) wrong.push(candidate);
    if (wrong.length === 2) break;
  }
  const options = [...wrong];
  options.splice(correct, 0, right);
  return options;
}

/* ---------- 2.1 Пути ---------- */

/** Путь одного шарика: true — поворот вправо. */
export const ballPath = (seed: number, m: number, p: number): boolean[] => simulatePath(p, createRng(seed), m);

export function pathsQuestion(m: number, k: number): QuizQuestion {
  const paths = binomialCoefficient(m, k);
  const correct = k % 3;
  return {
    text: `Сколько разных путей ведут в ячейку ${k} на доске из ${m} уровней?`,
    options: arrange(String(paths), [2 ** m, m, k + 1, m * k, paths + 1, paths * 2, paths + 2].map(String), correct),
    correct,
    explanation: `Путь — это ${m} поворотов, из них ${k} вправо. Выбрать, на каких уровнях повернуть вправо, можно C(${m}, ${k}) = ${paths} способами. Число 2^${m} = ${2 ** m} — это все пути доски вместе.`,
  };
}

/* ---------- 2.2 Матожидание и дисперсия ---------- */

/** Пути первых count шариков (true — вправо); первые k путей не зависят от count. */
export function dropPathsMP(seed: number, count: number, m: number, p: number): boolean[][] {
  const random = createRng(seed);
  return Array.from({ length: count }, () => simulatePath(p, random, m));
}

/** Ячейки первых count шариков на доске из m уровней с вероятностью p; первые k не зависят от count. */
export function dropBallsMP(seed: number, count: number, m: number, p: number): number[] {
  const random = createRng(seed);
  return Array.from({ length: count }, () => binOfPath(simulatePath(p, random, m)));
}

export function momentsQuestion(m: number, p: number): QuizQuestion {
  const e = m * p;
  const d = m * p * (1 - p);
  const correct = m % 3;
  const right = `E = ${f3(e)}, D = ${f3(d)}`;
  return {
    text: `Доска из m = ${m} уровней, вероятность поворота вправо p = ${f(p)}. Чему равны E(X) и D(X)?`,
    options: arrange(right, [`E = ${f3(e)}, D = ${f3(e)}`, `E = ${f3(d)}, D = ${f3(e)}`, `E = ${f3(m * (1 - p))}, D = ${f3(d)}`], correct),
    correct,
    explanation: `E(X) = mp = ${m} · ${f(p)} = ${f3(e)}. D(X) = mp(1 − p) = ${f3(e)} · ${f(1 - p)} = ${f3(d)}. Дисперсия меньше среднего, потому что множитель 1 − p меньше единицы.`,
  };
}

/* ---------- 2.3 Случайное блуждание ---------- */

/** walks путей по steps шагов: [i][k] — положение i-го пути после k шагов (k = 0 … steps). */
export function walkPositions(seed: number, walks: number, steps: number, p: number): number[][] {
  return generateWalks(walks, steps, p, createRng(seed)).paths.map((path) => positions(path));
}

export function walkQuestion(k: number, p: number): QuizQuestion {
  const d = 4 * k * p * (1 - p);
  const sigma = Math.sqrt(d);
  const correct = k % 3;
  return {
    text: `Сделано k = ${k} шагов, вероятность шага вправо p = ${f(p)}. Чему равно стандартное отклонение положения σ(Sₖ)?`,
    options: arrange(f(sigma), [d, k, Math.sqrt(k), 2 * sigma, sigma + 1].map(f), correct),
    correct,
    explanation: `D(Sₖ) = 4kp(1 − p) = 4 · ${k} · ${f(p)} · ${f(1 - p)} = ${f(d)}, σ = √D ≈ ${f(sigma)}. Разброс растёт как √k: чтобы он удвоился, шагов нужно вчетверо больше.`,
  };
}

/* ---------- 2.4 Нормальное приближение ---------- */

export const normalDensity = (x: number, mu: number, sigma: number): number =>
  Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI));

/** Наибольшее расхождение биномиальных вероятностей и нормальной плотности в целых точках. */
export function maxApproxError(m: number, p: number): number {
  const sigma = Math.sqrt(m * p * (1 - p));
  return Math.max(...binomialDistribution(p, m).map((probability, k) => Math.abs(probability - normalDensity(k, m * p, sigma))));
}

/** P(from ≤ X ≤ to) для биномиального X: сумма по целым k внутри промежутка. */
export function shareWithin(m: number, p: number, from: number, to: number): number {
  return binomialDistribution(p, m).reduce((sum, probability, k) => (k >= from && k <= to ? sum + probability : sum), 0);
}

export function normalQuestion(m: number, p: number): QuizQuestion {
  const mu = m * p;
  const sigma = Math.sqrt(m * p * (1 - p));
  const span = (n: number) => `от ${f(mu - n * sigma)} до ${f(mu + n * sigma)}`;
  const correct = m % 3;
  return {
    text: `Доска из m = ${m} уровней, p = ${f(p)}. В какой промежуток попадает примерно 95 % шариков?`,
    options: arrange(span(2), [span(1), span(3)], correct),
    correct,
    explanation: `μ = mp = ${f(mu)}, σ = √(mp(1 − p)) ≈ ${f(sigma)}. Для нормального распределения около 95 % значений лежат в пределах μ ± 2σ, то есть ${span(2)}. В μ ± σ — около 68 %, в μ ± 3σ — около 99,7 %.`,
  };
}

/* ---------- Итог курса 2 ---------- */

export const SUMMARY_QUESTIONS_2: readonly QuizQuestion[] = [
  {
    text: 'Доска из 6 уровней. Сколько разных путей ведут в ячейку 2?',
    options: ['15', '12', '64'],
    correct: 0,
    explanation: 'C(6, 2) = 6 · 5 / 2 = 15: выбираем два уровня из шести, на которых шарик повернёт вправо. 64 = 2⁶ — все пути доски.',
  },
  {
    text: 'm = 20, p = 0,25. Чему равны E(X) и D(X)?',
    options: ['E = 5, D = 5', 'E = 5, D = 3,75', 'E = 3,75, D = 5'],
    correct: 1,
    explanation: 'E = mp = 20 · 0,25 = 5. D = mp(1 − p) = 5 · 0,75 = 3,75.',
  },
  {
    text: 'Случайное блуждание: 100 шагов, p = 0,5. Чему равно стандартное отклонение положения?',
    options: ['100', '50', '10'],
    correct: 2,
    explanation: 'D = 4kp(1 − p) = 4 · 100 · 0,25 = 100, σ = √100 = 10. Разброс растёт как √k, а не как k.',
  },
  {
    text: 'm = 400, p = 0,5. В какой промежуток попадает около 95 % шариков?',
    options: ['от 180 до 220', 'от 190 до 210', 'от 0 до 400'],
    correct: 0,
    explanation: 'μ = 200, σ = √(400 · 0,25) = 10. Около 95 % — в пределах μ ± 2σ: от 180 до 220. От 190 до 210 — это μ ± σ, около 68 %.',
  },
];
