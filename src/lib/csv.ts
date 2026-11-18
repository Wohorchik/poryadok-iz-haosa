/**
 * Таблица в формате CSV для Excel с русскими настройками: разделитель «;», перевод строки CRLF.
 * Знак BOM в начале файла добавляет downloadCsv, чтобы Excel распознал кириллицу.
 */
export function toCsv(header: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  const cell = (value: string | number) => {
    const text = String(value);
    return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [header, ...rows].map((row) => row.map(cell).join(';')).join('\r\n') + '\r\n';
}

/** Отдаёт браузеру CSV на сохранение. Работает и в файле, открытом без интернета. */
export function downloadCsv(fileName: string, content: string): void {
  downloadBlob(fileName, new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' }));
}

/** Отдаёт браузеру любой файл: CSV, PNG и т. п. */
export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
