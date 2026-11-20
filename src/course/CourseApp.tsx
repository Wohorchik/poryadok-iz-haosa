import { useEffect, useMemo, useReducer, useState } from 'react';
import { Catalog } from './Catalog';
import { Lesson } from './Lesson';
import { PREFIX, browserStorage } from './progress';
import { parseRoute } from './routing';
import { Summary } from './Summary';

/** Учебный режим: каталог курсов, уроки и итог курса по адресу #study/… */
export function CourseApp({ route }: { route: string }) {
  const parsed = parseRoute('#' + route);
  const storage = useMemo(browserStorage, []);
  const [saveFailed, setSaveFailed] = useState(storage === null);
  // Прогресс, изменённый в другой вкладке, перечитывается.
  const [revision, refresh] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith(PREFIX)) refresh();
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const saved = (ok: boolean) => setSaveFailed(!ok);

  return (
    <>
      {saveFailed ? (
        <p className="c-save-note" role="status">
          Браузер не смог сохранить прогресс. Он доступен в этой вкладке до обновления страницы.
        </p>
      ) : null}
      {parsed.kind === 'catalog' ? <Catalog key={revision} storage={storage} /> : null}
      {parsed.kind === 'lesson' ? (
        <Lesson key={`${parsed.lesson.id}-${revision}`} course={parsed.course} lesson={parsed.lesson} storage={storage} onSaved={saved} />
      ) : null}
      {parsed.kind === 'summary' ? <Summary key={revision} course={parsed.course} storage={storage} onSaved={saved} /> : null}
    </>
  );
}
