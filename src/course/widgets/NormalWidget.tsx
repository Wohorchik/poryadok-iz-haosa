import { useId } from 'react';
import { useElementWidth } from '../../hooks/useElementWidth';
import { ColumnsChart } from '../ColumnsChart';
import { binomialDistribution } from '../../lib/galton';
import { formatStatistic } from '../../lib/format';
import { maxApproxError, normalDensity, shareWithin } from '../math2';
import type { WidgetProps } from '../types';
import type { NormalState } from './state';

const f = formatStatistic;
const SUPER = '⁰¹²³⁴⁵⁶⁷⁸⁹';
/** 0,0002 → «2·10⁻⁴»: маленькие числа в привычной записи. */
function scientific(value: number): string {
  const power = Math.floor(Math.log10(value));
  const mantissa = Math.round((value / 10 ** power) * 10) / 10;
  return `${f(mantissa)}·10⁻${String(-power).split('').map((d) => SUPER[Number(d)]).join('')}`;
}

/** Точное биномиальное распределение (синие столбики) и нормальная кривая (малиновая) с полосой μ ± 2σ. */
export function NormalWidget({ state, onChange }: WidgetProps<NormalState>) {
  const { m } = state;
  const p = state.p / 100;
  const mId = useId();
  const pId = useId();
  const { ref, width } = useElementWidth<HTMLDivElement>(640);

  const probabilities = binomialDistribution(p, m);
  const mu = m * p;
  const sigma = Math.sqrt(m * p * (1 - p));
  const npq = m * p * (1 - p);
  const share = shareWithin(m, p, mu - 2 * sigma, mu + 2 * sigma);
  const error = maxApproxError(m, p);

  const W = Math.max(280, width);

  return (
    <div className="c-widget" ref={ref}>
      <div className="c-range">
        <label htmlFor={mId}>
          Число уровней <output htmlFor={mId}>m = {m}</output>
        </label>
        <input id={mId} type="range" min={4} max={100} value={m} onChange={(event) => onChange({ ...state, m: Number(event.target.value) })} />
      </div>
      <div className="c-range">
        <label htmlFor={pId}>
          Вероятность поворота вправо <output htmlFor={pId}>p = {f(p)}</output>
        </label>
        <input id={pId} type="range" min={10} max={90} step={10} value={state.p} onChange={(event) => onChange({ ...state, p: Number(event.target.value) })} />
      </div>

      <ColumnsChart
        values={probabilities}
        variant="sample"
        format={(value) => f(value)}
        curve={(value) => normalDensity(value, mu, sigma)}
        band={[mu - 2 * sigma, mu + 2 * sigma]}
        labelEvery={Math.ceil((m + 1) / 12)}
        height={W < 480 ? 220 : 280}
        label={`Биномиальное распределение m = ${m}, p = ${f(p)} и нормальная кривая. В μ ± 2σ — ${Math.round(share * 100)} %`}
      />

      <dl className="c-readout">
        <div>
          <dt>μ = mp</dt>
          <dd className="c-theory-text">{f(mu)}</dd>
        </div>
        <div>
          <dt>σ = √(mp(1 − p))</dt>
          <dd className="c-theory-text">{f(sigma)}</dd>
        </div>
        <div className="c-readout-wide">
          <dt>Точная доля в μ ± 2σ</dt>
          <dd>{f(share * 100)} %</dd>
        </div>
        <div className="c-readout-wide">
          <dt>Наибольшее расхождение столбиков и кривой</dt>
          <dd className="c-dd-small">{error < 0.001 ? scientific(error) : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(error)}</dd>
        </div>
        <div className="c-readout-wide">
          <dt>mp(1 − p)</dt>
          <dd className="c-dd-small">
            {f(npq)} {npq > 9 ? '> 9 — приближение хорошее' : '≤ 9 — приближение грубое'}
          </dd>
        </div>
      </dl>
      <p className="c-widget-note">Синие столбики — точные биномиальные вероятности, малиновая кривая — нормальная плотность. Полоса — μ ± 2σ.</p>
    </div>
  );
}
