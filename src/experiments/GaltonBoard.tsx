import { useRef, useState, type CSSProperties } from 'react';
import { Readouts } from '../components/Readouts';
import { Reveal } from '../components/Reveal';
import { useFrameLoop } from '../hooks/useFrameLoop';
import { formatInteger, formatOneDecimal, plural } from '../lib/format';
import {
  BIN_COUNT,
  LEVELS,
  binOfPath,
  binomialCoefficient,
  binomialDistribution,
  chartMaximum,
  parsePercent,
  simulatePath,
} from '../lib/galton';

const BOARD_WIDTH = 900;
const BOARD_HEIGHT = 400;
const COLUMN_WIDTH = BOARD_WIDTH / BIN_COUNT;
const FIRST_ROW_Y = 44;
const ROW_GAP = 36;
const BIN_TOP = FIRST_ROW_Y + LEVELS * ROW_GAP;
const BALL_LIFT = 13;
const HOP_MS = 220;

const BINS = Array.from({ length: BIN_COUNT }, (_, bin) => bin);
const PATH_COUNTS = BINS.map((bin) => binomialCoefficient(LEVELS, bin));
const emptyCounts = () => Array<number>(BIN_COUNT).fill(0);

interface Point {
  x: number;
  y: number;
}

const pegX = (level: number, rights: number) => BOARD_WIDTH / 2 + (rights - level / 2) * COLUMN_WIDTH;
const pegY = (level: number) => FIRST_ROW_Y + level * ROW_GAP;

/** Опорные точки пути: вход, все уровни и дно ячейки. */
function buildWaypoints(path: readonly boolean[]): Point[] {
  const points: Point[] = [{ x: BOARD_WIDTH / 2, y: 4 }];
  let rights = 0;
  for (let level = 0; level <= LEVELS; level += 1) {
    points.push({ x: pegX(level, rights), y: pegY(level) - BALL_LIFT });
    if (level < LEVELS && path[level]) rights += 1;
  }
  points.push({ x: pegX(LEVELS, rights), y: BOARD_HEIGHT - 14 });
  return points;
}

function ballPosition(points: readonly Point[], elapsed: number): { ball: Point; passed: number } {
  const progress = Math.min(elapsed / HOP_MS, points.length - 1);
  const index = Math.min(Math.floor(progress), points.length - 2);
  const fraction = progress - index;
  const from = points[index];
  const to = points[index + 1];
  return {
    ball: {
      x: from.x + (to.x - from.x) * fraction,
      y: from.y + (to.y - from.y) * fraction ** 1.6 - Math.sin(Math.PI * fraction) * 8,
    },
    passed: index,
  };
}

interface Flight {
  path: boolean[];
  points: Point[];
  elapsed: number;
}

const pathLetters = (path: readonly boolean[]) => path.map((isRight) => (isRight ? 'П' : 'Л')).join('');

function Board({ flight, lastPath }: { flight: Flight | null; lastPath: boolean[] | null }) {
  const trailPath = flight?.path ?? lastPath;
  const points = trailPath ? (flight?.points ?? buildWaypoints(trailPath)) : null;
  const position = flight ? ballPosition(flight.points, flight.elapsed) : null;
  const visible = points
    ? position
      ? [...points.slice(0, position.passed + 1), position.ball]
      : points
    : [];

  return (
    <svg className="board" viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`} role="img" aria-label="Доска Гальтона: 8 уровней штырьков и 9 ячеек">
      {Array.from({ length: LEVELS }, (_, level) =>
        Array.from({ length: level + 1 }, (_, peg) => (
          <circle className="peg" key={`${level}-${peg}`} cx={pegX(level, peg)} cy={pegY(level)} r="6" />
        )),
      )}
      {Array.from({ length: BIN_COUNT + 1 }, (_, wall) => (
        <line
          className="bin-wall"
          key={wall}
          x1={wall * COLUMN_WIDTH}
          x2={wall * COLUMN_WIDTH}
          y1={BIN_TOP - 8}
          y2={BOARD_HEIGHT}
        />
      ))}
      {visible.length > 1 ? (
        <polyline className="ball-trail" points={visible.map((point) => `${point.x},${point.y}`).join(' ')} />
      ) : null}
      {position ? <circle className="ball" data-testid="galton-ball" cx={position.ball.x} cy={position.ball.y} r="11" /> : null}
    </svg>
  );
}

function Histogram({ shares, theory }: { shares: readonly number[]; theory: readonly number[] }) {
  const maximum = chartMaximum([...shares, ...theory]);
  const tickStep = maximum <= 10 ? 5 : maximum <= 40 ? 10 : 20;
  const ticks = Array.from({ length: Math.floor(maximum / tickStep) + 1 }, (_, index) => index * tickStep);

  return (
    <div className="chart" role="img" aria-label="Гистограмма долей шариков и теоретическое биномиальное распределение">
      <div className="chart-axis" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick} style={{ bottom: `${(tick / maximum) * 100}%` }}>
            {tick}&nbsp;%
          </span>
        ))}
      </div>
      <div className="chart-plot" aria-hidden="true">
        {ticks.map((tick) => (
          <span className="chart-line" key={tick} style={{ bottom: `${(tick / maximum) * 100}%` }} />
        ))}
        {BINS.map((bin) => {
          const theoryHeight = (theory[bin] * 100 * 100) / maximum;
          return (
            <div className="chart-column" key={bin}>
              <span className="chart-bar" data-testid={`galton-bar-${bin}`} style={{ height: `${(shares[bin] * 100 * 100) / maximum}%` }} />
              <span className="chart-theory" style={{ bottom: `${theoryHeight}%` }}>
                <span className="chart-theory-label">{formatOneDecimal(theory[bin] * 100)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GaltonBoard({ active }: { active: boolean }) {
  const [appliedPercent, setAppliedPercent] = useState(50);
  const [draftPercent, setDraftPercent] = useState('50');
  const [counts, setCounts] = useState<number[]>(emptyCounts);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [lastPath, setLastPath] = useState<boolean[] | null>(null);
  const [batchLeft, setBatchLeft] = useState(0);

  const batch = useRef({ left: 0, perMs: 0, bank: 0 });
  const flightRef = useRef<Flight | null>(null);

  const probability = appliedPercent / 100;
  const parsed = parsePercent(draftPercent);
  const isDirty = !parsed.ok || parsed.value !== appliedPercent;
  const isBusy = flight !== null || batchLeft > 0;
  const total = counts.reduce((sum, value) => sum + value, 0);
  const shares = counts.map((count) => (total === 0 ? 0 : count / total));
  const theory = binomialDistribution(probability);
  const mean = total === 0 ? null : counts.reduce((sum, count, bin) => sum + count * bin, 0) / total;

  const clearExperiment = () => {
    batch.current = { left: 0, perMs: 0, bank: 0 };
    flightRef.current = null;
    setFlight(null);
    setBatchLeft(0);
    setLastPath(null);
    setCounts(emptyCounts());
  };

  const dropOne = () => {
    const path = simulatePath(probability);
    const next = { path, points: buildWaypoints(path), elapsed: 0 };
    flightRef.current = next;
    setFlight(next);
    setLastPath(null);
  };

  const dropMany = (amount: number, durationMs: number) => {
    batch.current = { left: amount, perMs: amount / durationMs, bank: 0 };
    setBatchLeft(amount);
    setLastPath(null);
  };

  const applyProbability = () => {
    if (!parsed.ok) return;
    setAppliedPercent(parsed.value);
    clearExperiment();
  };

  useFrameLoop(active && isBusy, (elapsed) => {
    const current = flightRef.current;
    if (current) {
      const updated = { ...current, elapsed: current.elapsed + elapsed };
      if (updated.elapsed >= HOP_MS * (updated.points.length - 1)) {
        const bin = binOfPath(updated.path);
        flightRef.current = null;
        setFlight(null);
        setLastPath(updated.path);
        setCounts((previous) => previous.map((count, index) => (index === bin ? count + 1 : count)));
      } else {
        flightRef.current = updated;
        setFlight(updated);
      }
      return;
    }

    const state = batch.current;
    if (state.left <= 0) return;
    state.bank += elapsed * state.perMs;
    const amount = Math.min(state.left, Math.max(1, Math.floor(state.bank)));
    state.bank = Math.max(0, state.bank - amount);
    state.left -= amount;
    const added = emptyCounts();
    let path: boolean[] = [];
    for (let ball = 0; ball < amount; ball += 1) {
      path = simulatePath(probability);
      added[binOfPath(path)] += 1;
    }
    setCounts((previous) => previous.map((count, index) => count + added[index]));
    setLastPath(path);
    setBatchLeft(state.left);
  });

  let status: string;
  if (flight) status = 'Шарик проходит уровни доски.';
  else if (batchLeft > 0) status = 'Идёт серия шариков.';
  else if (total === 0) status = `Новый опыт при p = ${appliedPercent} %. Запустите шарик или серию.`;
  else if (lastPath) {
    const bin = binOfPath(lastPath);
    status = `Последний путь ${pathLetters(lastPath)}: ${bin} ${plural(bin, 'поворот', 'поворота', 'поворотов')} вправо, ячейка ${bin}.`;
  } else status = '';

  return (
    <section
      className="experiment experiment--galton"
      id="panel-galton"
      role="tabpanel"
      aria-labelledby="tab-galton"
      hidden={!active}
    >
      <div className="experiment-head">
        <h2>Доска Гальтона</h2>
        <p>На каждом из 8 уровней шарик независимо идёт вправо с вероятностью p. Номер ячейки равен числу поворотов вправо.</p>
      </div>

      <div className="viz-column galton-stack" style={{ '--bins': BIN_COUNT } as CSSProperties}>
        <div className="board-wrap">
          <Board flight={flight} lastPath={lastPath} />
        </div>
        <Histogram shares={shares} theory={theory} />

        <div className="chart-legend">
          <span className="legend-bar">Доля шариков в опыте</span>
          <span className="legend-theory">Биномиальная теория при p = {appliedPercent}&nbsp;%</span>
        </div>
      </div>

      <div className="bin-tables">
        <table className="bin-table bin-table--wide">
          <caption className="visually-hidden">Результаты по ячейкам</caption>
          <colgroup>
            <col className="bin-table-heading" />
            <col span={BIN_COUNT} />
          </colgroup>
          <tbody>
            <tr>
              <th scope="row">Ячейка</th>
              {BINS.map((bin) => (
                <th scope="col" key={bin}>
                  {bin}
                </th>
              ))}
            </tr>
            <tr>
              <th scope="row">Шарики</th>
              {BINS.map((bin) => (
                <td key={bin} data-testid={`galton-count-${bin}`}>
                  {formatInteger(counts[bin])}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Доля, %</th>
              {BINS.map((bin) => (
                <td key={bin} data-testid={`galton-share-${bin}`}>
                  {total === 0 ? '0,0' : formatOneDecimal(shares[bin] * 100)}
                </td>
              ))}
            </tr>
            <tr className="tone-cyan">
              <th scope="row">Теория, %</th>
              {BINS.map((bin) => (
                <td key={bin} data-testid={`galton-theory-${bin}`}>
                  {formatOneDecimal(theory[bin] * 100)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>

        <table className="data-table bin-table--stack">
          <caption className="visually-hidden">Результаты по ячейкам</caption>
          <thead>
            <tr>
              <th scope="col">Ячейка</th>
              <th scope="col">Шарики</th>
              <th scope="col">Доля, %</th>
              <th scope="col">Теория, %</th>
            </tr>
          </thead>
          <tbody>
            {BINS.map((bin) => (
              <tr key={bin}>
                <th scope="row">{bin}</th>
                <td>{formatInteger(counts[bin])}</td>
                <td>{total === 0 ? '0,0' : formatOneDecimal(shares[bin] * 100)}</td>
                <td className="tone-cyan">{formatOneDecimal(theory[bin] * 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="side-column">
        <Readouts
          items={[
            { label: 'Шарики', value: formatInteger(total), tone: 'amber', testId: 'galton-total' },
            { label: 'Вправо, p', value: `${appliedPercent} %`, tone: 'cyan', testId: 'galton-p' },
          ]}
        />
        <p className="balance" data-testid="galton-mean">
          Средняя ячейка: {mean === null ? 'нет данных' : formatOneDecimal(mean)}, теория{' '}
          {formatOneDecimal(LEVELS * probability)}
        </p>
        <p className="status" aria-live={isBusy ? 'off' : 'polite'} data-testid="galton-status">
          {status}
        </p>

        <div className="actions actions--four">
          <button className="btn" type="button" disabled={isBusy} onClick={dropOne}>
            1 шарик
          </button>
          <button className="btn btn--primary" type="button" disabled={isBusy} onClick={() => dropMany(100, 500)}>
            100 шариков
          </button>
          <button className="btn" type="button" disabled={isBusy} onClick={() => dropMany(1000, 1000)}>
            1000 шариков
          </button>
          <button className="btn btn--quiet" type="button" onClick={clearExperiment}>
            Сбросить
          </button>
        </div>

        <div className="field">
          <label htmlFor="galton-p-range">Вероятность поворота вправо, p</label>
          <div className="range-row">
            <input
              id="galton-p-range"
              className="range"
              type="range"
              min="0"
              max="100"
              step="1"
              value={parsed.ok ? parsed.value : appliedPercent}
              onChange={(event) => setDraftPercent(event.target.value)}
            />
            <input
              className="input input--short"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              aria-label="Значение p в процентах"
              value={draftPercent}
              aria-invalid={!parsed.ok}
              onChange={(event) => setDraftPercent(event.target.value)}
            />
            <span aria-hidden="true">%</span>
          </div>
          {!parsed.ok ? (
            <p className="hint hint--error" role="alert">
              {parsed.error}
            </p>
          ) : isDirty ? (
            <p className="hint">Опыт идёт при p = {appliedPercent}&nbsp;%, пока новое значение не применено.</p>
          ) : null}
          <button
            className={parsed.ok && isDirty ? 'btn btn--primary' : 'btn'}
            type="button"
            disabled={!parsed.ok}
            onClick={applyProbability}
          >
            Применить p и начать новый опыт
          </button>
        </div>

        <Reveal
          question="Почему при равных шансах центральные ячейки заполняются чаще крайних?"
          openLabel="Показать объяснение"
          closeLabel="Скрыть объяснение"
        >
          <p>
            При p = 50&nbsp;% каждая последовательность из 8 поворотов имеет одну и ту же вероятность 1/256. Значит, ячейка
            заполняется тем чаще, чем больше последовательностей в неё ведёт.
          </p>
          <ol className="paths" aria-label="Число последовательностей для каждой ячейки">
            {BINS.map((bin) => (
              <li key={bin} className={bin === 4 ? 'paths-item paths-item--center' : 'paths-item'}>
                <span className="paths-count">{PATH_COUNTS[bin]}</span>
                <span className="paths-bar" style={{ height: `${(PATH_COUNTS[bin] / 70) * 100}%` }} />
                <span className="paths-bin">{bin}</span>
              </li>
            ))}
          </ol>
          <p className="hint">Сверху указано число последовательностей, снизу номер ячейки.</p>
          <p>
            В центральную ячейку 4 ведут 70 последовательностей с четырьмя поворотами вправо, например ППППЛЛЛЛ, ПЛПЛПЛПЛ и
            ЛППЛЛППЛ. Её вероятность равна 70/256, это около 27,3&nbsp;%.
          </p>
          <p>
            В каждую крайнюю ячейку ведёт только одна последовательность: ЛЛЛЛЛЛЛЛ в ячейку 0 и ПППППППП в ячейку 8. Вероятность
            каждой из них равна 1/256, это около 0,4&nbsp;%.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
