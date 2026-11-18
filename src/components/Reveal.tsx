import { useEffect, useId, useState, type ReactNode } from 'react';

interface RevealProps {
  question: string;
  openLabel: string;
  closeLabel: string;
  locked?: boolean;
  lockedHint?: string;
  children: ReactNode;
}

export function Reveal({ question, openLabel, closeLabel, locked = false, lockedHint, children }: RevealProps) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  useEffect(() => {
    if (locked) setOpen(false);
  }, [locked]);

  const isOpen = open && !locked;

  return (
    <section className="reveal">
      <h3 className="reveal-question">{question}</h3>
      <button
        className="btn"
        type="button"
        aria-expanded={isOpen}
        aria-controls={bodyId}
        disabled={locked}
        onClick={() => setOpen((value) => !value)}
      >
        {isOpen ? closeLabel : openLabel}
      </button>
      {locked && lockedHint ? <p className="hint">{lockedHint}</p> : null}
      <div className="reveal-body" id={bodyId} hidden={!isOpen}>
        {children}
      </div>
    </section>
  );
}
