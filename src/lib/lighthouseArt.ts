export const ART_SIZE = 60;

type Rgb = readonly [number, number, number];

const hex = (value: string): Rgb => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
];

const SKY = ['#25387F', '#2F4494', '#4154AB', '#6263BA', '#9170BA', '#C9799F', '#EE8F7E', '#FBB56C', '#FFD27A'].map(hex);
const SEA = ['#2A7FA8', '#216D98', '#1A5C87', '#154D76', '#104066'].map(hex);
const WAVE = hex('#7CCBDD');
const GLOW = hex('#FFF0A6');
const SUN = hex('#FFEFB5');
const CLOUD = hex('#F6B8A8');
const STAR = hex('#F4F7FF');
const ROCK_LIGHT = hex('#6F6078');
const ROCK = hex('#544860');
const ROCK_DARK = hex('#3A3248');
const GRASS = hex('#5E9A5C');
const WHITE = hex('#F7F2E8');
const WHITE_SHADE = hex('#CFC8C4');
const RED = hex('#DC3F3C');
const RED_SHADE = hex('#A92D33');
const IRON = hex('#25283D');
const ROOF = hex('#B32F35');
const DOOR = hex('#40292C');
const SAIL = hex('#FFF9EC');
const HULL = hex('#5B2F35');

/** Встроенная пиксельная иллюстрация маяка на закате: массив RGBA размером 60 × 60. */
export function buildLighthousePixels(): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(ART_SIZE * ART_SIZE * 4);

  const set = (x: number, y: number, color: Rgb, alpha = 1): void => {
    if (x < 0 || y < 0 || x >= ART_SIZE || y >= ART_SIZE) return;
    const offset = (y * ART_SIZE + x) * 4;
    for (let channel = 0; channel < 3; channel += 1) {
      pixels[offset + channel] = pixels[offset + channel] * (1 - alpha) + color[channel] * alpha;
    }
    pixels[offset + 3] = 255;
  };
  const rect = (x: number, y: number, width: number, height: number, color: Rgb): void => {
    for (let row = y; row < y + height; row += 1) {
      for (let column = x; column < x + width; column += 1) set(column, row, color);
    }
  };

  // Небо с пиксельным смешиванием полос.
  const horizon = 42;
  for (let y = 0; y < horizon; y += 1) {
    const position = (y / horizon) * SKY.length;
    const band = Math.floor(position);
    const blend = position - band;
    for (let x = 0; x < ART_SIZE; x += 1) {
      const useNext = blend > 0.62 && (x + y) % 2 === 0;
      set(x, y, SKY[Math.min(band + (useNext ? 1 : 0), SKY.length - 1)]);
    }
  }

  const stars = [[4, 3], [11, 7], [19, 2], [26, 9], [31, 4], [52, 3], [57, 9], [47, 6], [8, 13], [22, 14], [54, 15]];
  stars.forEach(([x, y]) => set(x, y, STAR));

  // Солнце у горизонта.
  for (let y = 30; y < horizon; y += 1) {
    for (let x = 6; x < 22; x += 1) {
      if ((x - 14) ** 2 + (y - 38) ** 2 <= 36) set(x, y, SUN);
    }
  }

  // Облака.
  rect(3, 22, 12, 1, CLOUD);
  rect(6, 21, 6, 1, CLOUD);
  rect(20, 27, 9, 1, CLOUD);
  rect(23, 26, 4, 1, CLOUD);
  rect(49, 24, 11, 1, CLOUD);
  rect(52, 23, 5, 1, CLOUD);

  // Лучи маяка.
  const lampY = 9;
  for (let x = 0; x < 37; x += 1) {
    const spread = (37 - x) * 0.3;
    for (let y = Math.floor(lampY - spread); y <= lampY + spread; y += 1) {
      set(x, y, GLOW, 0.5 - (37 - x) * 0.009);
    }
  }
  for (let x = 44; x < ART_SIZE; x += 1) {
    const spread = (x - 44) * 0.3;
    for (let y = Math.floor(lampY - spread); y <= lampY + spread; y += 1) {
      set(x, y, GLOW, 0.5 - (x - 44) * 0.018);
    }
  }

  // Чайки.
  [[16, 18], [17, 17], [18, 18], [19, 17], [20, 18], [27, 21], [28, 20], [29, 21], [30, 20], [31, 21]].forEach(
    ([x, y]) => set(x, y, IRON),
  );

  // Море.
  for (let y = horizon; y < ART_SIZE; y += 1) {
    const band = Math.min(Math.floor(((y - horizon) / (ART_SIZE - horizon)) * SEA.length), SEA.length - 1);
    rect(0, y, ART_SIZE, 1, SEA[band]);
  }
  for (let y = horizon + 1; y < ART_SIZE; y += 2) {
    const offset = (y * 7) % 11;
    for (let x = offset; x < ART_SIZE; x += 11) rect(x, y, 3 + (y % 3), 1, WAVE);
  }
  // Солнечная дорожка.
  for (let y = horizon; y < 54; y += 1) {
    const half = 4 - Math.floor((y - horizon) / 4);
    for (let x = 14 - half; x <= 14 + half; x += 1) {
      if ((x + y) % 2 === 0) set(x, y, SUN);
    }
  }

  // Парусная лодка.
  rect(8, 52, 10, 1, HULL);
  rect(9, 53, 8, 1, HULL);
  rect(13, 44, 1, 8, IRON);
  for (let row = 0; row < 7; row += 1) rect(14, 45 + row, 1 + row, 1, SAIL);
  for (let row = 2; row < 7; row += 1) rect(13 - Math.floor(row / 2), 45 + row, Math.floor(row / 2), 1, SAIL);

  // Скала.
  const rockRows = [
    [32, 49], [30, 51], [28, 53], [27, 54], [26, 55], [25, 56], [24, 57], [24, 58],
    [23, 58], [23, 59], [24, 59], [26, 58], [29, 56], [33, 52],
  ];
  rockRows.forEach(([left, right], row) => {
    const y = 41 + row;
    rect(left, y, right - left, 1, ROCK);
    rect(left, y, 3, 1, ROCK_LIGHT);
    rect(right - 5, y, 5, 1, ROCK_DARK);
    if (row % 3 === 1) rect(left + 8, y, 6, 1, ROCK_LIGHT);
    if (row % 4 === 2) rect(left + 17, y, 5, 1, ROCK_DARK);
  });
  rect(31, 40, 19, 1, GRASS);
  rect(29, 41, 23, 1, GRASS);

  // Башня: сужается кверху, полосы красные и белые.
  const towerTop = 15;
  const towerBottom = 41;
  for (let y = towerTop; y < towerBottom; y += 1) {
    const halfWidth = 3 + Math.floor(((y - towerTop) / (towerBottom - towerTop)) * 4);
    const isRed = Math.floor((y - towerTop) / 6.5) % 2 === 0;
    rect(40 - halfWidth, y, halfWidth * 2, 1, isRed ? RED : WHITE);
    rect(40 + halfWidth - 2, y, 2, 1, isRed ? RED_SHADE : WHITE_SHADE);
  }
  rect(39, 19, 2, 3, IRON);
  rect(38, 30, 2, 3, IRON);
  rect(38, 36, 4, 5, DOOR);

  // Галерея, фонарь и крыша.
  rect(34, 13, 12, 2, IRON);
  rect(35, 12, 1, 1, IRON);
  rect(44, 12, 1, 1, IRON);
  rect(37, 7, 6, 6, GLOW);
  rect(37, 7, 1, 6, IRON);
  rect(42, 7, 1, 6, IRON);
  rect(39, 8, 2, 4, WHITE);
  for (let row = 0; row < 4; row += 1) rect(39 - row, 3 + row, 2 + row * 2, 1, ROOF);
  rect(39, 1, 2, 2, IRON);

  return pixels;
}
