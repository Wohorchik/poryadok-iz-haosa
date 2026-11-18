import { useState, type CSSProperties, type ReactNode } from 'react';
import { niceTicks } from '../lib/chart';
import { formatStatistic } from '../lib/format';

/* ---------- Линейный график ---------- */

export interface LineSeries {
  points: readonly (readonly [number, number])[];
  /** Класс задаёт цвет: series-amber, series-cyan, series-coral, series-mist. */
  className: string;
  label: string;
  kind?: 'line' | 'dashed' | 'dots';
}

const SIZE = 1000;

/**
 * График: деления и подписи осей — обычный HTML (не мельчают на телефоне),
 * линии — SVG, растянутый на всю область, с толщиной, не зависящей от масштаба.
 */
export function LineChart({
  series,
  xDomain,
  yDomain,
  xLabel,
  yLabel,
  formatX = formatStatistic,
  formatY = formatStatistic,
  ariaLabel,
  height,
}: {
  series: readonly LineSeries[];
  xDomain: readonly [number, number];
  yDomain: readonly [number, number];
  xLabel: string;
  yLabel: string;
  formatX?: (value: number) => string;
  formatY?: (value: number) => string;
  ariaLabel: string;
  height?: string;
}) {
  const y = niceTicks(yDomain[0], yDomain[1], 4);
  const x = niceTicks(xDomain[0], xDomain[1], 5);
  const xMin = xDomain[0];
  const xMax = xDomain[1] > xDomain[0] ? xDomain[1] : xDomain[0] + 1;
  const px = (value: number) => ((value - xMin) / (xMax - xMin)) * SIZE;
  const py = (value: number) => SIZE - ((value - y.min) / (y.max - y.min)) * SIZE;
  // Для целочисленной оси (номер шарика, кадра, попытки) дробные деления не показываем.
  const integerX = Number.isInteger(xDomain[0]) && Number.isInteger(xDomain[1]);
  const xTicks = x.ticks.filter((tick) => tick >= xMin - 1e-9 && tick <= xMax + 1e-9 && (!integerX || Number.isInteger(tick)));

  return (
    <figure className="line-chart" style={height ? ({ '--line-chart-height': height } as CSSProperties) : undefined}>
      <p className="series-axis-title" aria-hidden="true">
        {yLabel}
      </p>
      <div className="line-chart-body">
        <div className="chart-axis" aria-hidden="true">
          {y.ticks.map((tick) => (
            <span key={tick} style={{ bottom: `${((tick - y.min) / (y.max - y.min)) * 100}%` }}>
              {formatY(tick)}
            </span>
          ))}
        </div>
        <div className="line-chart-plot">
          {y.ticks.map((tick) => (
            <span className="chart-line" key={tick} style={{ bottom: `${((tick - y.min) / (y.max - y.min)) * 100}%` }} />
          ))}
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel}>
            {series.map((item) =>
              item.kind === 'dots' ? (
                <path
                  key={item.label}
                  className={`line-dots ${item.className}`}
                  vectorEffect="non-scaling-stroke"
                  d={item.points.map(([a, b]) => `M${px(a).toFixed(1)} ${py(b).toFixed(1)}h0`).join('')}
                />
              ) : (
                <polyline
                  key={item.label}
                  className={`line-series ${item.className} ${item.kind === 'dashed' ? 'line-series--dashed' : ''}`}
                  vectorEffect="non-scaling-stroke"
                  points={item.points.map(([a, b]) => `${px(a).toFixed(1)},${py(b).toFixed(1)}`).join(' ')}
                />
              ),
            )}
          </svg>
        </div>
        <div className="line-chart-x" aria-hidden="true">
          {xTicks.map((tick) => (
            <span key={tick} style={{ left: `${((tick - xMin) / (xMax - xMin)) * 100}%` }}>
              {formatX(tick)}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="series-axis-title series-axis-title--x">{xLabel}</figcaption>
      <div className="chart-legend line-legend">
        {series.map((item) => (
          <span key={item.label} className={`legend-line ${item.className} legend-line--${item.kind ?? 'line'}`}>
            {item.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

/* ---------- Столбчатая диаграмма ---------- */

export function BarChart({
  values,
  labels,
  theory,
  maximum,
  formatTick,
  selected = null,
  highlight = null,
  onSelect,
  showTheoryLabels = false,
  formatTheory = formatStatistic,
  ariaLabel,
  barLabel,
  labelEvery = 1,
}: {
  values: readonly number[];
  labels: readonly (string | number)[];
  theory?: readonly number[];
  maximum: number;
  formatTick: (value: number) => string;
  selected?: number | null;
  highlight?: number | null;
  onSelect?: (index: number) => void;
  showTheoryLabels?: boolean;
  formatTheory?: (value: number) => string;
  ariaLabel: string;
  barLabel?: (index: number) => string;
  labelEvery?: number;
}) {
  const { ticks, max } = niceTicks(0, maximum > 0 ? maximum : 1, 4);
  const top = max;
  return (
    <div className="bar-chart" style={{ '--bins': values.length } as CSSProperties}>
      <div className="chart" role="img" aria-label={ariaLabel}>
        <div className="chart-axis" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} style={{ bottom: `${(tick / top) * 100}%` }}>
              {formatTick(tick)}
            </span>
          ))}
        </div>
        <div className="chart-plot">
          {ticks.map((tick) => (
            <span className="chart-line" key={tick} style={{ bottom: `${(tick / top) * 100}%` }} aria-hidden="true" />
          ))}
          {values.map((value, index) => {
            const classes = ['chart-column'];
            if (selected === index) classes.push('chart-column--selected');
            const bar = (
              <>
                <span
                  className={highlight === index ? 'chart-bar chart-bar--highlight' : 'chart-bar'}
                  data-value={value}
                  style={{ height: `${(value / top) * 100}%` }}
                />
                {theory ? (
                  // Ожидание — контурный столбец от нуля до расчётной высоты, чуть шире фактического и поверх него.
                  <span className="chart-theory-column" data-value={theory[index]} style={{ height: `${(theory[index] / top) * 100}%` }}>
                    {showTheoryLabels ? <span className="chart-theory-label">{formatTheory(theory[index])}</span> : null}
                  </span>
                ) : null}
              </>
            );
            return onSelect ? (
              <button
                key={index}
                type="button"
                className={`${classes.join(' ')} chart-column--button`}
                aria-pressed={selected === index}
                aria-label={barLabel ? barLabel(index) : String(labels[index])}
                onClick={() => onSelect(index)}
              >
                {bar}
              </button>
            ) : (
              <div key={index} className={classes.join(' ')} aria-hidden="true">
                {bar}
              </div>
            );
          })}
        </div>
      </div>
      <div className="series-x" aria-hidden="true">
        {labels.map((label, index) => (
          <span key={index}>{index % labelEvery === 0 ? label : ''}</span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Повтор запуска ---------- */

export function RunControls({
  seed,
  onRepeat,
  onNew,
  note,
  onSeed,
}: {
  seed: number;
  onRepeat: () => void;
  onNew: () => void;
  note?: ReactNode;
  /** Если задан, можно ввести seed вручную — например, чтобы повторить чужой запуск. */
  onSeed?: (seed: number) => void;
}) {
  const [seedText, setSeedText] = useState('');
  const parsedSeed = Number(seedText.trim());
  const seedOk = /^\d{1,10}$/.test(seedText.trim()) && parsedSeed >= 1 && parsedSeed <= 4294967295;
  // Дополнительная настройка: свёрнута под опытом и раскрывается по запросу.
  return (
    <details className="more run-controls">
      <summary>Повтор запуска</summary>
      <p className="hint">
        Запуск <span className="run-seed">seed {seed}</span>. {note ?? 'Повтор восстанавливает те же настройки и seed — результат совпадёт при любой скорости.'}
      </p>
      <div className="actions actions--two">
        <button className="btn" type="button" onClick={onRepeat}>
          Повторить этот запуск
        </button>
        <button className="btn" type="button" onClick={onNew}>
          Новый случайный запуск
        </button>
      </div>
      {onSeed ? (
        <form
          className="range-row seed-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!seedOk) return;
            onSeed(parsedSeed);
            setSeedText('');
          }}
        >
          <label htmlFor="seed-input" className="visually-hidden">
            Свой seed
          </label>
          <input
            id="seed-input"
            className="input"
            type="text"
            inputMode="numeric"
            placeholder="свой seed"
            value={seedText}
            aria-invalid={seedText.trim() !== '' && !seedOk}
            onChange={(event) => setSeedText(event.target.value)}
          />
          <button className="btn" type="submit" disabled={!seedOk}>
            Применить seed
          </button>
        </form>
      ) : null}
    </details>
  );
}

/** Ползунок с подписью и текущим значением. */
export function RangeField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  display,
  marks,
  disabled,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  display: string;
  marks?: readonly { value: number; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="field range-field">
      <label htmlFor={id}>
        {label}: <output htmlFor={id}>{display}</output>
      </label>
      <input
        id={id}
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        list={marks ? `${id}-marks` : undefined}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {marks ? (
        <>
          <datalist id={`${id}-marks`}>
            {marks.map((mark) => (
              <option key={mark.value} value={mark.value} label={mark.label} />
            ))}
          </datalist>
          <div className="range-marks" aria-hidden="true">
            {marks.map((mark) => (
              <span key={mark.value} style={{ left: `${((mark.value - min) / (max - min)) * 100}%` }}>
                {mark.label}
              </span>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Переключатель из нескольких вариантов (кнопки с aria-pressed). */
export function Segmented<T extends string | number>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="segmented">
      <legend>{legend}</legend>
      <div className="segmented-options">
        {options.map((option) => (
          <button
            key={String(option.value)}
            className="chip"
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
