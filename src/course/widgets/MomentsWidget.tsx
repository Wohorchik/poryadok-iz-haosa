import { useId, useMemo } from 'react';
import { binomialDistribution } from '../../lib/galton';
import { formatStatistic } from '../../lib/format';
import { GaltonScene } from '../GaltonScene';
import { variance } from '../math';
import { dropPathsMP } from '../math2';
import type { WidgetProps } from '../types';
import { useLaunch } from './FrequencyWidget';
import { MOMENTS_MAX, type MomentsState } from './state';

const f = formatStatistic;

/** 2.2: поток шариков на доске m × p; среднее и дисперсия выборки догоняют E = mp и D = mp(1 − p). */
export function MomentsWidget({ state, onChange }: WidgetProps<MomentsState>) {
  const { m, thrown, seed } = state;
  const p = state.p / 100;
  const mId = useId();
  const pId = useId();

  const paths = useMemo(() => dropPathsMP(seed, thrown, m, p), [seed, thrown, m, p]);
  const launch = useLaunch(paths, seed * 1000 + m * 101 + state.p);
  const sample = useMemo(() => paths.map((path) => path.filter(Boolean).length), [paths]);
  const counts = Array<number>(m + 1).fill(0);
  for (const bin of sample) counts[bin] += 1;
  const theory = binomialDistribution(p, m);
  const mean = thrown ? sample.reduce((s, v) => s + v, 0) / thrown : null;
  const sampleD = thrown ? variance(sample) : null;
  const e = m * p;
  const d = m * p * (1 - p);

  const restart = (changes: Partial<MomentsState>) => onChange({ ...state, ...changes, thrown: 0 });
  const markers = [
    { value: e, color: '#ff4fc8', label: 'E = ' + f(e) },
    ...(mean === null ? [] : [{ value: mean, color: '#8290ff', label: 'x̄ = ' + f(mean) }]),
  ];

  return (
    <div className="c-widget">
      <div className="c-range">
        <label htmlFor={mId}>
          Число уровней <output htmlFor={mId}>m = {m}</output>
        </label>
        <input id={mId} type="range" min={2} max={16} value={m} onChange={(event) => restart({ m: Number(event.target.value) })} />
      </div>
      <div className="c-range">
        <label htmlFor={pId}>
          Вероятность поворота вправо <output htmlFor={pId}>p = {f(p)}</output>
        </label>
        <input id={pId} type="range" min={5} max={95} step={5} value={state.p} onChange={(event) => restart({ p: Number(event.target.value) })} />
      </div>
      <div className="c-actions" role="group" aria-label="Бросить шарики">
        {[10, 100, 1000].map((count) => (
          <button key={count} type="button" className="c-btn c-btn--small" disabled={thrown >= MOMENTS_MAX} onClick={() => onChange({ ...state, thrown: Math.min(MOMENTS_MAX, thrown + count) })}>
            +{count}
          </button>
        ))}
        <button type="button" className="c-btn c-btn--small c-btn--ghost" disabled={thrown === 0} onClick={() => restart({})}>
          Сначала
        </button>
      </div>

      <GaltonScene
        m={m}
        counts={counts}
        mode="share"
        theory={theory}
        selected={null}
        launch={launch}
        markers={markers}
        label={`Доска m = ${m}, p = ${f(p)}: брошено ${thrown} шариков. Среднее выборки ${mean === null ? 'нет' : f(mean)}, E = ${f(e)}.`}
      />

      <dl className="c-readout">
        <div>
          <dt>Шариков</dt>
          <dd>N = {thrown}</dd>
        </div>
        <div>
          <dt>Среднее выборки</dt>
          <dd className="c-accent-dd">x̄ = {mean === null ? '—' : f(mean)}</dd>
        </div>
        <div className="c-readout-wide">
          <dt>Теория</dt>
          <dd className="c-theory-text">E = mp = {f(e)}</dd>
        </div>
        <div className="c-readout-wide">
          <dt>Дисперсия выборки</dt>
          <dd className="c-accent-dd">{sampleD === null ? '—' : f(sampleD)}</dd>
        </div>
        <div className="c-readout-wide">
          <dt>Теория</dt>
          <dd className="c-theory-text">D = mp(1 − p) = {f(d)}</dd>
        </div>
      </dl>
      <p className="c-widget-note">Синее стекло — выборка, малиновые шарики — формула. При смене m или p выборка начинается заново.</p>
    </div>
  );
}
