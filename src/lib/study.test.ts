import { describe, expect, it } from 'vitest';
import { binOfPath } from './galton';
import { summarize } from './statistics';
import {
  LESSON_BINS,
  LESSON_PATHS,
  LESSON_SUMMARY,
  POST_TEST,
  PRE_TEST,
  STORAGE_KEY,
  TASK_VERSION,
  assignGroup,
  checkCode,
  emptyStore,
  finishLesson,
  formatGain,
  loadStore,
  resultsToCsv,
  saveStore,
  scoreAnswers,
  startParticipant,
  submitPost,
  submitPre,
  summarizeGroups,
  type Question,
  type StudyStore,
} from './study';

const SKILLS = ['объём', 'среднее', 'медиана', 'частота', 'разброс', 'интерпретация'];
const numbers = (text: string) => text.replace(/^[^:]*:\s*/, '').split(',').map((value) => Number(value.trim()));
const option = (question: Question) => question.options[question.correct];
const byId = (id: string) => [...PRE_TEST, ...POST_TEST].find((question) => question.id === id) as Question;

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), data };
}

/** Проводит участника по всему сценарию; answers — номера выбранных вариантов. */
function runParticipant(store: StudyStore, code: string, group: 'А' | 'Б', pre: number[], post: number[]): StudyStore {
  const t0 = new Date('2026-11-18T10:00:00Z');
  let participant = startParticipant(code, group, t0);
  participant = { ...participant, preDraft: pre };
  participant = submitPre(participant, t0);
  participant = finishLesson(participant);
  participant = { ...participant, postDraft: post };
  return submitPost({ ...store, current: participant }, new Date(t0.getTime() + 120_000));
}

describe('задания исследования', () => {
  it('в каждом тесте 6 вопросов — по одному на каждое умение', () => {
    for (const test of [PRE_TEST, POST_TEST]) {
      expect(test).toHaveLength(6);
      expect(test.map((question) => question.skill).sort()).toEqual([...SKILLS].sort());
      for (const question of test) {
        expect(question.correct).toBeGreaterThanOrEqual(0);
        expect(question.correct).toBeLessThan(question.options.length);
        expect(new Set(question.options).size).toBe(question.options.length);
      }
    }
  });

  it('итоговый тест использует другие числа и ситуации', () => {
    PRE_TEST.forEach((question, index) => {
      expect(POST_TEST[index].text + POST_TEST[index].samples).not.toBe(question.text + question.samples);
    });
  });

  it('правильные ответы про среднее и медиану совпадают с расчётом', () => {
    expect(String(summarize(numbers(byId('pre-mean').samples![0])).mean)).toBe(option(byId('pre-mean')));
    expect(String(summarize(numbers(byId('post-mean').samples![0])).mean)).toBe(option(byId('post-mean')));
    expect(String(summarize(numbers(byId('pre-median').samples![0])).median)).toBe(option(byId('pre-median')));
    expect(String(summarize(numbers(byId('post-median').samples![0])).median)).toBe(option(byId('post-median')));
    expect(numbers(byId('pre-size').samples![0])).toHaveLength(Number(option(byId('pre-size'))));
  });

  it('обязательное задание: 4, 4, 4, 4 и 2, 3, 5, 6 — среднее 4 в обеих, разброс больше во второй', () => {
    const question = byId('post-spread');
    expect(question.samples).toEqual(['Выборка 1: 4, 4, 4, 4', 'Выборка 2: 2, 3, 5, 6']);
    const first = summarize(numbers(question.samples![0]));
    const second = summarize(numbers(question.samples![1]));
    expect(first.mean).toBe(4);
    expect(second.mean).toBe(4);
    expect(first.standardDeviation).toBe(0);
    expect(second.standardDeviation).toBeGreaterThan(0);
    expect(option(question)).toBe('Среднее в обеих равно 4, разброс больше во второй');
  });

  it('входное задание на разброс устроено так же, но с другими числами', () => {
    const question = byId('pre-spread');
    const [first, second] = question.samples!.map((sample) => summarize(numbers(sample)));
    expect(first.mean).toBe(5);
    expect(second.mean).toBe(5);
    expect(second.standardDeviation).toBeGreaterThan(first.standardDeviation ?? 0);
    expect(option(question)).toContain('разброс больше во второй');
  });

  it('баллы и прирост', () => {
    expect(scoreAnswers(PRE_TEST, PRE_TEST.map((question) => question.correct))).toBe(6);
    expect(scoreAnswers(PRE_TEST, Array(6).fill(null))).toBe(0);
    expect(formatGain(2)).toBe('+2');
    expect(formatGain(0)).toBe('0');
    expect(formatGain(-1)).toBe('−1');
  });
});

describe('мини-урок', () => {
  it('одна заранее заданная последовательность из 20 шариков', () => {
    expect(LESSON_BINS).toHaveLength(20);
    LESSON_PATHS.forEach((path, index) => expect(binOfPath(path)).toBe(LESSON_BINS[index]));
    expect(LESSON_SUMMARY).toMatchObject({ size: 20, mean: 4, median: 4 });
  });
});

describe('сценарий участника', () => {
  it('группа назначается с равными шансами', () => {
    expect(assignGroup(() => 0.2)).toBe('А');
    expect(assignGroup(() => 0.7)).toBe('Б');
    let groupA = 0;
    for (let index = 0; index < 20000; index += 1) if (assignGroup() === 'А') groupA += 1;
    expect(Math.abs(groupA / 20000 - 0.5)).toBeLessThan(0.02);
  });

  it('засчитывается первая отправка входного теста', () => {
    const t0 = new Date('2026-11-18T10:00:00Z');
    let participant = startParticipant('17Б', 'А', t0);
    expect(submitPre(participant, t0)).toBe(participant); // не все ответы выбраны
    participant = submitPre({ ...participant, preDraft: [1, 2, 3, 0, 0, 0] }, t0);
    expect(participant).toMatchObject({ step: 'lesson', preScore: 4 });
    const again = submitPre({ ...participant, preDraft: [1, 2, 3, 0, 2, 1] }, t0);
    expect(again.preScore).toBe(4);
    expect(again.preAnswers).toEqual([1, 2, 3, 0, 0, 0]);
  });

  it('итоговый тест доступен сразу после открытия урока, но не до входного теста', () => {
    const t0 = new Date('2026-11-18T10:00:00Z');
    const fresh = startParticipant('A1', 'Б', t0);
    expect(finishLesson(fresh).step).toBe('pre');
    const participant = submitPre({ ...fresh, preDraft: [0, 0, 0, 0, 0, 0] }, t0);
    expect(finishLesson(participant).step).toBe('post');
  });

  it('завершение добавляет одну запись, повторная отправка ничего не меняет', () => {
    const correct = POST_TEST.map((question) => question.correct);
    const store = runParticipant(emptyStore(), '17Б', 'Б', [1, 2, 0, 0, 0, 0], correct);
    expect(store.current?.step).toBe('results');
    expect(store.completed).toHaveLength(1);
    // Входные ответы [1, 2, 0, 0, 0, 0]: верны первые два и четвёртый — 3 балла.
    expect(store.completed[0]).toMatchObject({ code: '17Б', group: 'Б', version: TASK_VERSION, preScore: 3, postScore: 6, gain: 3 });
    expect(submitPost(store, new Date())).toBe(store);
  });

  it('код завершившего участника нельзя использовать повторно', () => {
    const store = runParticipant(emptyStore(), '17Б', 'А', Array(6).fill(0), Array(6).fill(0));
    expect(checkCode(' 17б ', store).ok).toBe(false);
    expect(checkCode('18Б', store)).toEqual({ ok: true, code: '18Б' });
    expect(checkCode('Иван Петров', store).ok).toBe(false);
    expect(checkCode('x', store).ok).toBe(false);
  });

  it('прогресс и группа переживают перезагрузку', () => {
    const storage = memoryStorage();
    const t0 = new Date('2026-11-18T10:00:00Z');
    const store: StudyStore = { current: { ...startParticipant('K9', 'Б', t0), preDraft: [1, null, null, null, null, null] }, completed: [] };
    expect(saveStore(storage, store)).toBe(true);
    expect(storage.data.has(STORAGE_KEY)).toBe(true);
    expect(loadStore(storage)).toEqual(store);
    expect(loadStore({ getItem: () => '{испорчено', setItem: () => undefined })).toEqual(emptyStore());
    expect(loadStore(null)).toEqual(emptyStore());
  });
});

describe('экран преподавателя', () => {
  const store = [
    { code: 'A1', group: 'А' as const, pre: [0, 0, 0, 0, 0, 0], post: POST_TEST.map((q) => q.correct) },
    { code: 'A2', group: 'А' as const, pre: PRE_TEST.map((q) => q.correct), post: POST_TEST.map((q) => q.correct) },
    { code: 'B1', group: 'Б' as const, pre: [0, 0, 0, 0, 0, 0], post: [0, 0, 0, 0, 0, 0] },
  ].reduce((current, item) => runParticipant(current, item.code, item.group, item.pre, item.post), emptyStore());

  it('считает завершивших и средний прирост по группам', () => {
    const [groupA, groupB] = summarizeGroups(store.completed);
    // A1: 1 → 6 (+5), A2: 6 → 6 (0); B1: 1 → 1 (0). Ответ 0 верен в одном входном вопросе.
    expect(groupA).toMatchObject({ group: 'А', finished: 2, meanGain: 2.5 });
    expect(groupB).toMatchObject({ group: 'Б', finished: 1, meanGain: 0 });
  });

  it('CSV: одна строка на завершившего участника', () => {
    const lines = resultsToCsv(store.completed).trimEnd().split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[0].split(';').slice(0, 6)).toEqual(['Код', 'Группа', 'Версия заданий', 'Баллы до', 'Баллы после', 'Прирост']);
    expect(lines[1].split(';').slice(0, 6)).toEqual(['A1', 'А', TASK_VERSION, '1', '6', '5']);
    expect(lines[3].split(';').slice(0, 6)).toEqual(['B1', 'Б', TASK_VERSION, '1', '1', '0']);
  });
});
