import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { homeCamera, renderScene, type Camera, type Scene } from '../lib/spatial';

interface PlotProps {
  build: () => Scene;
  label: string;
  animated?: boolean;
  interactive?: boolean;
  compact?: boolean;
  initialCamera?: Camera;
}

export function SpatialPlot({
  build,
  label,
  animated = false,
  interactive = false,
  compact = false,
  initialCamera = homeCamera,
}: PlotProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [camera, setCamera] = useState(initialCamera);
  const drag = useRef<{ x: number; y: number; camera: Camera } | null>(null);
  const latest = useRef({ build, camera, compact });
  useLayoutEffect(() => {
    latest.current = { build, camera, compact };
  });
  const model = useRef<Scene | null>(null);
  const redraw = () => {
    const canvas = ref.current;
    if (!canvas || !canvas.clientWidth) return;
    const view = latest.current;
    model.current ??= view.build();
    renderScene(canvas, model.current, view.camera, view.compact);
  };
  useLayoutEffect(() => {
    model.current = null;
  }, [build]);
  useLayoutEffect(() => {
    redraw();
  }, [build, camera, compact]);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!animated) return;
    let frame = 0,
      last = 0;
    const tick = (time: number) => {
      if (time - last >= 30) {
        model.current = null;
        redraw();
        last = time;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animated]);
  const orbit = (base: Camera, dx: number, dy: number) =>
    setCamera({
      yaw: base.yaw + dx,
      pitch: Math.max(0.08, Math.min(1.49, base.pitch + dy)),
    });
  return (
    <canvas
      ref={ref}
      className={interactive ? 'spatial-canvas orbit' : 'spatial-canvas'}
      role="img"
      aria-label={label + (interactive ? '. Поворот мышью или стрелками. Home возвращает исходный ракурс.' : '')}
      tabIndex={interactive ? 0 : undefined}
      onDoubleClick={() => interactive && setCamera(initialCamera)}
      onKeyDown={(e) => {
        if (!interactive) return;
        const shifts: Record<string, [number, number]> = {
          ArrowLeft: [-0.14, 0],
          ArrowRight: [0.14, 0],
          ArrowUp: [0, 0.12],
          ArrowDown: [0, -0.12],
        };
        if (e.key === 'Home') {
          e.preventDefault();
          setCamera(initialCamera);
        }
        if (shifts[e.key]) {
          e.preventDefault();
          orbit(camera, ...shifts[e.key]);
        }
      }}
      onPointerDown={(e) => {
        if (!interactive || !e.isPrimary || e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, y: e.clientY, camera };
      }}
      onPointerMove={(e) => {
        if (interactive && drag.current && e.isPrimary)
          orbit(drag.current.camera, (e.clientX - drag.current.x) * 0.008, (e.clientY - drag.current.y) * 0.007);
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
    />
  );
}

interface SpatialViewProps extends PlotProps {
  title: string;
  caption: string;
  active: boolean;
  children?: ReactNode;
}

/** Keep planar canvases mounted for editing, exports and deterministic simulation playback. */
export function SpatialView({ title, caption, active, children, ...plot }: SpatialViewProps) {
  const [volume, setVolume] = useState(true);
  const [reset, setReset] = useState(0);
  return (
    <div className="spatial-view">
      <div className="spatial-header">
        <strong>{title}</strong>
        {children && (
          <div className="view-switch" aria-label="Проекция">
            <button type="button" aria-pressed={volume} onClick={() => setVolume(true)}>
              3D
            </button>
            <button type="button" aria-pressed={!volume} onClick={() => setVolume(false)}>
              2D
            </button>
          </div>
        )}
      </div>
      {volume && active && (
        <>
          <div className="spatial-stage">
            <span className="orbit-tip" aria-hidden="true">
              ⟲ Вращайте сцену
            </span>
            <SpatialPlot {...plot} interactive key={reset} />
          </div>
          <div className="spatial-caption">
            <span>{caption}</span>
            <button
              type="button"
              onClick={() => setReset((v) => v + 1)}
              title="Вернуть исходный ракурс"
              aria-label="Вернуть исходный ракурс"
            >
              ↺
            </button>
          </div>
        </>
      )}
      {children && <div hidden={volume}>{children}</div>}
    </div>
  );
}
