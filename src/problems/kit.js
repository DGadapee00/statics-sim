/**
 * Authoring kit for problem templates. A template is a *generator*: variables with ranges,
 * answers computed from them, and an optional hook that loads the matching lab so the sim
 * shows the same setup. See PROBLEMS.md.
 *
 * All values inside `$` are SI. Range variables are sampled in their display unit and
 * multiplied by `si`; choice variables carry their option value.
 */
import { fitScale, lenLabel } from '../engine/frame.js';
import { G, G_FT } from '../physics/constants.js';

export { G, G_FT };
export const DEG = Math.PI / 180;

// ---------- variables ----------
export const range = (min, max, step, unit = '', si = 1, opts = {}) => ({ type: 'range', min, max, step, unit, si, ...opts });
export const choice = (...opts) => ({ type: 'choice', options: opts.map(([value, label]) => ({ value, label })) });
export const SIGN = choice([1, 'positive'], [-1, 'negative']);
export const UPDOWN = choice([1, 'upward'], [-1, 'downward']);

// ---------- parts ----------
/** Numeric answer. get($) returns SI; the student answers in `unit`, i.e. SI / scale. */
export const num = (id, get, unit, o = {}) => ({
  id,
  kind: 'numeric',
  get,
  unit,
  scale: o.scale ?? 1,
  tol: o.tol ?? 0.02,
  abs: o.abs ?? 0,
  wrap: o.wrap ?? 0, // 360 for direction angles: −30° and 330° are the same answer
  label: o.label ?? null,
});

/** Multiple choice. `correct` is an option value, an array (multi-select), or a function of $. */
export const mc = (id, options, correct, o = {}) => ({
  id,
  kind: 'choice',
  options: options.map(([value, label]) => ({ value, label })),
  correct,
  multi: !!o.multi,
  label: o.label ?? null,
});

export const tf = (id, correct, o = {}) => mc(id, [[1, 'True'], [0, 'False']], correct ? 1 : 0, o);

/**
 * Symbolic answer typed by the student, e.g. "2k*lam/R".
 * expr uses the engine's parser; `vars` are the symbols the student may use (plus k, eps0, mu0, pi).
 * `alias` maps typed Greek letters to symbol names (λ → lam). The check script confirms that
 * expr, evaluated with $, equals `get($)`.
 */
/**
 * Symbolic answer: the expression, before any numbers go in.
 *
 * `vars` is either a list of symbol names, or — better — a map of name → SI unit, which lets the
 * panel show the units of what the student typed and lets the bank check itself. Pass the unit of
 * the answer as `o.unit` to turn that check on.
 *
 *   sym('Ey_sym', 'k*lam*L/(d*sqrt(d^2+L^2/4))', { lam: 'C/m', L: 'm', d: 'm' }, ($) => $.Ey,
 *       { unit: 'N/C', label: '$E_y$ as a formula' })
 */
export const sym = (id, expr, vars, get, o = {}) => ({
  id,
  kind: 'symbolic',
  expr,
  vars: Array.isArray(vars) ? vars : Object.keys(vars),
  units: Array.isArray(vars) ? null : vars,
  unit: o.unit ?? null,
  get,
  alias: o.alias ?? {},
  label: o.label ?? null,
});

/** Free response (sketches, derivation setup). Graded by the student against the rubric. */
export const self = (id, prompt, rubric) => ({ id, kind: 'self', label: prompt, rubric });

// ---------- common option sets ----------
export const DIR_X = [
  [1, '+x direction'],
  [-1, '−x direction'],
  [0, 'Zero (no direction)'],
];
export const RADIAL = [
  [1, 'Radially outward'],
  [-1, 'Radially inward'],
  [0, 'Zero field'],
];
export const POSNEG = [
  [1, 'Positive'],
  [-1, 'Negative'],
];
export const AXES6 = [
  [1, '+x'],
  [-1, '−x'],
  [2, '+y'],
  [-2, '−y'],
  [3, '+z'],
  [-3, '−z'],
  [0, 'Zero'],
];
/** Map a vector to the AXES6 code of its dominant component (0 if ~zero). */
export function axisCode(v) {
  const a = [Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)];
  const m = Math.max(...a);
  if (m < 1e-30) return 0;
  const i = a.indexOf(m);
  return (i + 1) * Math.sign([v.x, v.y, v.z][i]);
}

// ---------- template ----------
export function problem(spec) {
  return {
    level: 1,
    topics: [],
    vars: {},
    derive: () => ({}),
    valid: () => true,
    hints: [],
    steps: () => [],
    sim: null,
    cases: [],
    ...spec,
  };
}

/** A worked instance, usually the worksheet's own numbers. want: partId → expected (display units). */
export const kase = (src, v, want, o = {}) => ({ src, v, want, key: o.key ?? null, note: o.note ?? null });

// ---------- sim helpers ----------
let uid = 5000;
/** Charge in the shape the charge-based labs use (ids far above scenarios.js' counter). */
export const charge = (q, x, y, z = 0, extra = {}) => ({ id: ++uid, q, x, y, z, ...extra });

/**
 * Load a problem's own numbers into a lab slice: true positions in meters, true charges, and a view
 * scaled to frame them (see engine/frame.js).
 *
 * This used to scale the layout into a fixed-size scene and compensate on the charges, which kept
 * the answer right but meant the separation on screen was never the separation in the question.
 * Now the geometry is the question's, and the *view* adapts — so a value read off the lab is the
 * value being solved for, and the setup can be rebuilt by hand from the problem text.
 */
export function layout(s, { charges = [], probe = null, pathA = null, plane = 'xy', select = 0 } = {}) {
  const pt = (p) => ({ x: p.x || 0, y: p.y || 0, z: p.z || 0 });
  const all = [...charges, probe, pathA].filter(Boolean).map(pt);
  const extent = Math.max(1e-9, ...all.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y), Math.abs(p.z))));
  s.charges = charges;
  if (probe) s.probe = pt(probe);
  if (pathA) s.pathA = pt(pathA);
  s.extraE = { x: 0, y: 0, z: 0 };
  s.selectedId = charges[select]?.id ?? charges[0]?.id ?? null;
  const upm = fitScale(extent);
  s.view = { upm, plane };
  return `Set to the problem's own numbers · 1 grid square = ${lenLabel(1 / upm)}`;
}

/**
 * A number for the inside of `$…$`: three significant figures, scientific as TeX rather than with
 * the unicode superscripts `sig()` uses (KaTeX cannot read those). Steps and hints are typeset —
 * see PROBLEMS.md — so a worked line can be one piece of mathematics, numbers and all.
 */
export function texNum(x, n = 3) {
  if (!Number.isFinite(x)) return '-';
  if (x === 0 || Math.abs(x) < 1e-300) return '0';
  const a = Math.abs(x);
  if (a >= 0.01 && a < 1e5) return String(Number(x.toPrecision(n))).replace('-', '-');
  const [m, e] = x.toExponential(n - 1).split('e');
  return `${Number(m)}\\times 10^{${Number(e)}}`;
}

export const mag = (v) => Math.hypot(v.x, v.y, v.z || 0);
export const angleDeg = (x, y) => ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
