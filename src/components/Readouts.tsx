export interface ReadoutItem {
  label: string;
  value: string;
  tone?: 'amber' | 'cyan' | 'coral';
  testId: string;
}

export function Readouts({ items }: { items: readonly ReadoutItem[] }) {
  return (
    <dl className="readouts">
      {items.map((item) => (
        <div className="readout" key={item.testId}>
          <dt>{item.label}</dt>
          <dd className={item.tone ? `tone-${item.tone}` : undefined} data-testid={item.testId}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
