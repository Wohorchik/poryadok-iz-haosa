import { useEffect, useRef, type CSSProperties } from 'react';
import { useElementWidth } from '../hooks/useElementWidth';
import { formatShare, formatStatistic } from '../lib/format';
import { galtonBallPosition } from './physics';
import { drawBall, drawColumn, prefersReducedMotion, prepareCanvas, useSprites } from './sprites';

export interface GaltonLaunch {
  /** Меняется при каждом новом броске — по нему сцена понимает, что пора запускать шарики. */
  id: number;
  /** Пути новых шариков (true — вправо). Они уже учтены в counts; сцена только показывает их полёт. */
  paths: boolean[][];
}

interface Props {
  m: number;
  counts: readonly number[];
  mode: 'count' | 'share';
  /** Теоретические вероятности ячеек — малиновые метки; null — не показывать. */
  theory: readonly number[] | null;
  selected: number | null;
  onSelect?: (bin: number) => void;
  launch: GaltonLaunch | null;
  /** 'columns' — стеклянные столбики, 'stack' — шарики стопкой (для малых чисел). */
  look?: 'columns' | 'stack';
  /** Путь последнего шарика — светлая линия поверх доски. */
  trail?: readonly boolean[] | null;
  /** Метки под ячейками: значение в номерах ячеек (можно дробное), цвет и подпись. */
  markers?: readonly { value: number; color: string; label: string }[];
  label: string;
}

const MAX_ANIMATED = 40;

/** Доска Гальтона из деталей Blender: штырьки, падающие шарики, ячейки со столбиками или стопками. */
export function GaltonScene({ m, counts, mode, theory, selected, onSelect, launch, look = 'columns', trail = null, markers = [], label }: Props) {
  const sprites = useSprites();
  const { ref, width } = useElementWidth<HTMLDivElement>(640);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shown = useRef<number[]>([...counts]);
  const balls = useRef<{ path: boolean[]; start: number; bin: number }[]>([]);
  const frame = useRef(0);
  const lastLaunch = useRef<number | null>(launch?.id ?? null);
  const level = useRef(220);

  const W = Math.max(300, width);
  const pad = 24;
  const sx = Math.min(46, (W - 2 * pad) / (m + 1.4));
  const sy = Math.min(30, sx * 0.82, 300 / Math.max(m, 1));
  const cx = W / 2;
  const y0 = 26;
  const binTop = y0 + (m + 0.7) * sy;
  const binH = W < 480 ? 120 : 160;
  const floor = binTop + binH;
  const H = Math.round(floor + 14 + (markers.length ? 44 : 0));
  const binX = (k: number) => cx + (k - m / 2) * sx;
  const total = counts.reduce((a, b) => a + b, 0);

  const scaleTop = () => {
    const values = mode === 'share' ? counts.map((c) => (total ? c / total : 0)) : [...counts];
    const expected = theory ? theory.map((p) => (mode === 'share' ? p : p * total)) : [];
    const largest = Math.max(...values, ...expected, mode === 'share' ? 0.05 : 4);
    return largest * 1.12;
  };

  const draw = (now: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !sprites) return false;
    const context = prepareCanvas(canvas, W, H);
    if (!context) return false;
    const top = scaleTop();
    // Стопка шариков: один шарик — один диаметр высоты, если всё помещается; иначе — стеклянные столбики.
    const colW = sx * 0.7;
    // В стопке шарик не крупнее 1/10 высоты ячейки — помещается хотя бы 10.
    const stackD = Math.min(colW, (binH - 6) / 10);
    const capacity = Math.floor((binH - 6) / stackD);
    const expectedMax = theory ? Math.max(...theory) * total : 0;
    const stackable = look === 'stack' && mode === 'count' && Math.max(...counts, expectedMax) <= capacity;
    const height = (value: number) => (stackable ? value * stackD : ((binH - 10) * value) / top);
    let busy = false;

    // Штырьки
    const pegR = Math.max(3.5, sx * 0.13);
    for (let r = 0; r < m; r += 1) {
      for (let j = 0; j <= r; j += 1) drawBall(context, sprites.peg, cx + (j - r / 2) * sx, y0 + (r + 0.42) * sy, pegR);
    }

    // Путь последнего шарика
    if (trail && trail.length === m) {
      context.strokeStyle = 'rgba(130, 144, 255, 0.85)';
      context.lineWidth = 3;
      context.lineJoin = 'round';
      context.beginPath();
      for (let t = 0; t <= m + 0.6; t += 0.05) {
        const p = galtonBallPosition(trail, t);
        const px = cx + p.u * sx;
        const py = y0 + p.v * sy;
        if (t === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.stroke();
    }

    // Ячейки: перегородки и дно
    for (let k = 0; k <= m + 1; k += 1) {
      const dx = binX(k) - sx / 2;
      const dw = Math.max(3, sx * 0.08);
      context.drawImage(sprites.divider, dx - dw / 2, binTop, dw, binH);
    }
    const railW = (m + 1) * sx + 8;
    context.drawImage(sprites.rail, binX(0) - sx / 2 - 4, floor - 5, railW, 10);

    // Сколько шариков ещё летит в каждую ячейку — столбик дорастёт, когда они приземлятся.
    const pending = Array<number>(m + 1).fill(0);
    for (const ball of balls.current) pending[ball.bin] += 1;
    for (let k = 0; k <= m; k += 1) {
      const target = Math.max(0, counts[k] - pending[k]);
      const diff = target - shown.current[k];
      if (Math.abs(diff) > 0.01) {
        shown.current[k] += diff * 0.18;
        busy = true;
      } else shown.current[k] = target;
    }
    const shownTotal = shown.current.reduce((a, b) => a + b, 0);

    for (let k = 0; k <= m; k += 1) {
      const value = mode === 'share' ? (shownTotal ? shown.current[k] / Math.max(total, 1) : 0) : shown.current[k];
      const left = binX(k) - colW / 2;
      const ballR = stackD / 2;
      if (stackable) {
        const n = Math.round(shown.current[k]);
        for (let i = 0; i < n; i += 1) drawBall(context, sprites.ballGlass, binX(k), floor - 4 - ballR - i * stackD, ballR);
      } else {
        drawColumn(context, sprites.columnGlass, left, floor - 4, colW, height(value));
      }
      if (k === selected) {
        context.fillStyle = 'rgba(255, 255, 255, 0.08)';
        context.fillRect(binX(k) - sx / 2 + 2, binTop, sx - 4, binH - 6);
        context.fillStyle = '#ffffff';
        context.font = '700 14px Consolas, "Courier New", monospace';
        context.textAlign = 'center';
        const v = mode === 'share' ? (total ? counts[k] / total : 0) : counts[k];
        context.fillText(mode === 'share' ? formatShare(v) : formatStatistic(v), binX(k), Math.max(binTop + 14, floor - 12 - height(v)));
      }
    }

    // Теория: малиновые шарики-метки и пунктир между ними
    if (theory) {
      const points = theory.map((p, k) => [binX(k), floor - 4 - height(mode === 'share' ? p : p * total)] as const);
      context.strokeStyle = 'rgba(255, 79, 200, 0.8)';
      context.setLineDash([6, 6]);
      context.lineWidth = 2;
      context.beginPath();
      points.forEach(([px, py], i) => (i ? context.lineTo(px, py) : context.moveTo(px, py)));
      context.stroke();
      context.setLineDash([]);
      for (const [px, py] of points) drawBall(context, sprites.ballTheory, px, py, Math.max(5, sx * 0.17));
    }

    // Метки под ячейками (среднее выборки, матожидание)
    markers.forEach((marker, i) => {
      const mx = binX(marker.value);
      context.fillStyle = marker.color;
      context.beginPath();
      context.moveTo(mx, floor + 10);
      context.lineTo(mx + 7, floor + 22);
      context.lineTo(mx - 7, floor + 22);
      context.closePath();
      context.fill();
      context.font = '700 13px Consolas, "Courier New", monospace';
      // Левая из двух меток подписывается влево, правая — вправо, чтобы подписи не наезжали.
      const other = markers.find((_, j) => j !== i);
      const leftSide = other ? marker.value < other.value || (marker.value === other.value && i === 0) : false;
      context.textAlign = other ? (leftSide ? 'right' : 'left') : 'center';
      context.fillText(marker.label, mx + (other ? (leftSide ? -10 : 10) : 0), floor + 38);
    });

    // Летящие шарики
    const ballR = Math.max(6, sx * 0.24);
    balls.current = balls.current.filter((ball) => {
      const t = (now - ball.start) / level.current;
      if (t < 0) {
        busy = true;
        return true;
      }
      const p = galtonBallPosition(ball.path, t);
      const px = cx + p.u * sx;
      const py = y0 + p.v * sy;
      const value = mode === 'share' ? (total ? shown.current[ball.bin] / total : 0) : shown.current[ball.bin];
      const landing = floor - 4 - height(value) - ballR;
      if (py >= landing) {
        busy = true; // столбик дорастёт на следующих кадрах: шарик больше не «в пути»
        return false;
      }
      drawBall(context, sprites.ballGlass, px, py, ballR);
      busy = true;
      return true;
    });
    return busy;
  };

  const loop = (now: number) => {
    const busy = draw(now);
    frame.current = busy ? requestAnimationFrame(loop) : 0;
  };
  const wake = () => {
    if (!frame.current) frame.current = requestAnimationFrame(loop);
  };

  // Новый бросок: запускаем последние MAX_ANIMATED шариков партии, остальные дорастают столбиками.
  useEffect(() => {
    if (!launch || launch.id === lastLaunch.current) return;
    lastLaunch.current = launch.id;
    if (prefersReducedMotion()) {
      shown.current = [...counts];
      wake();
      return;
    }
    const animated = launch.paths.slice(-MAX_ANIMATED);
    level.current = animated.length > 1 ? 120 : 230;
    const now = performance.now();
    const gap = animated.length > 1 ? 70 : 0;
    animated.forEach((path, i) => balls.current.push({ path, start: now + i * gap, bin: path.filter(Boolean).length }));
    wake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launch?.id]);

  // Сброс или смена доски: столбики сразу к новым числам, полёты отменяются.
  useEffect(() => {
    if (shown.current.length !== m + 1 || total === 0) {
      shown.current = [...counts];
      balls.current = [];
    }
    wake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, total, mode, theory, selected, W, sprites]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0; // иначе после повторного монтирования (StrictMode) wake() решит, что цикл уже идёт
    },
    [],
  );

  const buttons: CSSProperties = { position: 'relative', height: 32 };
  return (
    <figure className="c-chart c-chart--scene" ref={ref}>
      <canvas ref={canvasRef} style={{ width: '100%', height: H, display: 'block' }} role="img" aria-label={label} />
      <div style={buttons} role={onSelect ? 'group' : undefined} aria-label={onSelect ? 'Выбор ячейки' : undefined}>
        {counts.map((count, k) => {
          const style: CSSProperties = { position: 'absolute', left: binX(k) - sx / 2, width: sx, top: 0 };
          return onSelect ? (
            <button
              key={k}
              type="button"
              className={'c-bin-button' + (k === selected ? ' c-bin-button--on' : '')}
              style={style}
              aria-pressed={k === selected}
              aria-label={`Ячейка ${k}: ${count} шариков`}
              onClick={() => onSelect(k)}
            >
              {k}
            </button>
          ) : (
            <span key={k} className="c-bin-button c-bin-button--static" style={style}>
              {k}
            </span>
          );
        })}
      </div>
    </figure>
  );
}
