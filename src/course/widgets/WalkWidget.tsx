import { useId, useMemo } from 'react';
import { useElementWidth } from '../../hooks/useElementWidth';
import { formatStatistic } from '../../lib/format';
import { newSeed } from '../../lib/random';
import { walkPositions } from '../math2';
import ballGlass from '../sprites/ball-glass.webp';
import type { WidgetProps } from '../types';
import { WALK_MAX, type WalkState } from './state';

const f = formatStatistic;
const WALKS = 80;

/** 80 случайных путей и малиновый коридор E ± 2σ, который расширяется как √k. */
export function WalkWidget({ state, onChange }: WidgetProps<WalkState>) {
  const { k, seed } = state;
  const p = state.p / 100;
  const kId = useId();
  const pId = useId();
  const { ref, width } = useElementWidth<HTMLElement>(640);
  const walks = useMemo(() => walkPositions(seed, WALKS, WALK_MAX, p), [seed, p]);

  const mean = (t: number) => t * (2 * p - 1);
  const sd = (t: number) => Math.sqrt(4 * t * p * (1 - p));
  const finals = walks.map((walk) => walk[k]);
  const sampleMean = finals.reduce((s, v) => s + v, 0) / WALKS;
  const sampleSd = Math.sqrt(finals.reduce((s, v) => s + (v - sampleMean) ** 2, 0) / WALKS);
  const inside = finals.filter((v) => Math.abs(v - mean(k)) <= 2 * sd(k)).length;

  const W = Math.max(280, width);
  const H = W < 480 ? 260 : 320;
  const left = 40;
  const right = W - 12;
  const reach = Math.max(8, Math.ceil(Math.max(Math.abs(mean(WALK_MAX)) + 2.5 * sd(WALK_MAX), 2.5 * sd(WALK_MAX))));
  const lo = p >= 0.5 ? -Math.min(reach, Math.ceil(2.5 * sd(WALK_MAX)) + 2) : -reach;
  const hi = p <= 0.5 ? Math.min(reach, Math.ceil(2.5 * sd(WALK_MAX)) + 2) : reach;
  const x = (t: number) => left + ((right - left) * t) / WALK_MAX;
  const y = (v: number) => 12 + ((H - 40) * (hi - v)) / (hi - lo);
  const steps = Array.from({ length: k + 1 }, (_, t) => t);
  const band = (sign: number) => steps.map((t) => `${x(t)},${y(mean(t) + sign * 2 * sd(t))}`).join(' ');

  return (
    <div className="c-widget">
      <div className="c-range">
        <label htmlFor={kId}>
          Шагов <output htmlFor={kId}>k = {k}</output>
        </label>
        <input id={kId} type="range" min={4} max={WALK_MAX} value={k} onChange={(event) => onChange({ ...state, k: Number(event.target.value) })} />
      </div>
      <div className="c-range">
        <label htmlFor={pId}>
          Вероятность шага вправо <output htmlFor={pId}>p = {f(p)}</output>
        </label>
        <input id={pId} type="range" min={5} max={95} step={5} value={state.p} onChange={(event) => onChange({ ...state, p: Number(event.target.value) })} />
      </div>
      <div className="c-actions">
        <button type="button" className="c-btn c-btn--small c-btn--ghost" onClick={() => onChange({ ...state, seed: newSeed() })}>
          Новые 80 путей
        </button>
      </div>

      <figure className="c-chart c-chart--scene" ref={ref}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${WALKS} путей по ${k} шагов при p = ${f(p)}. Внутри коридора E ± 2σ — ${inside} путей`}>
          <line className="c-gridline" x1={left} x2={right} y1={y(0)} y2={y(0)} />
          <text className="c-tick" x={left - 8} y={y(0) + 4} textAnchor="end">
            0
          </text>
          {[hi, lo].map((v) => (
            <text key={v} className="c-tick" x={left - 8} y={y(v) + 4} textAnchor="end">
              {v}
            </text>
          ))}
          <g fill="none" stroke="#6b7bff" strokeOpacity={0.32} strokeWidth={1.4}>
            {walks.map((walk, index) => (
              <polyline key={index} points={walk.slice(0, k + 1).map((v, t) => `${x(t)},${y(v)}`).join(' ')} />
            ))}
          </g>
          <g fill="none" stroke="#ff4fc8" strokeWidth={2.5} aria-hidden="true" style={{ filter: 'drop-shadow(0 0 6px rgba(255, 79, 200, 0.7))' }}>
            <polyline points={band(1)} strokeDasharray="6 5" />
            <polyline points={band(-1)} strokeDasharray="6 5" />
            <polyline points={steps.map((t) => `${x(t)},${y(mean(t))}`).join(' ')} strokeOpacity={0.6} />
          </g>
          <line x1={x(k)} x2={x(k)} y1={8} y2={H - 26} stroke="#55555f" strokeWidth={1} />
          {/* Концы путей — стеклянные шарики; совпавшие положения сдвинуты вправо, чтобы было видно, сколько их */}
          {finals.map((v, index) => {
            const same = finals.slice(0, index).filter((other) => other === v).length;
            return <image key={index} href={ballGlass} x={x(k) - 6 + same * 7} y={y(v) - 6} width={12} height={12} />;
          })}
          <text className="c-axis-label" x={(left + right) / 2} y={H - 6} textAnchor="middle">
            Номер шага (до {WALK_MAX})
          </text>
        </svg>
      </figure>

      <dl className="c-readout">
        <div>
          <dt>Среднее по 80 путям</dt>
          <dd className="c-accent-dd">{f(sampleMean)}</dd>
        </div>
        <div>
          <dt>Теория E(Sₖ)</dt>
          <dd className="c-theory-text">{f(mean(k))}</dd>
        </div>
        <div>
          <dt>σ по 80 путям</dt>
          <dd className="c-accent-dd">{f(sampleSd)}</dd>
        </div>
        <div>
          <dt>Теория σ = √(4kp(1 − p))</dt>
          <dd className="c-theory-text">{f(sd(k))}</dd>
        </div>
        <div className="c-readout-wide" style={{ gridColumn: '1 / -1' }}>
          <dt>Внутри коридора E ± 2σ</dt>
          <dd>
            {inside} из {WALKS} путей ({Math.round((inside / WALKS) * 100)} %)
          </dd>
        </div>
      </dl>
      <p className="c-widget-note">Коридор расширяется как √k: от 16 к 64 шагам он становится шире только вдвое.</p>
    </div>
  );
}
