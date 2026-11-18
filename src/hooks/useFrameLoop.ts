import { useEffect, useRef } from 'react';

const MAX_FRAME_MS = 100;

/** Вызывает onFrame на каждом кадре, пока running истинно. Длинные паузы не догоняются рывком. */
export function useFrameLoop(running: boolean, onFrame: (elapsedMs: number) => void): void {
  const callback = useRef(onFrame);

  useEffect(() => {
    callback.current = onFrame;
  });

  useEffect(() => {
    if (!running) return undefined;
    let frameId = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      // Метка кадра rAF может оказаться раньше performance.now() из эффекта, поэтому отсекаем отрицательное время.
      const elapsed = Math.min(Math.max(0, now - previous), MAX_FRAME_MS);
      previous = now;
      callback.current(elapsed);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [running]);
}
