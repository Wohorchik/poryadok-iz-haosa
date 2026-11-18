import { useEffect, useRef, useState } from 'react';
import { BarChart, LineChart, RangeField, RunControls, Segmented } from '../components/Charts';
import { BoardWithBalls, boardGeometry, useGaltonFlights, type LaunchOptions } from '../components/GaltonBoardView';
import { Readouts } from '../components/Readouts';
import { StatsTable } from '../components/StatsTable';
import { runningMeans, thin } from '../lib/chart';
import {
  NO_DATA,
  equalsSign,
  formatInteger,
  formatOneDecimal,
  formatShare,
  formatStatistic,
  formatSummary,
  plural,
} from '../lib/format';
import {
  LEVELS,
  MAX_LEVELS,
  MIN_LEVELS,
  binOfPath,
  binomialCoefficient,
  binomialDistribution,
  binomialMean,
  binomialVariance,
  simulatePath,
} from '../lib/galton';
import { createRng, newSeed } from '../lib/random';
import { summarizeCounts } from '../lib/statistics';

const pathLetters = (path: readonly boolean[]) => path.map((isRight) => (isRight ? 'П' : 'Л')).join('');

const BATCHES = [
  { size: 1, label: '1 шарик' },
  { size: 10, label: '10 шариков' },
  { size: 100, label: '100 шариков' },
  { size: 1000, label: '1000 шариков' },
] as const;

/** Скорость влияет только на анимацию: пути шариков уже определены в момент запуска. */
function launchOptions(size: number, fast: boolean): LaunchOptions {
  if (size === 1) return { releaseMs: 0, hopMs: fast ? 90 : 220 };
  if (fast) return { releaseMs: Math.min(600, size * 4), hopMs: 45, visibleLimit: 60 };
  return { releaseMs: size <= 10 ? 700 : size <= 100 ? 1200 : 2500, hopMs: 170 };
}

/** Снимок выборки для сравнения. */
interface SavedSample {
  id: number;
  levels: number;
  percent: number;
  size: number;
  mean: number | null;
  standardDeviation: number | null;
}

export interface GaltonReplay {
  id: number;
  path: boolean[];
}

export function GaltonBoard({ active, replay }: { active: boolean; replay?: GaltonReplay | null }) {
  const [levels, setLevels] = useState(LEVELS);
  const [percent, setPercent] = useState(50);
  const [seed, setSeed] = useState(newSeed);
  const [counts, setCounts] = useState<number[]>(() => Array(LEVELS + 1).fill(0));
  const [lastPath, setLastPath] = useState<boolean[] | null>(null);
  const [lastBatch, setLastBatch] = useState<number | null>(null);
  const [fast, setFast] = useState(false);
  const [mode, setMode] = useState<'count' | 'share'>('count');
  const [selectedBin, setSelectedBin] = useState<number | null>(null);
  const [saved, setSaved] = useState<SavedSample[]>([]);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [sampleNumber, setSampleNumber] = useState(1);
  const [replayNote, setReplayNote] = useState<string | null>(null);
  const [pendingReplay, setPendingReplay] = useState<GaltonReplay | null>(null);

  const rngRef = useRef(createRng(seed));
  const observationsRef = useRef<number[]>([]);
  const savedIdRef = useRef(0);

  const geometry = boardGeometry(levels);
  const p = percent / 100;
  const flights = useGaltonFlights(active, geometry, (bins, path) => {
    observationsRef.current.push(...bins);
    setCounts((previous) => {
      const next = [...previous];
      for (const bin of bins) next[bin] += 1;
      return next;
    });
    setLastPath(path);
  });

  const busy = flights.inFlight > 0;
  const total = counts.reduce((sum, value) => sum + value, 0);
  const theory = binomialDistribution(p, levels);
  const summary = summarizeCounts(counts);
  const shown = formatSummary(summary);
  const expected = binomialMean(levels, p);
  const variance = binomialVariance(levels, p);
  const currentKey = `${sampleNumber}:${total}`;
  const canSave = total > 0 && !busy && currentKey !== savedKey;

  /** Новая пустая выборка с заданными параметрами и seed. */
  const restart = (nextLevels: number, nextSeed: number) => {
    flights.cancel();
    rngRef.current = createRng(nextSeed);
    observationsRef.current = [];
    setCounts(Array(nextLevels + 1).fill(0));
    setLastPath(null);
    setLastBatch(null);
    setSelectedBin(null);
    setReplayNote(null);
    setSampleNumber((value) => value + 1);
  };

  const changeLevels = (value: number) => {
    setLevels(value);
    restart(value, seed);
  };
  const changePercent = (value: number) => {
    setPercent(value);
    restart(levels, seed);
  };
  const repeatRun = () => restart(levels, seed);
  const newRun = () => {
    const next = newSeed();
    setSeed(next);
    restart(levels, next);
  };

  const drop = (size: number) => {
    const paths = Array.from({ length: size }, () => simulatePath(p, rngRef.current, levels));
    setLastBatch(size);
    setLastPath(null);
    setReplayNote(null);
    flights.launch(paths, launchOptions(size, fast));
  };

  // Путь из «Случайного блуждания»: сначала перестраиваем доску под его длину, затем проигрываем.
  useEffect(() => {
    if (!replay) return;
    setLevels(replay.path.length);
    restart(replay.path.length, seed);
    setPendingReplay(replay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay?.id]);

  useEffect(() => {
    if (!pendingReplay || pendingReplay.path.length !== levels) return;
    const r = binOfPath(pendingReplay.path);
    setReplayNote(
      `Путь из случайного блуждания: ${pathLetters(pendingReplay.path)}. Правых шагов r = ${r} из ${levels}: положение блуждания 2r − k = ${2 * r - levels}, ячейка доски ${r}.`,
    );
    setLastBatch(1);
    flights.launch([pendingReplay.path], launchOptions(1, false));
    setPendingReplay(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingReplay, levels]);

  const saveSample = () => {
    if (!canSave) return;
    savedIdRef.current += 1;
    setSaved((previous) => [
      ...previous,
      { id: savedIdRef.current, levels, percent, size: total, mean: summary.mean, standardDeviation: summary.standardDeviation },
    ]);
    setSavedKey(currentKey);
  };

  const values = mode === 'count' ? counts : counts.map((count) => (total === 0 ? 0 : (count / total) * 100));
  const theoryValues = theory.map((probability) => (mode === 'count' ? probability * total : probability * 100));
  const chartMax = Math.max(...values, ...theoryValues, mode === 'count' ? 1 : 10);

  const means = runningMeans(observationsRef.current);
  const meanPoints = thin(
    means.map((value, index) => [index + 1, value] as const),
    600,
  );

  let status: string;
  if (replayNote) status = replayNote;
  else if (busy && flights.paused) status = `Пауза. В полёте ${formatInteger(flights.inFlight)} ${plural(flights.inFlight, 'шарик', 'шарика', 'шариков')}.`;
  else if (busy && lastBatch === 1) status = 'Шарик проходит уровни доски.';
  else if (busy) status = `Шарики падают: ещё ${formatInteger(flights.inFlight)} в полёте.`;
  else if (total === 0) status = `Новая выборка: ${levels} уровней, p = ${percent} %. Запустите шарики.`;
  else if (lastBatch !== null && lastBatch > 1)
    status = `Партия из ${formatInteger(lastBatch)} ${plural(lastBatch, 'шарика', 'шариков', 'шариков')} приземлилась. Всего шариков: ${formatInteger(total)}.`;
  else if (lastPath) {
    const bin = binOfPath(lastPath);
    status = `Последний путь ${pathLetters(lastPath)}: ${bin} ${plural(bin, 'поворот', 'поворота', 'поворотов')} вправо, ячейка ${bin}.`;
  } else status = '';

  const bins = Array.from({ length: levels + 1 }, (_, bin) => bin);
  const selected = selectedBin !== null && selectedBin <= levels ? selectedBin : null;

  return (
    <section className="experiment experiment--galton" id="panel-galton" hidden={!active}>
      <div className="experiment-head">
        <h2>Доска Гальтона</h2>
        <p className="action-line">Нажми «100 шариков» и посмотри, в каких ячейках они соберутся.</p>
      </div>

      <div className="viz-column galton-stack">
        <div className="viz-group" data-testid="galton-group">
          <BoardWithBalls geometry={geometry} lastPath={busy ? null : lastPath} canvasRef={flights.canvasRef} selectedBin={selected} />
          <p className="status galton-status" aria-live={busy ? 'off' : 'polite'} data-testid="galton-status">
            {status}
          </p>
          <div className="chart-toolbar">
            <Segmented
              legend="Шкала распределения"
              options={[
                { value: 'count', label: 'Количество' },
                { value: 'share', label: 'Доля, %' },
              ]}
              value={mode}
              onChange={setMode}
            />
          </div>
          <BarChart
            values={values}
            labels={bins}
            theory={theoryValues}
            maximum={chartMax}
            formatTick={(tick) => (mode === 'count' ? formatInteger(tick) : `${formatInteger(tick)} %`)}
            selected={selected}
            onSelect={(bin) => setSelectedBin(bin === selected ? null : bin)}
            ariaLabel={`Распределение шариков по ${levels + 1} ячейкам и ожидаемое биномиальное распределение`}
            barLabel={(bin) => `Ячейка ${bin}: ${counts[bin]} ${plural(counts[bin], 'шарик', 'шарика', 'шариков')}`}
            labelEvery={levels > 12 ? 2 : 1}
          />
          <div className="chart-legend">
            <span className="legend-bar">Фактически: {mode === 'count' ? 'число шариков' : 'доля шариков, %'}</span>
            <span className="legend-theory legend-theory--outline">
              Ожидалось: {mode === 'count' ? 'N · P(ячейка)' : 'P(ячейка), %'} при m = {levels}, p = {percent}&nbsp;%
            </span>
          </div>
          <p className="bin-info" data-testid="galton-bin-info" aria-live="polite">
            {selected === null
              ? 'Нажмите на столбец, чтобы сравнить факт и ожидание в ячейке.'
              : mode === 'count'
                ? `Ячейка ${selected} · фактически ${formatInteger(counts[selected])} · ожидалось ${formatStatistic(theory[selected] * total)}`
                : `Ячейка ${selected} · фактически ${total === 0 ? NO_DATA.toLowerCase() : formatShare(counts[selected] / total)} · ожидалось ${formatOneDecimal(theory[selected] * 100)} %`}
          </p>
        </div>
      </div>

      <div className="side-column">

        <div className="actions actions--four">
          {BATCHES.map(({ size, label }) => (
            <button
              key={size}
              className={lastBatch === size ? 'btn btn--primary' : 'btn'}
              type="button"
              aria-current={lastBatch === size ? 'true' : undefined}
              data-testid={`galton-run-${size}`}
              disabled={busy}
              onClick={() => drop(size)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="actions actions--two">
          <button className="btn" type="button" disabled={!busy} onClick={() => flights.setPaused(!flights.paused)}>
            {flights.paused ? 'Продолжить' : 'Пауза'}
          </button>
          <button className="btn btn--quiet" type="button" onClick={newRun}>
            Сбросить
          </button>
        </div>
        <Readouts
          items={[
            { label: 'Всего шариков', value: formatInteger(total), tone: 'amber', testId: 'galton-total' },
            { label: 'Последняя партия', value: lastBatch === null ? '—' : formatInteger(lastBatch), tone: 'cyan', testId: 'galton-last-batch' },
          ]}
        />
        <p className="balance" data-testid="galton-batch">
          Последняя партия — {lastBatch === null ? 'нет' : formatInteger(lastBatch)}, всего шариков — {formatInteger(total)}
        </p>
        <label className="check">
          <input type="checkbox" checked={fast} onChange={(event) => setFast(event.target.checked)} />
          <span>Быстрый режим: короткий полёт, на доске видна часть траекторий. Учитываются все шарики.</span>
        </label>

        <RangeField id="galton-levels" label="Число уровней m" value={levels} min={MIN_LEVELS} max={MAX_LEVELS} onChange={changeLevels} display={String(levels)} />
        <RangeField id="galton-p" label="Вероятность поворота вправо p" value={percent} min={0} max={100} onChange={changePercent} display={`${percent} %`} />
        <p className="hint">Изменение параметров начинает новую выборку.</p>

        <StatsTable
          title={`Выборка: m = ${levels}, p = ${percent} %`}
          rows={[
            { label: 'Объём N', value: shown.size, testId: 'galton-stat-size' },
            { label: 'Среднее x̄', value: shown.mean, theory: `E(X) = mp ${equalsSign(expected)} ${formatStatistic(expected)}`, testId: 'galton-stat-mean' },
            { label: 'Медиана', value: shown.median, testId: 'galton-stat-median' },
            { label: summary.modes.length > 1 ? 'Моды' : 'Мода', value: shown.modes, testId: 'galton-stat-mode' },
            {
              label: (
                <>
                  Исправленная дисперсия s<sup>2</sup>
                </>
              ),
              value: shown.variance,
              theory: `D(X) = mp(1 − p) ${equalsSign(variance)} ${formatStatistic(variance)}`,
              testId: 'galton-stat-variance',
            },
            {
              label: 'Стандартное отклонение s',
              value: shown.standardDeviation,
              theory: `√D(X) ${equalsSign(Math.sqrt(variance))} ${formatStatistic(Math.sqrt(variance))}`,
              testId: 'galton-stat-deviation',
            },
          ]}
        />
        <button className="btn" type="button" disabled={!canSave} onClick={saveSample}>
          Сохранить выборку
        </button>

        <RunControls seed={seed} onRepeat={repeatRun} onNew={newRun} />
      </div>

      <div className="bin-tables">
        <LineChart
          series={[
            { points: meanPoints, className: 'series-amber', label: 'Накопленное среднее выборки' },
            { points: [[0, expected], [Math.max(1, total), expected]], className: 'series-cyan', label: `E(X) = mp = ${formatStatistic(expected)}`, kind: 'dashed' },
          ]}
          xDomain={[0, Math.max(1, total)]}
          yDomain={[0, levels]}
          xLabel="Число учтённых шариков (в порядке приземления)"
          yLabel="Накопленное среднее, номер ячейки"
          formatX={formatInteger}
          ariaLabel="График накопленного среднего и теоретического значения"
        />
        {saved.length > 0 ? (
          <section className="stats-panel" aria-labelledby="galton-compare-title">
            <h3 id="galton-compare-title">Сохранённые выборки</h3>
            <div className="table-scroll">
              <table className="data-table compare-table" data-testid="galton-compare">
                <thead>
                  <tr>
                    <th scope="col">№</th>
                    <th scope="col">m</th>
                    <th scope="col">p</th>
                    <th scope="col">N</th>
                    <th scope="col">x̄</th>
                    <th scope="col">E(X)</th>
                    <th scope="col">|x̄ − E(X)|</th>
                    <th scope="col">s</th>
                    <th scope="col">√D(X)</th>
                  </tr>
                </thead>
                <tbody>
                  {saved.map((sample, index) => {
                    const e = binomialMean(sample.levels, sample.percent / 100);
                    return (
                      <tr key={sample.id}>
                        <th scope="row">{index + 1}</th>
                        <td>{sample.levels}</td>
                        <td>{sample.percent}&nbsp;%</td>
                        <td>{formatInteger(sample.size)}</td>
                        <td className="tone-amber">{sample.mean === null ? NO_DATA : formatStatistic(sample.mean)}</td>
                        <td className="tone-cyan">{formatStatistic(e)}</td>
                        <td>{sample.mean === null ? NO_DATA : formatStatistic(Math.abs(sample.mean - e))}</td>
                        <td>{sample.standardDeviation === null ? '—' : formatStatistic(sample.standardDeviation)}</td>
                        <td className="tone-cyan">{formatStatistic(Math.sqrt(binomialVariance(sample.levels, sample.percent / 100)))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button className="btn btn--quiet compare-clear" type="button" onClick={() => setSaved([])}>
              Очистить сохранённые
            </button>
          </section>
        ) : null}

        <details className="more">
          <summary>Таблица по ячейкам</summary>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Ячейка</th>
                  <th scope="col">Шарики</th>
                  <th scope="col">Доля, %</th>
                  <th scope="col">Теория, %</th>
                  <th scope="col">Путей C(m, k)</th>
                </tr>
              </thead>
              <tbody>
                {bins.map((bin) => (
                  <tr key={bin}>
                    <th scope="row">{bin}</th>
                    <td data-testid={`galton-count-${bin}`}>{formatInteger(counts[bin])}</td>
                    <td>{total === 0 ? '—' : formatOneDecimal((counts[bin] / total) * 100)}</td>
                    <td className="tone-cyan" data-testid={`galton-theory-${bin}`}>
                      {formatStatistic(theory[bin] * 100)}
                    </td>
                    <td>{formatInteger(binomialCoefficient(levels, bin))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <details className="more">
          <summary>Формулы и объяснение</summary>
          <div className="more-body">
            <p>
              Каждый путь из m поворотов, в котором ровно k поворотов вправо, имеет вероятность p<sup>k</sup>(1 − p)
              <sup>m−k</sup>. Таких путей C(m, k), поэтому P(X = k) = C(m, k) · p<sup>k</sup>(1 − p)<sup>m−k</sup>.
            </p>
            <p>
              При m = 8 и p = 50&nbsp;% в центральную ячейку 4 ведут C(8, 4) = 70 путей из 256, её вероятность 70/256 ≈ 27,3&nbsp;%. Среднее
              E(X) = mp = 4, дисперсия D(X) = mp(1 − p) = 2.
            </p>
            <p>
              Накопленное среднее колеблется вокруг E(X) и с ростом N обычно приближается к нему. Это закономерность для
              больших выборок, а не гарантия для каждого отдельного шага.
            </p>
          </div>
        </details>
      </div>
    </section>
  );
}
