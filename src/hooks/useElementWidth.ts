import { useEffect, useRef, useState } from 'react';

/** Фактическая ширина элемента в CSS-пикселях; обновляется при изменении размера и повороте экрана. */
export function useElementWidth<T extends HTMLElement>(fallback = 600) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    // Ширина области содержимого (без внутренних отступов и рамки): иначе вложенный холст или SVG
    // оказывается шире контейнера, и контейнер, подстраиваясь под него, растёт бесконечно.
    const update = () => {
      const styles = getComputedStyle(element);
      const padding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const next = Math.floor(element.clientWidth - padding);
      if (next > 0) setWidth(next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}
