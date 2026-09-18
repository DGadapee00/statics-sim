/**
 * Dimensional analysis for the symbolic answers in the problem bank.
 *
 * A dimension is the exponent vector [M, L, T, I] — mass, length, time, current. Every unit the
 * course uses is one of those, so "N/C" and "V/m" compare equal, and an expression whose units
 * come out as kg·m/s² can be told apart from one that came out as kg·m²/s².
 *
 * This is the check a student does by hand: write the answer in symbols, read off the units, see
 * whether it lands in the right place. Here it runs on what they typed, before they submit.
 */

export const ZERO = [0, 0, 0, 0];

const mul = (a, b) => a.map((x, i) => x + b[i]);
const div = (a, b) => a.map((x, i) => x - b[i]);
const scale = (a, n) => a.map((x) => x * n);

export const dimEqual = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
export const isDimensionless = (a) => dimEqual(a, ZERO);

/** Unit name → dimension. SI only, no prefixes: the bank stores every value in SI. */
const M = [1, 0, 0, 0];
const L = [0, 1, 0, 0];
const T = [0, 0, 1, 0];
const I = [0, 0, 0, 1];

export const UNITS = {
  kg: M,
  m: L,
  // Prefixed lengths, because the optics and wave problems are written in them. Only the dimension
  // matters here, so cm and m compare equal — the declared string is what the panel shows.
  cm: L,
  mm: L,
  nm: L,
  km: L,
  s: T,
  A: I,
  C: mul(I, T),
  N: [1, 1, -2, 0],
  J: [1, 2, -2, 0],
  W: [1, 2, -3, 0],
  V: [1, 2, -3, -1],
  F: [-1, -2, 4, 2],
  ohm: [1, 2, -3, -2],
  'Ω': [1, 2, -3, -2],
  T: [1, 0, -2, -1], // tesla — inside a unit string, never "time"
  Wb: [1, 2, -2, -1],
  H: [1, 2, -2, -2],
  Hz: [0, 0, -1, 0],
  Pa: [1, -1, -2, 0],
  // Statics works in both systems, so the US customary units carry their own names. A pound is a
  // force here, not a mass, and a slug is the mass that goes with it.
  lb: [1, 1, -2, 0],
  kip: [1, 1, -2, 0],
  ft: [0, 1, 0, 0],
  in: [0, 1, 0, 0],
  slug: [1, 0, 0, 0],
  D: [0, -1, 0, 0], // diopter
  rad: ZERO,
  '': ZERO,
  '1': ZERO,
};

/** Dimensions of the constants the expression language provides. */
export const CONST_DIMS = {
  pi: ZERO,
  g: [0, 1, -2, 0], // m/s²
  gft: [0, 1, -2, 0],
};

const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁻': '-' };

/**
 * "N·m²/C²" → [1, 3, -4, -2]. Understands ·, *, a space, /, parentheses, and exponents written
 * `^2` or `²`. A `/` divides by the one factor that follows it, so "N/(C·m²)" groups as written.
 */
export function parseUnit(src) {
  const s = String(src ?? '')
    .replace(/[⁰¹²³⁴⁵⁶⁻]/g, (ch) => (ch === '⁻' ? '^-' : `^${SUP[ch]}`))
    .replace(/·|\*/g, ' ')
    .trim();
  if (!s) return ZERO;
  const toks = [...s.matchAll(/\s*([A-Za-zΩ]+(?:\^-?\d+(?:\.\d+)?)?|1|\(|\)|\/)/g)].map((m) => m[1]);
  if (!toks.length) throw new Error(`Unit "${src}": nothing to read`);
  let i = 0;

  function factor() {
    const t = toks[i++];
    if (t === undefined) throw new Error(`Unit "${src}": ends too early`);
    if (t === '(') {
      const d = group();
      if (toks[i++] !== ')') throw new Error(`Unit "${src}": missing )`);
      return d;
    }
    const m = /^([A-Za-zΩ]+|1)(?:\^(-?\d+(?:\.\d+)?))?$/.exec(t);
    if (!m) throw new Error(`Unit "${src}": cannot read "${t}"`);
    const base = UNITS[m[1]];
    if (!base) throw new Error(`Unit "${src}": unknown unit "${m[1]}"`);
    return scale(base, m[2] ? Number(m[2]) : 1);
  }

  function group() {
    let dim = ZERO;
    let first = true;
    while (i < toks.length && toks[i] !== ')') {
      if (toks[i] === '/') {
        i++;
        dim = div(dim, factor());
      } else {
        dim = first ? factor() : mul(dim, factor());
      }
      first = false;
    }
    return dim;
  }

  const dim = group();
  if (i !== toks.length) throw new Error(`Unit "${src}": cannot read "${toks.slice(i).join(' ')}"`);
  return dim;
}

// Tried in order, so a composite that a student would recognise wins over raw base units.
const NAMED = [
  'N', 'lb', 'm', 'ft', 'N·m', 'lb·ft', 'N/m', 'lb/ft', 'm^4', 'ft^4', 'm^2', 'ft^2',
  'N/C', 'V', 'C', 'J', 'W', 'F', 'Ω', 'T', 'Wb', 'H', 'Hz', 'Pa', 'A', 's', 'kg',
  'm/s', 'm/s²', 'C/m', 'C/m²', 'C/m³', 'W/m²', 'A/m²', 'N/m', 'J/C', 'N·m', 'N·m²/C', 'N·m²/C²',
  'V·s', 'V/s', 'C/V', 'J/s', 'kg·m/s', '1/m', '1/s',
];

const SUP_OUT = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻', '.': '·' };
const sup = (n) => [...String(n)].map((c) => SUP_OUT[c] ?? c).join('');

/** A dimension as the shortest readable unit: a named one when it fits, else kg·m²/(A·s³). */
export function formatDim(dim) {
  if (isDimensionless(dim)) return 'dimensionless';
  for (const name of NAMED) {
    if (dimEqual(dim, parseUnit(name))) return name;
  }
  const names = ['kg', 'm', 's', 'A'];
  const top = [];
  const bottom = [];
  dim.forEach((e, i) => {
    if (Math.abs(e) < 1e-9) return;
    const p = Math.abs(e) === 1 ? names[i] : `${names[i]}${sup(Math.abs(e))}`;
    (e > 0 ? top : bottom).push(p);
  });
  const num = top.join('·') || '1';
  return bottom.length ? `${num}/${bottom.length > 1 ? `(${bottom.join('·')})` : bottom[0]}` : num;
}

export { mul as dimMul, div as dimDiv, scale as dimScale };
