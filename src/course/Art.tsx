import { useEffect, useRef, useState } from 'react';

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** WebM с прозрачностью (VP9 alpha) честно работает в Chrome, Edge и Firefox; Safari рисует чёрный фон. */
function canPlayAlphaVideo(): boolean {
  if (typeof document === 'undefined' || reducedMotion()) return false;
  const ua = navigator.userAgent;
  const safari = /safari/i.test(ua) && !/chrome|chromium|crios|edg|android|fxios/i.test(ua);
  return !safari && document.createElement('video').canPlayType('video/webm; codecs="vp9"') !== '';
}

/**
 * 3D-картинка из Blender: слегка покачивается и сдвигается за мышью (до 8 px).
 * Если передано видео и браузер умеет прозрачный WebM — показывается анимация, иначе статичный кадр.
 */
export function Art({ src, video, alt, size }: { src: string; video?: string; alt: string; size: 'hero' | 'cover' | 'lesson' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [playVideo] = useState(() => (video ? canPlayAlphaVideo() : false));

  useEffect(() => {
    const node = ref.current;
    if (!node || reducedMotion()) return;
    let frame = 0;
    const move = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        node.style.setProperty('--px', ((event.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        node.style.setProperty('--py', ((event.clientY / window.innerHeight) * 2 - 1).toFixed(3));
      });
    };
    window.addEventListener('pointermove', move);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
    };
  }, []);

  return (
    <div className={`c-art c-art--${size}`} ref={ref}>
      <div className="c-art-float">
        {playVideo ? (
          <video src={video} poster={src} autoPlay loop muted playsInline aria-label={alt} />
        ) : (
          <img src={src} alt={alt} decoding="async" />
        )}
      </div>
    </div>
  );
}
