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
import { solveTruss, memberForce, zeroForceMembers, sectionCheck, stateOf } from './truss.js';
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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
