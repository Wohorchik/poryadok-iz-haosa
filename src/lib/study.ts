/**
 * Учебное исследование «Помогает ли визуализация понять статистику?».
 * Здесь всё, что не зависит от интерфейса: задания, проверка ответов, назначение группы,
 * хранение прогресса и выгрузка результатов.
 */
import { toCsv } from './csv';
import { BIN_COUNT, LEVELS } from './galton';
import { browserRandom, type RandomSource } from './random';
import { summarize } from './statistics';

/** Версия набора заданий. Меняйте её при любой правке вопросов, чтобы данные разных версий не смешивались. */
export const TASK_VERSION = 'galton-v1';
export const STORAGE_KEY = 'poryadok-study-v1';

export type Group = 'А' | 'Б';
export type Skill = 'объём' | 'среднее' | 'медиана' | 'частота' | 'разброс' | 'интерпретация';

export interface Question {
  id: string;
  skill: Skill;
  /** Текст вопроса. Выборки даны отдельно, чтобы показать их крупно. */
  text: string;
  samples?: readonly string[];
  options: readonly string[];
  correct: number;
  explanation: string;
}

export const PRE_TEST: readonly Question[] = [
  {
    id: 'pre-size',
    skill: 'объём',
    text: 'Шарики упали в ячейки с такими номерами. Каков объём выборки N?',
    samples: ['3, 5, 4, 4, 6, 2, 4'],
    options: ['4', '7', '6', '28'],
    correct: 1,
    explanation: 'Объём выборки — число наблюдений. Здесь записано 7 номеров ячеек, значит N = 7.',
  },
  {
    id: 'pre-mean',
    skill: 'среднее',
    text: 'Найдите среднее значение выборки.',
    samples: ['1, 3, 3, 5, 8'],
    options: ['3', '5', '4', '20'],
    correct: 2,
    explanation: 'Среднее — сумма, делённая на объём: (1 + 3 + 3 + 5 + 8) / 5 = 20 / 5 = 4.',
  },
  {
    id: 'pre-median',
    skill: 'медиана',
    text: 'Найдите медиану выборки.',
    samples: ['7, 2, 9, 4, 5'],
    options: ['9', '5,4', '7', '5'],
    correct: 3,
    explanation:
      'Сначала упорядочим: 2, 4, 5, 7, 9. Медиана — значение в середине упорядоченного ряда, это 5. Число 9 стоит в середине неупорядоченной записи, а 5,4 — это среднее.',
  },
  {
    id: 'pre-frequency',
    skill: 'частота',
    text: 'Из 50 шариков в ячейку 3 попали 10. Какова относительная частота ячейки 3?',
    options: ['20 %', '10 %', '30 %', '3 %'],
    correct: 0,
    explanation: 'Относительная частота — доля наблюдений: 10 / 50 = 0,2, то есть 20 %.',
  },
  {
    id: 'pre-spread',
    skill: 'разброс',
    text: 'Даны две выборки. В какой среднее больше и в какой результаты сильнее отличаются друг от друга?',
    samples: ['Выборка 1: 5, 5, 5, 5', 'Выборка 2: 1, 4, 6, 9'],
    options: [
      'Среднее больше во второй, разброс больше во второй',
      'Среднее больше в первой, разброс одинаковый',
      'Среднее в обеих равно 5, разброс больше во второй',
      'Среднее в обеих равно 5, разброс одинаковый',
    ],
    correct: 2,
    explanation:
      'Среднее первой выборки 20 / 4 = 5, второй тоже 20 / 4 = 5. В первой все значения совпадают, разброс нулевой. Во второй значения далеко отходят от 5, поэтому разброс больше.',
  },
  {
    id: 'pre-interpretation',
    skill: 'интерпретация',
    text: 'При p = 50 % теоретическое среднее равно 4. В опыте с 20 шариками среднее получилось 4,6. Что верно?',
    options: [
      'Доска неисправна: среднее обязано равняться 4',
      'Отклонение возможно из-за случайности; при большем числе шариков среднее обычно ближе к 4',
      'Следующий опыт обязательно даст среднее меньше 4, чтобы уравновесить',
      'Теория неверна: настоящее среднее равно 4,6',
    ],
    correct: 1,
    explanation:
      'Среднее отдельной выборки колеблется вокруг теоретического значения. Отклонение 0,6 при 20 шариках вполне возможно. Шарики не «помнят» прошлые опыты, поэтому ничего не уравновешивают.',
  },
];

export const POST_TEST: readonly Question[] = [
  {
    id: 'post-size',
    skill: 'объём',
    text: 'Таблица частот: в ячейку 2 попали 3 шарика, в ячейку 3 — 5 шариков, в ячейку 4 — 4 шарика. Каков объём выборки N?',
    options: ['3', '9', '12', '4'],
    correct: 2,
    explanation: 'Объём — общее число шариков: 3 + 5 + 4 = 12. Число 9 — сумма номеров ячеек, а не шариков.',
  },
  {
    id: 'post-mean',
    skill: 'среднее',
    text: 'Найдите среднее значение выборки.',
    samples: ['6, 2, 7, 5'],
    options: ['5', '5,5', '20', '6'],
    correct: 0,
    explanation: 'Среднее: (6 + 2 + 7 + 5) / 4 = 20 / 4 = 5. Число 5,5 — это медиана.',
  },
  {
    id: 'post-median',
    skill: 'медиана',
    text: 'Найдите медиану выборки.',
    samples: ['2, 9, 4, 7, 1, 6'],
    options: ['4', '6', '4,8', '5'],
    correct: 3,
    explanation:
      'Упорядочим: 1, 2, 4, 6, 7, 9. Наблюдений чётное число, поэтому медиана — среднее двух центральных: (4 + 6) / 2 = 5.',
  },
  {
    id: 'post-frequency',
    skill: 'частота',
    text: 'Из 200 шариков в ячейку 4 попали 54. Какова относительная частота ячейки 4?',
    options: ['54 %', '27 %', '4 %', '2,7 %'],
    correct: 1,
    explanation: 'Относительная частота: 54 / 200 = 0,27, то есть 27 %.',
  },
  {
    id: 'post-spread',
    skill: 'разброс',
    text: 'Даны две выборки. В какой среднее больше и в какой результаты сильнее отличаются друг от друга?',
    samples: ['Выборка 1: 4, 4, 4, 4', 'Выборка 2: 2, 3, 5, 6'],
    options: [
      'Среднее больше во второй, разброс больше во второй',
      'Среднее в обеих равно 4, разброс больше во второй',
      'Среднее в обеих равно 4, разброс одинаковый',
      'Среднее больше в первой, разброс больше в первой',
    ],
    correct: 1,
    explanation:
      'Среднее первой выборки 16 / 4 = 4, второй тоже 16 / 4 = 4. В первой все значения равны, разброс нулевой. Во второй значения отходят от 4 на 1 и 2, поэтому разброс больше.',
  },
  {
    id: 'post-interpretation',
    skill: 'интерпретация',
    text: 'При одинаковом p провели две выборки: из 10 шариков и из 1000 шариков. Что верно?',
    options: [
      'Среднее большой выборки всегда ближе к теоретическому',
      'Объём выборки не влияет на точность среднего',
      'Среднее большой выборки обычно ближе к теоретическому, но в отдельном опыте может быть иначе',
      'Малая выборка точнее, потому что в ней меньше случайных ошибок',
    ],
    correct: 2,
    explanation:
      'С ростом объёма типичная ошибка среднего уменьшается, поэтому большая выборка обычно точнее. Но это закономерность для многих опытов, а не гарантия для каждого.',
  },
];

export const scoreAnswers = (questions: readonly Question[], answers: readonly (number | null)[]): number =>
  questions.reduce((score, question, index) => score + (answers[index] === question.correct ? 1 : 0), 0);

export const formatGain = (gain: number): string => (gain > 0 ? `+${gain}` : gain < 0 ? `−${-gain}` : '0');

/* ---------- Мини-урок: одна последовательность шариков для обеих групп ---------- */

/** Номера ячеек 20 шариков урока в порядке падения. Одинаковы для групп А и Б. */
export const LESSON_BINS: readonly number[] = [4, 3, 5, 4, 2, 4, 6, 3, 4, 5, 3, 4, 5, 2, 4, 3, 5, 4, 6, 4];

/** Детерминированный генератор, чтобы пути шариков урока не менялись между запусками. */
function seeded(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Путь шарика урока: ровно bin поворотов вправо в заранее заданных (но разных у разных шариков) местах. */
export const LESSON_PATHS: readonly (readonly boolean[])[] = (() => {
  const random = seeded(20261118);
  return LESSON_BINS.map((bin) => {
    const levels = Array.from({ length: LEVELS }, (_, level) => level);
    for (let index = levels.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [levels[index], levels[swap]] = [levels[swap], levels[index]];
    }
    const rights = new Set(levels.slice(0, bin));
    return Array.from({ length: LEVELS }, (_, level) => rights.has(level));
  });
})();

export const lessonCounts = (count = LESSON_BINS.length): number[] => {
  const counts = Array<number>(BIN_COUNT).fill(0);
  for (const bin of LESSON_BINS.slice(0, count)) counts[bin] += 1;
  return counts;
};

export const LESSON_SUMMARY = summarize(LESSON_BINS);

/* ---------- Участник и хранение ---------- */

export type Step = 'pre' | 'lesson' | 'post' | 'results';

export interface Participant {
  code: string;
  group: Group;
  version: string;
  step: Step;
  startedAt: string;
  preDraft: (number | null)[];
  preAnswers: number[] | null;
  preScore: number | null;
  lessonStartedAt: string | null;
  postDraft: (number | null)[];
  postAnswers: number[] | null;
  postScore: number | null;
  finishedAt: string | null;
}

export interface CompletedRecord {
  code: string;
  group: Group;
  version: string;
  preScore: number;
  postScore: number;
  gain: number;
  preAnswers: number[];
  postAnswers: number[];
  startedAt: string;
  lessonStartedAt: string;
  finishedAt: string;
}

export interface StudyStore {
  current: Participant | null;
  completed: CompletedRecord[];
}

export const emptyStore = (): StudyStore => ({ current: null, completed: [] });

/** Пробелы по краям убираются, а пробел внутри — ошибка: так чаще всего вводят имя и фамилию. */
export const normalizeCode = (raw: string): string => raw.trim().toUpperCase();

export type CodeResult = { ok: true; code: string } | { ok: false; error: string };

export function checkCode(raw: string, store: StudyStore): CodeResult {
  const code = normalizeCode(raw);
  if (!/^[0-9A-ZА-ЯЁ_-]{2,20}$/.test(code)) {
    return { ok: false, error: 'Код — от 2 до 20 букв или цифр, без пробелов. Не используйте имя и фамилию.' };
  }
  if (store.completed.some((record) => record.code === code)) {
    return { ok: false, error: 'Участник с этим кодом уже прошёл исследование. Повторное прохождение не засчитывается.' };
  }
  return { ok: true, code };
}

/** Группа А или Б с равными шансами. */
export const assignGroup = (random: RandomSource = browserRandom): Group => (random() < 0.5 ? 'А' : 'Б');

export function startParticipant(code: string, group: Group, now: Date): Participant {
  return {
    code,
    group,
    version: TASK_VERSION,
    step: 'pre',
    startedAt: now.toISOString(),
    preDraft: Array<number | null>(PRE_TEST.length).fill(null),
    preAnswers: null,
    preScore: null,
    lessonStartedAt: null,
    postDraft: Array<number | null>(POST_TEST.length).fill(null),
    postAnswers: null,
    postScore: null,
    finishedAt: null,
  };
}

/** Фиксирует входной тест. Повторная отправка ничего не меняет: засчитывается первая. */
export function submitPre(participant: Participant, now: Date): Participant {
  if (participant.preAnswers !== null || participant.preDraft.some((answer) => answer === null)) return participant;
  const answers = participant.preDraft as number[];
  return {
    ...participant,
    step: 'lesson',
    preAnswers: answers,
    preScore: scoreAnswers(PRE_TEST, answers),
    lessonStartedAt: now.toISOString(),
  };
}

/** Переход к итоговому тесту доступен сразу после открытия урока. */
export function finishLesson(participant: Participant): Participant {
  if (participant.step !== 'lesson') return participant;
  return { ...participant, step: 'post' };
}

/** Фиксирует итоговый тест и добавляет участника в список завершивших ровно один раз. */
export function submitPost(store: StudyStore, now: Date): StudyStore {
  const participant = store.current;
  if (!participant || participant.step !== 'post' || participant.postAnswers !== null) return store;
  if (participant.postDraft.some((answer) => answer === null) || participant.preAnswers === null) return store;
  const postAnswers = participant.postDraft as number[];
  const postScore = scoreAnswers(POST_TEST, postAnswers);
  const finishedAt = now.toISOString();
  const finished: Participant = { ...participant, step: 'results', postAnswers, postScore, finishedAt };
  const record: CompletedRecord = {
    code: participant.code,
    group: participant.group,
    version: participant.version,
    preScore: participant.preScore ?? 0,
    postScore,
    gain: postScore - (participant.preScore ?? 0),
    preAnswers: participant.preAnswers,
    postAnswers,
    startedAt: participant.startedAt,
    lessonStartedAt: participant.lessonStartedAt ?? participant.startedAt,
    finishedAt,
  };
  const already = store.completed.some((item) => item.code === record.code);
  return { current: finished, completed: already ? store.completed : [...store.completed, record] };
}

/* ---------- Сохранение в браузере ---------- */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadStore(storage: StorageLike | null): StudyStore {
  if (!storage) return emptyStore();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<StudyStore>;
    return {
      current: parsed.current ?? null,
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
    };
  } catch {
    return emptyStore();
  }
}

export function saveStore(storage: StorageLike | null, store: StudyStore): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

/* ---------- Для преподавателя ---------- */

export interface GroupSummary {
  group: Group;
  finished: number;
  meanPre: number | null;
  meanPost: number | null;
  meanGain: number | null;
}

export function summarizeGroups(completed: readonly CompletedRecord[]): GroupSummary[] {
  return (['А', 'Б'] as const).map((group) => {
    const records = completed.filter((record) => record.group === group);
    const mean = (values: number[]) => summarize(values).mean;
    return {
      group,
      finished: records.length,
      meanPre: mean(records.map((record) => record.preScore)),
      meanPost: mean(records.map((record) => record.postScore)),
      meanGain: mean(records.map((record) => record.gain)),
    };
  });
}

const secondsBetween = (from: string, to: string) =>
  Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));

/** Одна строка на завершившего участника. Ответы по вопросам — 1 (верно) или 0. */
export function resultsToCsv(completed: readonly CompletedRecord[]): string {
  const header = [
    'Код',
    'Группа',
    'Версия заданий',
    'Баллы до',
    'Баллы после',
    'Прирост',
    ...PRE_TEST.map((question, index) => `До ${index + 1} (${question.skill})`),
    ...POST_TEST.map((question, index) => `После ${index + 1} (${question.skill})`),
    'Начало',
    'Окончание',
    'Урок и итоговый тест, с',
  ];
  const rows = completed.map((record) => [
    record.code,
    record.group,
    record.version,
    record.preScore,
    record.postScore,
    record.gain,
    ...PRE_TEST.map((question, index) => (record.preAnswers[index] === question.correct ? 1 : 0)),
    ...POST_TEST.map((question, index) => (record.postAnswers[index] === question.correct ? 1 : 0)),
    record.startedAt,
    record.finishedAt,
    secondsBetween(record.lessonStartedAt, record.finishedAt),
  ]);
  return toCsv(header, rows);
}
