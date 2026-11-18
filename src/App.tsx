import { useEffect, useMemo, useState } from 'react';
import { Gallery, type GalleryItem } from './components/Gallery';
import { GaltonBoard, type GaltonReplay } from './experiments/GaltonBoard';
import { HiddenPicture } from './experiments/HiddenPicture';
import { MeanShift } from './experiments/MeanShift';
import { NoiseImage } from './experiments/NoiseImage';
import { RandomWalk } from './experiments/RandomWalk';
import { SierpinskiTriangle } from './experiments/SierpinskiTriangle';
import { Silhouette } from './experiments/Silhouette';
import { StudyLab } from './experiments/StudyLab';

const EXPERIMENTS: readonly GalleryItem[] = [
  { id: 'galton', title: 'Доска Гальтона', hint: 'Запусти шарики и посмотри, в каких ячейках они соберутся.' },
  { id: 'walk', title: 'Случайное блуждание', hint: 'Проследи один случайный путь, затем сравни его с сотней других.' },
  { id: 'picture', title: 'Скрытая картинка', hint: 'Открывай случайные клетки и узнай, сколько попыток уйдёт на рисунок.' },
  { id: 'triangle', title: 'Треугольник Серпинского', hint: 'Измени вероятность выбора вершины и посмотри, где узор станет плотнее.' },
  { id: 'noise', title: 'От шума к изображению', hint: 'Сложи несколько шумных кадров и прояви спрятанные детали.' },
  { id: 'mean', title: 'Как одна точка меняет среднее', hint: 'Перетащи точку и проследи за средним и медианой.' },
  { id: 'silhouette', title: 'Нарисуй силуэт точками', hint: 'Нарисуй фигуру и оцени её площадь случайными точками.' },
];

type View = 'gallery' | 'study' | (typeof EXPERIMENTS)[number]['id'];

const TITLE = 'Порядок из хаоса';

const viewFromHash = (): View => {
  const id = window.location.hash.slice(1);
  if (id === 'study') return 'study';
  return EXPERIMENTS.some((item) => item.id === id) ? id : 'gallery';
};

/** Буквы названия разлетаются случайно и собираются в слово при открытии страницы. */
function ScatteredTitle({ onClick }: { onClick: () => void }) {
  const words = useMemo(
    () =>
      TITLE.split(' ').map((word) =>
        [...word].map((letter) => ({
          letter,
          style: {
            '--from-x': `${Math.round((Math.random() - 0.5) * 64)}px`,
            '--from-y': `${Math.round((Math.random() - 0.5) * 40)}px`,
            '--from-turn': `${Math.round((Math.random() - 0.5) * 70)}deg`,
          } as React.CSSProperties,
        })),
      ),
    [],
  );

  return (
    <h1 className="brand">
      <a href="#" aria-label={`${TITLE} — все эксперименты`} onClick={(event) => (event.preventDefault(), onClick())}>
        {words.map((letters, wordIndex) => (
          <span className="brand-word" aria-hidden="true" key={wordIndex}>
            {letters.map(({ letter, style }, letterIndex) => (
              <span className="brand-letter" style={style} key={letterIndex}>
                {letter}
              </span>
            ))}
          </span>
        ))}
      </a>
    </h1>
  );
}

export function App() {
  const [view, setView] = useState<View>(viewFromHash);
  const [projector, setProjector] = useState(false);
  const [replay, setReplay] = useState<GaltonReplay | null>(null);

  // Кнопка «Назад» браузера возвращает к галерее; ручная смена адреса тоже работает.
  useEffect(() => {
    const sync = () => setView(viewFromHash());
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  const open = (next: View) => {
    if (next === view) return;
    window.history.pushState(null, '', next === 'gallery' ? window.location.pathname + window.location.search : `#${next}`);
    setView(next);
    window.scrollTo({ top: 0 });
  };

  const current = EXPERIMENTS.find((item) => item.id === view);

  return (
    <div className={projector ? 'app app--projector' : 'app'}>
      <header className="topbar">
        <ScatteredTitle onClick={() => open('gallery')} />
        <nav className="topnav" aria-label="Навигация">
          <button
            type="button"
            className="btn nav-button"
            aria-current={view === 'gallery' ? 'page' : undefined}
            onClick={() => open('gallery')}
            data-testid="nav-gallery"
          >
            <span aria-hidden="true">▦</span> Все эксперименты
          </button>
          <button
            type="button"
            className="btn nav-button nav-button--quiet"
            aria-current={view === 'study' ? 'page' : undefined}
            onClick={() => open('study')}
            data-testid="nav-study"
          >
            Учебный режим
          </button>
          <button className="btn btn--toggle projector-button" type="button" aria-pressed={projector} onClick={() => setProjector((value) => !value)}>
            Проектор
          </button>
        </nav>
      </header>

      {current ? (
        <p className="crumbs">
          <button type="button" className="link-button" onClick={() => open('gallery')}>
            ← Все эксперименты
          </button>
        </p>
      ) : null}

      <main>
        {view === 'gallery' ? <Gallery items={EXPERIMENTS} onOpen={(id) => open(id as View)} onStudy={() => open('study')} /> : null}
        <GaltonBoard active={view === 'galton'} replay={replay} />
        <RandomWalk
          active={view === 'walk'}
          onOpenGalton={(path) => {
            setReplay((previous) => ({ id: (previous?.id ?? 0) + 1, path }));
            open('galton');
          }}
        />
        <HiddenPicture active={view === 'picture'} />
        <SierpinskiTriangle active={view === 'triangle'} />
        <NoiseImage active={view === 'noise'} />
        <MeanShift active={view === 'mean'} />
        <Silhouette active={view === 'silhouette'} />
        <StudyLab active={view === 'study'} />
      </main>
    </div>
  );
}
