import type { ReactNode } from 'react';

export interface StatRow {
  label: ReactNode;
  value: string;
  /** Теоретическое значение; если его нет, в ячейке стоит прочерк. */
  theory?: ReactNode;
  testId: string;
}

/** Таблица «характеристика — выборка — теория». Общая для доски Гальтона и серии опытов. */
export function StatsTable({ title, rows }: { title: string; rows: readonly StatRow[] }) {
  return (
    <table className="stats-table">
      <caption>{title}</caption>
      <thead>
        <tr>
          <th scope="col">Характеристика</th>
          <th scope="col">Выборка</th>
          <th scope="col">Теория</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.testId}>
            <th scope="row">{row.label}</th>
            <td className="tone-amber" data-testid={row.testId}>
              {row.value}
            </td>
            <td className="tone-cyan">{row.theory ?? <span aria-label="нет">—</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
