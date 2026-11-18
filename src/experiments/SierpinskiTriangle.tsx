import { useEffect, useRef, useState } from 'react';
import { Readouts } from '../components/Readouts';
import { Reveal } from '../components/Reveal';
import { useFrameLoop } from '../hooks/useFrameLoop';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  ChaosRun,
  EQUAL_WEIGHTS,
  SKEWED_WEIGHTS,
  VERTEX_NAMES,
  VERTICES,
  parseWeights,
  toProbabilities,
  type Triple,
  type VertexIndex,
} from '../lib/chaosGame';
import { DensityMap } from '../lib/densityMap';
import { formatInteger, formatShare } from '../lib/format';

type Draft = [string, string, string];

const SPEEDS = [
  { label: 'Медленно', stepsPerSecond: 8 },
  { label: 'Средне', stepsPerSecond: 800 },
  { label: 'Быстро', stepsPerSecond: 12000 },
] as const;

const PRESETS: readonly { label: string; draft: Draft }[] = [
  { label: 'Равные шансы', draft: ['1', '1', '1'] },
  { label: '60/30/10', draft: ['60', '30', '10'] },
];

const VERTEX_INDEXES = [0, 1, 2] as const;
const LABEL_OFFSETS = [
  { x: 34, y: 8 },
  { x: -2, y: 30 },
  { x: 2, y: 30 },
] as const;

interface Snapshot {
  steps: number;
  counts: Triple;
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  lastVertex: VertexIndex | null;
  countsAtThirty: Triple | null;
}

const takeSnapshot = (run: ChaosRun): Snapshot => ({
  steps: run.steps,
  counts: [...run.counts],
  x: run.x,
  y: run.y,
  previousX: run.previousX,
  previousY: run.previousY,
  lastVertex: run.lastVertex,
  countsAtThirty: run.countsAtThirty,
});

function describePattern(weights: Triple): string {
  const probabilities = toProbabilities(weights);
  const active = VERTEX_INDEXES.filter((index) => weights[index] > 0);
  if (active.length === 1) {
    return `Участвует только вершина ${VERTEX_NAMES[active[0]]}, поэтому точка с каждым шагом приближается к ней.`;
  }
  if (active.length === 2) {
    return `Участвуют только вершины ${VERTEX_NAMES[active[0]]} и ${VERTEX_NAMES[active[1]]}, поэтому точки ложатся на сторону между ними.`;
  }
  if (weights[0] === weights[1] && weights[1] === weights[2]) {
    return 'Равные шансы: точки складываются в фрактальный узор из трёх уменьшенных копий целого с пустотой в центре. Каждая копия получает около трети точек.';
  }
  const ordered = [...VERTEX_INDEXES].sort((first, second) => probabilities[second] - probabilities[first]);
  const densest = ordered[0];
  const sparsest = ordered[2];
  return `Неравные шансы: контур узора сохраняется, а плотность меняется. Часть у вершины ${VERTEX_NAMES[densest]} получает около ${formatShare(probabilities[densest])} точек, часть у вершины ${VERTEX_NAMES[sparsest]} около ${formatShare(probabilities[sparsest])}.`;
}

function ComparisonCanvas({ weights, title, caption }: { weights: Triple; title: string; caption: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    const map = new DensityMap(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 1, 0.5);
    const run = new ChaosRun(weights);
    for (let step = 0; step < 40000; step += 1) {
      const vertex = run.step();
      map.add(run.x, run.y, vertex);
    }
    map.draw(context);
  }, [weights]);

  return (
    <figure className="compare-item">
      <canvas ref={canvasRef} width={CANVAS_WIDTH / 2} height={CANVAS_HEIGHT / 2} role="img" aria-label={caption} />
      <figcaption>
        <strong>{title}</strong>
        <span>{caption}</span>
      </figcaption>
    </figure>
  );
}

export function SierpinskiTriangle({ active }: { active: boolean }) {
  const [applied, setApplied] = useState<Triple>(EQUAL_WEIGHTS);
  const [draft, setDraft] = useState<Draft>(['1', '1', '1']);
  const [running, setRunning] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [map] = useState(() => new DensityMap(CANVAS_WIDTH, CANVAS_HEIGHT, 2));

  const runRef = useRef<ChaosRun | null>(null);
  runRef.current ??= new ChaosRun(EQUAL_WEIGHTS);
  const [snapshot, setSnapshot] = useState<Snapshot>(() => takeSnapshot(runRef.current as ChaosRun));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stepBank = useRef(0);

  const parsed = parseWeights(draft);
  const draftProbabilities = parsed.ok ? toProbabilities(parsed.weights) : null;
  const appliedProbabilities = toProbabilities(applied);
  const isDirty = !parsed.ok || parsed.weights.some((weight, index) => weight !== applied[index]);
  const speed = SPEEDS[speedIndex].stepsPerSecond;

  const paint = () => {
    const context = canvasRef.current?.getContext('2d');
    if (context) map.draw(context);
  };

  const advance = (count: number) => {
    const run = runRef.current as ChaosRun;
    for (let index = 0; index < count; index += 1) {
      const vertex = run.step();
      map.add(run.x, run.y, vertex);
    }
    paint();
    setSnapshot(takeSnapshot(run));
  };

  const startExperiment = (weights: Triple) => {
    setRunning(false);
    stepBank.current = 0;
    map.clear();
    paint();
    const run = new ChaosRun(weights);
    runRef.current = run;
    setSnapshot(takeSnapshot(run));
  };

  const applySettings = () => {
    if (!parsed.ok) return;
    setApplied(parsed.weights);
    startExperiment(parsed.weights);
  };

  useFrameLoop(active && running, (elapsed) => {
    stepBank.current += (elapsed * speed) / 1000;
    const count = Math.floor(stepBank.current);
    if (count === 0) return;
    stepBank.current -= count;
    advance(count);
  });

  const showMove = snapshot.lastVertex !== null && (!running || speed <= SPEEDS[0].stepsPerSecond);
  const moveTarget = snapshot.lastVertex !== null ? VERTICES[snapshot.lastVertex] : null;

  let status: string;
  if (snapshot.steps === 0) status = 'Старт в вершине A. Сделайте шаг или запустите построение.';
  else if (running) status = 'Идёт построение.';
  else if (snapshot.lastVertex !== null)
    status = `Шаг ${formatInteger(snapshot.steps)}: выбрана вершина ${VERTEX_NAMES[snapshot.lastVertex]}, новая точка стоит посередине пути к ней.`;
  else status = '';

  return (
    <section
      className="experiment"
      id="panel-triangle"
      role="tabpanel"
      aria-labelledby="tab-triangle"
      hidden={!active}
    >
      <div className="experiment-head">
        <h2>Треугольник Серпинского</h2>
        <p>На каждом шаге случайно выбирается вершина, и новая точка ставится посередине между ней и текущей точкой.</p>
      </div>

      <div className="viz-column">
        <div className="viz-pin">
        <div className="triangle">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            role="img"
            aria-label={`Точки опыта с вершинами A, B и C. Сделано шагов: ${snapshot.steps}.`}
          />
          <svg viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} aria-hidden="true">
            <polygon className="triangle-outline" points={VERTICES.map((point) => `${point.x},${point.y}`).join(' ')} />
            {showMove && moveTarget ? (
              <>
                <line
                  className="triangle-move"
                  x1={snapshot.previousX}
                  y1={snapshot.previousY}
                  x2={moveTarget.x}
                  y2={moveTarget.y}
                />
                <circle className="triangle-previous" cx={snapshot.previousX} cy={snapshot.previousY} r="6" />
              </>
            ) : null}
            <circle className="triangle-current" cx={snapshot.x} cy={snapshot.y} r="8" />
            {VERTEX_INDEXES.map((index) => (
              <text
                key={index}
                className={`triangle-label vertex-${index}`}
                x={VERTICES[index].x + LABEL_OFFSETS[index].x}
                y={VERTICES[index].y + LABEL_OFFSETS[index].y}
                textAnchor={index === 2 ? 'end' : 'start'}
              >
                {VERTEX_NAMES[index]}
              </text>
            ))}
          </svg>
        </div>
        <p className="status" aria-live={running ? 'off' : 'polite'} data-testid="triangle-status">
          {status}
        </p>
        </div>
      </div>

      <div className="side-column">
        <Readouts items={[{ label: 'Шаги', value: formatInteger(snapshot.steps), tone: 'amber', testId: 'triangle-steps' }]} />

        <div className="actions actions--four">
          <button className="btn" type="button" disabled={running} onClick={() => advance(1)}>
            1 шаг
          </button>
          <button className="btn btn--primary" type="button" disabled={running} onClick={() => setRunning(true)}>
            {snapshot.steps > 0 ? 'Продолжить' : 'Запустить'}
          </button>
          <button className="btn" type="button" disabled={!running} onClick={() => setRunning(false)}>
            Пауза
          </button>
          <button className="btn btn--quiet" type="button" onClick={() => startExperiment(applied)}>
            Сбросить
          </button>
        </div>

        <fieldset className="segmented">
          <legend>Скорость построения</legend>
          <div className="segmented-options">
            {SPEEDS.map((option, index) => (
              <button
                key={option.label}
                className="chip"
                type="button"
                aria-pressed={speedIndex === index}
                onClick={() => setSpeedIndex(index)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="table-scroll">
          <table className="data-table">
            <caption>Вершины в текущем опыте</caption>
            <thead>
              <tr>
                <th scope="col">Вершина</th>
                <th scope="col">Вероятность</th>
                <th scope="col">Выборы</th>
                <th scope="col">Частота</th>
              </tr>
            </thead>
            <tbody>
              {VERTEX_INDEXES.map((index) => (
                <tr key={index}>
                  <th scope="row" className={`vertex-${index}`}>
                    {VERTEX_NAMES[index]}
                  </th>
                  <td data-testid={`triangle-probability-${index}`}>{formatShare(appliedProbabilities[index])}</td>
                  <td data-testid={`triangle-count-${index}`}>{formatInteger(snapshot.counts[index])}</td>
                  <td data-testid={`triangle-frequency-${index}`}>
                    {snapshot.steps === 0 ? 'нет данных' : formatShare(snapshot.counts[index] / snapshot.steps)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Всего</th>
                <td>100,0&nbsp;%</td>
                <td data-testid="triangle-count-total">
                  {formatInteger(snapshot.counts[0] + snapshot.counts[1] + snapshot.counts[2])}
                </td>
                <td>{snapshot.steps === 0 ? 'нет данных' : '100,0 %'}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <fieldset className="settings">
          <legend>Вероятности вершин</legend>
          <div className="segmented-options">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                className="chip"
                type="button"
                aria-pressed={preset.draft.every((value, index) => value === draft[index])}
                onClick={() => setDraft([...preset.draft])}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="weights">
            {VERTEX_INDEXES.map((index) => (
              <div className="weight" key={index}>
                <label htmlFor={`weight-${index}`} className={`vertex-${index}`}>
                  Вес {VERTEX_NAMES[index]}
                </label>
                <input
                  id={`weight-${index}`}
                  className="input"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft[index]}
                  aria-invalid={!parsed.ok}
                  onChange={(event) => {
                    const next: Draft = [...draft];
                    next[index] = event.target.value;
                    setDraft(next);
                  }}
                />
                <output data-testid={`draft-probability-${index}`}>
                  {draftProbabilities ? formatShare(draftProbabilities[index]) : 'нет значения'}
                </output>
              </div>
            ))}
          </div>
          {!parsed.ok ? (
            <p className="hint hint--error" role="alert">
              {parsed.error}
            </p>
          ) : isDirty ? (
            <p className="hint">Новые вероятности начнут действовать после применения.</p>
          ) : null}
          <button
            className={parsed.ok && isDirty ? 'btn btn--primary' : 'btn'}
            type="button"
            disabled={!parsed.ok}
            onClick={applySettings}
          >
            Применить и начать новый опыт
          </button>
        </fieldset>
      </div>

      <div className="notes">
        <section className="explain">
          <h3>Что показывает узор</h3>
          <p data-testid="triangle-note">{describePattern(applied)}</p>
          <div className="compare">
            <ComparisonCanvas weights={EQUAL_WEIGHTS} title="Равные шансы" caption="Все три части заполнены одинаково плотно" />
            <ComparisonCanvas weights={SKEWED_WEIGHTS} title="60/30/10" caption="Часть у вершины A плотнее, часть у C реже" />
          </div>
          <p className="hint">Каждый образец построен случайно за 40 000 шагов при открытии страницы.</p>
        </section>

        <Reveal
          question="Обязана ли вершина с вероятностью 1/3 выпасть ровно 10 раз за 30 шагов?"
          openLabel="Показать ответ"
          closeLabel="Скрыть ответ"
          locked={snapshot.steps === 0}
          lockedHint="Ответ откроется после запуска опыта."
        >
          <p>
            Нет. 10 раз это среднее значение, а не обязательный результат. Каждый шаг случаен, поэтому число выпадений
            меняется от опыта к опыту. Ровно 10 выпадений случаются примерно в 15,3&nbsp;% опытов, а от 7 до 13 выпадений
            примерно в 82,6&nbsp;%.
          </p>
          {snapshot.countsAtThirty && applied[0] === applied[1] && applied[1] === applied[2] ? (
            <p data-testid="triangle-thirty">
              В этом опыте за первые 30 шагов: A выпала {snapshot.countsAtThirty[0]}, B выпала {snapshot.countsAtThirty[1]},
              C выпала {snapshot.countsAtThirty[2]}.
            </p>
          ) : null}
        </Reveal>
      </div>
    </section>
  );
}
