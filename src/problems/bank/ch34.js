/** Ch 3 · particle equilibrium and Ch 4 · moments. Built from the Part 2 problem deck. */
import { problem, kase, range, choice, num, mc, sym, texNum } from '../kit.js';
import { v, add, mag, unit, cross, dot, fromAngle2D, DEG } from '../../physics/vectors.js';
import { springForce, particleEq2D, momentAbout, moment2D, momentArm, momentAboutAxis } from '../../physics/statics.js';

const U2 = { exam: 'u2' };

export default [
  problem({
    ...U2, id: 'ch3.two-cables', ch: '3', lab: 'particle', src: 'Part 2 · 3.8–3.9', title: 'Weight on two cables', kind: 'numeric', level: 2, topics: ['equilibrium'],
    vars: { W: range(50, 800, 10, 'lb'), a1: range(100, 170, 5, '°'), a2: range(10, 80, 5, '°') },
    derive: ($) => {
      const sol = particleEq2D([v(0, -$.W, 0)], [fromAngle2D(1, $.a1), fromAngle2D(1, $.a2)]);
      return { T1: sol.magnitudes[0], T2: sol.magnitudes[1], res: mag(sol.residual) };
    },
    valid: ($) => $.a1 - $.a2 > 40 && $.T1 > 0 && $.T2 > 0 && $.T1 < 1e5 && $.T2 < 1e5,
    text: (T) => `A ${T.W} lb weight hangs from a ring held by two cables. Cable AB leaves the ring at ${T.a1}° and cable AC at ${T.a2}°, both measured counterclockwise from the +x axis. Find the tension in each cable.`,
    parts: [
      num('T1', ($) => $.T1, 'lb', { label: 'T in AB' }),
      num('T2', ($) => $.T2, 'lb', { label: 'T in AC' }),
    ],
    hints: [
      'Draw the free-body diagram of the ring: three forces, one of them known.',
      String.raw`Two equations, two unknowns: $\sum F_x = 0$ and $\sum F_y = 0$.`,
    ],
    steps: ($, f) => [
      String.raw`$\sum F_x = 0:\; T_1\cos\alpha_1 + T_2\cos\alpha_2 = 0$`,
      String.raw`$\sum F_y = 0:\; T_1\sin\alpha_1 + T_2\sin\alpha_2 = W$`,
      String.raw`$T_{AB} = ${texNum($.T1)}$ lb, $T_{AC} = ${texNum($.T2)}$ lb`,
    ],
    sim: {
      scenario: 'two',
      setup: (s, $) => void Object.assign(s, { W: $.W, a1: $.a1, a2: $.a2, k: 0 }),
      read: (c) => ({
        T1: c.particle.members[0].T,
        T2: c.particle.members[1].T,
        '@ΣF residual': [c.particle.residual, 0],
      }),
    },
    cases: [kase('hand', { W: 100, a1: 150, a2: 45 }, { T1: 73.205, T2: 89.658 })],
  }),
  problem({
    ...U2, id: 'ch3.spring', ch: '3', lab: 'particle', src: 'Part 2 · 3.1, 3.7', title: 'Spring stretch in equilibrium', kind: 'numeric', topics: ['equilibrium', 'springs'],
    vars: { k: range(100, 900, 10, 'N/m'), W: range(20, 400, 5, 'N'), th: range(20, 80, 5, '°') },
    // thr is the angle in radians, so the symbolic answer can use sin() the way the parser means it.
    derive: ($) => {
      const F = $.W / Math.sin($.th * DEG);
      return { F, s: F / $.k, thr: $.th * DEG };
    },
    text: (T) => `A ${T.W} N crate hangs from a spring of stiffness ${T.k} N/m. The spring makes an angle of ${T.th}° with the horizontal and is the only thing carrying the vertical load. Find the force in the spring and how far it has stretched.`,
    parts: [
      sym('s_sym', 'W/(k*sin(thr))', { W: 'N', k: 'N/m', thr: 'rad' }, ($) => $.s, { unit: 'm', label: 'stretch as a formula' }),
      num('F', ($) => $.F, 'N', { label: 'spring force' }),
      num('s', ($) => $.s, 'm', { label: 'stretch' }),
    ],
    hints: [String.raw`Equilibrium first, then Hooke: $F = ks$, so $s = F/k$.`],
    steps: ($, f) => [
      String.raw`$F\sin\theta = W \;\Rightarrow\; F = ${texNum($.F)}\ \text{N}$`,
      String.raw`$s = F/k = ${texNum($.s)}\ \text{m}$`,
    ],
    // The lab's spring scenario is this problem: a horizontal cable (180°) and the spring at θ.
    sim: {
      scenario: 'spring',
      setup: (s, $) => void Object.assign(s, { W: $.W, a1: 180, a2: $.th, k: $.k }),
      read: (c) => ({ F: c.particle.members[1].T, s: c.particle.stretch }),
    },
    cases: [kase('hand', { k: 500, W: 200, th: 30 }, { F: 400, s: 0.8 })],
  }),
  problem({
    ...U2, id: 'ch4.moment-2d', ch: '4', lab: 'moments', src: 'Part 2 · 4.14', title: 'Moment of a force about a point', kind: 'numeric', topics: ['moments'],
    vars: { F: range(20, 500, 10, 'N'), th: range(0, 350, 10, '°'), x: range(-4, 4, 0.5, 'm'), y: range(-4, 4, 0.5, 'm') },
    derive: ($) => {
      const Fv = fromAngle2D($.F, $.th);
      const at = v($.x, $.y, 0);
      return { M: moment2D(v(0, 0, 0), at, Fv), d: momentArm(v(0, 0, 0), at, Fv) };
    },
    valid: ($) => Math.abs($.M) > 5,
    text: (T) => `A ${T.F} N force acting at ${T.th}° from the +x axis is applied at the point (${T.x}, ${T.y}) m. Find the moment it produces about the origin, and the perpendicular distance from the origin to the force's line of action.`,
    parts: [
      num('M', ($) => $.M, 'N·m', { label: String.raw`$M_O$ (positive counterclockwise)`, abs: 0.05 }),
      num('d', ($) => $.d, 'm', { label: 'moment arm d', abs: 0.005 }),
    ],
    hints: [
      String.raw`$M_O = xF_y - yF_x$ is the whole 2D calculation — no need to find $d$ first.`,
      String.raw`Then $d = |M|/F$, which is the perpendicular distance the other method uses.`,
    ],
    steps: ($, f) => [
      String.raw`$M_O = xF_y - yF_x = ${texNum($.M)}\ \text{N}\cdot\text{m}$`,
      String.raw`$d = |M|/F = ${texNum($.d)}\ \text{m}$`,
    ],
    sim: {
      scenario: 'point',
      setup: (s, $) => void Object.assign(s, { F: $.F, th: $.th, x: $.x, y: $.y }),
      read: (c) => ({ M: c.mom.Mz, d: c.mom.d, '@|M| = F·d': [c.mom.Fd, Math.abs(c.mom.Mz)] }),
    },
    cases: [kase('hand', { F: 50, th: 30, x: 4, y: 3 }, { M: -29.904, d: 0.5981 })],
  }),
  problem({
    ...U2, id: 'ch4.moment-3d', ch: '4', lab: 'moments', src: 'Part 2 · 4.15–4.20', title: 'Moment as r × F', kind: 'numeric', level: 2, topics: ['moments', 'cross-product'],
    vars: {
      rx: range(-4, 4, 1, 'm'), ry: range(-4, 4, 1, 'm'), rz: range(-4, 4, 1, 'm'),
      Fx: range(-200, 200, 10, 'N'), Fy: range(-200, 200, 10, 'N'), Fz: range(-200, 200, 10, 'N'),
    },
    derive: ($) => {
      const M = cross(v($.rx, $.ry, $.rz), v($.Fx, $.Fy, $.Fz));
      return { Mx: M.x, My: M.y, Mz: M.z, Mmag: mag(M) };
    },
    valid: ($) => $.Mmag > 50,
    text: (T) => `A force F = ${T.Fx}i + ${T.Fy}j + ${T.Fz}k N acts at a point whose position relative to O is r = ${T.rx}i + ${T.ry}j + ${T.rz}k m. Determine the moment of F about O as a Cartesian vector.`,
    parts: [
      num('Mx', ($) => $.Mx, 'N·m', { label: String.raw`$M_x$`, abs: 0.5 }),
      num('My', ($) => $.My, 'N·m', { label: String.raw`$M_y$`, abs: 0.5 }),
      num('Mz', ($) => $.Mz, 'N·m', { label: String.raw`$M_z$`, abs: 0.5 }),
    ],
    hints: [String.raw`Expand the determinant with $\hat{i}, \hat{j}, \hat{k}$ across the top, $\vec{r}$ next and $\vec{F}$ last — in that order, or the sign flips.`],
    steps: ($, f) => [
      String.raw`$\vec{M}_O = \vec{r}\times\vec{F} = (${texNum($.Mx)})\hat{i} + (${texNum($.My)})\hat{j} + (${texNum($.Mz)})\hat{k}\ \text{N}\cdot\text{m}$`,
      String.raw`Check: $\vec{M}\cdot\vec{F} = 0$ and $\vec{M}\cdot\vec{r} = 0$, since the moment is perpendicular to both.`,
    ],
    sim: {
      scenario: 'cross',
      setup: (s, $) => void Object.assign(s, { r: [$.rx, $.ry, $.rz], Fv: [$.Fx, $.Fy, $.Fz], axis: false }),
      read: (c) => ({ Mx: c.mom.M.x, My: c.mom.M.y, Mz: c.mom.M.z, '@M·F': [c.mom.checkF, 0] }),
    },
    cases: [kase('hand', { rx: 1, ry: 2, rz: 3, Fx: 40, Fy: 50, Fz: 60 }, { Mx: -30, My: 60, Mz: -30 })],
  }),
  problem({
    ...U2, id: 'ch4.moment-axis', ch: '4', lab: 'moments', src: 'Part 2 · 4.21–4.25', title: 'Moment about an axis', kind: 'numeric', level: 3, topics: ['moments', 'axis'],
    vars: {
      ax: range(-3, 3, 1, 'm'), ay: range(-3, 3, 1, 'm'), az: range(-3, 3, 1, 'm'),
      rx: range(-4, 4, 1, 'm'), ry: range(-4, 4, 1, 'm'), rz: range(-4, 4, 1, 'm'),
      Fx: range(-400, 400, 25, 'N'), Fy: range(-400, 400, 25, 'N'), Fz: range(-400, 400, 25, 'N'),
    },
    derive: ($) => {
      const A = v(0, 0, 0);
      const u = v($.ax, $.ay, $.az);
      const Mx = momentAboutAxis(A, u, v($.rx, $.ry, $.rz), v($.Fx, $.Fy, $.Fz));
      return { ulen: mag(u), Maxis: Mx };
    },
    valid: ($) => $.ulen > 1.2 && Math.abs($.Maxis) > 20,
    text: (T) => `An axis runs from the origin along the direction (${T.ax}, ${T.ay}, ${T.az}). A force F = ${T.Fx}i + ${T.Fy}j + ${T.Fz}k N acts at the point (${T.rx}, ${T.ry}, ${T.rz}) m. Find the magnitude of the moment of F about that axis.`,
    parts: [
      sym('M_sym', 'ax*(ry*Fz - rz*Fy)/sqrt(ax^2+ay^2+az^2) + ay*(rz*Fx - rx*Fz)/sqrt(ax^2+ay^2+az^2) + az*(rx*Fy - ry*Fx)/sqrt(ax^2+ay^2+az^2)', { ax: 'm', ay: 'm', az: 'm', rx: 'm', ry: 'm', rz: 'm', Fx: 'N', Fy: 'N', Fz: 'N' }, ($) => $.Maxis, { unit: 'N·m', label: 'the axis moment as a formula' }),
      num('Maxis', ($) => $.Maxis, 'N·m', { label: String.raw`$M_{axis}$`, abs: 0.5 }),
    ],
    hints: [
      String.raw`Two steps: take $\vec{r}\times\vec{F}$ about any point on the axis, then project onto the axis with a dot product.`,
      String.raw`$M_{axis} = \hat{u}\cdot(\vec{r}\times\vec{F})$ — the scalar triple product.`,
    ],
    steps: ($, f) => [
      String.raw`$M_{axis} = \hat{u}\cdot(\vec{r}\times\vec{F}) = ${texNum($.Maxis)}\ \text{N}\cdot\text{m}$`,
      'A force whose line of action meets the axis, or runs parallel to it, contributes nothing — the triple product vanishes.',
    ],
    sim: {
      scenario: 'axis',
      setup: (s, $) => void Object.assign(s, { u: [$.ax, $.ay, $.az], r: [$.rx, $.ry, $.rz], Fv: [$.Fx, $.Fy, $.Fz], axis: true }),
      read: (c) => ({ Maxis: c.mom.Maxis }),
    },
    cases: [kase('hand', { ax: 0, ay: 0, az: 2, rx: 2, ry: 0, rz: 0, Fx: 0, Fy: 50, Fz: 0 }, { Maxis: 100 })],
  }),
  problem({
    ...U2, id: 'ch4.couple-concept', ch: '4', lab: 'moments', title: 'What makes a couple special', kind: 'conceptual', topics: ['moments', 'couples'],
    vars: {
      ask: choice(
        ['point', 'The moment of a couple, computed about different points, is'],
        ['net', 'The net force of a couple is'],
        ['slide', 'Sliding a force along its own line of action changes'],
      ),
    },
    text: (T) => T.ask,
    parts: [
      mc('ans', [
        ['same', 'The same about every point'],
        ['zero', 'Zero'],
        ['nothing', 'Nothing — neither the force nor its moment about any point'],
        ['depends', 'Different for each point'],
      ], ($) => ({ point: 'same', net: 'zero', slide: 'nothing' })[$.ask]),
    ],
    hints: ['A couple is two equal and opposite forces, so the forces cancel but the moments do not.'],
    steps: ($) => [
      $.ask === 'slide'
        ? 'The moment is r × F with r to any point on the line of action, so sliding the force along that line leaves r × F unchanged. This is the principle of transmissibility.'
        : 'The two forces cancel, so the resultant force is zero; the moment works out to r × F with r between the two points of application, which contains no reference to any origin.',
    ],
    sim: { scenario: 'couple', read: () => ({}) },
    cases: [kase('point', { ask: 'point' }, { ans: 'same' }), kase('net', { ask: 'net' }, { ans: 'zero' })],
  }),
  problem({
    ...U2, id: 'ch3.three-cables', ch: '3', lab: 'particle', src: 'Part 2 · 3.10–3.13', title: 'A ring on three cables in 3D', kind: 'numeric', level: 3, topics: ['equilibrium', '3d'],
    vars: { W: range(100, 1500, 50, 'lb'), h: range(2, 10, 0.5, 'ft') },
    // By hand: AC and AD are mirror images, so they carry the same T. ΣFx then ties T_AB to T,
    // and ΣFz fixes T — no 3×3 solve needed.
    derive: ($) => {
      const LA = Math.hypot(3, $.h);
      const LB = Math.hypot(2, 3, $.h);
      return { LA, LB, TAB: (2 * $.W * LA) / (5 * $.h), T: (3 * $.W * LB) / (10 * $.h) };
    },
    text: (T) => `A ${T.W} lb weight hangs from a ring at the origin. Three cables run up to anchors B(3, 0, ${T.h}), C(−2, 3, ${T.h}) and D(−2, −3, ${T.h}) ft (z up). Find the tension in cable AB and in cable AC.`,
    parts: [
      num('TAB', ($) => $.TAB, 'lb', { label: String.raw`$T_{AB}$` }),
      num('TAC', ($) => $.T, 'lb', { label: String.raw`$T_{AC}$` }),
    ],
    hints: [
      String.raw`Write each tension as $T\hat{u}$ with $\hat{u}$ from the ring toward its anchor.`,
      'Look for symmetry before solving: C and D are mirror images across the xz-plane, so T_AC = T_AD. That leaves two unknowns.',
    ],
    steps: ($, f) => [
      String.raw`$|r_{AB}| = ${texNum($.LA)}$ ft, $|r_{AC}| = |r_{AD}| = ${texNum($.LB)}$ ft`,
      String.raw`$\sum F_x:\; T_{AB}\frac{3}{|r_{AB}|} = 2\,T\frac{2}{|r_{AC}|}$; $\;\sum F_z:\; h\left(\frac{T_{AB}}{|r_{AB}|} + \frac{2T}{|r_{AC}|}\right) = W$`,
      String.raw`$T_{AB} = ${texNum($.TAB)}$ lb, $T_{AC} = T_{AD} = ${texNum($.T)}$ lb`,
    ],
    sim: {
      scenario: 'three',
      setup: (s, $) => void Object.assign(s, { W: $.W, h: $.h }),
      read: (c) => ({ TAB: c.particle.members[0].T, TAC: c.particle.members[1].T, '@T_AC = T_AD': [c.particle.members[2].T, c.particle.members[1].T] }),
    },
    cases: [kase('hand', { W: 600, h: 4 }, { TAB: 300, TAC: 242.33 })],
  }),
  problem({
    ...U2, id: 'ch4.couple-moment', ch: '4', lab: 'moments', src: 'Part 2 · couples', title: 'Moment of a couple, about any point', kind: 'numeric', level: 2, topics: ['moments', 'couples'],
    vars: { F: range(20, 400, 10, 'N'), th: range(10, 170, 10, '°'), px: range(-4, 4, 0.5, 'm'), py: range(-4, 4, 0.5, 'm') },
    derive: ($) => ({ M: -3 * $.F * Math.sin($.th * DEG) }),
    text: (T) => `A force of ${T.F} N at ${T.th}° from the +x axis acts at A(−1.5, 0) m, and an equal and opposite force acts at B(1.5, 0) m. Find the resultant moment of the pair about the point P(${T.px}, ${T.py}) m, counterclockwise positive.`,
    parts: [num('M', ($) => $.M, 'N·m', { label: String.raw`$M_P$`, abs: 0.05 })],
    hints: [
      'The two forces are a couple. What does that tell you about where P is?',
      String.raw`$M = \vec{r}_{BA}\times\vec{F}$, with $\vec{F}$ the force at A — P never enters.`,
    ],
    steps: ($, f) => [
      String.raw`A couple has the same moment about every point, so P is a distraction.`,
      String.raw`$M = (x_A - x_B)F_y = -3F\sin\theta = ${texNum($.M)}\ \text{N}\cdot\text{m}$`,
    ],
    sim: {
      scenario: 'couple',
      setup: (s, $) => void Object.assign(s, { F: $.F, th: $.th, px: $.px, py: $.py }),
      read: (c) => ({ M: c.mom.Mz, '@same as r_BA × F': [c.mom.Mcouple, c.mom.Mz] }),
    },
    cases: [kase('hand', { F: 80, th: 90, px: 0, py: 2 }, { M: -240 })],
  }),
];
