import { useRef, useState, type CSSProperties } from 'react';
import { useFrameLoop } from '../hooks/useFrameLoop';
import { binOfPath } from '../lib/galton';

/* ---------- Геометрия доски для m уровней ---------- */

export interface Point {
  x: number;
  y: number;
}

export interface BoardGeometry {
  levels: number;
  bins: number;
  width: number;
  height: number;
  column: number;
  firstRowY: number;
  rowGap: number;
  binTop: number;
  pegRadius: number;
  lift: number;
}

const WIDTH = 900;
const FIRST_ROW_Y = 44;
const BIN_DEPTH = 68;

export function boardGeometry(levels: number): BoardGeometry {
  const rowGap = Math.min(36, 300 / levels);
  const column = WIDTH / (levels + 1);
  const binTop = FIRST_ROW_Y + levels * rowGap;
  return {
    levels,
    bins: levels + 1,
    width: WIDTH,
    height: binTop + BIN_DEPTH,
    column,
    firstRowY: FIRST_ROW_Y,
    rowGap,
    binTop,
    pegRadius: Math.min(6, column / 7),
    lift: Math.min(13, rowGap * 0.36),
  };
}

const pegX = (g: BoardGeometry, level: number, rights: number) => g.width / 2 + (rights - level / 2) * g.column;
const pegY = (g: BoardGeometry, level: number) => g.firstRowY + level * g.rowGap;

/** Опорные точки пути: вход, каждый уровень и дно ячейки. */
export function buildWaypoints(g: BoardGeometry, path: readonly boolean[]): Point[] {
  const points: Point[] = [{ x: g.width / 2, y: 4 }];
  let rights = 0;
  for (let level = 0; level <= g.levels; level += 1) {
    points.push({ x: pegX(g, level, rights), y: pegY(g, level) - g.lift });
    if (level < g.levels && path[level]) rights += 1;
  }
  points.push({ x: pegX(g, g.levels, rights), y: g.height - 14 });
  return points;
}

function ballPosition(points: readonly Point[], elapsed: number, hopMs: number): { ball: Point; passed: number } {
  const progress = Math.min(Math.max(0, elapsed / hopMs), points.length - 1);
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

/* ---------- Статичная доска ---------- */

export function Board({
  geometry: g,
  lastPath,
  selectedBin = null,
}: {
  geometry: BoardGeometry;
  lastPath: readonly boolean[] | null;
  selectedBin?: number | null;
}) {
  const trail = lastPath && lastPath.length === g.levels ? buildWaypoints(g, lastPath) : [];
  return (
    <svg
      className="board"
      viewBox={`0 0 ${g.width} ${g.height}`}
      role="img"
      aria-label={`Доска Гальтона: ${g.levels} уровней штырьков и ${g.bins} ячеек`}
    >
      {selectedBin !== null && selectedBin < g.bins ? (
        <rect className="board-selected" x={selectedBin * g.column} y={g.binTop - 8} width={g.column} height={g.height - g.binTop + 8} />
      ) : null}
      {Array.from({ length: g.levels }, (_, level) =>
        Array.from({ length: level + 1 }, (_, peg) => (
          <circle className="peg" key={`${level}-${peg}`} cx={pegX(g, level, peg)} cy={pegY(g, level)} r={g.pegRadius} />
        )),
      )}
      {Array.from({ length: g.bins + 1 }, (_, wall) => (
        <line className="bin-wall" key={wall} x1={wall * g.column} x2={wall * g.column} y1={g.binTop - 8} y2={g.height} />
      ))}
      {trail.length > 1 ? <polyline className="ball-trail" points={trail.map((p) => `${p.x},${p.y}`).join(' ')} /> : null}
    </svg>
  );
}

/* ---------- Полёты ---------- */

interface Flight {
  path: boolean[];
  points: Point[];
  delay: number;
  hopMs: number;
  elapsed: number;
  visible: boolean;
}

export interface LaunchOptions {
  /** За сколько миллисекунд срываются все шарики партии. Срыв идёт строго по порядку. */
  releaseMs: number;
  hopMs: number;
  /** Сколько траекторий рисовать. Остальные шарики летят невидимо, но учитываются так же. */
  visibleLimit?: number;
}

const flightDuration = (flight: Flight) => flight.delay + flight.hopMs * (flight.points.length - 1);

function drawFlights(canvas: HTMLCanvasElement | null, g: BoardGeometry, flights: readonly Flight[], trail: boolean) {
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(canvas.clientWidth * ratio);
  const height = Math.round(canvas.clientHeight * ratio);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  if (flights.length === 0 || width === 0) return;
  context.setTransform(width / g.width, 0, 0, height / g.height, 0, 0);

  const styles = getComputedStyle(canvas);
  const lamp = styles.getPropertyValue('--lamp').trim() || '#ffc53d';
  const deep = styles.getPropertyValue('--deep').trim() || '#071530';
  const phone = window.matchMedia('(max-width: 639px)').matches;
  const scale = Math.min(1, g.column / 100);
  const single = trail && flights.length === 1;
  const radius = (single ? (phone ? 24 : 11) : phone ? 15 : 7) * Math.max(0.6, scale);

  context.fillStyle = lamp;
  context.strokeStyle = deep;
  for (const flight of flights) {
    if (!flight.visible || flight.elapsed < flight.delay) continue;
    const { ball, passed } = ballPosition(flight.points, flight.elapsed - flight.delay, flight.hopMs);
    if (single) {
      // След растёт за шариком: пройденные опорные точки и текущее положение.
      context.save();
      context.globalAlpha = 0.85;
      context.strokeStyle = lamp;
      context.lineWidth = phone ? 9 : 4;
      context.lineJoin = 'round';
      context.lineCap = 'round';
      context.beginPath();
      flight.points.slice(0, passed + 1).forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.lineTo(ball.x, ball.y);
      context.stroke();
      context.restore();
    }
    context.lineWidth = single ? 3 : 1.5;
    context.beginPath();
    context.arc(ball.x, ball.y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
}

/**
 * Анимация шариков на доске. Результат каждого шарика определяется путём, переданным в launch,
 * поэтому скорость, пауза и число нарисованных траекторий не влияют на итог.
 * onLand получает номера ячеек приземлившихся шариков в порядке запуска.
 */
export function useGaltonFlights(
  active: boolean,
  geometry: BoardGeometry,
  onLand: (bins: number[], lastPath: boolean[]) => void,
) {
  const flightsRef = useRef<Flight[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef(false);
  const landRef = useRef(onLand);
  landRef.current = onLand;
  const [inFlight, setInFlight] = useState(0);
  const [paused, setPaused] = useState(false);

  const launch = (paths: boolean[][], options: LaunchOptions) => {
    const count = paths.length;
    const limit = options.visibleLimit ?? Infinity;
    const every = count <= limit ? 1 : Math.ceil(count / limit);
    flightsRef.current = paths.map((path, index) => {
      // Небольшой детерминированный сдвиг, чтобы шарики с одинаковым путём не сливались в один.
      const shift = count > 1 ? (((index * 37) % 9) - 4) : 0;
      const points = buildWaypoints(geometry, path).map((point, pointIndex) =>
        pointIndex === 0 ? point : { x: point.x + shift, y: point.y },
      );
      return {
        path,
        points,
        delay: count > 1 ? (index * options.releaseMs) / (count - 1) : 0,
        hopMs: options.hopMs,
        elapsed: 0,
        visible: index % every === 0,
      };
    });
    trailRef.current = count === 1;
    setPaused(false);
    setInFlight(count);
  };

  const cancel = () => {
    flightsRef.current = [];
    drawFlights(canvasRef.current, geometry, [], false);
    setInFlight(0);
    setPaused(false);
  };

  useFrameLoop(active && inFlight > 0 && !paused, (elapsed) => {
    const flights = flightsRef.current;
    if (flights.length === 0) return;
    const landed: number[] = [];
    let lastPath: boolean[] | null = null;
    const remaining: Flight[] = [];
    for (const flight of flights) {
      flight.elapsed += elapsed;
      if (flight.elapsed >= flightDuration(flight)) {
        landed.push(binOfPath(flight.path));
        lastPath = flight.path;
      } else {
        remaining.push(flight);
      }
    }
    flightsRef.current = remaining;
    drawFlights(canvasRef.current, geometry, remaining, trailRef.current);
    if (landed.length > 0 && lastPath) {
      setInFlight(remaining.length);
      landRef.current(landed, lastPath);
    }
  });

  return { canvasRef, inFlight, paused, setPaused, launch, cancel };
}

/** Доска с холстом для летящих шариков поверх неё. */
export function BoardWithBalls({
  geometry,
  lastPath,
  canvasRef,
  selectedBin,
  className = '',
}: {
  geometry: BoardGeometry;
  lastPath: readonly boolean[] | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  selectedBin?: number | null;
  className?: string;
}) {
  return (
    <div className={`board-wrap ${className}`}>
      <Board geometry={geometry} lastPath={lastPath} selectedBin={selectedBin} />
      <canvas
        className="board-balls"
        ref={canvasRef}
        aria-hidden="true"
        style={{ aspectRatio: `${geometry.width} / ${geometry.height}` } as CSSProperties}
      />
    </div>
  );
}
