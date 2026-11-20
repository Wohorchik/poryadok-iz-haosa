import { useMemo, useRef } from 'react';
import { binomialDistribution } from '../../lib/galton';
import { formatStatistic } from '../../lib/format';
import { newSeed } from '../../lib/random';
import { GaltonScene, type GaltonLaunch } from '../GaltonScene';
import { BOARD_LEVELS, frequencyTable } from '../math';
import { dropPathsMP } from '../math2';
import type { WidgetProps } from '../types';
import { MAX_THROWN, type FrequencyState } from './state';

const THEORY = binomialDistribution(0.5, BOARD_LEVELS);

/** Новые шарики партии для анимации: всё, что брошено после прошлого показа. */
export function useLaunch(paths: boolean[][], seed: number): GaltonLaunch | null {
  const seen = useRef({ seed, count: paths.length });
  const launch = useRef<GaltonLaunch | null>(null);
  if (seen.current.seed !== seed || paths.length < seen.current.count) {
    seen.current = { seed, count: paths.length };
  } else if (paths.length > seen.current.count) {
    launch.current = { id: (launch.current?.id ?? 0) + 1, paths: paths.slice(seen.current.count) };
    seen.current = { seed, count: paths.length };
  }
  return launch.current;
}

/** 1.1: шарики падают сквозь доску из 8 уровней и копятся в ячейках — гистограмма частот растёт на глазах. */
export function FrequencyWidget({ state, onChange }: WidgetProps<FrequencyState>) {
  const { seed, thrown, bin, mode, theory } = state;
  const share = mode === 'share';
  const paths = useMemo(() => dropPathsMP(seed, thrown, BOARD_LEVELS, 0.5), [seed, thrown]);
  const table = useMemo(() => frequencyTable(paths.map((path) => path.filter(Boolean).length)), [paths]);
  const launch = useLaunch(paths, seed);
  const nk = table.counts[bin];

  const throwMore = (count: number) => onChange({ ...state, thrown: Math.min(MAX_THROWN, thrown + count) });

  return (
    <div className="c-widget">
      <div className="c-toolbar">
        <div className="c-actions" role="group" aria-label="Бросить шарики">
          {[1, 10, 100].map((count) => (
            <button key={count} type="button" className="c-btn c-btn--small" disabled={thrown >= MAX_THROWN} onClick={() => throwMore(count)}>
              +{count}
            </button>
          ))}
          <button type="button" className="c-btn c-btn--small c-btn--ghost" disabled={thrown === 0} onClick={() => onChange({ ...state, seed: newSeed(), thrown: 0 })}>
            Сначала
          </button>
        </div>
        <div className="c-actions" role="group" aria-label="Что показывать">
          <div className="c-segmented">
            <button type="button" aria-pressed={!share} onClick={() => onChange({ ...state, mode: 'count' })}>
              Количество
            </button>
            <button type="button" aria-pressed={share} onClick={() => onChange({ ...state, mode: 'share' })}>
              Доля
            </button>
          </div>
          <button type="button" className="c-toggle" aria-pressed={theory} onClick={() => onChange({ ...state, theory: !theory })}>
            <span className="c-swatch c-swatch--theory" aria-hidden="true" />
            Теория
          </button>
        </div>
      </div>

      <GaltonScene
        m={BOARD_LEVELS}
        counts={table.counts}
        mode={mode}
        theory={theory ? THEORY : null}
        selected={bin}
        onSelect={(next) => onChange({ ...state, bin: next })}
        launch={launch}
        label={`Доска Гальтона из 8 уровней, брошено ${thrown} шариков. В ячейке ${bin} — ${nk}.`}
      />
      {thrown === 0 ? <p className="c-widget-note">Бросьте первый шарик — он пролетит сквозь штырьки и упадёт в одну из 9 ячеек.</p> : null}

      <dl className="c-readout">
        <div>
          <dt>Объём выборки</dt>
          <dd>N = {thrown}</dd>
        </div>
        <div>
          <dt>Ячейка {bin}</dt>
          <dd>
            n<sub>{bin}</sub> = {nk}
          </dd>
        </div>
        <div className="c-readout-wide">
          <dt>Относительная частота</dt>
          <dd>
            w<sub>{bin}</sub> = n<sub>{bin}</sub> / N = {thrown === 0 ? '—' : `${nk} / ${thrown} = ${formatStatistic(nk / thrown)}`}
          </dd>
        </div>
        {theory ? (
          <div className="c-readout-wide">
            <dt>Теоретическая вероятность</dt>
            <dd className="c-theory-text">
              p<sub>{bin}</sub> = {formatStatistic(THEORY[bin])}
            </dd>
          </div>
        ) : null}
      </dl>
      <p className="c-widget-note">Номера под ячейками — кнопки: выберите ячейку, чтобы посчитать её частоту.</p>
    </div>
  );
}
