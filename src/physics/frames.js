/**
 * Frames and machines · Hibbeler Ch 6.4–6.6.
 *
 * A frame is several rigid members pinned together. Unlike a truss, a member can carry loads along
 * its length and a pin can join it anywhere, so every member gets the full three equations
 * (ΣFx, ΣFy, ΣM) and every pin between two members carries an unknown force whose components act
 * equal and opposite on the two of them — Newton's third law is what couples the equations.
 *
 * The model:
 *   points   { name: [x, y] }
 *   bodies   { name: [pointName, …] }   — the points a member passes through, in drawing order
 *   pins     [{ at, bodies: [i, j] }]   — force (Px, Py) on body i, (−Px, −Py) on body j
 *   contacts [{ at, bodies: [i, j], dir: [nx, ny] }] — smooth contact: one unknown along dir
 *   supports [{ at, body, kind }]       — 'pin' (Rx, Ry), 'rollerY' (Ry), 'rollerX' (Rx),
 *                                         'fixed' (Rx, Ry, M)
 *   loads    [{ body, at, F: [Fx, Fy], M? }] — `at` a point name or [x, y]; M counterclockwise
 *
 * A machine has no supports: its applied loads balance on their own, so the whole assembly's three
 * equations repeat the others. The system is solved by least squares, which handles that
 * redundancy exactly (the residual is still zero when the loads really are in balance).
 */

const pt = (model, at) => (Array.isArray(at) ? at : model.points[at]);

/** Gaussian elimination with partial pivoting. Returns null when the matrix is singular. */
export function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-10) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      if (f === 0) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/**
 * Build the unknown list. Each entry says which body it acts on, where, and with what unit action:
 * a force direction (fx, fy), or a couple (m = 1). A pin's unknown acts on two bodies with opposite
 * signs.
 */
function unknownsOf(model) {
  const list = [];
  for (const p of model.pins || []) {
    const [i, j] = p.bodies;
    const at = pt(model, p.at);
    list.push({ key: `${p.at}x`, group: p.at, kind: 'pin', comp: 'x', at, acts: [[i, 1, 0, 0], [j, -1, 0, 0]], label: `${p.at}_x` });
    list.push({ key: `${p.at}y`, group: p.at, kind: 'pin', comp: 'y', at, acts: [[i, 0, 1, 0], [j, 0, -1, 0]], label: `${p.at}_y` });
  }
  for (const c of model.contacts || []) {
    const [i, j] = c.bodies;
    const at = pt(model, c.at);
    const L = Math.hypot(c.dir[0], c.dir[1]);
    const n = [c.dir[0] / L, c.dir[1] / L];
    list.push({ key: `${c.at}n`, group: c.at, kind: 'contact', comp: 'n', at, n, acts: [[i, n[0], n[1], 0], [j, -n[0], -n[1], 0]], label: `N_${c.at}` });
  }
  for (const s of model.supports || []) {
    const at = pt(model, s.at);
    const b = s.body;
    if (s.kind === 'pin' || s.kind === 'fixed' || s.kind === 'rollerX') list.push({ key: `${s.at}x`, group: s.at, kind: 'support', comp: 'x', at, acts: [[b, 1, 0, 0]], label: `${s.at}_x` });
    if (s.kind === 'pin' || s.kind === 'fixed' || s.kind === 'rollerY') list.push({ key: `${s.at}y`, group: s.at, kind: 'support', comp: 'y', at, acts: [[b, 0, 1, 0]], label: `${s.at}_y` });
    if (s.kind === 'fixed') list.push({ key: `${s.at}M`, group: s.at, kind: 'support', comp: 'M', at, acts: [[b, 0, 0, 1]], label: `M_${s.at}` });
  }
  return list;
}

/**
 * Solve the frame. Returns every unknown by key (e.g. { Bx, By, Ax, … } — a pin's value is the
 * force on the FIRST body it lists), the forces each body feels (for drawing exploded FBDs), the
 * equation and unknown counts, and each body's residual ΣFx, ΣFy, ΣM re-evaluated with the answer.
 */
export function solveFrame(model) {
  const bodies = Object.keys(model.bodies);
  const idx = Object.fromEntries(bodies.map((b, i) => [b, i]));
  const unknowns = unknownsOf(model);
  // Take each body's moments about its own first point, which keeps the columns well scaled.
  const ref = bodies.map((b) => pt(model, model.bodies[b][0]));
  const nEq = 3 * bodies.length;
  const A = Array.from({ length: nEq }, () => new Array(unknowns.length).fill(0));
  const rhs = new Array(nEq).fill(0);

  unknowns.forEach((u, k) => {
    for (const [b, fx, fy, m] of u.acts) {
      const i = idx[b];
      const [ox, oy] = ref[i];
      A[3 * i][k] += fx;
      A[3 * i + 1][k] += fy;
      A[3 * i + 2][k] += (u.at[0] - ox) * fy - (u.at[1] - oy) * fx + m;
    }
  });
  const known = bodies.map(() => [0, 0, 0]);
  for (const L of model.loads || []) {
    const i = idx[L.body];
    const at = pt(model, L.at);
    const [ox, oy] = ref[i];
    const [Fx, Fy] = L.F || [0, 0];
    known[i][0] += Fx;
    known[i][1] += Fy;
    known[i][2] += (at[0] - ox) * Fy - (at[1] - oy) * Fx + (L.M || 0);
  }
  known.forEach((k, i) => {
    rhs[3 * i] = -k[0];
    rhs[3 * i + 1] = -k[1];
    rhs[3 * i + 2] = -k[2];
  });

  // Least squares: (AᵀA)x = Aᵀb. Exact when A is square and invertible, and exact again for a
  // machine whose extra equations are dependent — the residual below is what proves it.
  const n = unknowns.length;
  const AtA = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => A.reduce((s, row) => s + row[r] * row[c], 0)));
  const Atb = Array.from({ length: n }, (_, r) => A.reduce((s, row, e) => s + row[r] * rhs[e], 0));
  const x = n ? solveLinear(AtA, Atb) : [];
  const solved = !!x;
  const values = {};
  unknowns.forEach((u, k) => { values[u.key] = solved ? x[k] : NaN; });

  // Residuals per body, and the forces each body feels, for the exploded view.
  const residual = {};
  const onBody = Object.fromEntries(bodies.map((b) => [b, []]));
  bodies.forEach((b, i) => {
    let [Fx, Fy, M] = known[i];
    unknowns.forEach((u, k) => {
      const val = solved ? x[k] : NaN;
      for (const [bb, fx, fy, m] of u.acts) {
        if (bb !== b) continue;
        Fx += fx * val;
        Fy += fy * val;
        M += ((u.at[0] - ref[i][0]) * fy - (u.at[1] - ref[i][1]) * fx + m) * val;
      }
    });
    residual[b] = { Fx, Fy, M };
  });
  for (const u of unknowns) {
    for (const [b, fx, fy, m] of u.acts) {
      onBody[b].push({ key: u.key, group: u.group, kind: u.kind, at: u.at, F: [fx * values[u.key], fy * values[u.key]], M: m * values[u.key] });
    }
  }
  // Merge the x and y parts of each pin/support into one force per body per point.
  for (const b of bodies) {
    const merged = {};
    for (const f of onBody[b]) {
      const g = merged[f.group] || (merged[f.group] = { group: f.group, kind: f.kind, at: f.at, F: [0, 0], M: 0 });
      g.F[0] += f.F[0];
      g.F[1] += f.F[1];
      g.M += f.M;
    }
    onBody[b] = Object.values(merged);
  }
  const worst = Math.max(0, ...Object.values(residual).map((r) => Math.max(Math.abs(r.Fx), Math.abs(r.Fy), Math.abs(r.M))));
  return {
    values,
    unknowns: unknowns.map((u) => ({ key: u.key, label: u.label, kind: u.kind })),
    counts: { equations: nEq, unknowns: n, bodies: bodies.length },
    onBody,
    residual,
    worstResidual: solved ? worst : NaN,
    solved,
  };
}

/** The resultant of a pin's force on one body, as { mag, angle° }. */
export function pinResultant(sol, pin) {
  const x = sol.values[`${pin}x`];
  const y = sol.values[`${pin}y`];
  return { mag: Math.hypot(x, y), angle: (Math.atan2(y, x) * 180) / Math.PI };
}
