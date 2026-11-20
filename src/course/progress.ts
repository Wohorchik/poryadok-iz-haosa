/**
 * Прогресс уроков в localStorage: состояние виджета, выбранный ответ и отметка «пройден».
 * Любые повреждённые данные превращаются в пустой прогресс, чтобы урок всегда открывался.
 */
import type { StorageLike } from '../lib/study';

export const PREFIX = 'matstat-course-v2/';

export interface LessonRecord {
  /** Состояние виджета; проверяет и восстанавливает его сам урок. */
  state: unknown;
  option: number | null;
  checked: boolean;
  done: boolean;
}

export const emptyRecord = (): LessonRecord => ({ state: null, option: null, checked: false, done: false });

/** Безопасный доступ к localStorage: в приватном режиме или при запрете он может бросать исключения. */
export function browserStorage(): StorageLike | null {
  try {
    const storage = window.localStorage;
    const probe = PREFIX + '__probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export function readRecord(storage: StorageLike | null, key: string): LessonRecord {
  if (!storage) return emptyRecord();
  try {
    const raw: unknown = JSON.parse(storage.getItem(PREFIX + key) ?? 'null');
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return emptyRecord();
    const record = raw as Record<string, unknown>;
    const option =
      typeof record.option === 'number' && Number.isInteger(record.option) && record.option >= 0 && record.option <= 3
        ? record.option
        : null;
    return {
      state: record.state ?? null,
      option,
      checked: record.checked === true && option !== null,
      done: record.done === true,
    };
  } catch {
    return emptyRecord();
  }
}

export function writeRecord(storage: StorageLike | null, key: string, record: LessonRecord): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PREFIX + key, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}
