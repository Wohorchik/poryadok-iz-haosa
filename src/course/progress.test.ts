import { describe, expect, it } from 'vitest';
import type { StorageLike } from '../lib/study';
import { PREFIX, emptyRecord, readRecord, writeRecord } from './progress';

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
}

describe('прогресс урока', () => {
  it('запись и чтение туда-обратно', () => {
    const storage = memory();
    const record = { state: { k: 1.5 }, option: 2, checked: true, done: true };
    expect(writeRecord(storage, 'descriptive/spread', record)).toBe(true);
    expect(storage.data.has(PREFIX + 'descriptive/spread')).toBe(true);
    expect(readRecord(storage, 'descriptive/spread')).toEqual(record);
  });

  it('нет записи — пустой прогресс', () => {
    expect(readRecord(memory(), 'descriptive/sample')).toEqual(emptyRecord());
  });

  it('битый JSON — пустой прогресс', () => {
    const storage = memory();
    storage.data.set(PREFIX + 'descriptive/sample', '{');
    expect(readRecord(storage, 'descriptive/sample')).toEqual(emptyRecord());
  });

  it('недопустимый вариант ответа сбрасывается вместе с отметкой проверки', () => {
    const storage = memory();
    storage.data.set(PREFIX + 'descriptive/sample', '{"option":7,"checked":true,"done":true}');
    expect(readRecord(storage, 'descriptive/sample')).toEqual({ state: null, option: null, checked: false, done: true });
  });

  it('чужой формат (массив, строка) — пустой прогресс', () => {
    const storage = memory();
    storage.data.set(PREFIX + 'a', '[1,2]');
    storage.data.set(PREFIX + 'b', '"text"');
    expect(readRecord(storage, 'a')).toEqual(emptyRecord());
    expect(readRecord(storage, 'b')).toEqual(emptyRecord());
  });

  it('старый префикс v1 не читается', () => {
    const storage = memory();
    storage.data.set('matstat-course-v1/sample', '{"value":7,"option":1,"checked":true,"done":true}');
    expect(readRecord(storage, 'sample')).toEqual(emptyRecord());
  });

  it('ошибка setItem — запись не удалась', () => {
    const broken: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(writeRecord(broken, 'descriptive/sample', emptyRecord())).toBe(false);
  });

  it('хранилища нет — пустой прогресс и неудачная запись', () => {
    expect(readRecord(null, 'descriptive/sample')).toEqual(emptyRecord());
    expect(writeRecord(null, 'descriptive/sample', emptyRecord())).toBe(false);
  });
});
