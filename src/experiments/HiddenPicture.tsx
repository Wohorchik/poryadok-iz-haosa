import { useEffect, useId, useRef, useState } from 'react';
import { Readouts } from '../components/Readouts';
import { useFrameLoop } from '../hooks/useFrameLoop';
import { formatInteger, formatOneDecimal, formatThreeDecimals, plural } from '../lib/format';
import {
  CELL_COUNT,
  FORECAST_ATTEMPTS,
  GRID_SIZE,
  applyAttempt,
  createPictureState,
  expectedOpened,
  missProbability,
  parseForecast,
  type PictureState,
} from '../lib/hiddenPicture';
import { ART_SIZE, buildLighthousePixels } from '../lib/lighthouseArt';
import { randomIndex } from '../lib/random';

const BATCH_SIZE = 100;
const ATTEMPT_MS = 28;

const cellWord = (value: number) => plural(value, 'клетка', 'клетки', 'клеток');

function LighthouseCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    const image = context.createImageData(ART_SIZE, ART_SIZE);
    image.data.set(buildLighthousePixels());
    context.putImageData(image, 0, 0);
  }, []);

  return <canvas ref={canvasRef} className="picture-art" width={ART_SIZE} height={ART_SIZE} />;
}

function describeAttempt(state: PictureState): string {
  if (state.lastCell === null) return 'Все клетки закрыты. Запустите первую попытку.';
  const row = Math.floor(state.lastCell / GRID_SIZE) + 1;
  const column = (state.lastCell % GRID_SIZE) + 1;
  const outcome = state.lastWasRepeat ? 'Клетка уже была открыта, это повтор.' : 'Открыта новая клетка.';
  return `Попытка ${formatInteger(state.attempts)}: строка ${row}, столбец ${column}. ${outcome}`;
}

function ForecastResult({ forecast, actual }: { forecast: number; actual: number }) {
  const difference = Math.abs(forecast - actual);
  return (
    <div className="verdict" data-testid="forecast-result">
      <p className="verdict-title">
        {difference === 0
          ? 'Прогноз совпал с результатом'
          : `Прогноз отличается на ${difference} ${cellWord(difference)}`}
      </p>
      <p>
        Прогноз: {forecast}. На сотой попытке открыто: {actual}.
      </p>
    </div>
  );
}

export function HiddenPicture({ active }: { active: boolean }) {
  const [state, setState] = useState<PictureState>(createPictureState);
  const [batchLeft, setBatchLeft] = useState(0);
  const [forecastText, setForecastText] = useState('');
  const [lockedForecast, setLockedForecast] = useState<number | null>(null);
  const [showForecastError, setShowForecastError] = useState(false);

  const stateRef = useRef(state);
  const batchRef = useRef(0);
  const timeBank = useRef(0);
  const forecastInput = useRef<HTMLInputElement>(null);
  const forecastHintId = useId();

  const parsedForecast = parseForecast(forecastText);
  const isBatchRunning = batchLeft > 0;
  const hasStarted = state.attempts > 0;

  const commit = (next: PictureState) => {
    stateRef.current = next;
    setState(next);
  };

  /** Прогноз фиксируется перед самой первой попыткой опыта. */
  const prepareRun = (): boolean => {
    if (stateRef.current.attempts > 0) return true;
    if (!parsedForecast.ok) {
      setShowForecastError(true);
      forecastInput.current?.focus();
      return false;
    }
    setLockedForecast(parsedForecast.value);
    return true;
  };

  const runOne = () => {
    if (!prepareRun()) return;
    commit(applyAttempt(stateRef.current, randomIndex(CELL_COUNT)));
  };

  const runBatch = () => {
    if (!prepareRun()) return;
    batchRef.current = BATCH_SIZE;
    timeBank.current = ATTEMPT_MS;
    setBatchLeft(BATCH_SIZE);
  };

  const reset = () => {
    batchRef.current = 0;
    timeBank.current = 0;
    setBatchLeft(0);
    commit(createPictureState());
    setForecastText('');
    setLockedForecast(null);
    setShowForecastError(false);
  };

  useFrameLoop(active && isBatchRunning, (elapsed) => {
    timeBank.current += elapsed;
    let next = stateRef.current;
    while (timeBank.current >= ATTEMPT_MS && batchRef.current > 0) {
      next = applyAttempt(next, randomIndex(CELL_COUNT));
      batchRef.current -= 1;
      timeBank.current -= ATTEMPT_MS;
    }
    commit(next);
    setBatchLeft(batchRef.current);
  });

  const forecastError = !parsedForecast.ok && (showForecastError || forecastText.trim() !== '') ? parsedForecast.error : null;

  return (
    <section
      className="experiment experiment--picture"
      id="panel-picture"
      role="tabpanel"
      aria-labelledby="tab-picture"
      hidden={!active}
    >
      <div className="experiment-head">
        <h2>Скрытая картинка</h2>
        <p>Каждая попытка выбирает одну из 100 клеток с равными шансами. Открытая клетка тоже может выпасть снова.</p>
      </div>

      <div className="viz-column">
        <div className="viz-pin">
        <div className="picture" role="img" aria-label={`Пиксельный маяк под сеткой 10 на 10. Открыто клеток: ${state.openedCount} из 100.`}>
          <LighthouseCanvas />
          <div className="picture-grid">
            {state.opened.map((isOpen, index) => (
              <span className={isOpen ? 'cover cover--open' : 'cover'} data-open={isOpen} key={index} />
            ))}
            {state.lastCell !== null ? (
              <span
                key={state.attempts}
                className={state.lastWasRepeat ? 'cell-mark cell-mark--repeat' : 'cell-mark'}
                style={{
                  top: `${Math.floor(state.lastCell / GRID_SIZE) * 10}%`,
                  left: `${(state.lastCell % GRID_SIZE) * 10}%`,
                }}
              />
            ) : null}
          </div>
        </div>
        <p className="status" aria-live={isBatchRunning ? 'off' : 'polite'} data-testid="picture-status">
          {describeAttempt(state)}
        </p>
        </div>
      </div>

      <div className="side-column">
        <Readouts
          items={[
            { label: 'Попытки', value: formatInteger(state.attempts), testId: 'picture-attempts' },
            { label: 'Открыто клеток', value: formatInteger(state.openedCount), tone: 'amber', testId: 'picture-opened' },
            { label: 'Повторы', value: formatInteger(state.repeats), tone: 'coral', testId: 'picture-repeats' },
            { label: 'Открыто изображения', value: `${state.openedCount} %`, tone: 'cyan', testId: 'picture-percent' },
          ]}
        />
        <p className="balance" data-testid="picture-balance">
          Открыто {formatInteger(state.openedCount)} + повторов {formatInteger(state.repeats)} = попыток{' '}
          {formatInteger(state.attempts)}
        </p>

        <div className="field">
          <label htmlFor="forecast">Сколько клеток откроется за 100 попыток?</label>
          <input
            ref={forecastInput}
            id="forecast"
            className="input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="необязательно, от 0 до 100"
            value={hasStarted ? (lockedForecast?.toString() ?? '') : forecastText}
            disabled={hasStarted || isBatchRunning}
            aria-invalid={forecastError !== null}
            aria-describedby={forecastHintId}
            onChange={(event) => {
              setForecastText(event.target.value);
              setShowForecastError(false);
            }}
          />
          <p className={forecastError ? 'hint hint--error' : 'hint'} id={forecastHintId} role={forecastError ? 'alert' : undefined}>
            {forecastError ??
              (hasStarted
                ? lockedForecast === null
                  ? 'Прогноз вводится до первой попытки. Сбросьте опыт, чтобы ввести его.'
                  : 'Прогноз принят и не меняется до сброса.'
                : 'Необязательное поле. Прогноз принимается до первой попытки.')}
          </p>
        </div>

        <div className="actions">
          <button className="btn" type="button" disabled={isBatchRunning} onClick={runOne}>
            1 попытка
          </button>
          <button className="btn btn--primary" type="button" disabled={isBatchRunning} onClick={runBatch}>
            100 попыток
          </button>
          <button className="btn btn--quiet" type="button" onClick={reset}>
            Сбросить
          </button>
        </div>

        {lockedForecast !== null && state.openedAtForecast !== null ? (
          <ForecastResult forecast={lockedForecast} actual={state.openedAtForecast} />
        ) : null}
        {lockedForecast !== null && state.openedAtForecast === null && hasStarted ? (
          <p className="hint">
            Сравнение с прогнозом появится на сотой попытке. Осталось попыток: {FORECAST_ATTEMPTS - state.attempts}.
          </p>
        ) : null}

        {hasStarted ? (
          <section className="explain" data-testid="picture-explanation">
            <h3>Почему открывается не вся картинка</h3>
            <p>
              Вероятность того, что конкретная клетка ни разу не выпадет за n попыток, равна (99/100)
              <sup>n</sup>.
            </p>
            <p>
              Сейчас n = {formatInteger(state.attempts)}: вероятность равна{' '}
              {formatThreeDecimals(missProbability(state.attempts))}, а в среднем открылось бы{' '}
              {formatOneDecimal(expectedOpened(state.attempts))} из 100 клеток.
            </p>
            <p>
              При 100 попытках в среднем открывается около 63,4 клетки. Это среднее по множеству запусков, а результат
              одного запуска определяется случайными выборами.
            </p>
          </section>
        ) : null}
      </div>
    </section>
  );
}
