import { useEffect, useId, useState, type CSSProperties } from 'react';
import { Reveal } from '../components/Reveal';
import { downloadCsv } from '../lib/csv';
import { formatInteger, formatOneDecimal, formatStatistic, plural } from '../lib/format';
import { BIN_COUNT, LEVELS } from '../lib/galton';
import { countAxis } from '../lib/statistics';
import {
  LESSON_BINS,
  LESSON_PATHS,
  LESSON_SUMMARY,
  POST_TEST,
  PRE_TEST,
  TASK_VERSION,
  assignGroup,
  checkCode,
  finishLesson,
  formatGain,
  lessonCounts,
  loadStore,
  resultsToCsv,
  saveStore,
  startParticipant,
  submitPost,
  submitPre,
  summarizeGroups,
  type Group,
  type Participant,
  type Question,
  type StorageLike,
  type StudyStore,
} from '../lib/study';
import { BoardWithBalls, boardGeometry, useGaltonFlights } from '../components/GaltonBoardView';

const BINS = Array.from({ length: BIN_COUNT }, (_, bin) => bin);
const LESSON_N = LESSON_BINS.length;
const LESSON_COUNTS = lessonCounts();
const LESSON_SUM = LESSON_BINS.reduce((sum, bin) => sum + bin, 0);
const SORTED = [...LESSON_BINS].sort((first, second) => first - second);

function browserStorage(): StorageLike | null {
  try {
    const storage = window.localStorage;
    const probe = '__study_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

const scoreText = (score: number | null, total: number) => (score === null ? '—' : `${score}/${total}`);

/* ---------- Тест ---------- */

function Quiz({
  title,
  questions,
  answers,
  onAnswer,
  onSubmit,
  testId,
}: {
  title: string;
  questions: readonly Question[];
  answers: readonly (number | null)[];
  onAnswer: (index: number, option: number) => void;
  onSubmit: () => void;
  testId: string;
}) {
  const baseId = useId();
  const [index, setIndex] = useState(() => {
    const missing = answers.findIndex(value => value === null);
    return missing < 0 ? questions.length - 1 : missing;
  });
  const question = questions[index];
  const answered = answers.filter(value => value !== null).length;
  const last = index === questions.length - 1;
  return (
    <form className="quiz paper-quiz" data-testid={testId} onSubmit={event => {
      event.preventDefault();
      if (answers[index] === null) return;
      if (!last) setIndex(index + 1);
      else if (answered === questions.length) onSubmit();
      else setIndex(answers.findIndex(value => value === null));
    }}>
      <div className="paper-quiz-head"><h3>{title}</h3><span aria-live="polite">Вопрос {index+1} из {questions.length}</span></div>
      <progress value={answered} max={questions.length} aria-label="Отвечено вопросов"/>
      <fieldset className="quiz-question" key={question.id} data-testid={testId+'-q'+(index+1)}>
        <legend>{question.text}</legend>
        {question.samples && <div className="quiz-samples">{question.samples.map(sample=><code key={sample}>{sample}</code>)}</div>}
        <div className="quiz-options">{question.options.map((option,optionIndex)=>
          <label className="quiz-option" key={option}>
            <input type="radio" name={baseId+'-'+index} checked={answers[index]===optionIndex}
              onChange={()=>onAnswer(index,optionIndex)}/><span>{option}</span>
          </label>)}</div>
      </fieldset>
      <div className="quiz-submit">
        <button type="button" className="school-secondary" disabled={index===0} onClick={()=>setIndex(index-1)}>← Назад</button>
        <button type="submit" className="school-button" disabled={answers[index]===null}>{last?'Отправить ответы':'Дальше →'}</button>
      </div>
      <p className="hint">За верный ответ — 1 балл. Разбор откроется после итогового теста.</p>
    </form>
  );
}

/* ---------- Мини-урок ---------- */

function LessonTables() {
  return (
    <div className="lesson-tables">
      <div className="table-scroll">
        <table className="data-table lesson-observations" data-testid="lesson-observations">
          <caption>Выборка: 20 шариков в порядке падения</caption>
          <tbody>
            {[0, 10].map((start) => (
              <tr key={start}>
                <th scope="row">Шарики {start + 1}–{start + 10}</th>
                {LESSON_BINS.slice(start, start + 10).map((bin, index) => (
                  <td key={start + index} title={`Шарик ${start + index + 1}`}>
                    {bin}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-scroll">
        <table className="data-table lesson-frequencies" data-testid="lesson-frequencies">
          <caption>Таблица частот</caption>
          <thead>
            <tr>
              <th scope="col">Ячейка</th>
              {BINS.map((bin) => (
                <th scope="col" key={bin}>
                  {bin}
                </th>
              ))}
              <th scope="col">Всего</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Шариков</th>
              {BINS.map((bin) => (
                <td key={bin}>{LESSON_COUNTS[bin]}</td>
              ))}
              <td>{LESSON_N}</td>
            </tr>
            <tr>
              <th scope="row">Доля, %</th>
              {BINS.map((bin) => (
                <td key={bin}>{formatInteger((LESSON_COUNTS[bin] / LESSON_N) * 100)}</td>
              ))}
              <td>100</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Только для группы Б: та же последовательность шариков, показанная на доске по одному. */
const LESSON_GEOMETRY = boardGeometry(LEVELS);

function LessonBoard({ active }: { active: boolean }) {
  /** launched — сколько шариков запущено, shown — сколько приземлилось и учтено на диаграмме. */
  const [launched, setLaunched] = useState(0);
  const [shown, setShown] = useState(0);
  const [lastPath, setLastPath] = useState<boolean[] | null>(null);
  const flights = useGaltonFlights(active, LESSON_GEOMETRY, (bins, path) => {
    setShown((value) => value + bins.length);
    setLastPath(path);
  });
  const busy = flights.inFlight > 0;
  const counts = lessonCounts(shown);
  const { maximum, step } = countAxis(Math.max(...lessonCounts()));
  const ticks = Array.from({ length: maximum / step + 1 }, (_, index) => index * step);
  const current = shown > 0 ? LESSON_BINS[shown - 1] : null;

  const next = () => {
    flights.launch([[...LESSON_PATHS[launched]]], { releaseMs: 0, hopMs: 220 });
    setLaunched(launched + 1);
    setLastPath(null);
  };
  const all = () => {
    flights.launch(LESSON_PATHS.slice(launched).map((path) => [...path]), { releaseMs: 1600, hopMs: 150 });
    setLaunched(LESSON_N);
    setLastPath(null);
  };
  const restart = () => {
    flights.cancel();
    setLaunched(0);
    setShown(0);
    setLastPath(null);
  };

  return (
    <section className="lesson-board" aria-labelledby="lesson-board-title" data-testid="lesson-board">
      <h4 id="lesson-board-title">Те же 20 шариков на доске</h4>
      <div className="lesson-board-actions">
        <button className="btn btn--primary" type="button" disabled={busy || launched >= LESSON_N} onClick={next}>
          Следующий шарик
        </button>
        <button className="btn" type="button" disabled={launched >= LESSON_N} onClick={all}>
          Показать все 20
        </button>
        <button className="btn btn--quiet" type="button" disabled={launched === 0} onClick={restart}>
          Сначала
        </button>
      </div>
      <p className="status" aria-live="polite" data-testid="lesson-board-status">
        {busy && flights.inFlight === 1 && launched - shown === 1
          ? `Шарик ${launched} проходит восемь уровней.`
          : busy
            ? `Шарики падают: приземлилось ${shown} из ${LESSON_N}.`
            : current === null
              ? 'Нажмите «Следующий шарик», чтобы увидеть путь первого шарика.'
              : `Шарик ${shown} из ${LESSON_N}: ${current} ${plural(current, 'поворот', 'поворота', 'поворотов')} вправо, ячейка ${current}. Теперь в ней ${counts[current]} ${plural(counts[current], 'шарик', 'шарика', 'шариков')}.`}
      </p>
      <div className="lesson-board-visual" style={{ '--bins': BIN_COUNT } as CSSProperties}>
        <BoardWithBalls geometry={LESSON_GEOMETRY} lastPath={busy ? null : lastPath} canvasRef={flights.canvasRef} className="lesson-board-wrap" />
        <div className="chart lesson-chart" role="img" aria-label={`Диаграмма частот после ${shown} шариков`}>
          <div className="chart-axis" aria-hidden="true">
            {ticks.map((tick) => (
              <span key={tick} style={{ bottom: `${(tick / maximum) * 100}%` }}>
                {tick}
              </span>
            ))}
          </div>
          <div className="chart-plot" aria-hidden="true">
            {ticks.map((tick) => (
              <span className="chart-line" key={tick} style={{ bottom: `${(tick / maximum) * 100}%` }} />
            ))}
            {BINS.map((bin) => (
              <div className="chart-column" key={bin}>
                <span
                  className={bin === current ? 'chart-bar lesson-bar lesson-bar--current' : 'chart-bar lesson-bar'}
                  data-count={counts[bin]}
                  style={{ height: `${(counts[bin] / maximum) * 100}%` }}
                />
                {counts[bin] > 0 ? (
                  <span className="lesson-bar-label" style={{ bottom: `${(counts[bin] / maximum) * 100}%` }}>
                    {counts[bin]}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div className="series-x lesson-x" aria-hidden="true">
          {BINS.map((bin) => (
            <span key={bin}>{bin}</span>
          ))}
        </div>
        <p className="series-axis-title series-axis-title--x">Номер ячейки; высота столбца — число шариков</p>
      </div>
    </section>
  );
}

function Lesson({ group, active, onFinish }: { group: Group; active: boolean; onFinish: () => void }) {
  const mean = LESSON_SUMMARY.mean ?? 0;
  const median = LESSON_SUMMARY.median ?? 0;
  const deviation = LESSON_SUMMARY.standardDeviation ?? 0;
  const theory = LEVELS * 0.5;
  const middle = SORTED.slice(LESSON_N / 2 - 1, LESSON_N / 2 + 1);

  return (
    <section className="lesson" data-testid="lesson" data-group={group}>
      <h3>Мини-урок: как описать выборку</h3>
      <p>
        На доске Гальтона с 8 уровнями при p = 50&nbsp;% бросили {LESSON_N} шариков. Каждое наблюдение — номер ячейки,
        в которую упал шарик: от 0 до 8.{' '}
        {group === 'А'
          ? 'Изучите выборку по таблицам.'
          : 'Изучите выборку по таблицам, а ниже покажите на доске, как каждый шарик пополняет ячейку и меняет диаграмму.'}
      </p>

      <LessonTables />
      {group === 'Б' ? <LessonBoard active={active} /> : null}

      <div className="lesson-points">
        <section>
          <h4>Объём выборки</h4>
          <p>
            Объём N — число наблюдений. Здесь N = {LESSON_N}. Это число шариков, а не сумма номеров ячеек.
          </p>
        </section>
        <section>
          <h4>Частота</h4>
          <p>
            Частота ячейки — сколько шариков в неё попало. В ячейку 4 попало {LESSON_COUNTS[4]} шариков. Относительная
            частота — доля: {LESSON_COUNTS[4]} / {LESSON_N} = {formatInteger((LESSON_COUNTS[4] / LESSON_N) * 100)}&nbsp;%.
            Сумма частот всех ячеек всегда равна N.
          </p>
        </section>
        <section>
          <h4>Среднее</h4>
          <p>
            Среднее — сумма всех наблюдений, делённая на N: {LESSON_SUM} / {LESSON_N} = {formatStatistic(mean)}.
          </p>
        </section>
        <section>
          <h4>Медиана</h4>
          <p>
            Медиана — значение в середине упорядоченного ряда. Упорядочим 20 номеров. При чётном N берём среднее двух
            центральных — 10-го и 11-го: ({middle[0]} + {middle[1]}) / 2 = {formatStatistic(median)}. Сначала ряд
            обязательно упорядочивают.
          </p>
        </section>
        <section>
          <h4>Разброс</h4>
          <p>
            Разброс показывает, насколько наблюдения отличаются друг от друга и от среднего. Здесь номера ячеек — от{' '}
            {SORTED[0]} до {SORTED[LESSON_N - 1]}, стандартное отклонение s ≈ {formatStatistic(deviation)}. Если бы все
            шарики упали в одну ячейку, разброс был бы нулевым. У двух выборок может быть одинаковое среднее, но разный
            разброс.
          </p>
        </section>
        <section>
          <h4>Как понимать результат</h4>
          <p>
            Теория при p = 50&nbsp;% даёт среднее 8p = {formatStatistic(theory)}. Здесь среднее совпало с теорией, но так
            бывает не всегда: другая выборка из 20 шариков могла дать, например, {formatOneDecimal(3.7)} или{' '}
            {formatOneDecimal(4.4)}. Чем больше шариков, тем обычно ближе среднее к теории, но в отдельном опыте это не
            гарантировано.
          </p>
        </section>
      </div>

      <h4>Задания для самопроверки</h4>
      <Reveal question="1. Какая доля шариков попала в ячейки 3, 4 и 5 вместе?" openLabel="Проверить себя" closeLabel="Скрыть ответ">
        <p>
          {LESSON_COUNTS[3]} + {LESSON_COUNTS[4]} + {LESSON_COUNTS[5]} = {LESSON_COUNTS[3] + LESSON_COUNTS[4] + LESSON_COUNTS[5]}{' '}
          шариков из {LESSON_N}, то есть{' '}
          {formatInteger(((LESSON_COUNTS[3] + LESSON_COUNTS[4] + LESSON_COUNTS[5]) / LESSON_N) * 100)}&nbsp;%.
        </p>
      </Reveal>
      <Reveal
        question="2. Добавили 21-й шарик, и он упал в ячейку 8. Как изменится среднее?"
        openLabel="Проверить себя"
        closeLabel="Скрыть ответ"
      >
        <p>
          Сумма станет {LESSON_SUM} + 8 = {LESSON_SUM + 8}, объём — 21. Среднее: {LESSON_SUM + 8} / 21 ≈{' '}
          {formatStatistic((LESSON_SUM + 8) / 21)}. Оно немного выросло: одно большое значение сдвигает среднее.
        </p>
      </Reveal>

      <div className="quiz-submit">
        <button className="btn btn--primary" type="button" onClick={onFinish}>
          Перейти к итоговому тесту
        </button>
      </div>
    </section>
  );
}

/* ---------- Результаты ---------- */

function Review({ title, questions, answers }: { title: string; questions: readonly Question[]; answers: readonly number[] }) {
  return (
    <section className="review">
      <h4>{title}</h4>
      <ol className="review-list">
        {questions.map((question, index) => {
          const right = answers[index] === question.correct;
          return (
            <li key={question.id} className={right ? 'review-item review-item--right' : 'review-item review-item--wrong'}>
              <p className="review-question">
                {question.text} {question.samples ? <span className="review-samples">{question.samples.join('; ')}</span> : null}
              </p>
              <p>
                {right ? 'Верно' : 'Неверно'}. Ваш ответ: {question.options[answers[index]]}.
                {right ? null : ` Правильный ответ: ${question.options[question.correct]}.`}
              </p>
              <p className="hint">{question.explanation}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Results({ participant, onNext }: { participant: Participant; onNext: () => void }) {
  const pre = participant.preScore ?? 0;
  const post = participant.postScore ?? 0;
  return (
    <section className="results" data-testid="study-results">
      <h3>Результаты участника {participant.code}</h3>
      <div className="results-score">
        <p>
          <span className="results-label">До урока → после урока</span>
          <strong data-testid="study-scores">
            {scoreText(pre, PRE_TEST.length)} → {scoreText(post, POST_TEST.length)}
          </strong>
        </p>
        <p>
          <span className="results-label">Прирост</span>
          <strong data-testid="study-gain">{formatGain(post - pre)}</strong>
        </p>
      </div>
      <Review title="Входной тест" questions={PRE_TEST} answers={participant.preAnswers ?? []} />
      <Review title="Итоговый тест" questions={POST_TEST} answers={participant.postAnswers ?? []} />
      <div className="quiz-submit">
        <button className="btn btn--primary" type="button" onClick={onNext}>
          Новый участник
        </button>
      </div>
    </section>
  );
}

/* ---------- Экран преподавателя ---------- */

function TeacherPanel({ store, onReset, onClearAll }: { store: StudyStore; onReset: () => void; onClearAll: () => void }) {
  const groups = summarizeGroups(store.completed);
  const show = (value: number | null, signed = false) =>
    value === null ? 'нет данных' : signed ? (value > 0 ? `+${formatStatistic(value)}` : formatStatistic(value)) : formatStatistic(value);
  const download = () => {
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`issledovanie-${TASK_VERSION}-${date}.csv`, resultsToCsv(store.completed));
  };

  return (
    <section className="teacher" data-testid="teacher-panel" aria-labelledby="teacher-title">
      <h3 id="teacher-title">Экран преподавателя</h3>
      <div className="table-scroll">
        <table className="data-table">
          <caption>Завершившие участники (версия заданий {TASK_VERSION})</caption>
          <thead>
            <tr>
              <th scope="col">Группа</th>
              <th scope="col">Завершили</th>
              <th scope="col">Средний балл до</th>
              <th scope="col">Средний балл после</th>
              <th scope="col">Средний прирост</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.group} data-testid={`teacher-group-${group.group}`}>
                <th scope="row">{group.group === 'А' ? 'А — таблица' : 'Б — таблица и доска'}</th>
                <td>{group.finished}</td>
                <td>{show(group.meanPre)}</td>
                <td>{show(group.meanPost)}</td>
                <td>{show(group.meanGain, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">
        Здесь только описание собранных данных. Вывод о влиянии визуализации делайте по фактическим результатам: учитывайте
        число участников в группах и разброс приростов.
      </p>
      <div className="actions">
        <button className="btn btn--primary" type="button" disabled={store.completed.length === 0} onClick={download}>
          Скачать CSV
        </button>
        <button className="btn" type="button" disabled={store.current === null} onClick={onReset}>
          Прервать текущего участника
        </button>
        <button className="btn btn--quiet" type="button" disabled={store.completed.length === 0} onClick={onClearAll}>
          Удалить все результаты
        </button>
      </div>
      {store.current ? (
        <p className="hint">
          Сейчас проходит: код {store.current.code}, группа {store.current.group}, этап «{STEP_NAMES[store.current.step]}».
        </p>
      ) : null}
    </section>
  );
}

const STEP_NAMES = { pre: 'входной тест', lesson: 'мини-урок', post: 'итоговый тест', results: 'результаты' } as const;
const STEP_ORDER = ['pre', 'lesson', 'post', 'results'] as const;

/* ---------- Вкладка ---------- */

export function StudyLab({ active }: { active: boolean }) {
  const [storage] = useState(browserStorage);
  const [store, setStore] = useState<StudyStore>(() => loadStore(storage));
  const [codeText, setCodeText] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [teacher, setTeacher] = useState(false);

  const participant = store.current;

  useEffect(() => {
    saveStore(storage, store);
  }, [storage, store]);

  const update = (change: (participant: Participant) => Participant) =>
    setStore((previous) => (previous.current ? { ...previous, current: change(previous.current) } : previous));

  const start = () => {
    const result = checkCode(codeText, store);
    if (!result.ok) {
      setCodeError(result.error);
      return;
    }
    setStore((previous) => ({ ...previous, current: startParticipant(result.code, assignGroup(), new Date()) }));
    setCodeText('');
    setCodeError(null);
  };

  const answer = (field: 'preDraft' | 'postDraft') => (index: number, option: number) =>
    update((current) => {
      const draft = [...current[field]];
      draft[index] = option;
      return { ...current, [field]: draft };
    });

  const nextParticipant = () => setStore((previous) => ({ ...previous, current: null }));

  const resetCurrent = () => {
    if (window.confirm('Прервать текущего участника? Его незавершённые ответы будут удалены и не попадут в результаты.')) {
      nextParticipant();
    }
  };

  const clearAll = () => {
    if (window.confirm('Удалить результаты всех завершивших участников? Сначала скачайте CSV. Отменить удаление нельзя.')) {
      setStore((previous) => ({ ...previous, completed: [] }));
    }
  };

  const stepIndex = participant ? STEP_ORDER.indexOf(participant.step) : -1;

  return (
    <section className="study" id="panel-study" hidden={!active}>
      <a className="school-back" href="#study">← Все курсы</a>
      <div className="study-head">
        <div>
          <h2>Учебное исследование</h2>
          <p>
            Помогает ли визуализация понять статистику? Участник проходит входной тест, мини-урок по доске Гальтона и
            итоговый тест. Группа А изучает данные по таблице, группа Б — по той же таблице и доске.
          </p>
        </div>
        <button className="btn btn--toggle" type="button" aria-pressed={teacher} onClick={() => setTeacher((value) => !value)}>
          Экран преподавателя
        </button>
      </div>

      {storage === null ? (
        <p className="hint hint--error" role="alert">
          Браузер не разрешает сохранять данные на этой странице. Прогресс пропадёт при обновлении. Откройте файл в
          обычном окне Chrome, Edge или Firefox, не в режиме инкогнито.
        </p>
      ) : null}

      {teacher ? <TeacherPanel store={store} onReset={resetCurrent} onClearAll={clearAll} /> : null}

      {participant ? (
        <div className="study-progress">
          <p data-testid="study-participant">
            Участник <strong>{participant.code}</strong> · группа <strong data-testid="study-group">{participant.group}</strong>
          </p>
          <ol className="study-steps" aria-label="Этапы">
            {STEP_ORDER.map((step, index) => (
              <li
                key={step}
                className={index < stepIndex ? 'study-step study-step--done' : index === stepIndex ? 'study-step study-step--now' : 'study-step'}
                aria-current={index === stepIndex ? 'step' : undefined}
              >
                {STEP_NAMES[step]}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {participant === null ? (
        <form
          className="study-start"
          onSubmit={(event) => {
            event.preventDefault();
            start();
          }}
        >
          <h3>Начало</h3>
          <p>
            Введите анонимный код участника, например номер по списку и букву класса: <code>17Б</code>. Не вводите имя и
            фамилию. Группа А или Б назначится случайно, с равными шансами, и сохранится до конца прохождения.
          </p>
          <div className="field">
            <label htmlFor="study-code">Анонимный код</label>
            <input
              id="study-code"
              className="input"
              type="text"
              autoComplete="off"
              value={codeText}
              aria-invalid={codeError !== null}
              onChange={(event) => {
                setCodeText(event.target.value);
                setCodeError(null);
              }}
            />
            {codeError ? (
              <p className="hint hint--error" role="alert">
                {codeError}
              </p>
            ) : null}
          </div>
          <div className="quiz-submit">
            <button className="btn btn--primary" type="submit">
              Начать
            </button>
          </div>
        </form>
      ) : participant.step === 'pre' ? (
        <Quiz
          title="Входной тест"
          questions={PRE_TEST}
          answers={participant.preDraft}
          onAnswer={answer('preDraft')}
          onSubmit={() => update((current) => submitPre(current, new Date()))}
          testId="pre-test"
        />
      ) : participant.step === 'lesson' ? (
        <Lesson
          group={participant.group}
          active={active}
          onFinish={() => update((current) => finishLesson(current))}
        />
      ) : participant.step === 'post' ? (
        <Quiz
          title="Итоговый тест"
          questions={POST_TEST}
          answers={participant.postDraft}
          onAnswer={answer('postDraft')}
          onSubmit={() => setStore((previous) => submitPost(previous, new Date()))}
          testId="post-test"
        />
      ) : (
        <Results participant={participant} onNext={nextParticipant} />
      )}
    </section>
  );
}
