/** Ch 5 · rigid-body equilibrium and Ch 6 · trusses. Built from the Part 3 problem deck. */
import { problem, kase, range, choice, num, mc, sym, texNum } from '../kit.js';
import { v, mag } from '../../physics/vectors.js';
import { rigidBody2D, uniformLoad, triangularLoad } from '../../physics/statics.js';
import { solveTruss, memberForce, stateOf, zeroForceMembers } from '../../physics/truss.js';

const U3 = { exam: 'u3' };

/** The three-member truss the lab opens with, sized by the problem's own numbers. */
const triTruss = ($) => ({
  joints: { A: v(0, 0, 0), B: v($.span, 0, 0), C: v($.span / 2, $.h, 0) },
  members: [['A', 'B'], ['A', 'C'], ['B', 'C']],
  loads: { C: { x: 0, y: -$.P } },
  supports: { A: 'pin', B: 'rollerY' },
});

export default [
  problem({
    ...U3, id: 'ch5.beam-reactions', ch: '5', lab: 'beam', src: 'Part 3 · 5.2, 5.8, 5.10', title: 'Reactions on a simply supported beam', kind: 'numeric', topics: ['equilibrium', 'reactions'],
    vars: { L: range(4, 20, 1, 'ft'), P: range(100, 2000, 50, 'lb'), a: range(1, 18, 1, 'ft') },
    derive: ($) => {
      const sol = rigidBody2D({
        loads: [{ at: v($.a, 0, 0), F: v(0, -$.P, 0) }],
        unknowns: [{ at: v(0, 0, 0), dir: v(0, 1, 0) }, { at: v($.L, 0, 0), dir: v(0, 1, 0) }, { at: v(0, 0, 0), dir: v(1, 0, 0) }],
        about: v(0, 0, 0),
      });
      return { RA: sol.reactions[0], RB: sol.reactions[1], res: Math.abs(sol.residual.Fy) + Math.abs(sol.residual.M) };
    },
    valid: ($) => $.a < $.L - 0.5 && $.a > 0.5,
    text: (T) => `A beam of span ${T.L} ft rests on a pin at A (left end) and a roller at B (right end). A ${T.P} lb downward load acts ${T.a} ft from A. Find the vertical reactions at A and B.`,
    parts: [
      sym('RB_sym', 'P*a/L', { P: 'lb', a: 'ft', L: 'ft' }, ($) => $.RB, { unit: 'lb', label: 'the reaction at B as a formula' }),
      num('RA', ($) => $.RA, 'lb', { label: String.raw`$A_y$` }),
      num('RB', ($) => $.RB, 'lb', { label: String.raw`$B_y$` }),
    ],
    hints: [
      String.raw`Sum moments about A first: that kills $A_y$ and leaves one unknown.`,
      String.raw`Then $\sum F_y = 0$ gives the other. Check with $\sum M_B = 0$.`,
    ],
    steps: ($, f) => [
      String.raw`$\sum M_A = 0:\; B_y L - Pa = 0 \Rightarrow B_y = ${texNum($.RB)}\ \text{lb}$`,
      String.raw`$\sum F_y = 0:\; A_y = P - B_y = ${texNum($.RA)}\ \text{lb}$`,
    ],
    sim: {
      scenario: 'point',
      setup: (s, $) => void Object.assign(s, { L: $.L, P: $.a <= $.L ? $.P : 0, a: $.a, dist: 'none', w: 0, M0: 0, c: $.L / 2 }),
      read: (c) => ({ RA: c.beam.reactions[0].Fy, RB: c.beam.reactions[1].Fy }),
    },
    cases: [kase('hand', { L: 10, P: 600, a: 4 }, { RA: 360, RB: 240 })],
  }),
  problem({
    ...U3, id: 'ch5.distributed', ch: '5', lab: 'beam', src: 'Part 3 · distributed loads', title: 'Reactions under a distributed load', kind: 'numeric', level: 2, topics: ['equilibrium', 'distributed-load'],
    vars: { L: range(4, 16, 1, 'ft'), w: range(20, 400, 10, 'lb/ft'), shape: choice(['uniform', 'uniform'], ['triangular', 'triangular, zero at A']) },
    derive: ($) => {
      const eq = $.shape === 'uniform' ? uniformLoad($.w, 0, $.L) : triangularLoad($.w, 0, $.L);
      const sol = rigidBody2D({
        loads: [{ at: v(eq.x, 0, 0), F: v(0, -eq.F, 0) }],
        unknowns: [{ at: v(0, 0, 0), dir: v(0, 1, 0) }, { at: v($.L, 0, 0), dir: v(0, 1, 0) }, { at: v(0, 0, 0), dir: v(1, 0, 0) }],
        about: v(0, 0, 0),
      });
      return { W: eq.F, xbar: eq.x, RA: sol.reactions[0], RB: sol.reactions[1] };
    },
    text: (T) => `A beam of span ${T.L} ft carries a ${T.shape} distributed load with a peak intensity of ${T.w} lb/ft. It is pinned at A (left) and on a roller at B (right). Find the equivalent resultant load, where it acts, and the two reactions.`,
    parts: [
      num('W', ($) => $.W, 'lb', { label: 'resultant load' }),
      num('xbar', ($) => $.xbar, 'ft', { label: 'acting at x =' }),
      num('RA', ($) => $.RA, 'lb', { label: String.raw`$A_y$` }),
      num('RB', ($) => $.RB, 'lb', { label: String.raw`$B_y$` }),
    ],
    hints: [
      'Replace the distribution by its resultant before writing any equilibrium equation.',
      String.raw`Uniform: $W = wL$ at midspan. Triangular: $W = \tfrac12 wL$ at two thirds of the span from the zero end.`,
    ],
    steps: ($, f) => [
      String.raw`$W = ${texNum($.W)}\ \text{lb}$ acting at $x = ${texNum($.xbar)}\ \text{ft}$`,
      String.raw`$A_y = ${texNum($.RA)}$ lb, $B_y = ${texNum($.RB)}$ lb`,
    ],
    sim: {
      scenario: 'udl',
      setup: (s, $) => void Object.assign(s, { L: $.L, P: 0, dist: $.shape, w: $.w, M0: 0, c: $.L / 2 }),
      read: (c) => ({ W: Math.abs(c.beam.dist.F), xbar: c.beam.dist.x, RA: c.beam.reactions[0].Fy, RB: c.beam.reactions[1].Fy }),
    },
    cases: [
      kase('uniform', { L: 10, w: 120, shape: 'uniform' }, { W: 1200, xbar: 5, RA: 600, RB: 600 }),
      kase('triangular', { L: 6, w: 90, shape: 'triangular' }, { W: 270, xbar: 4, RA: 90, RB: 180 }),
    ],
  }),
  problem({
    ...U3, id: 'ch6.truss-joints', ch: '6', lab: 'truss', src: 'Part 3 · 6.1–6.3', title: 'Method of joints on a three-member truss', kind: 'numeric', level: 2, topics: ['trusses', 'method-of-joints'],
    vars: { span: range(4, 16, 1, 'ft'), h: range(2, 10, 1, 'ft'), P: range(200, 3000, 100, 'lb') },
    derive: ($) => {
      const sol = solveTruss(triTruss($));
      return {
        AB: memberForce(sol, 'A', 'B'),
        AC: memberForce(sol, 'A', 'C'),
        BC: memberForce(sol, 'B', 'C'),
        RA: sol.reactions.A.y,
        RB: sol.reactions.B.y,
        worst: sol.worstResidual,
      };
    },
    valid: ($) => $.h / $.span > 0.2 && $.h / $.span < 2,
    text: (T) => `A truss has joints A(0, 0), B(${T.span}, 0) and C(${T.span / 2}, ${T.h}), all in feet, with members AB, AC and BC. A pin supports A and a roller supports B. A ${T.P} lb downward load acts at C. Find the force in each member and say whether it is in tension or compression.`,
    parts: [
      num('AB', ($) => $.AB, 'lb', { label: 'AB (+ is tension)' }),
      num('AC', ($) => $.AC, 'lb', { label: 'AC (+ is tension)' }),
      mc('ACstate', [['tension', 'Tension'], ['compression', 'Compression'], ['zero', 'Zero-force']], ($) => stateOf($.AC), { label: 'AC is in' }),
    ],
    hints: [
      'Find the reactions first from the whole truss, then start at a joint with only two unknown members.',
      'Assume every member is in tension. A negative answer means compression — you do not have to guess the sense.',
    ],
    steps: ($, f) => [
      String.raw`Reactions: $A_y = ${texNum($.RA)}$ lb, $B_y = ${texNum($.RB)}$ lb`,
      String.raw`Joint A: $AC = ${texNum($.AC)}$ lb, $AB = ${texNum($.AB)}$ lb`,
      String.raw`Negative means compression; the sloping members push, the bottom chord pulls.`,
    ],
    sim: {
      scenario: 'three',
      setup: (s, $) => void Object.assign(s, {
        joints: { A: [0, 0], B: [$.span, 0], C: [$.span / 2, $.h] },
        members: [['A', 'B'], ['A', 'C'], ['B', 'C']],
        loads: { C: [0, -$.P] },
        supports: { A: 'pin', B: 'rollerY' },
        scale: 1,
      }),
      read: (c) => ({
        AB: memberForce(c.truss.sol, 'A', 'B'),
        AC: memberForce(c.truss.sol, 'A', 'C'),
        '@worst joint residual': [c.truss.sol.worstResidual, 0],
      }),
    },
    cases: [kase('hand', { span: 4, h: 3, P: 1000 }, { AB: 333.33, AC: -600.93, ACstate: 'compression' })],
  }),
  problem({
    ...U3, id: 'ch6.determinacy', ch: '6', title: 'Is the truss determinate?', kind: 'conceptual', level: 2, topics: ['trusses'],
    vars: { j: range(4, 12, 1, ''), extra: choice([0, 'exactly'], [1, 'one more member than'], [-1, 'one fewer member than']) },
    derive: ($) => {
      const m = 2 * $.j - 3 + $.extra;
      return { m, r: 3, verdict: $.extra === 0 ? 'determinate' : $.extra > 0 ? 'indeterminate' : 'unstable' };
    },
    text: (T, $) => `A plane truss has ${T.j} joints and three support reactions, and carries ${$.m} members — that is ${$.extra === 0 ? 'exactly' : $.extra > 0 ? 'one more member than' : 'one fewer member than'} the count m + r = 2j requires. What can you say about it?`,
    parts: [
      mc('verdict', [['determinate', 'Statically determinate — the joint equations have exactly one solution'], ['indeterminate', 'Statically indeterminate — more unknowns than equations'], ['unstable', 'Unstable — not enough members to hold its shape']], ($) => $.verdict),
    ],
    hints: [String.raw`Each joint gives two equations, so $2j$ equations must match $m + r$ unknowns.`],
    steps: ($, f) => [
      String.raw`$m + r = ${texNum($.m + 3)}$ and $2j = ${texNum(2 * $.j)}$.`,
      $.verdict === 'determinate'
        ? 'Equal counts: the method of joints will close exactly.'
        : $.verdict === 'indeterminate'
          ? 'More unknowns than equations — statics alone cannot finish it; you would need the members’ stiffness.'
          : 'Fewer members than needed: the truss is a mechanism and will collapse.',
    ],
    cases: [kase('det', { j: 6, extra: 0 }, { verdict: 'determinate' })],
  }),
  problem({
    ...U3, id: 'ch6.zero-force', ch: '6', lab: 'truss', src: 'Part 3 · 6.6', title: 'Spotting zero-force members', kind: 'conceptual', level: 2, topics: ['trusses', 'zero-force'],
    vars: {
      layout: choice(
        ['two', 'two members meet at an unloaded joint and are not in line'],
        ['three', 'three members meet at an unloaded joint, two of them collinear'],
        ['loaded', 'two members meet at a joint that carries an applied load'],
      ),
    },
    derive: ($) => ({ n: $.layout === 'two' ? 2 : $.layout === 'three' ? 1 : 0 }),
    text: (T) => `At a joint with no support and where ${T.layout}, how many of those members carry zero force?`,
    parts: [
      mc('n', [[2, 'Both of them'], [1, 'One — the member that is not in line with the others'], [0, 'None of them']], ($) => $.n),
    ],
    hints: [
      'Set up axes along and perpendicular to the collinear pair; the perpendicular equation usually has just one term in it.',
      'Any applied load at the joint breaks both rules — they only hold for an unloaded, unsupported joint.',
    ],
    steps: ($) => [
      $.n === 2
        ? 'With only two non-collinear members and nothing else at the joint, each direction has a single force in it, so both must vanish.'
        : $.n === 1
          ? 'Resolve perpendicular to the two collinear members: only the third member has a component there, so it must be zero.'
          : 'With a load applied at the joint, the members have something to balance, so neither rule applies.',
    ],
    sim: {
      scenario: 'zero',
      setup: (s) => void Object.assign(s, { showZero: true }),
      read: () => ({}),
    },
    cases: [kase('two', { layout: 'two' }, { n: 2 }), kase('three', { layout: 'three' }, { n: 1 })],
  }),
  problem({
    ...U3, id: 'ch6.frame-aframe', ch: '6', lab: 'frame', src: 'Part 3 · frames', title: 'A-frame with a two-force member', kind: 'numeric', level: 3, topics: ['frames', 'two-force'],
    vars: { P: range(100, 2000, 50, 'lb'), t: range(0.2, 0.9, 0.05, '') },
    // Worked the way you would by hand: ΣM_A on the whole frame for Cy, then BC is a two-force
    // member, so the force at C points along CB. The lab solves all six equations at once.
    derive: ($) => {
      const xD = 2 * $.t;
      const Cy = ($.P * xD) / 4;
      const Cx = -Cy * (2 / 3);
      return { xD, yD: 3 * $.t, Cy, Cx, Ay: $.P - Cy, Ax: -Cx, B: Math.hypot(Cx, Cy) };
    },
    text: (T, $) => `An A-frame has legs AB and BC pinned together at the apex B(2, 3) ft, with pin supports at A(0, 0) and C(4, 0). A ${T.P} lb downward load acts on AB at D(${$.xD.toFixed(2)}, ${$.yD.toFixed(2)}) ft. Nothing else loads BC. Find the vertical reaction at C and the magnitude of the pin force at B.`,
    parts: [
      num('Cy', ($) => $.Cy, 'lb', { label: String.raw`$C_y$` }),
      num('Ax', ($) => $.Ax, 'lb', { label: String.raw`$A_x$ (+ right)` }),
      num('B', ($) => $.B, 'lb', { label: 'pin force at B' }),
    ],
    hints: [
      'Whole frame first: ΣM about A involves only Cy and the load.',
      'BC carries no load between its pins — it is a two-force member, so the force at C acts along CB.',
    ],
    steps: ($, f) => [
      String.raw`$\sum M_A = 0:\; 4C_y - P\,x_D = 0 \Rightarrow C_y = ${texNum($.Cy)}$ lb`,
      String.raw`BC is a two-force member along $(-2, 3)$, so $C_x = -\tfrac{2}{3}C_y = ${texNum($.Cx)}$ lb, and $A_x = -C_x = ${texNum($.Ax)}$ lb`,
      String.raw`The pin force at B equals the force at C: $|B| = ${texNum($.B)}$ lb`,
    ],
    sim: {
      scenario: 'aframe',
      setup: (s, $) => void Object.assign(s, { P: $.P, t: $.t, Q: 0 }),
      read: (c) => ({
        Cy: c.frame.sol.values.Cy,
        Ax: c.frame.sol.values.Ax,
        B: Math.hypot(c.frame.sol.values.Bx, c.frame.sol.values.By),
        '@worst member residual': [c.frame.sol.worstResidual, 0],
      }),
    },
    cases: [kase('hand', { P: 600, t: 0.5 }, { Cy: 150, Ax: 100, B: 180.28 })],
  }),
  problem({
    ...U3, id: 'ch6.pliers', ch: '6', lab: 'frame', src: 'Part 3 · machines', title: 'Grip of a pair of pliers', kind: 'numeric', level: 2, topics: ['machines'],
    vars: { P: range(10, 200, 5, 'N'), b: range(1.5, 8, 0.5, 'in') },
    derive: ($) => ({ N: $.P * $.b, C: $.P + $.P * $.b }),
    text: (T) => `A pair of pliers pivots on a pin C. Each jaw grips a bolt 1 in from the pin; each handle is squeezed with ${T.P} N at ${T.b} in from the pin, on the other side. Find the gripping force on the bolt and the force the pin C carries.`,
    parts: [
      num('N', ($) => $.N, 'N', { label: 'grip on the bolt' }),
      num('C', ($) => $.C, 'N', { label: 'force at pin C' }),
    ],
    hints: [
      'Take one handle-and-jaw as a free body. Moments about C eliminate the pin force.',
      'Then ΣFy on the same member gives the pin force: it carries both the hand force and the grip.',
    ],
    steps: ($, f) => [
      String.raw`$\sum M_C = 0:\; N(1) = P\,b \Rightarrow N = ${texNum($.N)}$ N`,
      String.raw`$\sum F_y = 0:\; C = P + N = ${texNum($.C)}$ N`,
    ],
    sim: {
      scenario: 'pliers',
      setup: (s, $) => void Object.assign(s, { P: $.P, b: $.b }),
      read: (c) => ({ N: c.frame.sol.values.J1n, C: Math.hypot(c.frame.sol.values.Cx, c.frame.sol.values.Cy) }),
    },
    cases: [kase('hand', { P: 50, b: 3 }, { N: 150, C: 200 })],
  }),
  problem({
    ...U3, id: 'ch5.cantilever', ch: '5', lab: 'beam', src: 'Part 3 · fixed supports', title: 'Cantilever: reactions at the wall', kind: 'numeric', level: 2, topics: ['equilibrium', 'fixed-support'],
    vars: { L: range(3, 16, 1, 'ft'), P: range(0, 1000, 50, 'lb'), w: range(0, 200, 10, 'lb/ft') },
    derive: ($) => ({ Ay: $.P + $.w * $.L, MA: $.P * $.L + ($.w * $.L ** 2) / 2 }),
    valid: ($) => $.P + $.w > 0,
    text: (T) => `A ${T.L} ft cantilever is fixed into a wall at A and carries a uniform load of ${T.w} lb/ft along its length plus a ${T.P} lb downward load at its free end. Find the vertical reaction and the moment the wall exerts at A.`,
    parts: [
      num('Ay', ($) => $.Ay, 'lb', { label: String.raw`$A_y$` }),
      num('MA', ($) => $.MA, 'lb·ft', { label: String.raw`$M_A$ (counterclockwise +)` }),
    ],
    hints: [
      'A fixed support supplies three reactions: two forces and a couple. Draw all three.',
      String.raw`Replace the uniform load by $wL$ at $L/2$, then $\sum M_A = 0$ gives the couple directly.`,
    ],
    steps: ($, f) => [
      String.raw`$\sum F_y = 0:\; A_y = P + wL = ${texNum($.Ay)}$ lb`,
      String.raw`$\sum M_A = 0:\; M_A = PL + wL\cdot\tfrac{L}{2} = ${texNum($.MA)}\ \text{lb}\cdot\text{ft}$`,
    ],
    sim: {
      scenario: 'cantilever',
      setup: (s, $) => void Object.assign(s, { L: $.L, P: $.P, a: $.L, dist: $.w ? 'uniform' : 'none', w: $.w, M0: 0, c: $.L / 2 }),
      read: (c) => ({ Ay: c.beam.reactions[0].Fy, MA: c.beam.reactions[0].M }),
    },
    cases: [kase('hand', { L: 8, P: 250, w: 50 }, { Ay: 650, MA: 3600 })],
  }),
  problem({
    ...U3, id: 'ch6.sections', ch: '6', lab: 'truss', src: 'Part 3 · 6.4–6.5', title: 'Method of sections on a Pratt truss', kind: 'numeric', level: 3, topics: ['trusses', 'method-of-sections'],
    vars: { P1: range(100, 2000, 50, 'lb'), P2: range(100, 2000, 50, 'lb') },
    // By hand: ΣM_A on the whole truss for A_y, then the section left of the cut:
    // ΣM about E gives BC, ΣM about C gives EF, and ΣFy gives EC (its moment point is at infinity).
    derive: ($) => {
      const Ay = (2 * $.P1 + $.P2) / 3;
      return { Ay, BC: Ay, EF: $.P1 - 2 * Ay, EC: Math.SQRT2 * (Ay - $.P1) };
    },
    text: (T) => `A Pratt truss has bottom joints A(0, 0), B(3, 0), C(6, 0), D(9, 0) and top joints E(3, 3), F(6, 3), in feet, with a pin at A and a roller at D. It carries ${T.P1} lb down at B and ${T.P2} lb down at C. Cut through BC, EC and EF and find the force in each (tension positive).`,
    parts: [
      num('BC', ($) => $.BC, 'lb', { label: 'BC' }),
      num('EF', ($) => $.EF, 'lb', { label: 'EF' }),
      num('EC', ($) => $.EC, 'lb', { label: 'EC' }),
    ],
    hints: [
      String.raw`Reactions first: $\sum M_A = 0$ on the whole truss.`,
      'Keep the left part (A, B, E). For each member, take moments where the other two cut members meet: E isolates BC, C isolates EF.',
      String.raw`BC and EF are parallel, so EC has no moment point — use $\sum F_y$ on the section.`,
    ],
    steps: ($, f) => [
      String.raw`$A_y = \tfrac{2P_1 + P_2}{3} = ${texNum($.Ay)}$ lb`,
      String.raw`$\sum M_E:\; 3\,F_{BC} - 3A_y = 0 \Rightarrow F_{BC} = ${texNum($.BC)}$ lb`,
      String.raw`$\sum M_C:\; -6A_y + 3P_1 - 3F_{EF} = 0 \Rightarrow F_{EF} = ${texNum($.EF)}$ lb`,
      String.raw`$\sum F_y:\; A_y - P_1 - F_{EC}/\sqrt{2} = 0 \Rightarrow F_{EC} = ${texNum($.EC)}$ lb`,
    ],
    sim: {
      scenario: 'pratt-uneven',
      setup: (s, $) => void Object.assign(s, { loads: { B: [0, -$.P1], C: [0, -$.P2] }, scale: 1, section: true, cutIdx: 0 }),
      read: (c) => {
        const by = Object.fromEntries(c.truss.mos.cut.map((m) => [m.member, m.force]));
        return { BC: by.BC, EF: by.EF, EC: by.EC, '@EC by joints': [memberForce(c.truss.sol, 'E', 'C'), by.EC] };
      },
    },
    cases: [kase('hand', { P1: 900, P2: 300 }, { BC: 700, EF: -500, EC: -282.84 })],
  }),
];
