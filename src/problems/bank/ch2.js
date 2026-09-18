/** Ch 2 · Force vectors. Built from the Part 1 problem deck. */
import { problem, kase, range, choice, num, mc, sym, texNum } from '../kit.js';
import {
  v, add, mag, unit, unitAB, forceAlong, directionAngles, resultant, angleBetween, proj,
  parallelogram, fromAngle2D, angle2D, lawOfCosines, DEG,
} from '../../physics/vectors.js';

const U1 = { exam: 'u1' };

export default [
  problem({
    ...U1, id: 'ch2.parallelogram', ch: '2', lab: 'vectors', src: 'Part 1 · 2.1–2.2', title: 'Resultant by the parallelogram rule', kind: 'numeric', topics: ['vectors', 'resultant'],
    vars: { F1: range(200, 4000, 100, 'lb'), F2: range(200, 3000, 100, 'lb'), th: range(15, 150, 5, '°') },
    // thr is the angle in radians: the expression parser's cos() means radians, the problem states degrees.
    derive: ($) => {
      const p = parallelogram($.F1, $.F2, $.th);
      return { R: p.R, phi: p.phi, thr: ($.th * Math.PI) / 180 };
    },
    text: (T) => `Two forces act at a point: F₁ = ${T.F1} lb along the +x axis and F₂ = ${T.F2} lb at ${T.th}° counterclockwise from F₁. Find the magnitude of the resultant and the angle it makes with F₁.`,
    parts: [
      sym('R_sym', 'sqrt(F1^2 + F2^2 + 2*F1*F2*cos(thr))', { F1: 'lb', F2: 'lb', thr: 'rad' }, ($) => $.R, { unit: 'lb', label: 'the resultant magnitude as a formula' }),
      num('R', ($) => $.R, 'lb', { label: 'R' }),
      num('phi', ($) => $.phi, '°', { label: 'angle from F₁', abs: 0.02 }),
    ],
    hints: [
      'The parallelogram rule and the component method must give the same answer — if they do not, one of the angles went in wrong.',
      'Law of cosines on the force triangle: the interior angle is the supplement of the angle between the two forces.',
    ],
    steps: ($, f) => [
      String.raw`$R = \sqrt{F_1^2 + F_2^2 + 2F_1F_2\cos\theta} = ${texNum($.R)}\ \text{lb}$`,
      String.raw`$\phi = \sin^{-1}\left(\dfrac{F_2\sin\theta}{R}\right) = ${texNum($.phi)}^\circ$`,
    ],
    cases: [kase('hand', { F1: 3000, F2: 2000, th: 60 }, { R: 4358.9, phi: 23.413 })],
  }),
  problem({
    ...U1, id: 'ch2.components-resultant', ch: '2', lab: 'vectors', src: 'Part 1 · 2.4', title: 'Resultant by components', kind: 'numeric', topics: ['vectors', 'resultant'],
    vars: {
      F1: range(50, 600, 10, 'N'), a1: range(0, 350, 10, '°'),
      F2: range(50, 600, 10, 'N'), a2: range(0, 350, 10, '°'),
      F3: range(50, 600, 10, 'N'), a3: range(0, 350, 10, '°'),
    },
    derive: ($) => {
      const R = resultant(fromAngle2D($.F1, $.a1), fromAngle2D($.F2, $.a2), fromAngle2D($.F3, $.a3));
      return { Rx: R.x, Ry: R.y, R: mag(R), th: angle2D(R) };
    },
    valid: ($) => $.R > 40,
    text: (T) => `Three coplanar forces act at a point: ${T.F1} N at ${T.a1}°, ${T.F2} N at ${T.a2}°, and ${T.F3} N at ${T.a3}° (all measured counterclockwise from the +x axis). Find the resultant.`,
    parts: [
      num('Rx', ($) => $.Rx, 'N', { label: String.raw`$R_x$`, abs: 0.5 }),
      num('Ry', ($) => $.Ry, 'N', { label: String.raw`$R_y$`, abs: 0.5 }),
      num('R', ($) => $.R, 'N', { label: '|R|' }),
      num('th', ($) => $.th, '°', { label: 'direction', wrap: 360, abs: 0.1 }),
    ],
    hints: [String.raw`Resolve each force first: $F_x = F\cos\theta$, $F_y = F\sin\theta$. Then add the columns.`],
    steps: ($, f) => [
      String.raw`$R_x = \sum F\cos\theta = ${texNum($.Rx)}\ \text{N}$, $R_y = \sum F\sin\theta = ${texNum($.Ry)}\ \text{N}$`,
      String.raw`$|R| = ${texNum($.R)}\ \text{N}$ at $${texNum($.th)}^\circ$`,
    ],
    sim: {
      scenario: 'two',
      setup: (s, $) => void Object.assign(s, {
        mode: 'components',
        F1: [$.F1 * Math.cos($.a1 * DEG), $.F1 * Math.sin($.a1 * DEG), 0],
        F2: [$.F2 * Math.cos($.a2 * DEG) + $.F3 * Math.cos($.a3 * DEG), $.F2 * Math.sin($.a2 * DEG) + $.F3 * Math.sin($.a3 * DEG), 0],
        F3: null,
        showResultant: true,
      }),
      read: (c) => ({ Rx: c.vec.R.x, Ry: c.vec.R.y, R: mag(c.vec.R) }),
    },
    cases: [kase('hand', { F1: 300, a1: 0, F2: 200, a2: 120, F3: 150, a3: 250 }, { Rx: 148.7, Ry: 32.28, R: 152.2, th: 12.25 })],
  }),
  problem({
    ...U1, id: 'ch2.cartesian-angles', ch: '2', lab: 'vectors', src: 'Part 1 · 2.6, 2.10–2.14', title: 'Magnitude and coordinate direction angles', kind: 'numeric', topics: ['vectors', 'direction-angles'],
    vars: { Fx: range(-200, 200, 5, 'lb'), Fy: range(-200, 200, 5, 'lb'), Fz: range(-200, 200, 5, 'lb') },
    derive: ($) => {
      const F = v($.Fx, $.Fy, $.Fz);
      const d = directionAngles(F);
      return { F: mag(F), alpha: d.alpha, beta: d.beta, gamma: d.gamma };
    },
    valid: ($) => $.F > 30,
    text: (T) => `A force is given as F = ${T.Fx}i + ${T.Fy}j + ${T.Fz}k lb. Find its magnitude and its coordinate direction angles.`,
    parts: [
      sym('F_sym', 'sqrt(Fx^2 + Fy^2 + Fz^2)', { Fx: 'lb', Fy: 'lb', Fz: 'lb' }, ($) => $.F, { unit: 'lb', label: '|F| as a formula' }),
      num('F', ($) => $.F, 'lb', { label: '|F|' }),
      num('alpha', ($) => $.alpha, '°', { label: 'α', abs: 0.05 }),
      num('beta', ($) => $.beta, '°', { label: 'β', abs: 0.05 }),
      num('gamma', ($) => $.gamma, '°', { label: 'γ', abs: 0.05 }),
    ],
    hints: [
      String.raw`$\cos\alpha = F_x/F$, and likewise for $\beta$ and $\gamma$.`,
      String.raw`Check yourself: $\cos^2\alpha + \cos^2\beta + \cos^2\gamma$ must come out to exactly 1.`,
    ],
    steps: ($, f) => [
      String.raw`$F = \sqrt{F_x^2 + F_y^2 + F_z^2} = ${texNum($.F)}\ \text{lb}$`,
      String.raw`$\alpha = \cos^{-1}(F_x/F) = ${texNum($.alpha)}^\circ$, $\beta = ${texNum($.beta)}^\circ$, $\gamma = ${texNum($.gamma)}^\circ$`,
    ],
    sim: {
      scenario: 'two',
      setup: (s, $) => void Object.assign(s, { mode: 'components', F1: [$.Fx, $.Fy, $.Fz], F2: [0, 0, 0], F3: null, showResultant: false }),
      read: (c) => ({ F: mag(c.vec.F1), alpha: c.vec.d1.alpha, beta: c.vec.d1.beta, gamma: c.vec.d1.gamma }),
    },
    cases: [kase('2.6', { Fx: 34.3, Fy: -22.9, Fz: -68.6 }, { F: 80.0, alpha: 64.6, beta: 106.6, gamma: 149.0 })],
  }),
  problem({
    ...U1, id: 'ch2.force-along-line', ch: '2', lab: 'vectors', src: 'Part 1 · 2.9, 2.15', title: 'F = F·u along a line', kind: 'numeric', level: 2, topics: ['vectors', 'unit-vector'],
    vars: {
      F: range(100, 900, 10, 'N'),
      ax: range(-4, 4, 1, 'm'), ay: range(-4, 4, 1, 'm'), az: range(0, 5, 1, 'm'),
      bx: range(-4, 4, 1, 'm'), by: range(-4, 4, 1, 'm'), bz: range(0, 5, 1, 'm'),
    },
    derive: ($) => {
      const A = v($.ax, $.ay, $.az);
      const B = v($.bx, $.by, $.bz);
      const Fv = forceAlong($.F, A, B);
      return { L: mag(v($.bx - $.ax, $.by - $.ay, $.bz - $.az)), Fx: Fv.x, Fy: Fv.y, Fz: Fv.z };
    },
    valid: ($) => $.L > 1.5,
    text: (T) => `A cable runs from A(${T.ax}, ${T.ay}, ${T.az}) m to B(${T.bx}, ${T.by}, ${T.bz}) m and carries ${T.F} N of tension. Express the force it exerts at A as a Cartesian vector.`,
    parts: [
      sym('Fx_sym', 'F*(bx - ax)/sqrt((bx-ax)^2 + (by-ay)^2 + (bz-az)^2)', { F: 'N', ax: 'm', ay: 'm', az: 'm', bx: 'm', by: 'm', bz: 'm' }, ($) => $.Fx, { unit: 'N', label: String.raw`$F_x$ as a formula` }),
      num('Fx', ($) => $.Fx, 'N', { label: String.raw`$F_x$`, abs: 0.5 }),
      num('Fy', ($) => $.Fy, 'N', { label: String.raw`$F_y$`, abs: 0.5 }),
      num('Fz', ($) => $.Fz, 'N', { label: String.raw`$F_z$`, abs: 0.5 }),
    ],
    hints: [
      String.raw`Build $\vec{r}_{AB}$ first, then $\hat{u} = \vec{r}_{AB}/|\vec{r}_{AB}|$, then scale by $F$.`,
      'The magnitude never enters the direction: the unit vector carries all the geometry.',
    ],
    steps: ($, f) => [
      String.raw`$|\vec{r}_{AB}| = ${texNum($.L)}\ \text{m}$`,
      String.raw`$\vec{F} = F\hat{u} = (${texNum($.Fx)})\hat{i} + (${texNum($.Fy)})\hat{j} + (${texNum($.Fz)})\hat{k}\ \text{N}$`,
    ],
    cases: [kase('2-3-6', { F: 700, ax: 0, ay: 0, az: 0, bx: 2, by: 3, bz: 0 }, { Fx: 388.1, Fy: 582.2, Fz: 0 })],
  }),
  problem({
    ...U1, id: 'ch2.projection', ch: '2', src: 'Part 1 · dot product', title: 'Component of a force along a line', kind: 'numeric', level: 2, topics: ['vectors', 'dot-product'],
    vars: {
      Fx: range(-300, 300, 10, 'N'), Fy: range(-300, 300, 10, 'N'), Fz: range(-300, 300, 10, 'N'),
      ux: range(-3, 3, 1, ''), uy: range(-3, 3, 1, ''), uz: range(-3, 3, 1, ''),
    },
    derive: ($) => {
      const F = v($.Fx, $.Fy, $.Fz);
      const L = v($.ux, $.uy, $.uz);
      const par = mag(proj(F, L)) * Math.sign(F.x * L.x + F.y * L.y + F.z * L.z);
      return { Fmag: mag(F), Lmag: mag(L), par, perp: Math.sqrt(Math.max(0, mag(F) ** 2 - par ** 2)), theta: angleBetween(F, L) };
    },
    valid: ($) => $.Fmag > 50 && $.Lmag > 1.2,
    text: (T) => `A force F = ${T.Fx}i + ${T.Fy}j + ${T.Fz}k N acts along a member whose direction is given by (${T.ux}, ${T.uy}, ${T.uz}). Find the component of F parallel to that member, and the component perpendicular to it.`,
    parts: [
      num('par', ($) => $.par, 'N', { label: 'parallel component', abs: 0.5 }),
      num('perp', ($) => $.perp, 'N', { label: 'perpendicular component', abs: 0.5 }),
      num('theta', ($) => $.theta, '°', { label: 'angle between', abs: 0.05 }),
    ],
    hints: [
      String.raw`The parallel part is $\vec{F}\cdot\hat{u}$ — a scalar, and it can be negative.`,
      String.raw`The perpendicular part follows from Pythagoras: $F_\perp = \sqrt{F^2 - F_\parallel^2}$.`,
    ],
    steps: ($, f) => [
      String.raw`$F_\parallel = \vec{F}\cdot\hat{u} = ${texNum($.par)}\ \text{N}$`,
      String.raw`$F_\perp = \sqrt{F^2 - F_\parallel^2} = ${texNum($.perp)}\ \text{N}$`,
    ],
    cases: [kase('hand', { Fx: 100, Fy: 200, Fz: 0, ux: 2, uy: 0, uz: 0 }, { par: 100, perp: 200, theta: 63.435 })],
  }),
  problem({
    ...U1, id: 'ch2.concepts', ch: '2', title: 'What the unit vector does', kind: 'conceptual', topics: ['vectors'],
    vars: {
      ask: choice(
        ['unit', 'What is the magnitude of a unit vector?'],
        ['cos', 'For any Cartesian vector, cos²α + cos²β + cos²γ equals'],
        ['scalar', 'The dot product of two vectors is'],
        ['cross', 'The cross product of two vectors is'],
      ),
    },
    text: (T) => T.ask,
    parts: [
      mc('ans', [
        ['one', 'Exactly 1, with no units'],
        ['unity', '1, always'],
        ['scalar', 'A scalar'],
        ['vector', 'A vector perpendicular to both'],
        ['magF', 'The magnitude of the force'],
      ], ($) => ({ unit: 'one', cos: 'unity', scalar: 'scalar', cross: 'vector' })[$.ask]),
    ],
    hints: [String.raw`A unit vector carries direction only; all the size lives in the scalar it multiplies.`],
    steps: ($) => [
      $.ask === 'cross'
        ? String.raw`$\vec{a}\times\vec{b}$ is perpendicular to both, with magnitude $|a||b|\sin\theta$ — that is why moments come out as vectors.`
        : $.ask === 'scalar'
          ? String.raw`$\vec{a}\cdot\vec{b} = |a||b|\cos\theta$ is a number, which is what makes it the right tool for projections and angles.`
          : String.raw`Dividing a vector by its own magnitude leaves direction and nothing else, so $|\hat{u}| = 1$ and the direction cosines square to 1.`,
    ],
    cases: [kase('unit', { ask: 'unit' }, { ans: 'one' }), kase('cross', { ask: 'cross' }, { ans: 'vector' })],
  }),
];
