import { useState } from 'react';
import type { StorageLike } from '../lib/study';
import { Art } from './Art';
import { Syllabus } from './Lesson';
import { Quiz } from './Quiz';
import { type LessonRecord, readRecord, writeRecord } from './progress';
import { lessonHash } from './routing';
import type { CourseDef } from './types';
import { restoreSummary, type SummaryState } from './widgets/state';

export function Summary({ course, storage, onSaved }: { course: CourseDef; storage: StorageLike | null; onSaved: (ok: boolean) => void }) {
  const key = `${course.id}/summary`;
  const [record, setRecord] = useState<LessonRecord>(() => {
    const saved = readRecord(storage, key);
    return { ...saved, state: restoreSummary(saved.state) };
  });
  const state = record.state as SummaryState;
  const questions = course.summaryQuestions;
  const COUNT = questions.length;
  const right = questions.filter((q, i) => state.checked[i] && state.answers[i] === q.correct).length;
  const missing = course.lessons.filter((lesson) => !readRecord(storage, `${course.id}/${lesson.id}`).done);

  const save = (next: SummaryState) => {
    const allRight = questions.every((q, i) => next.checked[i] && next.answers[i] === q.correct);
    const nextRecord = { ...record, state: next, done: record.done || allRight };
    setRecord(nextRecord);
    onSaved(writeRecord(storage, key, nextRecord));
  };
  const pick = (index: number, option: number) =>
    save({ answers: state.answers.map((a, i) => (i === index ? option : a)), checked: state.checked.map((c, i) => (i === index ? false : c)) });
  const check = (index: number) => save({ ...state, checked: state.checked.map((c, i) => (i === index ? true : c)) });

  return (
    <div className="c-page c-lesson">
      <p className="c-crumbs">
        <a href="#study">← Все курсы</a>
        <span aria-hidden="true">/</span>
        <span>
          Курс {course.number} · {course.title}
        </span>
      </p>

      <header className="c-lesson-hero c-grid-bg">
        <div className="c-lesson-hero-copy">
          <p className="c-eyebrow">Итог курса {course.number}</p>
          <h1 className="c-title c-title--xl">
            {missing.length === 0 ? (
              <>
                Курс <em>пройден</em>
              </>
            ) : (
              <>
                Итог <em>курса</em>
              </>
            )}
          </h1>
          <p className="c-lead">
            {missing.length === 0
              ? 'Все уроки позади. Повторите формулы по шпаргалке и проверьте себя на четырёх итоговых вопросах.'
              : `Осталось уроков: ${missing.length}. Шпаргалка и итоговые вопросы доступны уже сейчас.`}
          </p>
          {missing.length > 0 ? (
            <div className="c-actions">
              {missing.map((lesson) => (
                <a key={lesson.id} className="c-btn c-btn--ghost c-btn--small" href={lessonHash(course, lesson)}>
                  Урок {lesson.number}: {lesson.title}
                </a>
              ))}
            </div>
          ) : null}
        </div>
        <Art size="lesson" src={course.art} alt="" />
      </header>

      <div className="c-lesson-layout">
        <Syllabus course={course} current="summary" storage={storage} />

        <div className="c-lesson-main">
          <section className="c-block" aria-labelledby="sheet-title">
            <h2 className="c-title c-title--md" id="sheet-title">
              Шпаргалка
            </h2>
            <dl className="c-cheatsheet">
              {(course.cheatsheet ?? []).map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.formula}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="c-block" aria-labelledby="final-title">
            <h2 className="c-title c-title--md" id="final-title">
              Итоговая проверка
            </h2>
            <p className="c-status" role="status">
              Верно {right} из {COUNT}
              {right === COUNT ? ' — отлично!' : ''}
            </p>
            <div className="c-summary-list">
              {questions.map((question, index) => (
                <Quiz
                  key={index}
                  question={question}
                  option={state.answers[index]}
                  checked={state.checked[index]}
                  onPick={(option) => pick(index, option)}
                  onCheck={() => check(index)}
                  emptyHint=""
                />
              ))}
            </div>
          </section>

          <section className="c-block c-block--next" aria-labelledby="after-title">
            <h2 className="c-title c-title--md" id="after-title">
              Дальше
            </h2>
            <p className="c-prose-muted">Закрепите материал в больших экспериментах — там больше параметров и данных.</p>
            <div className="c-actions">
              {course.experiments.map((experiment) => (
                <a key={experiment.hash} className="c-btn c-btn--ghost" href={experiment.hash}>
                  {experiment.label}
                </a>
              ))}
              <a className="c-btn" href="#study">
                К каталогу курсов
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
