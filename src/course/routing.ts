import { COURSES } from './courses';
import type { QuizQuestion } from './math';
import type { CourseDef, LessonDef } from './types';

export type Route =
  | { kind: 'catalog' }
  | { kind: 'lesson'; course: CourseDef; lesson: LessonDef }
  | { kind: 'summary'; course: CourseDef }
  | { kind: 'research' };

/** #study → каталог, #study/<курс>/<урок> → урок, #study/<курс>/summary → итог. Всё неизвестное — каталог. */
export function parseRoute(hash: string): Route {
  const [root, courseId, page, ...rest] = hash.replace(/^#/, '').split('/');
  if (root !== 'study' || rest.length > 0) return { kind: 'catalog' };
  if (courseId === 'research' && page === undefined) return { kind: 'research' };
  const course = COURSES.find((item) => item.id === courseId && item.ready);
  if (!course || !page) return { kind: 'catalog' };
  if (page === 'summary') return { kind: 'summary', course };
  const lesson = course.lessons.find((item) => item.id === page);
  return lesson ? { kind: 'lesson', course, lesson } : { kind: 'catalog' };
}

export const lessonHash = (course: CourseDef, lesson: LessonDef): string => `#study/${course.id}/${lesson.id}`;
export const summaryHash = (course: CourseDef): string => `#study/${course.id}/summary`;

/** Ответ сбрасывается, только если вопрос после изменения виджета стал другим. */
export function answerResetNeeded(before: QuizQuestion | null, after: QuizQuestion | null): boolean {
  if (before === null || after === null) return before !== after;
  return before.text !== after.text || before.options.join('\n') !== after.options.join('\n');
}
