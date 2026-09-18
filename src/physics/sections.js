/**
 * Internal loads, centroids and area moments of inertia · Hibbeler Ch 7, 9, 10.
 */

import { distributedLoad } from './statics.js';

// ---------------------------------------------------------------- Ch 7: internal loads

/**
 * Normal force, shear and bending moment at a cut, from the left-hand segment of a beam.
 *
 * Sign convention (the one the chapter draws): N positive in tension, V positive when the left
 * segment is pushed up, M positive when it sags (compression on top).
 *
 * `loads` are point loads { x, Fx, Fy, M } and `dist` a list of { w, a, b } distributed loads.
 * Fy and w(x) are both signed the same way: positive is UP. A load of 120 lb/ft pressing down on
 * the beam is therefore w: () => -120, not +120.
 */
export function internalAt(cut, { reactions = [], loads = [], dist = [] }) {
  let N = 0;
  let V = 0;
  let M = 0;
  const take = (x, Fx, Fy, Mo) => {
    if (x > cut + 1e-12) return;
    N -= Fx || 0;
    V += Fy || 0;
    M += (Fy || 0) * (cut - x) + (Mo || 0);
  };
  for (const r of reactions) take(r.x, r.Fx, r.Fy, r.M);
  for (const p of loads) take(p.x, p.Fx, p.Fy, p.M);
  for (const d of dist) {
    if (d.a >= cut) continue;
    const b = Math.min(d.b, cut);
    const { F, x } = distributedLoad(d.w, d.a, b);
    V += F;
    M += F * (cut - x);
  }
  return { N, V, M };
}

/** Shear and moment sampled across a beam, for drawing the diagrams. */
export function shearMomentDiagram(L, setup, n = 400) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = (L * i) / n;
    // Sample just past each station so a point load lands on the correct side of the jump.
    pts.push({ x, ...internalAt(x + 1e-9, setup) });
  }
  return pts;
}

// ---------------------------------------------------------------- Ch 9: centroids

/**
 * Centroid of a composite shape. Each part is { A, x, y } — area (or length, or volume) and the
 * centroid of that part. A negative A punches a hole, which is how the shaded-area problems work.
 */
export function composite(parts) {
  let A = 0;
  let Ax = 0;
  let Ay = 0;
  for (const p of parts) {
    A += p.A;
    Ax += p.A * p.x;
    Ay += p.A * p.y;
  }
  return { A, x: A === 0 ? NaN : Ax / A, y: A === 0 ? NaN : Ay / A };
}

/** Centroid of the area under y = f(x) between a and b, by integration. */
export function centroidUnderCurve(f, a, b, n = 4000) {
  let A = 0;
  let Ax = 0;
  let Ay = 0;
  const h = (b - a) / n;
  for (let i = 0; i < n; i++) {
    const x = a + (i + 0.5) * h;
    const y = f(x);
    A += y * h;
    Ax += x * y * h;
    Ay += (y / 2) * y * h;
  }
  return { A, x: Ax / A, y: Ay / A };
}

/** Centroid of a plane curve y = f(x) — the Ch 9 "centroid of the line" problems. */
export function centroidOfLine(f, df, a, b, n = 4000) {
  let L = 0;
  let Lx = 0;
  let Ly = 0;
  const h = (b - a) / n;
  for (let i = 0; i < n; i++) {
    const x = a + (i + 0.5) * h;
    const ds = Math.sqrt(1 + df(x) ** 2) * h;
    L += ds;
    Lx += x * ds;
    Ly += f(x) * ds;
  }
  return { L, x: Lx / L, y: Ly / L };
}

/** Common shapes, as composite parts. */
export const rect = (w, h, x0 = 0, y0 = 0) => ({ A: w * h, x: x0 + w / 2, y: y0 + h / 2 });
export const tri = (b, h, x0 = 0, y0 = 0) => ({ A: (b * h) / 2, x: x0 + b / 3, y: y0 + h / 3 });
export const circ = (r, x0 = 0, y0 = 0) => ({ A: Math.PI * r * r, x: x0, y: y0 });
export const semi = (r, x0 = 0, y0 = 0) => ({ A: (Math.PI * r * r) / 2, x: x0, y: y0 + (4 * r) / (3 * Math.PI) });
export const quarter = (r, x0 = 0, y0 = 0) => ({ A: (Math.PI * r * r) / 4, x: x0 + (4 * r) / (3 * Math.PI), y: y0 + (4 * r) / (3 * Math.PI) });

/**
 * Pappus–Guldinus: revolve a plane curve or area about an axis.
 * Surface area A = θ·r̄·L, volume V = θ·r̄·A, with θ in radians (2π for a full revolution).
 */
export const pappusArea = (rbar, L, theta = 2 * Math.PI) => theta * rbar * L;
export const pappusVolume = (rbar, A, theta = 2 * Math.PI) => theta * rbar * A;

// ---------------------------------------------------------------- Ch 10: moment of inertia

/** Parallel-axis theorem: I about a parallel axis a distance d away. */
export const parallelAxis = (Ibar, A, d) => Ibar + A * d * d;

/** Centroidal second moments for the usual shapes. */
export const rectI = (w, h) => ({ Ix: (w * h ** 3) / 12, Iy: (h * w ** 3) / 12 });
export const triI = (b, h) => ({ Ix: (b * h ** 3) / 36, Iy: (h * b ** 3) / 36 });
export const circI = (r) => ({ Ix: (Math.PI * r ** 4) / 4, Iy: (Math.PI * r ** 4) / 4 });
export const semiI = (r) => ({ Ix: ((Math.PI / 8) - (8 / (9 * Math.PI))) * r ** 4, Iy: (Math.PI * r ** 4) / 8 });

/**
 * Second moment of a composite area about the x and y axes through the origin.
 * Each part is { A, x, y, Ix, Iy } with Ix, Iy taken about that part's own centroid.
 */
export function compositeI(parts) {
  let Ix = 0;
  let Iy = 0;
  for (const p of parts) {
    Ix += parallelAxis(p.Ix, p.A, p.y);
    Iy += parallelAxis(p.Iy, p.A, p.x);
  }
  return { Ix, Iy };
}

/** I_x of the area under y = f(x) by integration, for checking the composite answers. */
export function IxUnderCurve(f, a, b, n = 4000) {
  let I = 0;
  const h = (b - a) / n;
  for (let i = 0; i < n; i++) {
    const x = a + (i + 0.5) * h;
    I += (f(x) ** 3 / 3) * h;
  }
  return I;
}

export function IyUnderCurve(f, a, b, n = 4000) {
  let I = 0;
  const h = (b - a) / n;
  for (let i = 0; i < n; i++) {
    const x = a + (i + 0.5) * h;
    I += x * x * f(x) * h;
  }
  return I;
}

/** Radius of gyration, k = √(I/A). */
export const radiusOfGyration = (I, A) => Math.sqrt(I / A);
