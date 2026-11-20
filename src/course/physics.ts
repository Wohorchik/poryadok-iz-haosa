/**
 * Физика учебных опытов. Чистые функции: шаг моделирования получает состояние и возвращает новое.
 *
 * Качели: доска на опоре, шарики одинаковой массы. Наклон θ (в градусах, плюс — правый край ниже)
 * разгоняет момент Σ(xᵢ − опора); слабая пружина и затухание возвращают доску к горизонту, когда момента нет.
 * Шарики катятся вдоль доски с ускорением g·sin θ, их тормозит трение; при малом наклоне держит трение покоя.
 * Если опора не под средним, шарики скатываются к тяжёлой стороне и перекос растёт — равновесие неустойчиво,
 * как у настоящих качелей. Поэтому опору нужно ставить ровно в x̄.
 */

export const SEESAW = {
  /** Длина доски: шарики катаются между упорами 0 и 20. */
  length: 20,
  /** Предельный наклон доски, градусы. */
  maxTilt: 12,
  /** Наименьшее расстояние между центрами шариков (диаметр). */
  ballGap: 0.9,
  /** При наклоне меньше этого шарики не трогаются с места (трение покоя), градусы. */
  staticTilt: 3,
  gravity: 10,
  torqueGain: 5,
  spring: 4,
  damping: 5,
  rollingFriction: 1,
  kineticFriction: 0.4,
} as const;

export interface SeesawState {
  /** Наклон доски, градусы; плюс — правый край ниже. */
  theta: number;
  /** Угловая скорость, градусы в секунду. */
  omega: number;
  /** Положения шариков на шкале 0…20. */
  xs: number[];
  /** Скорости шариков вдоль доски. */
  vs: number[];
}

export const seesawStart = (xs: readonly number[]): SeesawState => ({ theta: 0, omega: 0, xs: [...xs], vs: xs.map(() => 0) });

const STATIC_PUSH = SEESAW.gravity * Math.sin((SEESAW.staticTilt * Math.PI) / 180);

/** Шарики не проходят друг сквозь друга и не выходят за упоры: столкновения неупругие. */
function separate(xs: number[], vs: number[]): void {
  const order = xs.map((_, i) => i).sort((a, b) => xs[a] - xs[b]);
  const gap = SEESAW.ballGap;
  for (let k = 1; k < order.length; k += 1) {
    const a = order[k - 1];
    const b = order[k];
    if (xs[b] - xs[a] < gap) {
      const mid = (xs[a] + xs[b]) / 2;
      xs[a] = mid - gap / 2;
      xs[b] = mid + gap / 2;
      const v = (vs[a] + vs[b]) / 2;
      vs[a] = v;
      vs[b] = v;
    }
  }
  // Упоры: проход слева направо от 0, затем справа налево от длины доски.
  for (let k = 0; k < order.length; k += 1) {
    const i = order[k];
    const floor = k === 0 ? 0 : xs[order[k - 1]] + gap;
    if (xs[i] < floor) {
      xs[i] = floor;
      if (vs[i] < 0) vs[i] = 0;
    }
  }
  for (let k = order.length - 1; k >= 0; k -= 1) {
    const i = order[k];
    const ceiling = k === order.length - 1 ? SEESAW.length : xs[order[k + 1]] - gap;
    if (xs[i] > ceiling) {
      xs[i] = ceiling;
      if (vs[i] > 0) vs[i] = 0;
    }
  }
}

/** Шаг моделирования на dt секунд (внутри — мелкие подшаги для устойчивости). held — шарик, который держит пользователь. */
export function seesawStep(state: SeesawState, pivot: number, dt: number, held: number | null = null): SeesawState {
  let { theta, omega } = state;
  const xs = [...state.xs];
  const vs = [...state.vs];
  const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / steps;
  for (let s = 0; s < steps; s += 1) {
    const torque = xs.reduce((sum, x) => sum + (x - pivot), 0);
    const rad = (theta * Math.PI) / 180;
    const alpha = SEESAW.torqueGain * torque * Math.cos(rad) - SEESAW.spring * theta - SEESAW.damping * omega;
    omega += alpha * h;
    theta += omega * h;
    if (Math.abs(theta) > SEESAW.maxTilt) {
      theta = Math.sign(theta) * SEESAW.maxTilt;
      omega = 0;
    }
    const push = SEESAW.gravity * Math.sin((theta * Math.PI) / 180);
    for (let i = 0; i < xs.length; i += 1) {
      if (i === held) {
        vs[i] = 0;
        continue;
      }
      if (Math.abs(vs[i]) < 0.02 && Math.abs(push) < STATIC_PUSH) {
        vs[i] = 0;
        continue;
      }
      const friction = SEESAW.rollingFriction * vs[i] + SEESAW.kineticFriction * Math.sign(vs[i]);
      vs[i] += (push - friction) * h;
      xs[i] += vs[i] * h;
    }
    separate(xs, vs);
  }
  return { theta, omega, xs, vs };
}

/** Всё замерло: доска не вращается, шарики стоят. */
export const isSettled = (state: SeesawState): boolean =>
  Math.abs(state.omega) < 0.5 && state.vs.every((v) => Math.abs(v) < 0.01);

/**
 * Шарик на доске Гальтона в момент t (единица времени — один уровень).
 * Координаты в шагах доски: u — по горизонтали от центра (штырёк ряда r стоит в u = j − r/2),
 * v — вниз, ряд r на высоте v = r. Между рядами шарик подскакивает и уходит на полшага влево или вправо;
 * после последнего ряда падает вниз над своей ячейкой (u = k − m/2) с ускорением.
 */
export function galtonBallPosition(path: readonly boolean[], t: number): { u: number; v: number } {
  const m = path.length;
  if (t <= 0) return { u: 0, v: 0 };
  let u = 0;
  const level = Math.min(Math.floor(t), m);
  for (let r = 0; r < level; r += 1) u += path[r] ? 0.5 : -0.5;
  if (t >= m) return { u, v: m + 1.6 * (t - m) * (t - m) };
  const s = t - level;
  const ease = s * s * (3 - 2 * s);
  const dir = path[level] ? 0.5 : -0.5;
  // Подскок над штырьком: шарик сначала чуть поднимается, потом падает на следующий ряд.
  return { u: u + dir * ease, v: level + s * s - 0.3 * Math.sin(Math.PI * s) };
}
