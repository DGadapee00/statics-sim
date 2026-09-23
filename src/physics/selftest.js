/**
 * Self-test: every module checked against an independent method, never against itself.
 *
 *   node src/physics/selftest.js
 */
import {
  v, add, sub, scale, dot, cross, mag, unit, unitAB, forceAlong, directionAngles, fromAngles,
  fromAngle2D, angle2D, angleBetween, proj, perp, resultant, parallelogram, lawOfCosines, DEG,
} from './vectors.js';
import {
  springForce, particleEq2D, particleEq3D, momentAbout, moment2D, momentArm, momentAboutAxis,
  coupleMoment, resultantWrench, rigidBody2D, distributedLoad, uniformLoad, triangularLoad, solve3,
} from './statics.js';
import { solveTruss, memberForce, zeroForceMembers, sectionCheck, stateOf, methodOfSections } from './truss.js';
import { inclineState, inclineRange, tipOrSlip, beltTension } from './friction.js';
import { solveFrame, solveLinear } from './frames.js';
import {
  internalAt, shearMomentDiagram, composite, centroidUnderCurve, centroidOfLine, rect, tri, semi,
  quarter, pappusArea, pappusVolume, parallelAxis, rectI, triI, circI, compositeI, IxUnderCurve,
  IyUnderCurve, radiusOfGyration,
} from './sections.js';

let passed = 0;
let failed = 0;

function approx(a, b, tol, name) {
  const scaleB = b !== 0 ? Math.abs(b) : 1;
  const good = Number.isFinite(a) && Math.abs(a - b) <= tol * scaleB;
  if (good) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        got ${a}  expected ${b}`);
  }
}
const ok = (c, name) => (c ? (passed += 1, console.log(`  PASS  ${name}`)) : (failed += 1, console.log(`  FAIL  ${name}`)));
const vecApprox = (a, b, tol, name) => approx(mag(sub(a, b)), 0, tol * Math.max(1, mag(b)) || tol, name);

console.log('Vectors (Ch 2)');
{
  const F = v(3, -4, 12);
  approx(mag(F), 13, 1e-12, '|F| for the 3-4-12 triple is 13');
  const d = directionAngles(F);
  approx(Math.cos(d.alpha * DEG) ** 2 + Math.cos(d.beta * DEG) ** 2 + Math.cos(d.gamma * DEG) ** 2, 1, 1e-12,
    'cos²α + cos²β + cos²γ = 1');
  vecApprox(fromAngles(13, d.alpha, d.beta, 1), F, 1e-9, 'rebuilding F from its direction angles returns F');

  // F = F·u against a hand-computed unit vector.
  const A = v(0, 0, 0);
  const B = v(2, 3, 6);
  vecApprox(unitAB(A, B), v(2 / 7, 3 / 7, 6 / 7), 1e-12, 'u_AB for the 2-3-6 triple');
  vecApprox(forceAlong(140, A, B), v(40, 60, 120), 1e-12, 'F = 140 u_AB splits as 40, 60, 120');

  // Cross product against the determinant expanded by hand.
  const a = v(1, 2, 3);
  const b = v(4, 5, 6);
  vecApprox(cross(a, b), v(-3, 6, -3), 1e-12, 'a × b by hand');
  approx(dot(cross(a, b), a), 0, 1e-12, 'a × b is perpendicular to a');
  approx(dot(cross(a, b), b), 0, 1e-12, 'a × b is perpendicular to b');
  approx(mag(cross(a, b)), mag(a) * mag(b) * Math.sin(angleBetween(a, b) * DEG), 1e-9, '|a × b| = |a||b|sinθ');
  approx(dot(a, b), mag(a) * mag(b) * Math.cos(angleBetween(a, b) * DEG), 1e-9, 'a · b = |a||b|cosθ');

  // Projection and perpendicular parts must reassemble.
  vecApprox(add(proj(a, b), perp(a, b)), a, 1e-12, 'a = proj + perp');
  approx(dot(perp(a, b), b), 0, 1e-12, 'the perpendicular part really is perpendicular');

  // Parallelogram law against adding components.
  const F1 = 3000;
  const F2 = 2000;
  const between = 60;
  const p = parallelogram(F1, F2, between);
  const byComponents = mag(add(fromAngle2D(F1, 0), fromAngle2D(F2, between)));
  approx(p.R, byComponents, 1e-9, 'parallelogram law agrees with adding components');
  approx(p.R, lawOfCosines(F1, F2, 180 - between), 1e-9, 'and with the law of cosines');
  approx(angle2D(add(fromAngle2D(F1, 0), fromAngle2D(F2, between))), p.phi, 1e-9, 'and the resultant angle matches');
}

console.log('\nParticle equilibrium (Ch 3)');
{
  approx(springForce(500, 0.04), 20, 1e-12, 'F = ks');

  // A 100 lb weight on two cables at 30° and 45° from horizontal — solve, then confirm ΣF = 0.
  const W = v(0, -100, 0);
  const dirs = [fromAngle2D(1, 150), fromAngle2D(1, 45)];
  const sol = particleEq2D([W], dirs);
  approx(mag(sol.residual), 0, 1e-9, 'two-cable equilibrium closes ΣF = 0');
  // Independent check by the law of sines on the force triangle.
  const T1 = (100 * Math.sin(45 * DEG)) / Math.sin(105 * DEG);
  approx(sol.magnitudes[0], T1, 1e-9, 'and the tension matches the law of sines');
  ok(sol.magnitudes[0] > 0 && sol.magnitudes[1] > 0, 'both cables come out in tension');

  // 3D: three cables holding a weight.
  const P = v(0, 0, -900);
  const d3 = [sub(v(-2, 1, 4), v(0, 0, 0)), sub(v(2, 2, 4), v(0, 0, 0)), sub(v(0, -3, 4), v(0, 0, 0))];
  const s3 = particleEq3D([P], d3);
  approx(mag(s3.residual), 0, 1e-9, 'three-cable 3D equilibrium closes ΣF = 0');
  const rebuilt = resultant(P, ...d3.map((d, i) => scale(unit(d), s3.magnitudes[i])));
  approx(mag(rebuilt), 0, 1e-9, 'rebuilding the sum from the solved tensions gives zero');
}

console.log('\nMoments (Ch 4)');
{
  // M = r × F against M = F·d with the perpendicular distance worked out geometrically.
  const O = v(0, 0, 0);
  const at = v(4, 3, 0);
  const F = fromAngle2D(50, 30);
  const M = momentAbout(O, at, F);
  approx(M.z, moment2D(O, at, F), 1e-12, 'the 2D scalar moment is the z component of r × F');
  approx(Math.abs(M.z), mag(F) * momentArm(O, at, F), 1e-9, '|M| = F·d');

  // A couple gives the same moment about any point.
  const F2 = v(0, 60, 0);
  const c1 = add(momentAbout(O, v(0, 0, 0), scale(F2, -1)), momentAbout(O, v(3, 0, 0), F2));
  const c2 = add(momentAbout(v(9, -4, 2), v(0, 0, 0), scale(F2, -1)), momentAbout(v(9, -4, 2), v(3, 0, 0), F2));
  vecApprox(c1, c2, 1e-9, 'a couple gives the same moment about every point');
  vecApprox(c1, coupleMoment(v(3, 0, 0), F2), 1e-9, 'and matches r × F for the pair');

  // Moment about an axis: u · (r × F), and it must vanish for a force whose line meets the axis.
  const A = v(0, 0, 0);
  const u = v(0, 0, 1);
  approx(momentAboutAxis(A, u, v(2, 0, 0), v(0, 5, 0)), 10, 1e-12, 'moment about the z axis');
  approx(momentAboutAxis(A, u, v(2, 0, 0), v(7, 0, 3)), 0, 1e-12, 'a force meeting the axis has no moment about it');
  approx(momentAboutAxis(A, u, v(2, 0, 0), v(0, 5, 0)), dot(unit(u), cross(sub(v(2, 0, 0), A), v(0, 5, 0))), 1e-12,
    'momentAboutAxis is exactly u · (r × F)');

  // Resultant of two forces about a point, against summing the moments separately.
  const loads = [{ at: v(1, 2, 0), F: v(0, -30, 0) }, { at: v(4, 0, 0), F: v(0, -20, 0) }];
  const w = resultantWrench(O, loads);
  approx(w.M.z, -30 * 1 + -20 * 4, 1e-12, 'resultant moment adds the individual moments');
  approx(w.F.y, -50, 1e-12, 'resultant force adds the individual forces');
}

console.log('\nRigid bodies (Ch 5)');
{
  // Simply supported beam, 600 lb at 4 ft from A, span 10 ft: R_A = 360, R_B = 240 by hand.
  const sol = rigidBody2D({
    loads: [{ at: v(4, 0, 0), F: v(0, -600, 0) }],
    unknowns: [{ at: v(0, 0, 0), dir: v(0, 1, 0) }, { at: v(10, 0, 0), dir: v(0, 1, 0) }, { at: v(0, 0, 0), dir: v(1, 0, 0) }],
    about: v(0, 0, 0),
  });
  approx(sol.reactions[0], 360, 1e-9, 'simply supported beam: R_A = 360 lb');
  approx(sol.reactions[1], 240, 1e-9, 'R_B = 240 lb');
  approx(Math.abs(sol.residual.Fy) + Math.abs(sol.residual.M), 0, 1e-9, 'ΣFy and ΣM both close');

  // Cantilever with a uniform load: the fixed end carries wL and wL²/2.
  const w0 = 50;
  const L = 6;
  const eq = uniformLoad(w0, 0, L);
  approx(eq.F, 300, 1e-12, 'uniform load resultant is wL');
  approx(eq.x, 3, 1e-12, 'acting at midspan');
  const num = distributedLoad(() => w0, 0, L);
  approx(num.F, eq.F, 1e-6, 'numeric integration matches the closed form (force)');
  approx(num.x, eq.x, 1e-6, 'and the location');
  const tl = triangularLoad(90, 0, 3);
  const tn = distributedLoad((x) => 90 * (x / 3), 0, 3);
  approx(tn.F, tl.F, 1e-4, 'triangular load: numeric matches wL/2');
  approx(tn.x, tl.x, 1e-4, 'acting at two thirds of the span');

  const cant = rigidBody2D({
    loads: [{ at: v(3, 0, 0), F: v(0, -300, 0) }],
    unknowns: [{ at: v(0, 0, 0), dir: v(0, 1, 0) }, { at: v(0, 0, 0), dir: v(1, 0, 0) }, { couple: true }],
    about: v(0, 0, 0),
  });
  approx(cant.reactions[0], 300, 1e-9, 'cantilever vertical reaction is wL');
  approx(cant.reactions[2], 900, 1e-9, 'and the fixing moment is wL²/2');
}

console.log('\nTrusses (Ch 6)');
{
  // Classic three-member truss: joints A(0,0) pin, B(4,0) roller, C(2,3); 1000 lb down at C.
  const T = {
    joints: { A: v(0, 0, 0), B: v(4, 0, 0), C: v(2, 3, 0) },
    members: [['A', 'B'], ['A', 'C'], ['B', 'C']],
    loads: { C: { x: 0, y: -1000 } },
    supports: { A: 'pin', B: 'rollerY' },
  };
  const sol = solveTruss(T);
  approx(sol.worstResidual, 0, 1e-8, 'every joint equation closes');
  ok(sol.determinate, 'the truss is statically determinate (m + r = 2j)');
  approx(sol.reactions.A.y + sol.reactions.B.y, 1000, 1e-9, 'reactions carry the whole load');
  // By symmetry the two sloping members share the load equally and are in compression.
  approx(memberForce(sol, 'A', 'C'), memberForce(sol, 'B', 'C'), 1e-9, 'symmetry: AC and BC are equal');
  ok(stateOf(memberForce(sol, 'A', 'C')) === 'compression', 'the sloping members are in compression');
  ok(stateOf(memberForce(sol, 'A', 'B')) === 'tension', 'the bottom chord is in tension');
  // Independent hand check at joint C: 2·F·(3/√13) = 1000.
  approx(Math.abs(memberForce(sol, 'A', 'C')), 1000 / (2 * (3 / Math.sqrt(13))), 1e-9,
    'joint C by hand gives the same member force');

  // Method of sections must reproduce the method of joints.
  const sec = sectionCheck(T, ['A'], [['A', 'B'], ['A', 'C']], v(2, 3, 0));
  approx(sec.sumM, 0, 1e-8, 'a section through the truss is itself in equilibrium');

  // Zero-force members: a two-member unloaded joint.
  const Z = {
    joints: { A: v(0, 0, 0), B: v(4, 0, 0), C: v(2, 3, 0), D: v(6, 3, 0) },
    members: [['A', 'B'], ['A', 'C'], ['B', 'C'], ['B', 'D'], ['C', 'D']],
    loads: { C: { x: 0, y: -1000 } },
    supports: { A: 'pin', B: 'rollerY' },
  };
  const zf = zeroForceMembers(Z);
  ok(zf.length === 2 && zf.every(([p, q]) => p === 'D' || q === 'D'), 'both members at the unloaded joint D are zero-force');
  const zsol = solveTruss(Z);
  approx(memberForce(zsol, 'B', 'D'), 0, 1e-8, 'and the solver agrees that BD carries nothing');
  approx(memberForce(zsol, 'C', 'D'), 0, 1e-8, 'and CD carries nothing');
}

console.log('\nInternal loads (Ch 7)');
{
  // Simply supported beam, central point load P at midspan: V = ±P/2, M_max = PL/4.
  const P = 800;
  const L = 10;
  const setup = {
    reactions: [{ x: 0, Fy: P / 2 }, { x: L, Fy: P / 2 }],
    loads: [{ x: L / 2, Fy: -P }],
  };
  approx(internalAt(L / 4, setup).V, P / 2, 1e-9, 'shear left of the load is +P/2');
  approx(internalAt((3 * L) / 4, setup).V, -P / 2, 1e-9, 'shear right of the load is −P/2');
  approx(internalAt(L / 2, setup).M, (P * L) / 4, 1e-9, 'M at midspan is PL/4');
  approx(internalAt(L, setup).M, 0, 1e-9, 'and zero at the far support');

  // dM/dx = V, checked numerically on the diagram.
  const d = shearMomentDiagram(L, setup, 2000);
  const i = 400;
  const dM = (d[i + 1].M - d[i - 1].M) / (d[i + 1].x - d[i - 1].x);
  approx(dM, d[i].V, 1e-3, 'dM/dx = V on the diagram');

  // Uniform load: M_max = wL²/8 at midspan.
  const w0 = 120;
  const uni = {
    reactions: [{ x: 0, Fy: (w0 * L) / 2 }, { x: L, Fy: (w0 * L) / 2 }],
    dist: [{ w: () => -w0, a: 0, b: L }], // w is signed, positive up — this one presses down
  };
  approx(internalAt(L / 2, uni).M, (w0 * L * L) / 8, 1e-4, 'uniformly loaded beam: M_max = wL²/8');
  approx(internalAt(L / 2, uni).V, 0, 1e-6, 'and the shear is zero there');
}

console.log('\nCentroids and Pappus (Ch 9)');
{
  // A composite that is also a simple shape: two stacked rectangles making one 2×4.
  const c = composite([rect(2, 2, 0, 0), rect(2, 2, 0, 2)]);
  approx(c.A, 8, 1e-12, 'composite area adds');
  approx(c.y, 2, 1e-12, 'and the centroid lands at the middle of the tall rectangle');

  // A square with a hole, by composite and by integration of the same region.
  const withHole = composite([rect(4, 4, 0, 0), { ...semi(1, 2, 0), A: -semi(1, 2, 0).A }]);
  ok(withHole.A < 16 && withHole.A > 14, 'a negative area removes material');

  // Triangle centroid at h/3, checked against integrating under the line.
  const t = tri(3, 6);
  const ci = centroidUnderCurve((x) => 6 - 2 * x, 0, 3);
  approx(t.A, ci.A, 1e-6, 'triangle area matches the integral');
  approx(t.x, ci.x, 1e-5, 'triangle centroid x = b/3');
  approx(t.y, ci.y, 1e-5, 'triangle centroid y = h/3');

  // Semicircle centroid 4r/3π, against integration.
  const r = 2;
  const sc = centroidUnderCurve((x) => Math.sqrt(Math.max(0, r * r - x * x)), -r, r, 200000);
  approx(sc.y, (4 * r) / (3 * Math.PI), 2e-4, 'semicircle centroid is 4r/3π');

  // Pappus against the known sphere and torus.
  approx(pappusVolume((4 * r) / (3 * Math.PI), (Math.PI * r * r) / 2), (4 / 3) * Math.PI * r ** 3, 1e-9,
    'revolving a semicircular area gives the sphere volume');
  approx(pappusArea((2 * r) / Math.PI, Math.PI * r), 4 * Math.PI * r * r, 1e-9,
    'revolving a semicircular arc gives the sphere surface area');
  const R = 5;
  const a = 1;
  approx(pappusVolume(R, Math.PI * a * a), 2 * Math.PI * Math.PI * R * a * a, 1e-9, 'torus volume');
  approx(pappusArea(R, 2 * Math.PI * a), 4 * Math.PI * Math.PI * R * a, 1e-9, 'torus surface area');

  // Centroid of a straight line, where the answer is obvious.
  const line = centroidOfLine((x) => x, () => 1, 0, 4);
  approx(line.L, 4 * Math.SQRT2, 1e-6, 'length of y = x from 0 to 4');
  approx(line.x, 2, 1e-6, 'and its centroid is at the midpoint');
}

console.log('\nMoments of inertia (Ch 10)');
{
  const w = 3;
  const h = 6;
  const R = rectI(w, h);
  approx(R.Ix, (w * h ** 3) / 12, 1e-12, 'rectangle I_x = bh³/12');
  // Integrate both halves of the rectangle (the helper measures from y = 0 up to f(x)).
  approx(IxUnderCurve(() => h / 2, -w / 2, w / 2) * 2, R.Ix, 1e-9, 'and integrating both halves gives the same I_x');

  // Base axis via the parallel-axis theorem, against the direct bh³/3.
  approx(parallelAxis(R.Ix, w * h, h / 2), (w * h ** 3) / 3, 1e-12, 'parallel axis gives bh³/3 about the base');

  // A composite split in two must equal the whole.
  const whole = compositeI([{ A: w * h, x: 0, y: 0, ...rectI(w, h) }]);
  const halves = compositeI([
    { A: w * (h / 2), x: 0, y: h / 4, ...rectI(w, h / 2) },
    { A: w * (h / 2), x: 0, y: -h / 4, ...rectI(w, h / 2) },
  ]);
  approx(halves.Ix, whole.Ix, 1e-9, 'splitting a rectangle in two does not change I_x');
  approx(halves.Iy, whole.Iy, 1e-9, 'nor I_y');

  approx(triI(4, 9).Ix, (4 * 9 ** 3) / 36, 1e-12, 'triangle I_x = bh³/36');
  approx(circI(3).Ix, (Math.PI * 3 ** 4) / 4, 1e-12, 'circle I = πr⁴/4');
  approx(radiusOfGyration(R.Ix, w * h), h / Math.sqrt(12), 1e-9, 'k_x = h/√12 for a rectangle');

  // Integration check on I_y of a rectangle sitting on the y axis.
  approx(IyUnderCurve(() => h, 0, w), (h * w ** 3) / 3, 1e-6, 'I_y about the edge is hb³/3 by integration');
}

console.log('\nCouples and fixed supports in internal loads (Ch 7)');
{
  // Cantilever fixed at x = 0, P down at the tip. The reactions come from rigidBody2D; the internal
  // moment is then checked against the right-hand segment, which needs no reactions at all.
  const L = 8;
  const P = 250;
  const r = rigidBody2D({
    loads: [{ at: v(L, 0, 0), F: v(0, -P, 0) }],
    unknowns: [{ at: v(0, 0, 0), dir: v(0, 1, 0) }, { at: v(0, 0, 0), dir: v(1, 0, 0) }, { couple: true }],
  });
  const setup = { reactions: [{ x: 0, Fy: r.reactions[0], M: r.reactions[2] }], loads: [{ x: L, Fy: -P }] };
  approx(r.reactions[2], P * L, 1e-9, 'fixed support: the wall couple is +PL (counterclockwise)');
  for (const x of [0.5, 3, 7.5]) approx(internalAt(x, setup).M, -P * (L - x), 1e-9, `cantilever M(${x}) = −P(L − x), from the right segment`);
  approx(internalAt(3, setup).V, P, 1e-9, 'and V = +P all along');

  // A counterclockwise couple on a simple beam: M jumps DOWN by M0, and closes to zero at B.
  const M0 = 600;
  const c = L / 3;
  const s2 = rigidBody2D({
    loads: [{ at: v(c, 0, 0), F: v(0, 0, 0), couple: v(0, 0, M0) }],
    unknowns: [{ at: v(0, 0, 0), dir: v(0, 1, 0) }, { at: v(L, 0, 0), dir: v(0, 1, 0) }, { at: v(0, 0, 0), dir: v(1, 0, 0) }],
  });
  const beam = { reactions: [{ x: 0, Fy: s2.reactions[0] }, { x: L, Fy: s2.reactions[1] }], loads: [{ x: c, M: M0 }] };
  approx(internalAt(c + 1e-9, beam).M - internalAt(c - 1e-9, beam).M, -M0, 1e-6, 'a counterclockwise couple drops M by M0');
  // Right segment: M = Σ Fy(x − cut) + Σ counterclockwise couples, for everything right of the cut.
  const xl = c - 1;
  approx(internalAt(xl, beam).M, s2.reactions[1] * (L - xl) + M0, 1e-9, 'left of the couple, M agrees with the right segment');
  approx(internalAt(L, beam).M, 0, 1e-9, 'and M closes to zero at the far support');
}

console.log('\nFrames and machines (Ch 6)');
{
  approx(solveLinear([[2, 1], [1, 3]], [3, 5])[1], 1.4, 1e-12, 'the linear solver on a 2×2 by hand');

  // A-frame: legs AB and BC pinned at the apex B, pins to the ground at A and C, P on AB's midpoint.
  const P = 600;
  const aframe = solveFrame({
    points: { A: [0, 0], B: [2, 3], C: [4, 0], D: [1, 1.5] },
    bodies: { AB: ['A', 'D', 'B'], BC: ['B', 'C'] },
    pins: [{ at: 'B', bodies: ['AB', 'BC'] }],
    supports: [{ at: 'A', body: 'AB', kind: 'pin' }, { at: 'C', body: 'BC', kind: 'pin' }],
    loads: [{ body: 'AB', at: 'D', F: [0, -P] }],
  });
  // Independent: ΣM_A on the whole frame gives Cy; BC carries no load so it is a two-force member,
  // which fixes Cx from the direction of BC.
  const Cy = (P * 1) / 4;
  const Cx = -Cy * (2 / 3);
  approx(aframe.values.Cy, Cy, 1e-9, 'A-frame: Cy from ΣM_A on the whole frame');
  approx(aframe.values.Cx, Cx, 1e-9, 'Cx from BC being a two-force member');
  approx(aframe.values.Ax, -Cx, 1e-9, 'Ax from ΣFx on the whole frame');
  approx(aframe.values.Ay, P - Cy, 1e-9, 'Ay from ΣFy');
  approx(aframe.values.Bx, Cx, 1e-9, "pin B on AB equals C's reaction, by BC's equilibrium");
  approx(aframe.worstResidual, 0, 1e-9, 'every member closes');
  ok(aframe.counts.equations === aframe.counts.unknowns, 'six equations, six unknowns');

  // Wall bracket: boom AB on a pin at A, strut CB from a pin at C below. W at 3 ft along a 4 ft boom.
  const W = 400;
  const bracket = solveFrame({
    points: { A: [0, 0], B: [4, 0], C: [0, -3], D: [3, 0] },
    bodies: { AB: ['A', 'D', 'B'], CB: ['C', 'B'] },
    pins: [{ at: 'B', bodies: ['AB', 'CB'] }],
    supports: [{ at: 'A', body: 'AB', kind: 'pin' }, { at: 'C', body: 'CB', kind: 'pin' }],
    loads: [{ body: 'AB', at: 'D', F: [0, -W] }],
  });
  // ΣM_A on the boom with the strut force along CB (3-4-5): 4·(3/5)F = 3W.
  approx(Math.hypot(bracket.values.Cx, bracket.values.Cy), (3 * W) / (4 * 0.6), 1e-9, 'bracket: strut force from ΣM_A on the boom');

  // Pliers: a machine, no supports. Handle force P at b = 3 from the pin, jaws at a = 1: grip = Pb/a.
  const Ph = 50;
  const pliers = solveFrame({
    points: { J1: [-1, 0.2], J2: [-1, -0.2], C: [0, 0], H1: [3, -0.5], H2: [3, 0.5] },
    bodies: { upper: ['J1', 'C', 'H1'], lower: ['J2', 'C', 'H2'], bolt: ['J1', 'J2'] },
    pins: [{ at: 'C', bodies: ['upper', 'lower'] }],
    contacts: [{ at: 'J1', bodies: ['upper', 'bolt'], dir: [0, 1] }, { at: 'J2', bodies: ['lower', 'bolt'], dir: [0, -1] }],
    loads: [{ body: 'upper', at: 'H1', F: [0, Ph] }, { body: 'lower', at: 'H2', F: [0, -Ph] }],
  });
  approx(pliers.values.J1n, (Ph * 3) / 1, 1e-9, 'pliers: grip = P·b/a (lever rule about the pin)');
  approx(pliers.values.J2n, pliers.values.J1n, 1e-9, 'both jaws grip equally — the bolt is in equilibrium');
  approx(pliers.worstResidual, 0, 1e-9, 'a machine with no supports still closes (redundant equations)');
}

console.log('\nMethod of sections (Ch 6)');
{
  // Pratt truss, unequal panel loads. The section solver never calls the joint solver, so the two
  // agreeing is a real check; the hand result for BC (ΣM about E) is a third.
  const P1 = 900;
  const P2 = 300;
  const pratt = {
    joints: { A: v(0, 0), B: v(3, 0), C: v(6, 0), D: v(9, 0), E: v(3, 3), F: v(6, 3) },
    members: [['A', 'B'], ['B', 'C'], ['C', 'D'], ['A', 'E'], ['E', 'F'], ['F', 'D'], ['E', 'B'], ['F', 'C'], ['E', 'C']],
    loads: { B: { x: 0, y: -P1 }, C: { x: 0, y: -P2 } },
    supports: { A: 'pin', D: 'rollerY' },
  };
  const joints = solveTruss(pratt);
  const cut = methodOfSections(pratt, ['A', 'B', 'E']);
  const f = Object.fromEntries(cut.cut.map((c) => [c.member, c.force]));
  approx(f.BC, memberForce(joints, 'B', 'C'), 1e-9, 'section BC agrees with the method of joints');
  approx(f.EF, memberForce(joints, 'E', 'F'), 1e-9, 'section EF agrees');
  approx(f.EC, memberForce(joints, 'E', 'C'), 1e-9, 'section EC agrees');
  const Ay = (2 * P1 + P2) / 3;
  approx(f.BC, Ay, 1e-9, 'BC by hand: ΣM about E gives BC = A_y');
  const bcPoint = cut.cut.find((c) => c.member === 'BC').point;
  approx(bcPoint.x, 3, 1e-9, "BC's moment point is E, where EF and EC meet");
  ok(cut.cut.find((c) => c.member === 'EC').point === null, "EC's moment point is at infinity (BC ∥ EF): use ΣFy");
}

console.log('\nFriction (Ch 8)');
{
  const W = 100;
  const mus = 0.4;
  // With no push, the block is on the verge of slipping exactly at the angle of repose.
  const repose = Math.atan(mus) / DEG;
  ok(inclineState({ W, theta: repose, mus, muk: 0.3 }).regime === 'impending', 'at θ = atan μs the block is impending');
  ok(inclineState({ W, theta: repose - 2, mus, muk: 0.3 }).regime === 'static', 'just below it, it holds');
  ok(inclineState({ W, theta: repose + 2, mus, muk: 0.3 }).regime === 'slides down', 'just above it, it slides');

  // The closed-form band of P against the general equilibrium state at its two ends.
  const r = inclineRange({ W, theta: 35, mus, phi: 15 });
  const top = inclineState({ W, theta: 35, mus, muk: 0.3, P: r.Ppush, phi: 15 });
  approx(-top.need, top.Fmax, 1e-9, 'P_push: friction needed down the slope equals μsN');
  const bottom = inclineState({ W, theta: 35, mus, muk: 0.3, P: r.Phold, phi: 15 });
  approx(bottom.need, bottom.Fmax, 1e-9, 'P_hold: friction needed up the slope equals μsN');

  // Tip or slip: at the tipping load the normal force has moved exactly to the corner.
  const t = tipOrSlip({ W: 200, b: 1, hp: 2, mus: 0.5 });
  approx(tipOrSlip({ W: 200, b: 1, hp: 2, mus: 0.5, P: t.Ptip }).x, 0.5, 1e-12, 'tipping: N reaches the corner at P·h = W·b/2');
  ok(t.first === 'tip', 'a tall box pushed high tips before it slides');

  // Belt friction against integrating dT/dθ = μT numerically.
  let T = 50;
  const n = 200000;
  const beta = 200 * DEG;
  for (let i = 0; i < n; i++) T += 0.3 * T * (beta / n);
  approx(beltTension(50, 0.3, 200), T, 1e-4, 'T2 = T1·e^(μβ) matches integrating dT = μT dθ');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
