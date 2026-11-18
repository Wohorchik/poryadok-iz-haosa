import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { GaltonBoard } from './experiments/GaltonBoard';
import { HiddenPicture } from './experiments/HiddenPicture';
import { SierpinskiTriangle } from './experiments/SierpinskiTriangle';

const TABS = [
  { id: 'picture', label: 'Скрытая картинка' },
  { id: 'triangle', label: 'Треугольник Серпинского' },
  { id: 'galton', label: 'Доска Гальтона' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const TITLE = 'Порядок из хаоса';

/** Буквы названия разлетаются случайно и собираются в слово при открытии страницы. */
function ScatteredTitle() {
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
    <h1 className="brand" aria-label={TITLE}>
      {words.map((letters, wordIndex) => (
        <span className="brand-word" aria-hidden="true" key={wordIndex}>
          {letters.map(({ letter, style }, letterIndex) => (
            <span className="brand-letter" style={style} key={letterIndex}>
              {letter}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('picture');
  const [projector, setProjector] = useState(false);
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const current = TABS.findIndex((tab) => tab.id === activeTab);
    const targets: Record<string, number> = {
      ArrowRight: (current + 1) % TABS.length,
      ArrowLeft: (current - 1 + TABS.length) % TABS.length,
      Home: 0,
      End: TABS.length - 1,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    setActiveTab(TABS[target].id);
    tabRefs.current[TABS[target].id]?.focus();
  };

  return (
    <div className={projector ? 'app app--projector' : 'app'}>
      <header className="topbar">
        <ScatteredTitle />
        <div className="tabs" role="tablist" aria-label="Опыты">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[tab.id] = node;
              }}
              id={`tab-${tab.id}`}
              className="tab"
              role="tab"
              type="button"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={onTabKeyDown}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          className="btn btn--toggle projector-button"
          type="button"
          aria-pressed={projector}
          onClick={() => setProjector((value) => !value)}
        >
          Режим проектора
        </button>
      </header>

      <main>
        <HiddenPicture active={activeTab === 'picture'} />
        <SierpinskiTriangle active={activeTab === 'triangle'} />
        <GaltonBoard active={activeTab === 'galton'} />
      </main>
    </div>
  );
}
