/**
 * How the Cartesian scene is framed: how many Three.js units a meter is worth, and which plane
 * the 2D work happens in.
 *
 * Both are read at sync time by the scene views and by the pointer, and are set once per frame in
 * main.js from the active lab's `state.view`. A lab that never sets `view` keeps the defaults, so
 * the scenes that were authored in fixed units (Biot–Savart, Mag force, Faraday, optics) are
 * untouched.
 *
 * The point of the scale being a variable: a problem's real numbers (a 10 cm square, a 2 m
 * separation) go into the lab unchanged and the *view* adapts, instead of the positions and
 * charges being rescaled to fit a fixed scene.
 */
import { UNITS_PER_METER } from '../physics/constants.js';

/** The number plane runs to ±GRID_HALF units; a fit puts the content inside ±FIT_UNITS of them. */
export const GRID_HALF = 7;
export const FIT_UNITS = 3.4;
/**
 * A fit lands the content between 1.36 and 3.4 units out (the gaps between nice grid squares are
 * at most 2.5×), so refitting outside this wider band can never oscillate — and a drag or a
 * scenario a little larger than the last one leaves the scale alone. 3.4 units keeps the whole
 * layout clear of the panels, including the practice panel.
 */
export const FIT_MIN = 1.2;
export const FIT_MAX = 4.4;

let upm = UNITS_PER_METER;
let plane = 'xz';

/** Scene units per meter. */
export const sceneScale = () => upm;
/** 'xz' (the floor, the default) or 'xy' (the vertical plane problems are written in). */
export const workPlane = () => plane;

export function setFrame(view) {
  upm = view && view.upm > 0 ? view.upm : UNITS_PER_METER;
  plane = view && view.plane === 'xy' ? 'xy' : 'xz';
}

export function defaultView(planeId = 'xz') {
  return { upm: UNITS_PER_METER, plane: planeId };
}

/**
 * Softening radius, in meters: inside it the 1/r² singularity at a point charge is cut off. Tied to
 * the view (a fiftieth of a grid square), it means the same thing at every scale and stays far
 * smaller than any distance a problem would state, so it never quietly drops a charge from a sum.
 */
export function softenFor(view) {
  return 0.02 / (view && view.upm > 0 ? view.upm : UNITS_PER_METER);
}

/**
 * Softening for the equipotential grid, which does sample points right on top of a charge: a third
 * of a unit keeps one cell from swallowing the whole colour range.
 */
export function contourSoftenFor(view) {
  return 0.35 / (view && view.upm > 0 ? view.upm : UNITS_PER_METER);
}

/** Step for numerical derivatives (−dV/dx): a tenth of a grid square. */
export function stepFor(view) {
  return 0.1 / (view && view.upm > 0 ? view.upm : UNITS_PER_METER);
}

/** In-plane axes and the out-of-plane one, for dragging and for labeling. */
export const PLANE_AXES = {
  xz: { axes: ['x', 'z'], off: 'y' },
  xy: { axes: ['x', 'y'], off: 'z' },
};

const NICE = [1, 2, 2.5, 5];

/** Meters per grid square: the smallest 1 / 2 / 2.5 / 5 × 10ⁿ that frames `extent` in `fit` squares. */
export function metersPerUnit(extent, fit = FIT_UNITS) {
  const want = Math.max(1e-12, extent) / fit;
  const dec = 10 ** Math.floor(Math.log10(want));
  for (const n of NICE) if (n * dec >= want * (1 - 1e-9)) return n * dec;
  return 10 * dec;
}

/** Units per meter that frames `extent` on a nice grid. */
export function fitScale(extent, fit = FIT_UNITS) {
  return 1 / metersPerUnit(extent, fit);
}

/** Dragging snaps to half a grid square unless the pointer asks for free placement. */
export function snapStep(scale = upm) {
  return 1 / (2 * scale);
}

export function snapTo(v, step) {
  return step > 0 ? Math.round(v / step) * step : v;
}

const COORD = (p) => Math.max(Math.abs(p.x || 0), Math.abs(p.y || 0), Math.abs(p.z || 0));

/** Largest coordinate, in meters, of everything the student can see and move. */
export function contentExtent(state) {
  let m = 0;
  for (const c of state?.charges || []) m = Math.max(m, COORD(c));
  for (const key of ['probe', 'pathA']) if (state?.[key]) m = Math.max(m, COORD(state[key]));
  const surf = state?.surface;
  if (surf) m = Math.max(m, COORD(surf.origin || {}) + Math.max(surf.R || 0, (surf.L || 0) / 2));
  return m;
}

/**
 * The view a state wants: keeps the current plane, and rescales only when the content has drifted
 * out of the comfortable band (so a drag never makes the scene breathe).
 */
export function refit(state, { force = false, extent: given = 0 } = {}) {
  const view = state.view || defaultView();
  const extent = Math.max(given || 0, contentExtent(state));
  if (extent <= 0) return view;
  const drawn = extent * view.upm;
  if (!force && drawn >= FIT_MIN && drawn <= FIT_MAX) return view;
  return { ...view, upm: fitScale(extent) };
}

/** Compact length for grid ticks and coordinate readouts: 0.1 → "10 cm", 2 → "2 m". */
export function lenLabel(m) {
  const a = Math.abs(m);
  if (a < 1e-12) return '0';
  const [unit, mul] = a >= 1 ? ['m', 1] : a >= 1e-2 ? ['cm', 100] : a >= 1e-5 ? ['mm', 1e3] : ['µm', 1e6];
  const v = m * mul;
  const digits = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2;
  return `${Number(v.toFixed(digits))} ${unit}`;
}

/**
 * The unit coordinate boxes are typed in, chosen so a typical coordinate is a small number — the
 * one the problem is most likely to state (metres for a metre-wide layout, centimetres for a
 * hand-sized one) — with the snap step as the box's arrow step.
 */
export function coordUnit(scale = upm) {
  const square = 1 / scale;
  const [unit, per] = square >= 0.25 ? ['m', 1] : square >= 2.5e-3 ? ['cm', 100] : square >= 2.5e-5 ? ['mm', 1e3] : ['µm', 1e6];
  return { unit, per, step: Number(((square / 2) * per).toPrecision(3)) };
}
