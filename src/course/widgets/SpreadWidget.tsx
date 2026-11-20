import { useId } from 'react';
import { formatStatistic } from '../../lib/format';
import { rangeOf, stretch, variance } from '../math';
import { RailScene, type RailHelpers } from '../RailScene';
import type { WidgetProps } from '../types';
import { SPREAD_DOMAIN, type SpreadState } from './state';

const f = formatStatistic;
const mean = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length;

/** 1.3: квадраты отклонений. Точки можно таскать, ползунок растягивает выборку от среднего. */
export function SpreadWidget({ state, onChange }: WidgetProps<SpreadState>) {
  const { k, base } = state;
  const id = useId();
  const values = stretch(base, k);
  const m = mean(values);
  const d = variance(values);
  const sigma = Math.sqrt(d);
  const baseD = variance(base);

  /** Точку тащат на экране (после растяжения) — пересчитываем исходную выборку. */
  const move = (index: number, value: number) => {
    const next = [...base];
    next[index] = Math.round((m + (value - m) / k) * 10) / 10;
    onChange({ ...state, base: next.map((v) => Math.min(SPREAD_DOMAIN[1], Math.max(SPREAD_DOMAIN[0], v))) });
  };

  const underlay = ({ context, x, unit, railY }: RailHelpers) => {
    context.lineWidth = 2;
    values.forEach((value) => {
      const side = Math.abs(value - m) * unit;
      if (side < 1) return;
      context.fillStyle = 'rgba(74, 92, 255, 0.14)';
      context.strokeStyle = '#6b7bff';
      context.shadowColor = 'rgba(74, 92, 255, 0.7)';
      context.shadowBlur = 12;
      context.fillRect(Math.min(x(value), x(m)), railY - side, side, side);
      context.strokeRect(Math.min(x(value), x(m)), railY - side, side, side);
    });
    // Квадрат со стороной σ: его площадь — средняя площадь синих квадратов, то есть D.
    const s = sigma * unit;
    context.shadowColor = 'rgba(255, 79, 200, 0.7)';
    context.strokeStyle = '#ff4fc8';
    context.fillStyle = 'rgba(255, 79, 200, 0.08)';
    context.setLineDash([7, 6]);
    context.fillRect(x(m) - s / 2, railY - s, s, s);
    context.strokeRect(x(m) - s / 2, railY - s, s, s);
    context.setLineDash([]);
    context.shadowBlur = 0;
  };

  return (
    <div className="c-widget">
      <div className="c-range">
        <label htmlFor={id}>
          Растянуть выборку от среднего <output htmlFor={id}>× {f(k)}</output>
        </label>
        <input id={id} type="range" min={0.5} max={2} step={0.25} value={k} onChange={(event) => onChange({ ...state, k: Number(event.target.value) })} />
      </div>

      <RailScene
        values={values}
        domain={SPREAD_DOMAIN}
        onMove={move}
        underlay={underlay}
        aboveUnits={12.2}
        ticks={[-4, 0, 4, 8, 12, 16, 20]}
        markers={[{ value: m, color: '#ff4fc8', label: 'x̄ = ' + f(m) }]}
        label={`Выборка ${values.map(f).join('; ')}. Квадраты отклонений от среднего ${f(m)}. D = ${f(d)}, σ = ${f(sigma)}.`}
      />

      <dl className="c-readout">
        <div>
          <dt>Размах R</dt>
          <dd>{f(rangeOf(values))}</dd>
        </div>
        <div>
          <dt>Дисперсия D</dt>
          <dd>{f(d)}</dd>
        </div>
        <div>
          <dt>σ = √D</dt>
          <dd className="c-theory-text">{f(sigma)}</dd>
        </div>
        <div>
          <dt>Выборка</dt>
          <dd className="c-dd-small">{values.map(f).join('; ')}</dd>
        </div>
        <div className="c-readout-wide" style={{ gridColumn: '1 / -1' }}>
          <dt>По сравнению с выборкой без растяжения</dt>
          <dd className="c-dd-small">
            {k === 1
              ? `Без растяжения: D = ${f(baseD)}, σ = ${f(Math.sqrt(baseD))}`
              : k > 1
                ? `σ выросло в ${f(k)} раза, D — в ${f(k)}² = ${f(k * k)} раза: ${f(baseD)} × ${f(k * k)} = ${f(d)}`
                : `σ уменьшилось в ${f(1 / k)} раза, D — в ${f(1 / k)}² = ${f(1 / (k * k))} раза: ${f(baseD)} × ${f(k * k)} = ${f(d)}`}
          </dd>
        </div>
      </dl>
      <div className="c-actions">
        <button type="button" className="c-btn c-btn--small c-btn--ghost" onClick={() => onChange({ k: 1, base: [2, 5, 7, 8, 13] })}>
          Вернуть исходную выборку
        </button>
      </div>
      <p className="c-widget-note">
        Тащите любой шарик — квадраты перестроятся. Малиновый пунктирный квадрат со стороной σ имеет площадь D: столько в среднем занимает один синий.
      </p>
    </div>
  );
}
