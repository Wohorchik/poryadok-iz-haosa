import { useId } from 'react';
import { formatStatistic } from '../../lib/format';
import { summarize } from '../../lib/statistics';
import { outlierRow } from '../math';
import { RailScene } from '../RailScene';
import type { WidgetProps } from '../types';
import { OUTLIER_DOMAIN, type OutlierState } from './state';

const f = formatStatistic;

/** 1.4: любую точку можно утащить. Среднее сдвигается на Δ/N, медиана — только когда точка перескочит середину ряда. */
export function OutlierWidget({ state, onChange }: WidgetProps<OutlierState>) {
  const { n, values } = state;
  const nId = useId();
  const start = outlierRow(n, 0);
  const before = summarize(start);
  const now = summarize(values);
  const mean = now.mean ?? 0;
  const median = now.median ?? 0;
  const delta = values.reduce((sum, v, i) => sum + (v - start[i]), 0);

  const move = (index: number, value: number) =>
    onChange({ ...state, values: values.map((v, i) => (i === index ? Math.round(value * 10) / 10 : v)) });

  return (
    <div className="c-widget">
      <div className="c-range">
        <label htmlFor={nId}>
          Объём выборки <output htmlFor={nId}>N = {n}</output>
        </label>
        <input id={nId} type="range" min={5} max={30} step={1} value={n} onChange={(event) => {
          const next = Number(event.target.value);
          onChange({ n: next, values: outlierRow(next, 0) });
        }} />
      </div>

      <RailScene
        values={values}
        domain={OUTLIER_DOMAIN}
        onMove={move}
        above={110}
        ticks={[40, 60, 80, 100, 120, 140, 160]}
        sprite={(i) => (Math.abs(values[i] - start[i]) > 0.05 ? 'ballGlass' : 'ballChrome')}
        markers={[
          { value: mean, color: '#ff4fc8', label: 'x̄ = ' + f(mean) },
          { value: median, color: '#ffffff', label: 'Me = ' + f(median) },
        ]}
        label={`Выборка из ${n} значений. Среднее ${f(mean)}, медиана ${f(median)}.`}
      />

      <dl className="c-readout">
        <div>
          <dt>Среднее x̄</dt>
          <dd className="c-theory-text">{f(mean)}</dd>
        </div>
        <div>
          <dt>Медиана</dt>
          <dd>{f(median)}</dd>
        </div>
        <div className="c-readout-wide">
          <dt>Сдвиг среднего</dt>
          <dd className="c-dd-small">
            Δx̄ = Δ / N = {f(delta)} / {n} = {f(delta / n)}
          </dd>
        </div>
        <div className="c-readout-wide" style={{ gridColumn: '1 / -1' }}>
          <dt>Сдвиг медианы</dt>
          <dd className="c-dd-small">
            {f(median - (before.median ?? 0))}
            {Math.abs(median - (before.median ?? 0)) < 0.05 ? ' — медиана устояла' : ' — точка перескочила середину ряда'}
          </dd>
        </div>
      </dl>
      <div className="c-actions">
        <button type="button" className="c-btn c-btn--small c-btn--ghost" onClick={() => onChange({ n, values: outlierRow(n, 0) })}>
          Вернуть точки на места
        </button>
      </div>
      <p className="c-widget-note">
        Тащите любой шарик (сдвинутые становятся синими). Δ — сумма всех сдвигов. Попробуйте утащить самое большое значение вправо, а потом — одно из средних через середину ряда.
      </p>
    </div>
  );
}
