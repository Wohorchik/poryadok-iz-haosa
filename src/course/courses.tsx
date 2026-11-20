/** Курсы учебного режима: тексты уроков, формулы, картинки, виджеты и вопросы. */
import courseDescriptive from './art/course-descriptive.webp';
import courseDistributions from './art/course-distributions.webp';
import courseLimits from './art/course-limits.webp';
import courseMontecarlo from './art/course-montecarlo.webp';
import lessonCenter from './art/lesson-center.webp';
import lessonOutliers from './art/lesson-outliers.webp';
import lessonSample from './art/lesson-sample.webp';
import lessonSpread from './art/lesson-spread.webp';
import lessonBernoulli from './art/lesson-bernoulli.webp';
import lessonMoments from './art/lesson-moments.webp';
import lessonNormal from './art/lesson-normal.webp';
import lessonWalk from './art/lesson-walk.webp';
import { SPREAD_QUESTION, SUMMARY_QUESTIONS, centerQuestion, frequencyQuestion, outlierQuestion } from './math';
import { SUMMARY_QUESTIONS_2, momentsQuestion, normalQuestion, pathsQuestion, walkQuestion } from './math2';
import type { CourseDef, LessonDef } from './types';
import { BalanceWidget } from './widgets/BalanceWidget';
import { MomentsWidget } from './widgets/MomentsWidget';
import { NormalWidget } from './widgets/NormalWidget';
import { PathsWidget } from './widgets/PathsWidget';
import { WalkWidget } from './widgets/WalkWidget';
import { FrequencyWidget } from './widgets/FrequencyWidget';
import { OutlierWidget } from './widgets/OutlierWidget';
import { SpreadWidget } from './widgets/SpreadWidget';
import {
  balanceInitial,
  frequencyInitial,
  momentsInitial,
  normalInitial,
  pathsInitial,
  restoreMoments,
  restoreNormal,
  restorePaths,
  restoreWalk,
  walkInitial,
  outlierInitial,
  restoreBalance,
  restoreFrequency,
  restoreOutlier,
  restoreSpread,
  spreadInitial,
} from './widgets/state';

export type { CourseDef, LessonDef, WidgetProps } from './types';

/** Стирает тип состояния урока, чтобы уроки разных видов лежали в одном массиве. */
export const defineLesson = <S,>(lesson: LessonDef<S>): LessonDef => lesson as unknown as LessonDef;

/** x с чертой — среднее выборки. */
export const xbar = <span className="c-bar">x</span>;
export const sub = (base: string, index: string) => (
  <>
    {base}
    <sub>{index}</sub>
  </>
);

const sample = defineLesson({
  id: 'sample',
  number: '1.1',
  title: 'Выборка и частоты',
  accent: 'частоты',
  lead: 'Сотня шариков — это сотня чисел. Разбираемся, как превратить их в таблицу частот и гистограмму.',
  idea: (
    <>
      <p>
        <b>Выборка</b> — набор наблюдений {sub('x', '1')}, {sub('x', '2')}, …, {sub('x', 'N')}. Число наблюдений N называют{' '}
        <b>объёмом выборки</b>. На доске Гальтона каждое наблюдение — номер ячейки, в которую упал шарик.
      </p>
      <p>
        <b>Абсолютная частота</b> {sub('n', 'k')} показывает, сколько раз встретилось значение k. <b>Относительная частота</b>{' '}
        {sub('w', 'k')} = {sub('n', 'k')} / N — какую долю выборки оно занимает. Абсолютные частоты в сумме дают N, относительные — единицу.
      </p>
      <p>
        <b>Гистограмма</b> — столбики частот. Чем больше шариков, тем выше столбики абсолютных частот, а гистограмма относительных
        частот перестаёт прыгать и приближается к теоретическим вероятностям.
      </p>
    </>
  ),
  formula: (
    <>
      {sub('w', 'k')} = {sub('n', 'k')} / N<span className="c-formula-gap" />Σ {sub('w', 'k')} = 1
    </>
  ),
  art: lessonSample,
  experiment: { hash: '#galton', label: 'Доска Гальтона' },
  hint: 'Бросьте 10, потом ещё 100 шариков. Переключитесь на «Долю» и включите теорию: синие столбцы подтянутся к малиновым точкам.',
  initial: frequencyInitial,
  restore: restoreFrequency,
  Widget: FrequencyWidget,
  question: (state) => frequencyQuestion(state.seed, state.thrown, state.bin),
});

const center = defineLesson({
  id: 'center',
  number: '1.2',
  title: 'Среднее и медиана',
  accent: 'медиана',
  lead: 'Среднее — точка, в которой выборка уравновешивается. Медиана — середина упорядоченного ряда.',
  idea: (
    <>
      <p>
        <b>Среднее арифметическое</b> {xbar} = ({sub('x', '1')} + … + {sub('x', 'N')}) / N. У него есть физический смысл: разложите
        одинаковые грузики по шкале, и доска уравновесится ровно в точке {xbar}. Отклонения слева и справа от среднего в сумме дают ноль.
      </p>
      <p>
        <b>Медиана</b> — значение в середине упорядоченного ряда. При нечётном N это центральный элемент, при чётном — полусумма двух
        центральных. Медиана делит выборку пополам по количеству, а среднее — по «весу».
      </p>
    </>
  ),
  formula: (
    <>
      {xbar} = (1/N) Σ {sub('x', 'i')}
      <span className="c-formula-gap" />Σ ({sub('x', 'i')} − {xbar}) = 0
    </>
  ),
  art: lessonCenter,
  experiment: { hash: '#mean', label: 'Как одна точка меняет среднее' },
  hint: 'Двигайте опору, пока доска не выровняется. Потом перетащите любой шарик и снова найдите равновесие.',
  initial: balanceInitial,
  restore: restoreBalance,
  Widget: BalanceWidget,
  question: (state) => centerQuestion(state.values),
});

const spread = defineLesson({
  id: 'spread',
  number: '1.3',
  title: 'Разброс',
  accent: 'Разброс',
  lead: 'Две выборки с одинаковым средним могут выглядеть совсем по-разному. Разброс измеряют размахом, дисперсией и σ.',
  idea: (
    <>
      <p>
        <b>Размах</b> R = max − min — самая простая мера, но она зависит только от двух крайних значений.
      </p>
      <p>
        <b>Дисперсия</b> D — средний квадрат отклонения от среднего: возьмите каждое отклонение {sub('x', 'i')} − {xbar}, возведите в
        квадрат и усредните. На картинке квадрат буквальный — со стороной |{sub('x', 'i')} − {xbar}|, а D — средняя площадь этих квадратов.
      </p>
      <p>
        <b>Стандартное отклонение</b> σ = √D возвращает разброс в исходные единицы. Растяните выборку в k раз — σ вырастет в k раз, а D —
        в k² раз.
      </p>
      <p className="c-aside">
        В экспериментах сайта используется исправленная дисперсия s² = N / (N − 1) · D: по небольшой выборке она точнее оценивает разброс
        всей совокупности.
      </p>
    </>
  ),
  formula: (
    <>
      D = (1/N) Σ ({sub('x', 'i')} − {xbar})²<span className="c-formula-gap" />σ = √D
    </>
  ),
  art: lessonSpread,
  experiment: { hash: '#galton', label: 'Доска Гальтона' },
  hint: 'Двигайте ползунок растяжения и сравнивайте, во сколько раз меняются σ и D.',
  initial: spreadInitial,
  restore: restoreSpread,
  Widget: SpreadWidget,
  question: () => SPREAD_QUESTION,
});

const outliers = defineLesson({
  id: 'outliers',
  number: '1.4',
  title: 'Выбросы и устойчивость',
  accent: 'Выбросы',
  lead: 'Одно ошибочное значение может сильно сдвинуть среднее. Медиана при этом стоит на месте.',
  idea: (
    <>
      <p>
        <b>Выброс</b> — наблюдение, которое сильно отличается от остальных: опечатка в данных, сбой прибора или просто редкий случай.
      </p>
      <p>
        Если одно значение увеличить на Δ, сумма вырастет на Δ, а среднее — на Δ / N. Медиана зависит только от порядка: пока значение не
        перескочило через середину ряда, она не меняется.
      </p>
      <p>
        Поэтому для данных с выбросами — зарплат, цен квартир, времени ответа сервера — медиана честнее описывает «типичное» значение.
        Чем больше N, тем слабее один выброс сдвигает среднее.
      </p>
    </>
  ),
  formula: <>Δ{xbar} = Δ / N</>,
  art: lessonOutliers,
  experiment: { hash: '#mean', label: 'Как одна точка меняет среднее' },
  hint: 'Утащите самое большое значение далеко вправо, затем увеличьте N и посмотрите, как уменьшается сдвиг среднего.',
  initial: outlierInitial,
  restore: restoreOutlier,
  Widget: OutlierWidget,
  question: (state) => outlierQuestion(state.n),
});

/* ---------- Курс 2 «Распределения» ---------- */

const pct = (p: number) => p / 100;

const paths = defineLesson({
  id: 'paths',
  number: '2.1',
  title: 'Бернулли и биномиальное',
  accent: 'биномиальное',
  lead: 'Шарик на каждом уровне выбирает: вправо или влево. Считаем пути и получаем формулу вероятности каждой ячейки.',
  idea: (
    <>
      <p>
        <b>Испытание Бернулли</b> — опыт с двумя исходами: «успех» с вероятностью p и «неудача» с вероятностью 1 − p. На доске Гальтона
        успех — поворот вправо на очередном штырьке.
      </p>
      <p>
        Шарик проходит m уровней — это m независимых испытаний. Номер ячейки X равен числу поворотов вправо. В ячейку k ведут{' '}
        <b>C(m, k)</b> разных путей: столько способов выбрать k уровней из m, на которых шарик свернёт вправо.
      </p>
      <p>
        Каждый такой путь имеет вероятность p<sup>k</sup>(1 − p)<sup>m − k</sup>. Складываем вероятности всех путей в ячейку — получаем{' '}
        <b>биномиальное распределение</b> B(m, p).
      </p>
    </>
  ),
  formula: (
    <>
      P(X = k) = C(m, k) · p<sup>k</sup> · (1 − p)<sup>m − k</sup>
    </>
  ),
  art: lessonBernoulli,
  experiment: { hash: '#galton', label: 'Доска Гальтона' },
  hint: 'Бросьте несколько шариков и посмотрите на их пути. Затем выберите столбик k: рядом посчитаются число путей и вероятность. Сдвиньте p — колокол съедет.',
  initial: pathsInitial,
  restore: restorePaths,
  Widget: PathsWidget,
  question: (state) => pathsQuestion(state.m, state.k),
});

const moments = defineLesson({
  id: 'moments',
  number: '2.2',
  title: 'Матожидание и дисперсия',
  accent: 'дисперсия',
  lead: 'У биномиального распределения простые формулы для центра и разброса. Проверяем их сотнями шариков.',
  idea: (
    <>
      <p>
        <b>Математическое ожидание</b> E(X) — среднее значение X «в долгую». Для биномиального распределения E(X) = mp: из m поворотов в
        среднем mp — вправо.
      </p>
      <p>
        <b>Дисперсия</b> D(X) — средний квадрат отклонения от E(X). Для биномиального D(X) = mp(1 − p). Она наибольшая при p = 0,5 и
        равна нулю при p = 0 или 1: тогда все шарики падают в одну ячейку.
      </p>
      <p>Среднее выборки {xbar} и её дисперсия — оценки E и D по опыту. Чем больше шариков, тем ближе они к формулам.</p>
    </>
  ),
  formula: (
    <>
      E(X) = mp<span className="c-formula-gap" />D(X) = mp(1 − p)
    </>
  ),
  art: lessonMoments,
  experiment: { hash: '#galton', label: 'Доска Гальтона' },
  hint: 'Бросьте 1000 шариков и сравните синие числа выборки с малиновыми из формул. Измените m или p — выборка начнётся заново.',
  initial: momentsInitial,
  restore: restoreMoments,
  Widget: MomentsWidget,
  question: (state) => momentsQuestion(state.m, pct(state.p)),
});

const walk = defineLesson({
  id: 'walk',
  number: '2.3',
  title: 'Случайное блуждание',
  accent: 'блуждание',
  lead: 'Каждый шаг — монетка: +1 или −1. Разброс положения растёт, но медленнее, чем число шагов.',
  idea: (
    <>
      <p>
        Частица стартует в нуле. На каждом шаге она сдвигается на +1 с вероятностью p или на −1 с вероятностью 1 − p. Положение после k
        шагов S<sub>k</sub> = 2X − k, где X — число шагов вправо, X ~ B(k, p).
      </p>
      <p>
        Отсюда E(S<sub>k</sub>) = k(2p − 1): при p = 0,5 частица в среднем стоит на месте. D(S<sub>k</sub>) = 4kp(1 − p), а стандартное
        отклонение растёт как <b>√k</b>: чтобы разброс удвоился, шагов нужно вчетверо больше.
      </p>
      <p>Блуждание — та же доска Гальтона, только номер ячейки пересчитан в положение: шаг вправо — это +1, шаг влево — это −1.</p>
    </>
  ),
  formula: (
    <>
      E(S<sub>k</sub>) = k(2p − 1)
      <span className="c-formula-gap" />σ(S<sub>k</sub>) = √(4kp(1 − p))
    </>
  ),
  art: lessonWalk,
  experiment: { hash: '#walk', label: 'Случайное блуждание' },
  hint: 'Увеличивайте k и смотрите на малиновый коридор E ± 2σ: он расширяется всё медленнее. Сдвиньте p от 50 % — пути поползут в сторону.',
  initial: walkInitial,
  restore: restoreWalk,
  Widget: WalkWidget,
  question: (state) => walkQuestion(state.k, pct(state.p)),
});

const normal = defineLesson({
  id: 'normal',
  number: '2.4',
  title: 'Переход к нормальному',
  accent: 'нормальному',
  lead: 'Чем больше уровней у доски, тем сильнее гистограмма похожа на гладкий колокол Гаусса.',
  idea: (
    <>
      <p>
        <b>Теорема Муавра — Лапласа:</b> при большом m биномиальное распределение B(m, p) почти совпадает с нормальным N(μ, σ²), где μ =
        mp и σ² = mp(1 − p).
      </p>
      <p>
        У нормального распределения удобное правило: около 68 % значений лежат в пределах μ ± σ, около 95 % — в μ ± 2σ, около 99,7 % — в
        μ ± 3σ. Зная только mp и mp(1 − p), можно сказать, куда попадёт почти любой шарик.
      </p>
      <p className="c-aside">
        При p, близком к 0 или 1, колокол перекашивается и приближение хуже. Обычно им пользуются, когда mp(1 − p) больше 9.
      </p>
    </>
  ),
  formula: (
    <>
      P(X = k) ≈ e<sup>−(k − μ)² / 2σ²</sup> / (σ√2π)
    </>
  ),
  art: lessonNormal,
  experiment: { hash: '#galton', label: 'Доска Гальтона' },
  hint: 'Увеличьте m от 4 до 100 и следите за наибольшим расхождением. Поставьте p = 10 % — колокол перекосится.',
  initial: normalInitial,
  restore: restoreNormal,
  Widget: NormalWidget,
  question: (state) => normalQuestion(state.m, pct(state.p)),
});

export const COURSES: CourseDef[] = [
  {
    id: 'descriptive',
    number: 1,
    title: 'Описательная статистика',
    summary: 'Как несколькими числами описать выборку: частоты, центр, разброс и выбросы.',
    topics: 'Выборка и частоты · Среднее и медиана · Разброс · Выбросы',
    art: courseDescriptive,
    lessons: [sample, center, spread, outliers],
    ready: true,
    cheatsheet: [
      { label: 'Относительная частота', formula: sample.formula },
      { label: 'Среднее', formula: center.formula },
      { label: 'Дисперсия и σ', formula: spread.formula },
      { label: 'Сдвиг среднего от одного значения', formula: outliers.formula },
    ],
    summaryQuestions: SUMMARY_QUESTIONS,
    experiments: [
      { hash: '#galton', label: 'Доска Гальтона' },
      { hash: '#mean', label: 'Как одна точка меняет среднее' },
    ],
  },
  {
    id: 'distributions',
    number: 2,
    title: 'Распределения',
    summary: 'Откуда берутся законы распределения и как их узнать по гистограмме.',
    topics: 'Бернулли и биномиальное · E и D · Случайное блуждание · Нормальное приближение',
    art: courseDistributions,
    lessons: [paths, moments, walk, normal],
    ready: true,
    cheatsheet: [
      { label: 'Биномиальное распределение', formula: paths.formula },
      { label: 'Матожидание и дисперсия', formula: moments.formula },
      { label: 'Случайное блуждание', formula: walk.formula },
      { label: 'Правило двух сигм', formula: <>P(μ − 2σ ≤ X ≤ μ + 2σ) ≈ 0,95</> },
    ],
    summaryQuestions: SUMMARY_QUESTIONS_2,
    experiments: [
      { hash: '#galton', label: 'Доска Гальтона' },
      { hash: '#walk', label: 'Случайное блуждание' },
    ],
  },
  {
    id: 'limits',
    number: 3,
    title: 'Предельные теоремы',
    summary: 'Почему частота стремится к вероятности, а сумма случайностей — к колоколу Гаусса.',
    topics: 'Закон больших чисел · Усреднение и σ/√n · ЦПТ · Порядок из хаоса',
    art: courseLimits,
    lessons: [],
    ready: false,
    summaryQuestions: [],
    experiments: [],
  },
  {
    id: 'montecarlo',
    number: 4,
    title: 'Оценивание и Монте-Карло',
    summary: 'Как оценить долю, площадь и вероятность случайными точками и насколько можно доверять оценке.',
    topics: 'Оценка доли · Площадь точками · Точность 1/√n · Метод индикаторов',
    art: courseMontecarlo,
    lessons: [],
    ready: false,
    summaryQuestions: [],
    experiments: [],
  },
];
