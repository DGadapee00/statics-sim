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
    ...U3, id: 'ch5.beam-reactions', ch: '5', src: 'Part 3 · 5.2, 5.8, 5.10', title: 'Reactions on a simply supported beam', kind: 'numeric', topics: ['equilibrium', 'reactions'],
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
    cases: [kase('hand', { L: 10, P: 600, a: 4 }, { RA: 360, RB: 240 })],
  }),
  problem({
    ...U3, id: 'ch5.distributed', ch: '5', src: 'Part 3 · distributed loads', title: 'Reactions under a distributed load', kind: 'numeric', level: 2, topics: ['equilibrium', 'distributed-load'],
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
];
