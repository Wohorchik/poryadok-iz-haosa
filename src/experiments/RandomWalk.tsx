import { useEffect, useMemo, useRef, useState } from 'react';
import { RangeField, RunControls, Segmented } from '../components/Charts';
import { useElementWidth } from '../hooks/useElementWidth';
import { useFrameLoop } from '../hooks/useFrameLoop';
import { formatInteger, formatStatistic, plural } from '../lib/format';
import { MAX_LEVELS, MIN_LEVELS } from '../lib/galton';
import { createRng, newSeed } from '../lib/random';
import {
  completedDistribution,
  completedPaths,
  generateWalks,
  pathProgress,
  positionAt,
  positionTable,
  rightSteps,
  toBooleans,
  walkEnd,
  walkMean,
  walkStagger,
  walkVariance,
  type WalkSet,
} from '../lib/randomWalk';
import { summarize } from '../lib/statistics';

const COUNTS = [1, 10, 100, 1000] as const;
const SPEEDS = [
  { label: 'Медленно', stepMs: 700 },
  { label: 'Средне', stepMs: 180 },
  { label: 'Быстро', stepMs: 35 },
] as const;
const DRAW_LIMIT = 300;
const PLOT_LEFT = 44;
const PLOT_RIGHT = 14;
const PLOT_BOTTOM = 30;
const PLOT_TOP = 12;

const signed = (value: number) => (value > 0 ? `+${formatStatistic(value)}` : formatStatistic(value));

interface Prepared {
  walks: WalkSet;
  tables: Int16Array[];
  stagger: number;
  end: number;
  /** Пределы оси положения на весь запуск: траектория не прыгает при перерисовке. */
  yMax: number;
}

function prepare(count: number, steps: number, p: number, seed: number): Prepared {
  const walks = generateWalks(count, steps, p, createRng(seed));
  const tables = walks.paths.map(positionTable);
  let maxAbs = Math.abs(walkMean(steps, p));
  for (const table of tables) for (const value of table) maxAbs = Math.max(maxAbs, Math.abs(value));
  return {
    walks,
    tables,
    stagger: walkStagger(count, steps),
    end: walkEnd(count, steps),
    yMax: Math.max(4, Math.ceil(maxAbs)),
  };
}

function drawScene(
  canvas: HTMLCanvasElement | null,
  width: number,
  height: number,
  run: Prepared,
  clock: number,
  completed: number,
  selectedFinal: number | null,
  replay: { index: number; clock: number } | null,
) {
  if (!canvas) return;
  const ratio = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  const styles = getComputedStyle(canvas);
  const color = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  const { walks, tables, stagger, yMax } = run;
  const steps = walks.steps;
  const plotWidth = width - PLOT_LEFT - PLOT_RIGHT;
  const plotHeight = height - PLOT_TOP - PLOT_BOTTOM;
  const px = (step: number) => PLOT_LEFT + (step / Math.max(1, steps)) * plotWidth;
  const py = (position: number) => PLOT_TOP + ((yMax - position) / (2 * yMax)) * plotHeight;

  // Сетка и подписи осей.
  context.font = '12px "Golos Text", sans-serif';
  context.fillStyle = color('--mist', '#c0cee5');
  context.strokeStyle = color('--rule', '#34507f');
  context.lineWidth = 1;
  const yStep = yMax <= 6 ? 1 : yMax <= 12 ? 2 : yMax <= 30 ? 5 : 10;
  context.textAlign = 'right';
  context.textBaseline = 'middle';
  for (let value = -Math.floor(yMax / yStep) * yStep; value <= yMax; value += yStep) {
    context.globalAlpha = value === 0 ? 0.9 : 0.35;
    context.beginPath();
    context.moveTo(PLOT_LEFT, py(value));
    context.lineTo(PLOT_LEFT + plotWidth, py(value));
    context.stroke();
    context.globalAlpha = 1;
    context.fillText(value > 0 ? `+${value}` : String(value), PLOT_LEFT - 6, py(value));
  }
  const xStep = steps <= 10 ? 1 : steps <= 20 ? 2 : steps <= 50 ? 5 : 10;
  context.textAlign = 'center';
  context.textBaseline = 'top';
  for (let step = 0; step <= steps; step += xStep) context.fillText(String(step), px(step), PLOT_TOP + plotHeight + 6);

  const lamp = color('--lamp', '#ffc53d');
  const water = color('--water', '#62dceb');
  const mist = color('--rule-strong', '#7d97c2');
  const line = (table: ArrayLike<number>, progress: number, stroke: string, widthPx: number, alpha: number, dash: number[] = []) => {
    if (progress <= 0) return;
    context.globalAlpha = alpha;
    context.strokeStyle = stroke;
    context.lineWidth = widthPx;
    context.setLineDash(dash);
    context.beginPath();
    context.moveTo(px(0), py(table[0]));
    const whole = Math.floor(progress + 1e-9);
    for (let step = 1; step <= whole; step += 1) context.lineTo(px(step), py(table[step]));
    if (progress > whole) context.lineTo(px(progress), py(positionAt(table, progress)));
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = 1;
  };

  // Теория E(S_k) = k(2p − 1) — пунктир.
  const theory = Array.from({ length: steps + 1 }, (_, step) => walkMean(step, walks.p));
  line(theory, steps, water, 2, 0.9, [8, 6]);

  const drawn = Math.min(DRAW_LIMIT, tables.length);
  const faint = Math.max(0.08, 0.55 / Math.sqrt(drawn));
  for (let index = drawn - 1; index >= 1; index -= 1) {
    const progress = pathProgress(clock, index, stagger, steps);
    const highlighted = selectedFinal !== null && index < completed && walks.finals[index] === selectedFinal;
    if (!highlighted) line(tables[index], progress, mist, 1, selectedFinal === null ? faint : 0.06);
  }
  if (selectedFinal !== null) {
    for (let index = 1; index < drawn; index += 1) {
      if (index < completed && walks.finals[index] === selectedFinal) line(tables[index], steps, lamp, 1.5, 0.75);
    }
  }
  if (completed === tables.length && tables.length > 1) {
    const means = Array.from(walks.sums, (sum) => sum / tables.length);
    line(means, steps, color('--paper', '#f3f7ff'), 2.5, 0.95);
  }

  // Первый путь (или повторяемый) — ярко и с маркером.
  const focus = replay ? replay.index : 0;
  const focusProgress = replay ? replay.clock : pathProgress(clock, 0, stagger, steps);
  line(tables[focus], focusProgress, lamp, 3, 1);
  context.fillStyle = lamp;
  context.strokeStyle = color('--deep', '#071530');
  context.lineWidth = 2;
  context.beginPath();
  context.arc(px(focusProgress), py(positionAt(tables[focus], focusProgress)), 7, 0, Math.PI * 2);
  context.fill();
  context.stroke();
}

export function RandomWalk({ active, onOpenGalton }: { active: boolean; onOpenGalton: (path: boolean[]) => void }) {
  const [steps, setSteps] = useState(20);
  const [percent, setPercent] = useState(50);
  const [count, setCount] = useState<number>(1);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [seed, setSeed] = useState(newSeed);
  const [run, setRun] = useState<Prepared>(() => prepare(1, 20, 0.5, seed));
  const [playing, setPlaying] = useState(false);
  const [selectedFinal, setSelectedFinal] = useState<number | null>(null);
  const [chosenPath, setChosenPath] = useState<number | null>(null);
  const [replay, setReplay] = useState<{ index: number; clock: number } | null>(null);
  const [, setVersion] = useState(0);
  const clockRef = useRef(0);
  /** Цель для «Один шаг»: анимация останавливается ровно на следующем шаге. */
  const targetRef = useRef<number | null>(null);
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const height = width < 500 ? 280 : 360;

  const { walks, stagger, end, tables, yMax } = run;
  const clock = clockRef.current;
  const completed = completedPaths(clock, walks.paths.length, stagger, walks.steps);
  const counts = useMemo(() => completedDistribution(walks.finals, completed, walks.steps), [walks, completed]);
  const single = walks.paths.length === 1;
  const stepMs = SPEEDS[speedIndex].stepMs;

  useEffect(() => {
    drawScene(canvasRef.current, width, height, run, clockRef.current, completed, selectedFinal, replay);
  });

  /** Новый запуск: пути генерируются заранее по seed, анимация лишь показывает их. */
  const start = (nextSeed: number = seed, autoplay = true) => {
    const next = prepare(count, steps, percent / 100, nextSeed);
    clockRef.current = 0;
    targetRef.current = null;
    setRun(next);
    setSelectedFinal(null);
    setChosenPath(null);
    setReplay(null);
    setPlaying(autoplay);
    setVersion((value) => value + 1);
  };

  /** «Сначала»: немедленная остановка, след очищен, маркер в начале. Часы — единственный источник состояния. */
  const restart = () => {
    setPlaying(false);
    clockRef.current = 0;
    targetRef.current = null;
    setReplay(null);
    setSelectedFinal(null);
    setChosenPath(null);
    setVersion((value) => value + 1);
  };

  const stepOnce = () => {
    if (replay) return;
    const next = Math.min(end, Math.floor(clockRef.current + 1e-9) + 1);
    targetRef.current = next;
    setPlaying(true);
  };

  useFrameLoop(active && playing, (elapsed) => {
    const delta = elapsed / stepMs;
    if (replay) {
      const nextClock = Math.min(walks.steps, replay.clock + delta);
      setReplay({ index: replay.index, clock: nextClock });
      if (nextClock >= walks.steps) setPlaying(false);
      return;
    }
    const limit = targetRef.current ?? end;
    clockRef.current = Math.min(limit, clockRef.current + delta);
    if (clockRef.current >= limit) {
      targetRef.current = null;
      setPlaying(false);
    }
    setVersion((value) => value + 1);
  });

  const visible = Array.from({ length: walks.steps + 1 }, (_, index) => -walks.steps + 2 * index)
    .map((position, index) => ({ position, count: counts[index] }))
    .filter((item) => Math.abs(item.position) <= yMax);
  const maxCount = Math.max(1, ...counts);
  const finals = Array.from(walks.finals.slice(0, completed));
  const summary = summarize(finals);
  const matching = selectedFinal === null ? [] : finals.map((final, index) => (final === selectedFinal ? index : -1)).filter((index) => index >= 0);
  const focusIndex = replay?.index ?? chosenPath ?? 0;
  const focusDone = focusIndex < completed;
  const r = rightSteps(walks.paths[focusIndex]);
  const canOpenBoard = walks.steps >= MIN_LEVELS && walks.steps <= MAX_LEVELS && focusDone;
  const progress0 = pathProgress(clock, 0, stagger, walks.steps);
  const plotHeight = height - PLOT_TOP - PLOT_BOTTOM;

  let status: string;
  if (replay) {
    const k = Math.floor(replay.clock + 1e-9);
    status = `Повтор пути № ${replay.index + 1}: шаг ${k} из ${walks.steps} · положение ${signed(tables[replay.index][k])}`;
  } else if (clock === 0) status = 'Маркер в точке (0, 0). Нажмите «Запустить» или «Один шаг».';
  else if (single) {
    const k = Math.floor(progress0 + 1e-9);
    status = `Шаг ${k} из ${walks.steps} · положение ${signed(tables[0][k])}${completed === 1 ? ' · путь завершён' : ''}`;
  } else {
    status = `Шаг ${Math.min(walks.steps, Math.floor(progress0 + 1e-9))} первого пути · завершено ${formatInteger(completed)} из ${formatInteger(walks.paths.length)} ${plural(walks.paths.length, 'пути', 'путей', 'путей')}`;
  }

  return (
    <section className="experiment experiment--walk" id="panel-walk" hidden={!active}>
      <div className="experiment-head">
        <h2>Случайное блуждание</h2>
        <p className="action-line">Нажми «Запустить» и проследи путь маркера, затем запусти 100 путей и сравни, где они закончатся.</p>
      </div>

      <div className="viz-column">
        <div className="viz-group">
          <div className="walk-layout">
            <div className="walk-canvas" ref={ref}>
              <p className="series-axis-title">Положение</p>
              <canvas
                ref={canvasRef}
                style={{ width: `${width}px`, height: `${height}px` }}
                role="img"
                aria-label={`Случайное блуждание: ${walks.paths.length} ${plural(walks.paths.length, 'путь', 'пути', 'путей')}, шагов ${walks.steps}`}
                data-testid="walk-canvas"
              />
              <p className="series-axis-title series-axis-title--x">Номер шага</p>
            </div>
            <div className="walk-dist">
              <p className="series-axis-title" title="Конечные положения">
                Конечные положения
              </p>
              <div className="walk-bars" style={{ height: `${plotHeight}px`, marginTop: `${PLOT_TOP}px` }}>
                {visible.map(({ position, count: value }) => (
                  <button
                    key={position}
                    type="button"
                    className={selectedFinal === position ? 'walk-bar walk-bar--selected' : 'walk-bar'}
                    style={{ top: `${((yMax - position) / (2 * yMax)) * 100}%` }}
                    aria-pressed={selectedFinal === position}
                    aria-label={`Положение ${position}: ${value} ${plural(value, 'путь', 'пути', 'путей')}`}
                    data-position={position}
                    data-count={value}
                    onClick={() => {
                      setSelectedFinal(selectedFinal === position ? null : position);
                      setChosenPath(null);
                    }}
                  >
                    <span style={{ width: `${(value / maxCount) * 100}%` }} />
                    {value > 0 ? <em>{formatInteger(value)}</em> : null}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="walk-status" data-testid="walk-status" aria-live="polite">
            {status}
          </p>
          <div className="chart-legend">
            <span className="legend-line series-amber legend-line--line">{replay ? 'Повторяемый путь' : 'Первый путь и маркер'}</span>
            {!single ? <span className="legend-line series-mist legend-line--line">Остальные пути</span> : null}
            {!single && completed === walks.paths.length ? <span className="legend-line series-paper legend-line--line">Среднее положение (наблюдаемое)</span> : null}
            <span className="legend-line series-cyan legend-line--dashed">Теория E(S_k) = k(2p − 1)</span>
          </div>
          <p className="bin-info" data-testid="walk-info" aria-live="polite">
            {single
              ? 'Одна траектория. Выберите 10, 100 или 1000 путей, чтобы увидеть распределение.'
              : `На холсте ${formatInteger(Math.min(DRAW_LIMIT, walks.paths.length))} из ${formatInteger(walks.paths.length)} путей; в распределении — ${formatInteger(completed)} завершённых.`}
            {selectedFinal !== null
              ? ` Конец в ${signed(selectedFinal)}: ${formatInteger(matching.length)} ${plural(matching.length, 'путь', 'пути', 'путей')} — подсвечены.`
              : ''}
          </p>
          {selectedFinal !== null && matching.length > 0 ? (
            <div className="range-row walk-pick">
              <label htmlFor="walk-path" className="visually-hidden">
                Путь для повтора
              </label>
              <select
                id="walk-path"
                className="input"
                value={chosenPath ?? matching[0]}
                onChange={(event) => setChosenPath(Number(event.target.value))}
                data-testid="walk-path-select"
              >
                {matching.slice(0, 200).map((index) => (
                  <option key={index} value={index}>
                    Путь № {index + 1}
                  </option>
                ))}
              </select>
              <button
                className="btn btn--primary"
                type="button"
                onClick={() => {
                  const index = chosenPath ?? matching[0];
                  setChosenPath(index);
                  setReplay({ index, clock: 0 });
                  setPlaying(true);
                }}
              >
                Повторить путь
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="side-column">
        <div className="actions actions--two">
          <button className="btn btn--primary" type="button" onClick={() => start()}>
            Запустить
          </button>
          <button className="btn" type="button" disabled={!!replay || clock >= end} onClick={stepOnce}>
            Один шаг
          </button>
          <button className="btn" type="button" disabled={clock === 0 && !replay} onClick={() => setPlaying(!playing)}>
            {playing ? 'Пауза' : 'Продолжить'}
          </button>
          <button className="btn btn--quiet" type="button" onClick={restart}>
            Сначала
          </button>
        </div>
        <Segmented legend="Скорость" options={SPEEDS.map((option, index) => ({ value: index, label: option.label }))} value={speedIndex} onChange={setSpeedIndex} />
        <Segmented legend="Число путей" options={COUNTS.map((value) => ({ value, label: formatInteger(value) }))} value={count} onChange={setCount} />
        <RangeField id="walk-steps" label="Число шагов" value={steps} min={1} max={100} onChange={setSteps} display={String(steps)} />
        <RangeField id="walk-p" label="Вероятность шага +1, p" value={percent} min={0} max={100} onChange={setPercent} display={`${percent} %`} />
        <p className="hint">Новые параметры применяются по кнопке «Запустить».</p>

        <table className="stats-table" data-testid="walk-stats">
          <caption>Конечный шаг k = {walks.steps}, завершено путей: {formatInteger(completed)}</caption>
          <thead>
            <tr>
              <th scope="col">Характеристика</th>
              <th scope="col">Выборка</th>
              <th scope="col">Теория</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Среднее положение</th>
              <td className="tone-amber">{summary.mean === null ? '—' : signed(summary.mean)}</td>
              <td className="tone-cyan">k(2p − 1) = {signed(walkMean(walks.steps, walks.p))}</td>
            </tr>
            <tr>
              <th scope="row">Дисперсия</th>
              <td className="tone-amber">{summary.variance === null ? 'Нужно 2 пути' : formatStatistic(summary.variance)}</td>
              <td className="tone-cyan">4kp(1 − p) = {formatStatistic(walkVariance(walks.steps, walks.p))}</td>
            </tr>
          </tbody>
        </table>

        <section className="walk-board">
          <button className="btn" type="button" disabled={!canOpenBoard} onClick={() => onOpenGalton(toBooleans(walks.paths[focusIndex]))}>
            Те же шаги на доске Гальтона
          </button>
          <p className="hint" data-testid="walk-board-info">
            {walks.steps < MIN_LEVELS || walks.steps > MAX_LEVELS
              ? `Доступно для путей длины от ${MIN_LEVELS} до ${MAX_LEVELS}.`
              : !focusDone
                ? 'Дождитесь, пока путь дойдёт до конца.'
                : `Путь № ${focusIndex + 1}: r = ${r} шагов +1 из k = ${walks.steps}. Положение 2r − k = ${signed(2 * r - walks.steps)}, ячейка доски — ${r}.`}
          </p>
        </section>

        <RunControls
          seed={seed}
          onRepeat={() => start(seed)}
          onNew={() => {
            const next = newSeed();
            setSeed(next);
            start(next);
          }}
          onSeed={(value) => {
            setSeed(value);
            start(value, false);
          }}
        />
        <details className="more">
          <summary>После скольких шагов какие положения возможны</summary>
          <div className="more-body">
            <p>
              Каждый шаг меняет положение на ±1, поэтому после чётного числа шагов положение всегда чётное, после нечётного —
              нечётное. Если из k шагов r были +1, конечное положение равно 2r − k.
            </p>
          </div>
        </details>
      </div>
    </section>
  );
}
