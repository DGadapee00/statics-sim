/** Ch 7 · internal loads, Ch 9 · centroids, Ch 10 · moments of inertia. From the Part 4 deck. */
import { problem, kase, range, choice, num, mc, sym, texNum } from '../kit.js';
import { internalAt } from '../../physics/sections.js';
import { composite, rect, tri, semi, quarter, compositeI, rectI, triI, parallelAxis, radiusOfGyration, pappusArea, pappusVolume } from '../../physics/sections.js';

const U4 = { exam: 'u4' };

export default [
  problem({
    ...U4, id: 'ch7.internal-point', ch: '7', src: 'Part 4 · 7.1–7.3', title: 'Internal N, V and M at a cut', kind: 'numeric', level: 2, topics: ['internal-loads'],
    vars: { L: range(6, 20, 1, 'ft'), P: range(100, 1500, 50, 'lb'), a: range(2, 16, 1, 'ft'), c: range(1, 18, 1, 'ft') },
    derive: ($) => {
      const RB = ($.P * $.a) / $.L;
      const RA = $.P - RB;
      const setup = { reactions: [{ x: 0, Fy: RA }, { x: $.L, Fy: RB }], loads: [{ x: $.a, Fy: -$.P }] };
      const r = internalAt($.c, setup);
      return { RA, RB, N: r.N, V: r.V, M: r.M };
    },
    valid: ($) => $.a < $.L - 1 && $.c < $.L - 0.5 && Math.abs($.c - $.a) > 0.5,
    text: (T) => `A beam spans ${T.L} ft on a pin at A (left) and a roller at B (right), carrying a ${T.P} lb downward point load ${T.a} ft from A. Cut the beam at C, ${T.c} ft from A, and find the internal normal force, shear and bending moment there.`,
    parts: [
      num('N', ($) => $.N, 'lb', { label: 'N', abs: 0.5 }),
      num('V', ($) => $.V, 'lb', { label: 'V', abs: 0.5 }),
      num('M', ($) => $.M, 'lb·ft', { label: 'M', abs: 0.5 }),
    ],
    hints: [
      'Find the reactions first, then take everything to the left of the cut as a free body.',
      String.raw`$V$ is the sum of the vertical forces on that segment; $M$ is the sum of their moments about the cut.`,
    ],
    steps: ($, f) => [
      String.raw`$A_y = ${texNum($.RA)}$ lb, $B_y = ${texNum($.RB)}$ lb`,
      String.raw`$V = ${texNum($.V)}$ lb and $M = ${texNum($.M)}\ \text{lb}\cdot\text{ft}$ at the cut`,
      'No horizontal loads here, so N = 0 — which is worth writing down rather than leaving blank.',
    ],
    cases: [kase('hand', { L: 12, P: 600, a: 4, c: 2 }, { N: 0, V: 400, M: 800 })],
  }),
  problem({
    ...U4, id: 'ch9.centroid-composite', ch: '9', src: 'Part 4 · 9.1–9.4', title: 'Centroid of a composite area', kind: 'numeric', level: 2, topics: ['centroids'],
    vars: {
      w1: range(2, 10, 1, 'in'), h1: range(1, 6, 1, 'in'),
      w2: range(1, 8, 1, 'in'), h2: range(1, 8, 1, 'in'),
    },
    derive: ($) => {
      // An L: a base rectangle with a second rectangle standing on its left end.
      const parts = [rect($.w1, $.h1, 0, 0), rect($.w2, $.h2, 0, $.h1)];
      const c = composite(parts);
      return { A: c.A, xbar: c.x, ybar: c.y };
    },
    valid: ($) => $.w2 <= $.w1,
    text: (T) => `An L-shaped area is made of a ${T.w1} in × ${T.h1} in rectangle with its lower-left corner at the origin, plus a ${T.w2} in × ${T.h2} in rectangle sitting directly on top of its left end. Find the total area and the centroid.`,
    parts: [
      num('A', ($) => $.A, 'in²', { label: 'A' }),
      num('xbar', ($) => $.xbar, 'in', { label: 'x̄', abs: 0.005 }),
      num('ybar', ($) => $.ybar, 'in', { label: 'ȳ', abs: 0.005 }),
    ],
    hints: [
      String.raw`$\bar{x} = \dfrac{\sum A_i \bar{x}_i}{\sum A_i}$ — weight each piece's own centroid by its area.`,
      'Keep a table. Area, x̄, ȳ, then Ax̄ and Aȳ columns. Every mistake in this chapter is a bookkeeping mistake.',
    ],
    steps: ($, f) => [
      String.raw`$A = ${texNum($.A)}\ \text{in}^2$`,
      String.raw`$\bar{x} = ${texNum($.xbar)}$ in, $\bar{y} = ${texNum($.ybar)}$ in`,
    ],
    cases: [kase('hand', { w1: 6, h1: 2, w2: 2, h2: 4 }, { A: 20, xbar: 2.2, ybar: 2.2 })],
  }),
  problem({
    ...U4, id: 'ch9.pappus', ch: '9', src: 'Part 4 · 9.9–9.11', title: 'Pappus–Guldinus', kind: 'numeric', level: 2, topics: ['centroids', 'pappus'],
    vars: { R: range(2, 12, 1, 'in'), a: range(1, 5, 0.5, 'in'), shape: choice(['torus', 'a torus'], ['sphere', 'a sphere']) },
    derive: ($) => {
      if ($.shape === 'sphere') {
        return { V: (4 / 3) * Math.PI * $.a ** 3, S: 4 * Math.PI * $.a ** 2 };
      }
      return { V: pappusVolume($.R, Math.PI * $.a ** 2), S: pappusArea($.R, 2 * Math.PI * $.a) };
    },
    valid: ($) => $.shape === 'sphere' || $.R > $.a + 0.5,
    text: (T, $) => ($.shape === 'sphere'
      ? `Revolve a semicircular area of radius ${T.a} in a full turn about its flat edge to generate a sphere. Use Pappus–Guldinus to find the surface area and the volume.`
      : `Revolve a circle of radius ${T.a} in, whose centre is ${T.R} in from the axis, a full turn to generate a torus. Find its surface area and volume.`),
    parts: [
      num('S', ($) => $.S, 'in²', { label: 'surface area' }),
      num('V', ($) => $.V, 'in³', { label: 'volume' }),
    ],
    hints: [
      String.raw`$S = \theta\,\bar{r}\,L$ revolves a *curve*; $V = \theta\,\bar{r}\,A$ revolves an *area*. Mixing them up is the usual error.`,
      String.raw`$\bar{r}$ is the distance from the axis to the centroid of whatever you are revolving — for a semicircular area that is $4r/3\pi$, not $r$.`,
    ],
    steps: ($, f) => [
      String.raw`$S = \theta\bar{r}L = ${texNum($.S)}\ \text{in}^2$`,
      String.raw`$V = \theta\bar{r}A = ${texNum($.V)}\ \text{in}^3$`,
    ],
    cases: [kase('torus', { R: 5, a: 1, shape: 'torus' }, { S: 197.39, V: 98.696 })],
  }),
  problem({
    ...U4, id: 'ch10.moi-composite', ch: '10', src: 'Part 4 · 10.1–10.2', title: 'Moment of inertia of a composite', kind: 'numeric', level: 3, topics: ['moment-of-inertia'],
    vars: { b: range(2, 10, 1, 'in'), h: range(2, 12, 1, 'in'), t: range(1, 4, 1, 'in') },
    derive: ($) => {
      // A T-section: a flange on top of a web, taken about the centroidal x axis.
      const web = { A: $.t * $.h, x: 0, y: $.h / 2, ...rectI($.t, $.h) };
      const flange = { A: $.b * $.t, x: 0, y: $.h + $.t / 2, ...rectI($.b, $.t) };
      const c = composite([web, flange]);
      const about0 = compositeI([web, flange]);
      // Shift from the origin down to the centroid.
      const Ix = about0.Ix - c.A * c.y ** 2;
      return { A: c.A, ybar: c.y, Ix0: about0.Ix, Ix, k: radiusOfGyration(Ix, c.A) };
    },
    valid: ($) => $.b > $.t,
    text: (T) => `A T-section is built from a vertical web ${T.t} in wide and ${T.h} in tall, with a ${T.b} in × ${T.t} in flange laid across the top. Taking the origin at the bottom of the web, find the centroid height and the moment of inertia about the horizontal centroidal axis.`,
    parts: [
      num('ybar', ($) => $.ybar, 'in', { label: 'ȳ', abs: 0.005 }),
      num('Ix', ($) => $.Ix, 'in⁴', { label: String.raw`$\bar{I}_x$` }),
      num('k', ($) => $.k, 'in', { label: String.raw`$k_x$`, abs: 0.005 }),
    ],
    hints: [
      'Locate the centroid before any inertia calculation — the parallel-axis distances are measured from it.',
      String.raw`$I = \bar{I} + Ad^2$ for each piece, with $d$ from that piece's own centroid to the axis you want.`,
    ],
    steps: ($, f) => [
      String.raw`$\bar{y} = ${texNum($.ybar)}$ in`,
      String.raw`$\bar{I}_x = \sum(\bar{I}_i + A_i d_i^2) = ${texNum($.Ix)}\ \text{in}^4$`,
      String.raw`$k_x = \sqrt{\bar{I}_x/A} = ${texNum($.k)}$ in`,
    ],
    cases: [kase('hand', { b: 6, h: 8, t: 2 }, { ybar: 6.1429, Ix: 260.76, k: 3.0517 })],
  }),
  problem({
    ...U4, id: 'ch10.parallel-axis', ch: '10', title: 'When does the parallel-axis theorem apply?', kind: 'conceptual', topics: ['moment-of-inertia'],
    vars: {
      ask: choice(
        ['from', 'The parallel-axis theorem I = Ī + Ad² starts from which axis?'],
        ['min', 'For a given shape, the moment of inertia is smallest about'],
        ['units', 'The units of an area moment of inertia are'],
      ),
    },
    text: (T) => T.ask,
    parts: [
      mc('ans', [
        ['centroid', 'An axis through the centroid — Ī must be the centroidal value'],
        ['any', 'Any axis at all'],
        ['centroidal', 'The centroidal axis'],
        ['len4', 'Length to the fourth power'],
        ['len3', 'Length cubed'],
      ], ($) => ({ from: 'centroid', min: 'centroidal', units: 'len4' })[$.ask]),
    ],
    hints: [String.raw`$Ad^2$ is never negative, so moving away from the centroid can only increase $I$.`],
    steps: ($) => [
      $.ask === 'from'
        ? 'Ī has to be about the centroidal axis. Applying the theorem between two arbitrary parallel axes is the most common error in this chapter.'
        : $.ask === 'min'
          ? String.raw`Since $I = \bar{I} + Ad^2$ and $Ad^2 \ge 0$, the centroidal axis gives the minimum.`
          : String.raw`$I = \int y^2\,dA$ — that is length² times area, so length⁴ (in⁴ or m⁴).`,
    ],
    cases: [kase('from', { ask: 'from' }, { ans: 'centroid' }), kase('units', { ask: 'units' }, { ans: 'len4' })],
  }),
];
