export function luminance(hex: string): number {
  const channel = (index: number): number => {
    const srgb = parseInt(hex.slice(index, index + 2), 16) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

export type Vision = readonly (readonly [number, number, number])[];

const NORMAL_VISION: Vision = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

function linearRgb(hex: string, vision: Vision): readonly number[] {
  const linear = [1, 3, 5].map((index) => {
    const srgb = parseInt(hex.slice(index, index + 2), 16) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return vision.map((row) =>
    Math.min(
      1,
      Math.max(
        0,
        row.reduce((sum, k, at) => sum + k * (linear[at] ?? 0), 0),
      ),
    ),
  );
}

function cieLab([r = 0, g = 0, b = 0]: readonly number[]): readonly [
  number,
  number,
  number,
] {
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number): number =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export function deltaE76(
  a: string,
  b: string,
  vision: Vision = NORMAL_VISION,
): number {
  const [la, aa, ba] = cieLab(linearRgb(a, vision));
  const [lb, ab, bb] = cieLab(linearRgb(b, vision));
  return Math.hypot(la - lb, aa - ab, ba - bb);
}

export function mixHex(top: string, bottom: string, alpha: number): string {
  const mixed = [1, 3, 5].map((index) =>
    Math.round(
      parseInt(top.slice(index, index + 2), 16) * alpha +
        parseInt(bottom.slice(index, index + 2), 16) * (1 - alpha),
    )
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${mixed.join("")}`;
}
