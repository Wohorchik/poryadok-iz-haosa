import { useId } from 'react';
import type { QuizQuestion } from './math';

/** Вопрос с тремя вариантами: выбор, проверка, разбор. После неверного ответа можно выбрать снова. */
export function Quiz({
  question,
  option,
  checked,
  onPick,
  onCheck,
  emptyHint,
}: {
  question: QuizQuestion | null;
  option: number | null;
  checked: boolean;
  onPick: (index: number) => void;
  onCheck: () => void;
  emptyHint: string;
}) {
  const name = useId();
  if (!question) return <p className="c-quiz-empty">{emptyHint}</p>;
  const right = checked && option === question.correct;
  return (
    <div className="c-quiz">
      <fieldset>
        <legend className="c-quiz-text">{question.text}</legend>
        <div className="c-options">
          {question.options.map((text, index) => {
            const state = checked && index === option ? (index === question.correct ? 'ok' : 'bad') : '';
            return (
              <label key={index} className={'c-option' + (state ? ' c-option--' + state : '')}>
                <input type="radio" name={name} checked={option === index} onChange={() => onPick(index)} />
                <span className="c-option-mark" aria-hidden="true" />
                <span>{text}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {!right ? (
        <button type="button" className="c-btn" disabled={option === null || checked} onClick={onCheck}>
          Проверить ответ
        </button>
      ) : null}
      {checked ? (
        <div className={'c-verdict ' + (right ? 'c-verdict--ok' : 'c-verdict--bad')} role="status">
          <strong>{right ? 'Верно' : 'Не совсем. Выберите другой вариант'}</strong>
          <p>{question.explanation}</p>
        </div>
      ) : null}
    </div>
  );
}
