/**
 * Plane trusses · Hibbeler Ch 6.
 *
 * Solved by the method of joints as one linear system: two equilibrium equations per joint,
 * unknowns being the member forces plus the support reactions. Tension is positive throughout,
 * which is the sign convention the problems use.
 *
 * The solver hands back the per-joint residuals as well as the member forces. That is what lets a
 * lab say "your answer and the joint equations agree" instead of just printing a number — and it
 * is the same check you run by hand when you close a joint.
 */

import { v, sub, unit, mag } from './vectors.js';

/**
 * @param joints  { A: {x, y}, B: {...}, … }
 * @param members [['A','B'], …]
 * @param loads   { B: {x, y}, … }              external loads at joints
 * @param supports { A: 'pin' | 'rollerY' | 'rollerX' }
 *                 pin     — two unknown reaction components
 *                 rollerY — vertical reaction only (surface horizontal)
 *                 rollerX — horizontal reaction only (surface vertical)
 */
export function solveTruss({ joints, members, loads = {}, supports = {} }) {
  const names = Object.keys(joints);
  const idx = new Map(names.map((n, i) => [n, i]));

  // Unknown ordering: every member force, then each support's reaction components.
  const reactionSlots = [];
  for (const [j, kind] of Object.entries(supports)) {
    if (kind === 'pin') reactionSlots.push([j, 'x'], [j, 'y']);
    else if (kind === 'rollerY') reactionSlots.push([j, 'y']);
    else if (kind === 'rollerX') reactionSlots.push([j, 'x']);
  }
  const nUnknown = members.length + reactionSlots.length;
  const nEq = 2 * names.length;

  const A = Array.from({ length: nEq }, () => new Array(nUnknown).fill(0));
  const b = new Array(nEq).fill(0);

  // Each member pulls on its two end joints along the member, positive = tension.
  members.forEach(([p, q], m) => {
    const u = unit(sub(joints[q], joints[p]));
    const ip = idx.get(p);
    const iq = idx.get(q);
    A[2 * ip][m] = u.x;
    A[2 * ip + 1][m] = u.y;
    A[2 * iq][m] = -u.x;
    A[2 * iq + 1][m] = -u.y;
  });

  reactionSlots.forEach(([j, comp], k) => {
    const i = idx.get(j);
    A[2 * i + (comp === 'x' ? 0 : 1)][members.length + k] = 1;
  });

  for (const [j, L] of Object.entries(loads)) {
    const i = idx.get(j);
    b[2 * i] -= L.x || 0;
    b[2 * i + 1] -= L.y || 0;
  }

  const sol = lstsq(A, b);
  const forces = {};
  members.forEach(([p, q], m) => {
    forces[`${p}${q}`] = sol[m];
  });
  const reactions = {};
  reactionSlots.forEach(([j, comp], k) => {
    reactions[j] = reactions[j] || { x: 0, y: 0 };
    reactions[j][comp] = sol[members.length + k];
  });

  // Residual of every joint equation: this is the independent check.
  const residual = {};
  let worst = 0;
  names.forEach((n, i) => {
    const rx = A[2 * i].reduce((s, a, k) => s + a * sol[k], 0) - b[2 * i];
    const ry = A[2 * i + 1].reduce((s, a, k) => s + a * sol[k], 0) - b[2 * i + 1];
    residual[n] = { x: rx, y: ry };
    worst = Math.max(worst, Math.abs(rx), Math.abs(ry));
  });

  return {
    forces,
    reactions,
    residual,
    worstResidual: worst,
    determinate: members.length + reactionSlots.length === 2 * names.length,
    counts: { m: members.length, r: reactionSlots.length, j: names.length },
    state: (name) => stateOf(forces[name] ?? forces[flip(name)]),
  };
}

const flip = (name) => name[1] + name[0];
export const stateOf = (F) => (F === undefined || Number.isNaN(F) ? 'unknown' : Math.abs(F) < 1e-7 ? 'zero' : F > 0 ? 'tension' : 'compression');

/** Look up a member force by either ordering of its end labels. */
export function memberForce(sol, a, b) {
  return sol.forces[`${a}${b}`] ?? sol.forces[`${b}${a}`];
}

/**
 * Zero-force members, found by the two rules the chapter gives:
 *  1. Two non-collinear members at an unloaded, unsupported joint — both are zero.
 *  2. Three members at such a joint with two of them collinear — the odd one out is zero.
 */
export function zeroForceMembers({ joints, members, loads = {}, supports = {} }) {
  const at = {};
  members.forEach(([p, q], i) => {
    (at[p] = at[p] || []).push({ i, other: q });
    (at[q] = at[q] || []).push({ i, other: p });
  });
  const zero = new Set();
  for (const [j, list] of Object.entries(at)) {
    const loaded = loads[j] && (loads[j].x || loads[j].y);
    if (loaded || supports[j]) continue;
    const dirs = list.map((e) => unit(sub(joints[e.other], joints[j])));
    if (list.length === 2) {
      if (Math.abs(dirs[0].x * dirs[1].y - dirs[0].y * dirs[1].x) > 1e-9) {
        zero.add(list[0].i);
        zero.add(list[1].i);
      }
    } else if (list.length === 3) {
      for (let k = 0; k < 3; k++) {
        const [a, b] = [0, 1, 2].filter((t) => t !== k);
        const collinear = Math.abs(dirs[a].x * dirs[b].y - dirs[a].y * dirs[b].x) < 1e-9;
        if (collinear) zero.add(list[k].i);
      }
    }
  }
  return [...zero].map((i) => members[i]);
}

/**
 * Method of sections: cut the truss, keep the joints in `keep`, and sum moments about `about` to
 * get one member force directly. Returns the same number the joint solution gives, by a different
 * route — which is exactly the cross-check the chapter is teaching.
 */
export function sectionCheck({ joints, members, loads = {}, supports = {} }, keep, cutMembers, about) {
  const sol = solveTruss({ joints, members, loads, supports });
  const keepSet = new Set(keep);
  let M = 0;
  // External loads on the kept side.
  for (const [j, L] of Object.entries(loads)) {
    if (!keepSet.has(j)) continue;
    const r = sub(joints[j], about);
    M += r.x * (L.y || 0) - r.y * (L.x || 0);
  }
  // Support reactions on the kept side.
  for (const [j, R] of Object.entries(sol.reactions)) {
    if (!keepSet.has(j)) continue;
    const r = sub(joints[j], about);
    M += r.x * (R.y || 0) - r.y * (R.x || 0);
  }
  // Cut members act on the kept side, pulling toward the removed joint when in tension.
  const contributions = cutMembers.map(([p, q]) => {
    const inside = keepSet.has(p) ? p : q;
    const outside = inside === p ? q : p;
    const u = unit(sub(joints[outside], joints[inside]));
    const r = sub(joints[inside], about);
    const arm = r.x * u.y - r.y * u.x;
    return { member: `${p}${q}`, arm, force: memberForce(sol, p, q) };
  });
  const momentFromCut = contributions.reduce((s, c) => s + c.arm * c.force, 0);
  return { sumM: M + momentFromCut, contributions, solution: sol };
}

/** Least squares via normal equations with Gaussian elimination — handles square and over/under. */
function lstsq(A, b) {
  const n = A[0].length;
  const AtA = Array.from({ length: n }, () => new Array(n).fill(0));
  const Atb = new Array(n).fill(0);
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < n; j++) {
      Atb[j] += A[i][j] * b[i];
      for (let k = 0; k < n; k++) AtA[j][k] += A[i][j] * A[i][k];
    }
  }
  return gauss(AtA, Atb);
}

function gauss(M, r) {
  const n = r.length;
  const a = M.map((row, i) => [...row, r[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let i = c + 1; i < n; i++) if (Math.abs(a[i][c]) > Math.abs(a[p][c])) p = i;
    if (Math.abs(a[p][c]) < 1e-12) continue;
    [a[c], a[p]] = [a[p], a[c]];
    for (let i = 0; i < n; i++) {
      if (i === c) continue;
      const f = a[i][c] / a[c][c];
      for (let k = c; k <= n; k++) a[i][k] -= f * a[c][k];
    }
  }
  return a.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[n] / row[i]));
}

/** Length of a member, for drawing and for the weight problems. */
export const memberLength = (joints, [p, q]) => mag(sub(joints[q], joints[p]));
