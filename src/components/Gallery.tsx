import { useEffect, useRef } from 'react';
import { ChaosRun } from '../lib/chaosGame';
import { DensityMap } from '../lib/densityMap';
import { binomialDistribution } from '../lib/galton';
import { ART_SIZE, buildLighthousePixels } from '../lib/lighthouseArt';
import { NOISE_SIZE, NoiseSeries, lighthouseGray } from '../lib/noiseImage';
import { createRng, randomIndex } from '../lib/random';
import { generateWalks, positions } from '../lib/randomWalk';
import { starMask, SILHOUETTE_SIZE } from '../lib/silhouette';

export interface GalleryItem {
  id: string;
  title: string;
  hint: string;
}

/* ---------- Статичные превью: характерный кадр без анимации ---------- */

function GaltonPreview() {
  const levels = 8;
  const theory = binomialDistribution(0.5, levels);
  const top = Math.max(...theory);
  return (
    <svg viewBox="0 0 180 120" aria-hidden="true">
      {Array.from({ length: levels }, (_, level) =>
        Array.from({ length: level + 1 }, (_, peg) => (
          <circle key={`${level}-${peg}`} cx={90 + (peg - level / 2) * 16} cy={10 + level * 7} r="1.6" className="preview-peg" />
        )),
      )}
      <polyline points="90,6 98,17 90,24 98,31 106,38 98,45 106,52 114,59" className="preview-trail" />
      {theory.map((value, bin) => (
        <rect key={bin} x={18 + bin * 16} y={116 - (value / top) * 46} width="12" height={(value / top) * 46} className="preview-bar" />
      ))}
    </svg>
  );
}

function WalkPreview() {
  const walks = generateWalks(40, 30, 0.5, createRng(7));
  const y = (position: number) => 60 - position * 4.5;
  return (
    <svg viewBox="0 0 180 120" aria-hidden="true">
      <line x1="6" x2="174" y1="60" y2="60" className="preview-axis" />
      {walks.paths.map((path, index) => (
        <polyline
          key={index}
          points={positions(path).map((position, step) => `${6 + step * 5.6},${y(position)}`).join(' ')}
          className={index === 0 ? 'preview-trail' : 'preview-faint'}
        />
      ))}
    </svg>
  );
}

function CanvasPreview({ draw, size }: { draw: (context: CanvasRenderingContext2D) => void; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = ref.current?.getContext('2d');
    if (context) draw(context);
    // Превью рисуется один раз.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <canvas ref={ref} width={size} height={size} aria-hidden="true" />;
}

function PicturePreview() {
  return (
    <CanvasPreview
      size={ART_SIZE}
      draw={(context) => {
        const image = context.createImageData(ART_SIZE, ART_SIZE);
        image.data.set(buildLighthousePixels());
        context.putImageData(image, 0, 0);
        const rng = createRng(3);
        const opened = new Set<number>();
        for (let attempt = 0; attempt < 100; attempt += 1) opened.add(randomIndex(100, rng));
        context.fillStyle = '#193662';
        context.strokeStyle = '#34507f';
        for (let cell = 0; cell < 100; cell += 1) {
          if (opened.has(cell)) continue;
          context.fillRect((cell % 10) * 6, Math.floor(cell / 10) * 6, 6, 6);
          context.strokeRect((cell % 10) * 6 + 0.5, Math.floor(cell / 10) * 6 + 0.5, 6, 6);
        }
      }}
    />
  );
}

function TrianglePreview() {
  return (
    <CanvasPreview
      size={150}
      draw={(context) => {
        const map = new DensityMap(150, 150, 1, 0.25);
        const run = new ChaosRun([6, 3, 1], createRng(11));
        for (let step = 0; step < 30000; step += 1) {
          const vertex = run.step();
          map.add(run.x, run.y + 30, vertex);
        }
        map.draw(context, 'vertex');
      }}
    />
  );
}

function NoisePreview() {
  return (
    <CanvasPreview
      size={NOISE_SIZE * 2}
      draw={(context) => {
        const series = new NoiseSeries(lighthouseGray(), NOISE_SIZE, 110, 5);
        series.addFrames(1);
        const noisy = context.createImageData(NOISE_SIZE, NOISE_SIZE);
        noisy.data.set(series.toRgba((pixel) => series.current[pixel]));
        series.addFrames(59);
        const clean = context.createImageData(NOISE_SIZE, NOISE_SIZE);
        clean.data.set(series.toRgba((pixel) => series.mean(pixel)));
        context.putImageData(noisy, 0, NOISE_SIZE / 2);
        context.putImageData(clean, NOISE_SIZE, NOISE_SIZE / 2);
      }}
    />
  );
}

function MeanPreview() {
  const x = (value: number) => 12 + value * 3.2;
  return (
    <svg viewBox="0 0 180 120" aria-hidden="true">
      <line x1="10" x2="172" y1="66" y2="66" className="preview-axis" />
      {[10, 11, 12, 13].map((value) => (
        <circle key={value} cx={x(value)} cy="60" r="4.5" className="preview-dot" />
      ))}
      <circle cx={x(44)} cy="60" r="4.5" className="preview-dot preview-dot--moved" />
      <path d={`M${x(14) + 6} 48 H${x(44) - 8}`} className="preview-arrow" />
      <path d={`M${x(44) - 12} 44 L${x(44) - 6} 48 L${x(44) - 12} 52`} className="preview-arrow" />
      <path d={`M${x(18) - 6} 38 L${x(18) + 6} 38 L${x(18)} 46 Z`} className="preview-mean" />
      <text x={x(18)} y="32" textAnchor="middle" className="preview-label preview-label--mean">
        среднее 18
      </text>
      <path d={`M${x(12)} 74 L${x(12) + 6} 80 L${x(12)} 86 L${x(12) - 6} 80 Z`} className="preview-median" />
      <text x={x(12)} y="100" textAnchor="middle" className="preview-label preview-label--median">
        медиана 12
      </text>
    </svg>
  );
}

function SilhouettePreview() {
  return (
    <CanvasPreview
      size={150}
      draw={(context) => {
        const mask = starMask();
        const rng = createRng(9);
        for (let point = 0; point < 1500; point += 1) {
          const x = rng();
          const y = rng();
          const inside = mask[Math.floor(y * SILHOUETTE_SIZE) * SILHOUETTE_SIZE + Math.floor(x * SILHOUETTE_SIZE)] === 1;
          context.fillStyle = inside ? '#ffc53d' : '#3d5a8a';
          context.fillRect(x * 150 - 1, y * 150 - 1, 2.2, 2.2);
        }
      }}
    />
  );
}

const PREVIEWS: Record<string, () => React.ReactElement> = {
  galton: GaltonPreview,
  walk: WalkPreview,
  picture: PicturePreview,
  triangle: TrianglePreview,
  noise: NoisePreview,
  mean: MeanPreview,
  silhouette: SilhouettePreview,
};

export function Gallery({ items, onOpen, onStudy }: { items: readonly GalleryItem[]; onOpen: (id: string) => void; onStudy: () => void }) {
  return (
    <section className="gallery" aria-labelledby="gallery-title" data-testid="gallery">
      <h2 id="gallery-title">Выберите эксперимент</h2>
      <p className="gallery-lead">Меняйте одно правило и смотрите, как из случайности складывается порядок.</p>
      <ul className="gallery-grid">
        {items.map((item) => {
          const Preview = PREVIEWS[item.id];
          return (
            <li key={item.id}>
              <button type="button" className="gallery-card" onClick={() => onOpen(item.id)} data-testid={`card-${item.id}`}>
                <span className="gallery-preview">{Preview ? <Preview /> : null}</span>
                <span className="gallery-title">{item.title}</span>
                <span className="gallery-hint">{item.hint}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="gallery-footer">
        Для педагогического исследования с тестами и группами А/Б откройте{' '}
        <button type="button" className="link-button" onClick={onStudy}>
          учебный режим
        </button>
        .
      </p>
    </section>
  );
}
