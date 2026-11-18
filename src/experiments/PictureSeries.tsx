import { useRef, useState, type CSSProperties } from 'react';
import { RunControls } from '../components/Charts';
import { Reveal } from '../components/Reveal';
import { StatsTable } from '../components/StatsTable';
import { useFrameLoop } from '../hooks/useFrameLoop';
import { countAxis } from '../lib/statistics';
import { downloadCsv } from '../lib/csv';
import { formatInteger, formatOneDecimal, formatStatistic, formatSummary, plural } from '../lib/format';
import { SERIES_SIZES, expectedOpened, runPictureTrial, seriesHistogram, seriesToCsv, type TrialResult } from '../lib/hiddenPicture';
import { createRng, newSeed, type RandomSource } from '../lib/random';
import { summarize } from '../lib/statistics';

/** Серия рассчитывается примерно за 40 кадров, чтобы интерфейс не замирал. */
const FRAMES_PER_SERIES = 40;
const FRAME_BUDGET_MS = 8;
const MAX_ATTEMPTS = 20000;

const experimentWord = (value: number) => plural(value, 'опыт', 'опыта', 'опытов');

function SeriesChart({ values, theory }: { values: readonly number[]; theory: number }) {
  const { from, width, counts } = seriesHistogram(values, theory);
  const { maximum, step } = countAxis(Math.max(...counts));
  const ticks = Array.from({ length: maximum / step + 1 }, (_, index) => index * step);
  const theoryLeft = ((theory - from + 0.5) / (counts.length * width)) * 100;
  const frequencySum = counts.reduce((sum, count) => sum + count, 0);
  const labelEvery = Math.max(1, Math.ceil(counts.length / 12));
  const label = (index: number) => (width === 1 ? `${from + index}` : `${from + index * width}–${from + index * width + width - 1}`);

  return (
    <figure className="series-chart">
      <p className="series-axis-title" aria-hidden="true">
        В скольких опытах
      </p>
      <div
        className="chart series-plot"
        style={{ '--bins': counts.length } as CSSProperties}
        role="img"
        aria-label={`Диаграмма: сколько клеток открылось и в скольких опытах. Сумма частот ${frequencySum}.`}
      >
        <div className="chart-axis" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} style={{ bottom: `${(tick / maximum) * 100}%` }}>
              {formatInteger(tick)}
            </span>
          ))}
        </div>
        <div className="chart-plot" aria-hidden="true">
          {ticks.map((tick) => (
            <span className="chart-line" key={tick} style={{ bottom: `${(tick / maximum) * 100}%` }} />
          ))}
          {counts.map((count, index) => (
            <div className="chart-column" key={index} title={`${label(index)} клеток: ${count} ${experimentWord(count)}`}>
              <span className="chart-bar series-bar" data-count={count} style={{ height: `${(count / maximum) * 100}%` }} />
            </div>
          ))}
          <span className="series-theory" style={{ left: `${theoryLeft}%` }}>
            <span className="series-theory-label">{formatOneDecimal(theory)}</span>
          </span>
        </div>
      </div>
      <div className="series-x" style={{ '--bins': counts.length } as CSSProperties} aria-hidden="true">
        {counts.map((_, index) => (
          <span key={index}>{index % labelEvery === 0 ? (width === 1 ? from + index : from + index * width) : ''}</span>
        ))}
      </div>
      <figcaption className="series-axis-title series-axis-title--x">
        Сколько клеток открылось{width > 1 ? ` (интервалы по ${width})` : ''}
      </figcaption>
      <div className="chart-legend series-legend">
        <span className="legend-bar">Число опытов с таким результатом</span>
        <span className="legend-theory legend-theory--vertical">Теоретический ориентир {formatOneDecimal(theory)}</span>
        <span data-testid="series-frequency-sum">Сумма частот: {formatInteger(frequencySum)}</span>
      </div>
    </figure>
  );
}

export function PictureSeries({ active, size }: { active: boolean; size: number }) {
  const cells = size * size;
  const [attemptsText, setAttemptsText] = useState(String(cells));
  const [results, setResults] = useState<readonly TrialResult[]>([]);
  const [target, setTarget] = useState(0);
  const [runAttempts, setRunAttempts] = useState(cells);
  const [seed, setSeed] = useState(newSeed);
  const resultsRef = useRef<TrialResult[]>([]);
  const rngRef = useRef<RandomSource>(createRng(seed));

  const parsedAttempts = Number(attemptsText);
  const attemptsOk = /^\d+$/.test(attemptsText.trim()) && parsedAttempts >= 1 && parsedAttempts <= MAX_ATTEMPTS;
  const running = results.length < target;
  const done = target > 0 && !running;
  const values = results.map((result) => result.opened);
  const summary = summarize(values);
  const shown = formatSummary(summary);
  const theory = expectedOpened(runAttempts, cells);

  const start = (count: number, runSeed: number = seed) => {
    if (!attemptsOk) return;
    rngRef.current = createRng(runSeed);
    resultsRef.current = [];
    setResults([]);
    setRunAttempts(parsedAttempts);
    setTarget(count);
  };

  const reset = () => {
    resultsRef.current = [];
    setResults([]);
    setTarget(0);
  };

  useFrameLoop(active && running, () => {
    const started = performance.now();
    const portion = Math.max(1, Math.ceil(target / FRAMES_PER_SERIES));
    const next = resultsRef.current.slice();
    let made = 0;
    while (next.length < target && made < portion && (made === 0 || performance.now() - started < FRAME_BUDGET_MS)) {
      next.push(runPictureTrial(rngRef.current, cells, runAttempts));
      made += 1;
    }
    resultsRef.current = next;
    setResults(next);
  });

  let status: string;
  if (target === 0) status = 'Выберите число попыток в опыте и число опытов.';
  else if (running) status = `Идёт серия: ${formatInteger(results.length)} из ${formatInteger(target)} ${experimentWord(target)}.`;
  else
    status = `Серия из ${formatInteger(results.length)} ${plural(results.length, 'опыта', 'опытов', 'опытов')} завершена. В каждом опыте — ${formatInteger(runAttempts)} ${plural(runAttempts, 'попытка', 'попытки', 'попыток')} на новом закрытом поле ${size}×${size}.`;

  return (
    <section className="notes series" aria-labelledby="series-title" data-testid="picture-series">
      <div className="series-head">
        <h3 id="series-title">Серия независимых опытов</h3>
        <p>
          Кнопки попыток выше открывают клетки на одной картинке. В серии каждый опыт начинается с полностью закрытого
          поля {size}×{size}, и в нём делается заданное число попыток. Результат опыта — сколько разных клеток открылось.
        </p>
      </div>

      <div className="series-main">
        <SeriesChart values={values} theory={theory} />
      </div>

      <div className="series-side">
        <div className="field">
          <label htmlFor="series-attempts">Попыток в одном опыте</label>
          <input
            id="series-attempts"
            className="input input--short"
            type="text"
            inputMode="numeric"
            value={attemptsText}
            disabled={running}
            aria-invalid={!attemptsOk}
            onChange={(event) => setAttemptsText(event.target.value)}
          />
          <p className={attemptsOk ? 'hint' : 'hint hint--error'}>
            {attemptsOk ? `Поле ${size}×${size} = ${formatInteger(cells)} клеток.` : `Введите целое число от 1 до ${formatInteger(MAX_ATTEMPTS)}.`}
          </p>
        </div>
        <fieldset className="segmented">
          <legend>Число опытов</legend>
          <div className="actions">
            {SERIES_SIZES.map((count) => (
              <button
                key={count}
                className={count === target ? 'btn btn--primary' : 'btn'}
                type="button"
                aria-current={count === target ? 'true' : undefined}
                data-testid={`series-run-${count}`}
                disabled={running || !attemptsOk}
                onClick={() => start(count)}
              >
                {count} {experimentWord(count)}
              </button>
            ))}
            <button className="btn btn--quiet series-reset" type="button" disabled={target === 0} onClick={reset}>
              Сбросить серию
            </button>
          </div>
        </fieldset>
        <p className="status" aria-live={running ? 'off' : 'polite'} data-testid="series-status">
          {status}
        </p>

        <StatsTable
          title="Характеристики серии"
          rows={[
            { label: 'Число опытов N', value: shown.size, testId: 'series-stat-size' },
            {
              label: 'Среднее',
              value: shown.mean,
              theory: `M(1 − (1 − 1/M)^k) ≈ ${formatOneDecimal(theory)}`,
              testId: 'series-stat-mean',
            },
            { label: 'Медиана', value: shown.median, testId: 'series-stat-median' },
            { label: 'Стандартное отклонение s', value: shown.standardDeviation, testId: 'series-stat-deviation' },
          ]}
        />
        {summary.mean !== null ? (
          <p className="hint">Разница между средним серии и ориентиром: {formatStatistic(Math.abs(summary.mean - theory))}.</p>
        ) : null}

        <button
          className="btn"
          type="button"
          disabled={!done}
          onClick={() => downloadCsv(`skrytaya-kartinka-${size}x${size}-seriya-${results.length}.csv`, seriesToCsv(results, cells))}
        >
          Скачать CSV
        </button>
        <p className="hint">Одна строка файла — один опыт: номер, клеток в поле, попытки, открытые клетки и повторы.</p>

        <RunControls
          seed={seed}
          onRepeat={() => (target > 0 ? start(target, seed) : reset())}
          onNew={() => {
            const next = newSeed();
            setSeed(next);
            if (target > 0) start(target, next);
            else reset();
          }}
        />

        <Reveal
          question={`Почему среднее может быть дробным, например ${formatOneDecimal(theory)}, хотя ни в одном опыте нельзя открыть дробное число клеток?`}
          openLabel="Показать ответ"
          closeLabel="Скрыть ответ"
        >
          <p>
            Каждый опыт даёт целое число клеток, но среднее — это сумма результатов, делённая на число опытов. Например, если
            в двух опытах открылось 63 и 64 клетки, среднее равно 63,5.
          </p>
          <p>
            Ориентир M(1 − (1 − 1/M)<sup>k</sup>) — ожидаемое значение: центр, вокруг которого собираются результаты многих
            опытов. При поле 10×10 и 100 попытках это около 63,4 клетки.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
