import { useId, useMemo } from 'react';
import { binomialCoefficient, binomialDistribution } from '../../lib/galton';
import { formatStatistic } from '../../lib/format';
import { newSeed } from '../../lib/random';
import { ColumnsChart } from '../ColumnsChart';
import { GaltonScene } from '../GaltonScene';
import { dropPathsMP } from '../math2';
import type { WidgetProps } from '../types';
import { useLaunch } from './FrequencyWidget';
import { PATHS_MAX, type PathsState } from './state';

const f = formatStatistic;
/** Маленькие вероятности — двумя значащими цифрами. */
const small = (value: number) => (value === 0 ? '0' : value >= 0.01 ? f(value) : value.toPrecision(2).replace('.', ','));

/** 2.1: шарики летят сквозь штырьки, путь последнего виден; рядом — вероятности ячеек по формуле. */
export function PathsWidget({ state, onChange }: WidgetProps<PathsState>) {
  const { m, k, seed, thrown } = state;
  const p = state.p / 100;
  const mId = useId();
  const pId = useId();

  const paths = useMemo(() => dropPathsMP(seed, thrown, m, p), [seed, thrown, m, p]);
  const launch = useLaunch(paths, seed * 1000 + m * 101 + state.p);
  const counts = useMemo(() => {
    const c = Array<number>(m + 1).fill(0);
    for (const path of paths) c[path.filter(Boolean).length] += 1;
    return c;
  }, [paths, m]);
  const last = paths[paths.length - 1] ?? null;
  const probabilities = binomialDistribution(p, m);
  const ways = binomialCoefficient(m, k);
  const onePath = p ** k * (1 - p) ** (m - k);

  const restart = (changes: Partial<PathsState>) => onChange({ ...state, ...changes, thrown: 0 });
  const throwMore = (count: number) => onChange({ ...state, thrown: Math.min(PATHS_MAX, thrown + count) });

  return (
    <div className="c-widget">
      <div className="c-range">
        <label htmlFor={mId}>
          Число уровней <output htmlFor={mId}>m = {m}</output>
        </label>
        <input id={mId} type="range" min={1} max={10} value={m} onChange={(event) => {
          const next = Number(event.target.value);
          restart({ m: next, k: Math.min(k, next) });
        }} />
      </div>
      <div className="c-range">
        <label htmlFor={pId}>
          Вероятность поворота вправо <output htmlFor={pId}>p = {f(p)}</output>
        </label>
        <input id={pId} type="range" min={0} max={100} step={5} value={state.p} onChange={(event) => restart({ p: Number(event.target.value) })} />
      </div>

      <div className="c-actions">
        <button type="button" className="c-btn c-btn--small" disabled={thrown >= PATHS_MAX} onClick={() => throwMore(1)}>
          Бросить шарик
        </button>
        <button type="button" className="c-btn c-btn--small" disabled={thrown >= PATHS_MAX} onClick={() => throwMore(10)}>
          +10
        </button>
        <button type="button" className="c-btn c-btn--small c-btn--ghost" disabled={thrown === 0} onClick={() => restart({ seed: newSeed() })}>
          Сначала
        </button>
        <span className="c-widget-note" role="status">
          {last ? `Последний путь: ${last.map((right) => (right ? 'В' : 'Л')).join(' ') || '—'} → ячейка ${last.filter(Boolean).length}` : 'Шариков пока нет'}
        </span>
      </div>

      <GaltonScene
        m={m}
        counts={counts}
        mode="count"
        theory={thrown > 0 ? probabilities : null}
        selected={k}
        onSelect={(next) => onChange({ ...state, k: next })}
        launch={launch}
        look="stack"
        trail={last}
        label={`Доска из ${m} уровней, брошено ${thrown} шариков. Последний упал в ячейку ${last ? last.filter(Boolean).length : '—'}.`}
      />

      <p className="c-widget-note">Вероятности ячеек по формуле — малиновое стекло:</p>
      <ColumnsChart
        values={probabilities}
        variant="theory"
        selected={k}
        onSelect={(next) => onChange({ ...state, k: next })}
        format={small}
        height={180}
        label={`Биномиальные вероятности при m = ${m}, p = ${f(p)}. P(X = ${k}) = ${small(probabilities[k])}`}
      />

      <dl className="c-readout">
        <div>
          <dt>Путей в ячейку {k}</dt>
          <dd>
            C({m}, {k}) = {ways}
          </dd>
        </div>
        <div>
          <dt>Вероятность одного пути</dt>
          <dd className="c-dd-small">
            p<sup>{k}</sup>(1 − p)<sup>{m - k}</sup> = {small(onePath)}
          </dd>
        </div>
        <div className="c-readout-wide">
          <dt>Вероятность ячейки</dt>
          <dd className="c-theory-text">
            P(X = {k}) = {ways} · {small(onePath)} = {small(probabilities[k])}
          </dd>
        </div>
      </dl>
    </div>
  );
}
