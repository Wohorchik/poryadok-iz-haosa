import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { BarChart, RangeField, Segmented } from '../components/Charts';
import { useElementWidth } from '../hooks/useElementWidth';
import {
  DOMAIN_MAX,
  DOMAIN_MIN,
  FREE_START,
  MEAN_DOMAIN,
  MEAN_EXAMPLE_TO,
  MEAN_START,
  SPREAD_SCENE,
  clampValue,
  commit,
  describe,
  explainChange,
  histogram,
  singleChange,
  stackLevels,
  startEditable,
  undo,
  type Description,
  type Editable,
} from '../lib/drawDistribution';
import { NO_DATA, formatInteger, formatStatistic } from '../lib/format';

type Mode = 'one' | 'same' | 'own';

const START: Record<Mode, readonly (readonly number[])[]> = {
  one: [MEAN_START],
  same: SPREAD_SCENE,
  own: [FREE_START],
};
const DOMAINS: Record<Mode, readonly [number, number]> = {
  one: MEAN_DOMAIN,
  same: [0, 10],
  own: [DOMAIN_MIN, DOMAIN_MAX],
};

const show = (value: number | null) => (value === null ? NO_DATA : formatStatistic(value));
const PAD = 30;

interface LineProps {
  values: readonly number[];
  domain: readonly [number, number];
  selected: number | null;
  hintIndex: number | null;
  title: string;
  testId: string;
  onSelect: (index: number | null) => void;
  onDragStart: () => void;
  onDrag: (index: number, value: number) => void;
  onDragEnd: () => void;
  onKeyMove: (index: number, value: number) => void;
  onAdd?: (value: number) => void;
}

/**
 * Числовая прямая: точки выборки, среднее — бирюзовый треугольник над шкалой,
 * медиана — жёлтый ромб под шкалой. Шкала неподвижна: значение считается по фактическому размеру элемента.
 */
function NumberLine({ values, domain, selected, hintIndex, title, testId, onSelect, onDragStart, onDrag, onDragEnd, onKeyMove, onAdd }: LineProps) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const dragging = useRef<number | null>(null);
  const [lo, hi] = domain;
  const plotWidth = Math.max(100, width - PAD * 2);
  const unit = plotWidth / (hi - lo);
  const radius = Math.max(3.5, Math.min(11, unit * 0.45));
  const levels = stackLevels(values);
  const tallest = Math.max(0, ...levels);
  const meanY = 30;
  const axisY = 56 + (tallest + 1) * (radius * 2 + 2) + 6;
  const medianY = axisY + 36;
  const height = medianY + 34;
  const x = (value: number) => PAD + (value - lo) * unit;
  const info = describe(values);
  const span = hi - lo;
  const tickStep = span <= 10 ? 1 : span <= 20 ? 2 : span <= 60 ? 5 : 10;
  const ticks = Array.from({ length: Math.floor(span / tickStep) + 1 }, (_, index) => lo + index * tickStep);
  const valueAt = (clientX: number, element: Element) => {
    const rect = element.getBoundingClientRect();
    const scale = rect.width / width;
    return clampValue(lo + ((clientX - rect.left - PAD * scale) / (plotWidth * scale)) * span, lo, hi);
  };
  const dotY = (index: number) => axisY - radius - 2 - levels[index] * (radius * 2 + 2);

  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragging.current === null) return;
    onDrag(dragging.current, valueAt(event.clientX, event.currentTarget));
  };
  const end = () => {
    if (dragging.current === null) return;
    dragging.current = null;
    onDragEnd();
  };

  return (
    <figure className="number-line" ref={ref} data-testid={testId}>
      <figcaption>{title}</figcaption>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label={`${title}: ${values.join(', ')}`}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerDown={(event) => {
          if (!onAdd || !(event.target as Element).classList.contains('line-hit')) return;
          onSelect(null);
          onAdd(valueAt(event.clientX, event.currentTarget));
        }}
      >
        <rect className={onAdd ? 'line-hit line-hit--add' : 'line-hit'} x={0} y={0} width={width} height={height} />

        {info.mean !== null ? (
          <g className="mark-mean" data-testid={`${testId}-mean`} transform={`translate(${x(info.mean)} 0)`}>
            <line y1={meanY + 8} y2={axisY} />
            <path d={`M-9 ${meanY - 6} L9 ${meanY - 6} L0 ${meanY + 8} Z`} />
            <text x={14} y={meanY + 2} textAnchor={x(info.mean) > width - 120 ? 'end' : 'start'} dx={x(info.mean) > width - 120 ? -28 : 0}>
              Среднее {formatStatistic(info.mean)}
            </text>
          </g>
        ) : null}

        <line className="line-axis" x1={PAD} x2={PAD + plotWidth} y1={axisY} y2={axisY} />
        {ticks.map((tick) => (
          <g key={tick} className="line-tick">
            <line x1={x(tick)} x2={x(tick)} y1={axisY} y2={axisY + 5} />
            <text x={x(tick)} y={axisY + 18} textAnchor="middle">
              {tick}
            </text>
          </g>
        ))}

        {info.median !== null ? (
          <g className="mark-median" data-testid={`${testId}-median`} transform={`translate(${x(info.median)} 0)`}>
            <line y1={axisY + 22} y2={axisY} />
            <path d={`M0 ${medianY - 9} L9 ${medianY} L0 ${medianY + 9} L-9 ${medianY} Z`} />
            <text x={14} y={medianY + 5} textAnchor={x(info.median) > width - 120 ? 'end' : 'start'} dx={x(info.median) > width - 120 ? -28 : 0}>
              Медиана {formatStatistic(info.median)}
            </text>
          </g>
        ) : null}

        {hintIndex !== null && values[hintIndex] !== undefined ? (
          <g className="drag-hint" aria-hidden="true">
            <circle cx={x(values[hintIndex])} cy={dotY(hintIndex)} r={radius + 6} />
            <path d={`M${x(values[hintIndex]) + radius + 12} ${dotY(hintIndex)} h46 m-9 -7 l9 7 l-9 7`} />
            <text x={x(values[hintIndex]) + radius + 14} y={dotY(hintIndex) - 12}>
              тяни
            </text>
          </g>
        ) : null}

        {values.map((value, index) => (
          <circle
            key={index}
            className={selected === index ? 'line-dot line-dot--selected' : 'line-dot'}
            cx={x(value)}
            cy={dotY(index)}
            r={radius}
            data-value={value}
            data-index={index}
            tabIndex={0}
            role="slider"
            aria-label={`Точка ${index + 1}`}
            aria-valuemin={lo}
            aria-valuemax={hi}
            aria-valuenow={value}
            onFocus={() => onSelect(index)}
            onKeyDown={(event: ReactKeyboardEvent<SVGCircleElement>) => {
              const step = event.shiftKey ? 5 : 1;
              if (event.key === 'ArrowRight' || event.key === 'ArrowUp') onKeyMove(index, clampValue(value + step, lo, hi));
              else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') onKeyMove(index, clampValue(value - step, lo, hi));
              else return;
              event.preventDefault();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              (event.currentTarget.ownerSVGElement as SVGSVGElement).setPointerCapture(event.pointerId);
              dragging.current = index;
              onSelect(index);
              onDragStart();
            }}
          />
        ))}
      </svg>
    </figure>
  );
}

function StatsLine({ info }: { info: Description }) {
  return (
    <span>
      N = {formatInteger(info.size)} · среднее {show(info.mean)} · медиана {show(info.median)} · размах {show(info.range)} · s{' '}
      {info.size === 1 ? '— нужно 2 точки' : show(info.standardDeviation)}
    </span>
  );
}

export function MeanShift({ active }: { active: boolean }) {
  const [mode, setMode] = useState<Mode>('one');
  const [states, setStates] = useState<Record<Mode, Editable>>(() => ({
    one: startEditable(START.one),
    same: startEditable(START.same),
    own: startEditable(START.own),
  }));
  const [selected, setSelected] = useState<{ sample: number; index: number } | null>({ sample: 0, index: 4 });
  const [dragging, setDragging] = useState(false);
  const [hintDone, setHintDone] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [valueText, setValueText] = useState('');
  const [showHistogram, setShowHistogram] = useState(false);
  const [binWidth, setBinWidth] = useState(10);
  const dragBase = useRef<number[][] | null>(null);
  const animation = useRef<number | null>(null);

  const state = states[mode];
  const domain = DOMAINS[mode];
  const setState = (next: Editable | ((previous: Editable) => Editable)) =>
    setStates((previous) => ({ ...previous, [mode]: typeof next === 'function' ? next(previous[mode]) : next }));
  const change = (samples: number[][]) => setState((previous) => commit(previous, samples));

  // Остановить показ примера при уходе с экрана или смене режима.
  useEffect(() => {
    if (active && mode === 'one') return undefined;
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    animation.current = null;
    setAnimating(false);
    return undefined;
  }, [active, mode]);

  const reset = () => {
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    animation.current = null;
    setAnimating(false);
    setState(startEditable(START[mode]));
    setSelected(mode === 'one' ? { sample: 0, index: 4 } : null);
    if (mode === 'one') setHintDone(false);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setSelected(next === 'one' ? { sample: 0, index: 4 } : null);
    setValueText('');
  };

  /** Плавно перемещает точку 14 до 44. Весь показ — одно действие для «Отменить». */
  const playExample = () => {
    const base = states.one.samples;
    const start = [...MEAN_START];
    const index = start.indexOf(14);
    setHintDone(true);
    setAnimating(true);
    setSelected({ sample: 0, index });
    const startedAt = performance.now();
    const duration = 1600;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const value = Math.round(14 + (MEAN_EXAMPLE_TO - 14) * eased);
      const samples = [start.map((v, i) => (i === index ? value : v))];
      setStates((previous) => ({
        ...previous,
        one: { samples, history: previous.one.history.at(-1) === base ? previous.one.history : [...previous.one.history, base] },
      }));
      if (t < 1) animation.current = requestAnimationFrame(tick);
      else {
        animation.current = null;
        setAnimating(false);
      }
    };
    animation.current = requestAnimationFrame(tick);
  };

  const removeSelected = () => {
    if (!selected) return;
    change(state.samples.map((values, sample) => (sample === selected.sample ? values.filter((_, i) => i !== selected.index) : values)));
    setSelected(null);
  };

  const parsedValue = Number(valueText.replace(',', '.'));
  const valueOk = valueText.trim() !== '' && Number.isFinite(parsedValue) && parsedValue >= domain[0] && parsedValue <= domain[1];
  const applyValue = () => {
    if (!valueOk) return;
    const value = clampValue(parsedValue, domain[0], domain[1]);
    if (mode === 'own' && !selected) {
      change([[...state.samples[0], value]]);
    } else if (selected) {
      change(state.samples.map((values, sample) => (sample === selected.sample ? values.map((v, i) => (i === selected.index ? value : v)) : values)));
      setHintDone(true);
    }
    setValueText('');
  };

  const before = START[mode][0];
  const now = state.samples[0];
  const beforeInfo = describe(before);
  const nowInfo = describe(now);
  const oneChange = mode === 'one' && !dragging && !animating ? singleChange(before, now) : null;
  const hintIndex = mode === 'one' && !hintDone ? now.indexOf(14) : null;
  const { starts, counts } = histogram(state.samples[0], binWidth);

  const action =
    mode === 'one'
      ? 'Перетащи точку 14 вправо. Что произойдёт со средним?'
      : mode === 'same'
        ? 'Сравни два ряда: центры совпадают, а точки разбросаны по-разному.'
        : 'Нажми на шкалу, чтобы добавить точку. Тяни точки и смотри, как меняются показатели.';

  return (
    <section className="experiment experiment--mean" id="panel-mean" hidden={!active}>
      <div className="experiment-head">
        <h2>Как одна точка меняет среднее</h2>
        <p className="action-line" data-testid="mean-action">
          {action}
        </p>
      </div>

      <div className="viz-column">
        {state.samples.map((values, sample) => (
          <NumberLine
            key={`${mode}-${sample}`}
            testId={`line-${sample}`}
            title={mode === 'same' ? `Ряд ${sample + 1}: ${values.join(', ')}` : mode === 'one' ? 'Пять точек на числовой прямой' : `Своя выборка: ${values.length} точек`}
            values={values}
            domain={domain}
            selected={selected?.sample === sample ? selected.index : null}
            hintIndex={sample === 0 ? hintIndex : null}
            onSelect={(index) => setSelected(index === null ? null : { sample, index })}
            onDragStart={() => {
              dragBase.current = state.samples;
              setDragging(true);
            }}
            onDrag={(index, value) => {
              const base = dragBase.current;
              if (!base) return;
              setHintDone(true);
              const samples = base.map((current, i) => (i === sample ? current.map((v, j) => (j === index ? value : v)) : current));
              // Одно перетаскивание — одно действие: в историю попадает состояние до начала жеста.
              setState((previous) => ({ samples, history: previous.history.at(-1) === base ? previous.history : [...previous.history, base] }));
            }}
            onDragEnd={() => {
              dragBase.current = null;
              setDragging(false);
            }}
            onKeyMove={(index, value) => {
              setHintDone(true);
              change(state.samples.map((current, i) => (i === sample ? current.map((v, j) => (j === index ? value : v)) : current)));
            }}
            onAdd={mode === 'own' ? (value) => change([[...state.samples[0], value]]) : undefined}
          />
        ))}

        {mode === 'one' ? (
          <>
            <p className="mean-result viz-secondary" data-testid="mean-result" aria-live="polite">
              <span className="mean-result-mean">Среднее: {show(beforeInfo.mean)} → {show(nowInfo.mean)}</span> ·{' '}
              <span className="mean-result-median">Медиана: {show(beforeInfo.median)} → {show(nowInfo.median)}</span>
            </p>
            {oneChange ? (
              <p className="explain-box viz-secondary" data-testid="mean-explanation">
                {explainChange(oneChange, formatStatistic)}
              </p>
            ) : null}
          </>
        ) : null}
        {mode === 'same' ? (
          <div className="same-stats viz-secondary" data-testid="same-stats">
            {state.samples.map((values, sample) => (
              <p key={sample}>
                <strong>Ряд {sample + 1}:</strong> <StatsLine info={describe(values)} />
              </p>
            ))}
            <p className="hint">Центры совпали — среднее и медиана равны 4 в обоих рядах. Но во втором точки дальше от центра: размах и s больше.</p>
          </div>
        ) : null}
        {mode === 'own' ? (
          <p className="hint" data-testid="own-stats">
            <StatsLine info={nowInfo} />
          </p>
        ) : null}


        {mode === 'own' ? (
          <div className="own-histogram viz-secondary">
            <label className="check">
              <input type="checkbox" checked={showHistogram} onChange={(event) => setShowHistogram(event.target.checked)} />
              <span>Показать гистограмму</span>
            </label>
            {showHistogram ? (
              <>
                <BarChart
                  values={counts}
                  labels={starts}
                  maximum={Math.max(1, ...counts)}
                  formatTick={formatInteger}
                  ariaLabel={`Гистограмма с интервалами ширины ${binWidth}`}
                  labelEvery={Math.max(1, Math.ceil(counts.length / 10))}
                />
                <p className="series-axis-title series-axis-title--x">Значение (начало интервала); высота — число точек</p>
                <RangeField id="bin-width" label="Ширина интервала" value={binWidth} min={1} max={25} onChange={setBinWidth} display={String(binWidth)} />
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="side-column">
        {mode === 'one' ? (
          <button className="btn btn--primary" type="button" disabled={animating} onClick={playExample} data-testid="mean-example">
            Показать на примере
          </button>
        ) : null}
        <div className="actions actions--two">
          <button className="btn" type="button" disabled={state.history.length === 0 || animating} onClick={() => setState(undo(state))}>
            Отменить
          </button>
          <button className="btn btn--quiet" type="button" onClick={reset}>
            Сначала
          </button>
        </div>

        <form
          className="field"
          onSubmit={(event) => {
            event.preventDefault();
            applyValue();
          }}
        >
          <label htmlFor="point-value">
            {mode === 'own' && !selected
              ? `Добавить точку (от ${domain[0]} до ${domain[1]})`
              : selected
                ? `Новое значение точки ${state.samples[selected.sample]?.[selected.index] ?? ''}`
                : 'Выберите точку нажатием'}
          </label>
          <div className="range-row">
            <input
              id="point-value"
              className="input input--short"
              type="text"
              inputMode="numeric"
              value={valueText}
              aria-invalid={valueText.trim() !== '' && !valueOk}
              onChange={(event) => setValueText(event.target.value)}
            />
            <button className="btn" type="submit" disabled={!valueOk || (!selected && mode !== 'own')}>
              {mode === 'own' && !selected ? 'Добавить' : 'Применить'}
            </button>
          </div>
          <p className="hint">Выбранную точку можно двигать и стрелками ← → (с Shift — на 5).</p>
        </form>

        {mode === 'own' ? (
          <button className="btn btn--quiet" type="button" disabled={!selected} onClick={removeSelected}>
            Удалить выбранную точку
          </button>
        ) : null}

        <details className="more">
          <summary>Как считаются среднее и медиана</summary>
          <div className="more-body">
            <p>Среднее — сумма всех значений, делённая на их число. Оно учитывает каждое значение, поэтому одна далёкая точка тянет его за собой.</p>
            <p>
              Медиана — центральное значение упорядоченного ряда (при чётном числе точек — среднее двух центральных). Пока
              точка остаётся по ту же сторону от центра, медиана не меняется.
            </p>
          </div>
        </details>
      </div>
      <div className="notes mean-modes">
          <Segmented
            legend="Режим"
            options={[
              { value: 'one', label: 'Одна точка' },
              { value: 'same', label: 'Одинаковое среднее' },
              { value: 'own', label: 'Своя выборка' },
            ]}
            value={mode}
            onChange={switchMode}
          />
        </div>
    </section>
  );
}
