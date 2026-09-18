/**
 * Equilibrium, moments and rigid bodies · Hibbeler Ch 3–5.
 *
 * Everything here returns the residuals as well as the answer. That is the point of the app: the
 * lab does not just report "T = 240 lb", it reports ΣFx, ΣFy and ΣM so you can see the equations
 * close. A residual that is not zero is the check failing, and it should be visible.
 */

import { v, add, sub, scale, dot, cross, mag, unit, unitAB, resultant, DEG } from './vectors.js';

// ---------------------------------------------------------------- Ch 3: particle equilibrium

/** Hooke's law for the spring problems: F = k·s, with s the stretch from the unstretched length. */
export const springForce = (k, stretch) => k * stretch;
export const springStretch = (F, k) => F / k;

/**
 * A particle with several known forces and up to two unknown force magnitudes along known
 * directions (the usual "find the tension in AB and AC" setup, in 2D).
 *
 * `known` is a list of force vectors; `dirs` is a list of one or two unit directions whose
 * magnitudes are unknown. Solves ΣF = 0 for those magnitudes.
 */
export function particleEq2D(known, dirs) {
  const K = resultant(...known);
  if (dirs.length === 1) {
    const u = unit(dirs[0]);
    // One unknown can only balance if the known resultant is antiparallel to u.
    const T = -dot(K, u);
    return { magnitudes: [T], residual: add(K, scale(u, T)) };
  }
  const [a, b] = dirs.map(unit);
  // [ax bx][Ta]   [-Kx]
  // [ay by][Tb] = [-Ky]
  const det = a.x * b.y - a.y * b.x;
  if (Math.abs(det) < 1e-12) return { magnitudes: [NaN, NaN], residual: K, singular: true };
  const Ta = (-K.x * b.y + K.y * b.x) / det;
  const Tb = (-a.x * K.y + a.y * K.x) / det;
  return {
    magnitudes: [Ta, Tb],
    residual: add(K, add(scale(a, Ta), scale(b, Tb))),
  };
}

/** Three unknown magnitudes along three known directions in 3D — the Ch 3 cable problems. */
export function particleEq3D(known, dirs) {
  const K = resultant(...known);
  const [a, b, c] = dirs.map(unit);
  const M = [
    [a.x, b.x, c.x],
    [a.y, b.y, c.y],
    [a.z, b.z, c.z],
  ];
  const rhs = [-K.x, -K.y, -K.z];
  const T = solve3(M, rhs);
  const res = add(K, add(scale(a, T[0]), add(scale(b, T[1]), scale(c, T[2]))));
  return { magnitudes: T, residual: res };
}

/** Cramer's rule on a 3×3. Returns NaNs on a singular system rather than throwing. */
export function solve3(M, r) {
  const d = det3(M);
  if (Math.abs(d) < 1e-12) return [NaN, NaN, NaN];
  const col = (i, vals) => M.map((row, j) => row.map((x, k) => (k === i ? vals[j] : x)));
  return [det3(col(0, r)) / d, det3(col(1, r)) / d, det3(col(2, r)) / d];
}

export function det3(m) {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
    - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
    + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
}

// ---------------------------------------------------------------- Ch 4: moments

/** M = r × F, with r from the moment point to any point on the force's line of action. */
export const momentAbout = (point, applyAt, F) => cross(sub(applyAt, point), F);

/** Scalar moment in 2D (the z component), positive counterclockwise. */
export function moment2D(point, applyAt, F) {
  const r = sub(applyAt, point);
  return r.x * F.y - r.y * F.x;
}

/** The d in M = F·d: the perpendicular distance from the point to the line of action. */
export function momentArm(point, applyAt, F) {
  const m = mag(F);
  return m < 1e-12 ? 0 : mag(momentAbout(point, applyAt, F)) / m;
}

/**
 * Moment of F about an axis through A along u: M_axis = u · (r × F), a scalar.
 * This is the Ch 4 "moment about segment AB" problem, and the sign says which way it twists.
 */
export function momentAboutAxis(A, u, applyAt, F) {
  const uh = unit(u);
  return dot(uh, cross(sub(applyAt, A), F));
}

/** A couple: two equal and opposite forces. The moment is the same about every point. */
export const coupleMoment = (rAB, F) => cross(rAB, F);

/** Total moment of several forces about a point, plus the resultant force. */
export function resultantWrench(point, loads) {
  let F = v(0, 0, 0);
  let M = v(0, 0, 0);
  for (const L of loads) {
    F = add(F, L.F);
    M = add(M, momentAbout(point, L.at, L.F));
    if (L.couple) M = add(M, L.couple);
  }
  return { F, M };
}

// ---------------------------------------------------------------- Ch 5: rigid bodies in 2D

/**
 * Planar rigid body with three unknown reaction scalars — the standard determinate case.
 *
 * `unknowns` is a list of up to three entries, each either
 *   { at: point, dir: vector }   a force of unknown magnitude along a known direction, or
 *   { couple: true }             an unknown couple moment (a fixed support).
 * `loads` is a list of { at, F } and/or { couple } already known.
 *
 * Solves ΣFx = 0, ΣFy = 0, ΣM_o = 0 about `about`, and hands back the residuals so a lab can
 * show that the three equations really do close.
 */
export function rigidBody2D({ loads, unknowns, about = v(0, 0, 0) }) {
  const known = resultantWrench(about, loads);
  const cols = unknowns.map((u) => {
    if (u.couple) return [0, 0, 1];
    const d = unit(u.dir);
    const r = sub(u.at, about);
    return [d.x, d.y, r.x * d.y - r.y * d.x];
  });
  while (cols.length < 3) cols.push([0, 0, 0]);
  const M = [
    [cols[0][0], cols[1][0], cols[2][0]],
    [cols[0][1], cols[1][1], cols[2][1]],
    [cols[0][2], cols[1][2], cols[2][2]],
  ];
  const rhs = [-known.F.x, -known.F.y, -known.M.z];
  const sol = solve3(M, rhs).slice(0, unknowns.length);

  // Residuals: recompute the three sums with the reactions included.
  let Fx = known.F.x;
  let Fy = known.F.y;
  let Mo = known.M.z;
  unknowns.forEach((u, i) => {
    const s = sol[i];
    if (u.couple) {
      Mo += s;
      return;
    }
    const d = unit(u.dir);
    Fx += d.x * s;
    Fy += d.y * s;
    const r = sub(u.at, about);
    Mo += (r.x * d.y - r.y * d.x) * s;
  });
  return { reactions: sol, residual: { Fx, Fy, M: Mo } };
}

/** A distributed load w(x) over [a, b] as an equivalent point force and its location. */
export function distributedLoad(w, a, b, n = 2000) {
  let F = 0;
  let Mx = 0;
  const h = (b - a) / n;
  for (let i = 0; i < n; i++) {
    const x0 = a + i * h;
    const x1 = x0 + h;
    const wm = (w(x0) + w(x1)) / 2;
    F += wm * h;
    Mx += wm * h * ((x0 + x1) / 2);
  }
  return { F, x: F === 0 ? (a + b) / 2 : Mx / F };
}

/** Uniform and triangular loads in closed form, for checking the numeric version. */
export const uniformLoad = (w0, a, b) => ({ F: w0 * (b - a), x: (a + b) / 2 });
export const triangularLoad = (w0, a, b) => ({ F: (w0 * (b - a)) / 2, x: a + (2 * (b - a)) / 3 });
