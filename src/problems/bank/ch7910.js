/** Ch 7 · internal loads, Ch 9 · centroids, Ch 10 · moments of inertia. From the Part 4 deck. */
import { problem, kase, range, choice, num, mc, sym, texNum } from '../kit.js';
import { internalAt } from '../../physics/sections.js';
import { composite, rect, tri, semi, quarter, compositeI, rectI, triI, parallelAxis, radiusOfGyration, pappusArea, pappusVolume } from '../../physics/sections.js';

const U4 = { exam: 'u4' };

export default [
  problem({
    ...U4, id: 'ch7.internal-point', ch: '7', lab: 'beam', src: 'Part 4 · 7.1–7.3', title: 'Internal N, V and M at a cut', kind: 'numeric', level: 2, topics: ['internal-loads'],
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
    sim: {
      scenario: 'point',
      setup: (s, $) => void Object.assign(s, { L: $.L, P: $.P, a: $.a, dist: 'none', w: 0, M0: 0, c: $.c }),
      read: (c) => ({ N: c.beam.at.N, V: c.beam.at.V, M: c.beam.at.M, '@M from ∫V dx': [c.beam.MfromV, c.beam.at.M] }),
    },
    cases: [kase('hand', { L: 12, P: 600, a: 4, c: 2 }, { N: 0, V: 400, M: 800 })],
  }),
  problem({
    ...U4, id: 'ch9.centroid-composite', ch: '9', lab: 'sections', src: 'Part 4 · 9.1–9.4', title: 'Centroid of a composite area', kind: 'numeric', level: 2, topics: ['centroids'],
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
    sim: {
      scenario: 'L',
      setup: (s, $) => void Object.assign(s, { p: [$.w1, $.h1, $.w2, $.h2] }),
      read: (c) => ({ A: c.sec.A, xbar: c.sec.xbar, ybar: c.sec.ybar }),
    },
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
    ...U4, id: 'ch10.moi-composite', ch: '10', lab: 'sections', src: 'Part 4 · 10.1–10.2', title: 'Moment of inertia of a composite', kind: 'numeric', level: 3, topics: ['moment-of-inertia'],
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
    sim: {
      scenario: 'T',
      setup: (s, $) => void Object.assign(s, { p: [$.b, $.h, $.t] }),
      read: (c) => ({ ybar: c.sec.ybar, Ix: c.sec.Ix, k: c.sec.kx, '@I base = Ī + Aȳ²': [c.sec.IxBase, c.sec.Ix + c.sec.A * c.sec.ybar ** 2] }),
    },
    cases: [kase('hand', { b: 6, h: 8, t: 2 }, { ybar: 6.1429, Ix: 260.76, k: 3.0517 })],
  }),
  problem({
    ...U4, id: 'ch10.parallel-axis', ch: '10', lab: 'sections', title: 'When does the parallel-axis theorem apply?', kind: 'conceptual', topics: ['moment-of-inertia'],
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
    sim: { scenario: 'T', read: () => ({}) },
    cases: [kase('from', { ask: 'from' }, { ans: 'centroid' }), kase('units', { ask: 'units' }, { ans: 'len4' })],
  }),
  problem({
    ...U4, id: 'ch7.udl-diagrams', ch: '7', lab: 'beam', src: 'Part 4 · 7.4–7.6', title: 'Shear and moment under a uniform load', kind: 'numeric', level: 2, topics: ['internal-loads', 'shear-moment'],
    vars: { L: range(4, 24, 1, 'ft'), w: range(20, 400, 10, 'lb/ft'), c: range(0.5, 23, 0.5, 'ft') },
    // Closed form from the free body of the left segment: V = wL/2 − wx, M = wLx/2 − wx²/2.
    derive: ($) => ({ V: ($.w * $.L) / 2 - $.w * $.c, M: ($.w * $.L * $.c) / 2 - ($.w * $.c ** 2) / 2, Mmax: ($.w * $.L ** 2) / 8 }),
    valid: ($) => $.c < $.L,
    text: (T) => `A ${T.L} ft simply supported beam carries a uniform load of ${T.w} lb/ft over its whole span. Find the shear and bending moment ${T.c} ft from the left support, and the largest bending moment in the beam.`,
    parts: [
      sym('M_sym', 'w*L*c/2 - w*c^2/2', { w: 'lb/ft', L: 'ft', c: 'ft' }, ($) => $.M, { unit: 'lb*ft', label: 'M at the cut as a formula (cut at c)' }),
      num('V', ($) => $.V, 'lb', { label: 'V at the cut', abs: 0.5 }),
      num('M', ($) => $.M, 'lb·ft', { label: 'M at the cut', abs: 0.5 }),
      num('Mmax', ($) => $.Mmax, 'lb·ft', { label: String.raw`$M_{max}$` }),
    ],
    hints: [
      String.raw`Each reaction is $wL/2$ by symmetry. Then cut at $x$ and keep the left segment: the load on it is $wx$ acting at $x/2$.`,
      String.raw`$M$ peaks where $V = 0$ — at midspan here — giving the result worth memorising: $wL^2/8$.`,
    ],
    steps: ($, f) => [
      String.raw`$V(x) = \tfrac{wL}{2} - wx = ${texNum($.V)}$ lb`,
      String.raw`$M(x) = \tfrac{wL}{2}x - \tfrac{w x^2}{2} = ${texNum($.M)}\ \text{lb}\cdot\text{ft}$`,
      String.raw`$M_{max} = wL^2/8 = ${texNum($.Mmax)}\ \text{lb}\cdot\text{ft}$`,
    ],
    sim: {
      scenario: 'udl',
      setup: (s, $) => void Object.assign(s, { L: $.L, P: 0, dist: 'uniform', w: $.w, M0: 0, c: $.c }),
      read: (c) => ({ V: c.beam.at.V, M: c.beam.at.M, Mmax: c.beam.Mmax.M }),
    },
    cases: [kase('hand', { L: 10, w: 120, c: 3 }, { V: 240, M: 1260, Mmax: 1500 })],
  }),
  problem({
    ...U4, id: 'ch9.plate-hole', ch: '9', lab: 'sections', src: 'Part 4 · 9.5–9.8', title: 'Centroid of a plate with a hole', kind: 'numeric', level: 2, topics: ['centroids', 'holes'],
    vars: { w: range(4, 14, 1, 'in'), h: range(3, 10, 1, 'in'), r: range(0.5, 2, 0.25, 'in'), xh: range(1, 12, 0.5, 'in') },
    derive: ($) => {
      const Ap = $.w * $.h;
      const Ah = Math.PI * $.r ** 2;
      return { A: Ap - Ah, xbar: (Ap * ($.w / 2) - Ah * $.xh) / (Ap - Ah) };
    },
    valid: ($) => $.r < $.h / 2 - 0.2 && $.xh - $.r > 0.2 && $.xh + $.r < $.w - 0.2,
    text: (T) => `A ${T.w} in × ${T.h} in rectangular plate, lower-left corner at the origin, has a circular hole of radius ${T.r} in drilled at (${T.xh}, ${Number(T.h) / 2}) in. Find the net area and the x coordinate of the centroid.`,
    parts: [
      num('A', ($) => $.A, 'in²', { label: 'net area' }),
      num('xbar', ($) => $.xbar, 'in', { label: 'x̄', abs: 0.005 }),
    ],
    hints: [String.raw`Two rows: the solid plate, and the hole with negative area. $\bar{x} = (A_1\tilde{x}_1 - A_2\tilde{x}_2)/(A_1 - A_2)$.`],
    steps: ($, f) => [
      String.raw`$A = wh - \pi r^2 = ${texNum($.A)}\ \text{in}^2$`,
      String.raw`$\bar{x} = ${texNum($.xbar)}$ in — pushed away from the hole`,
    ],
    sim: {
      scenario: 'hole',
      setup: (s, $) => void Object.assign(s, { p: [$.w, $.h, $.r, $.xh] }),
      read: (c) => ({ A: c.sec.A, xbar: c.sec.xbar }),
    },
    cases: [kase('hand', { w: 8, h: 4, r: 1, xh: 6 }, { A: 28.858, xbar: 3.7823 })],
  }),
  problem({
    ...U4, id: 'ch10.ibeam', ch: '10', lab: 'sections', src: 'Part 4 · 10.3', title: 'I-beam about its centroidal axis', kind: 'numeric', level: 2, topics: ['moment-of-inertia'],
    vars: { b: range(3, 12, 0.5, 'in'), d: range(6, 16, 1, 'in'), tf: range(0.5, 2, 0.25, 'in'), tw: range(0.25, 1.5, 0.25, 'in') },
    // Independent of the parts table: the outer rectangle minus the two empty strips beside the web.
    derive: ($) => ({ Ix: ($.b * $.d ** 3) / 12 - (($.b - $.tw) * ($.d - 2 * $.tf) ** 3) / 12, A: 2 * $.b * $.tf + $.tw * ($.d - 2 * $.tf) }),
    valid: ($) => $.tw < $.b - 0.5 && 2 * $.tf < $.d - 2,
    text: (T) => `A symmetric I-beam is ${T.d} in deep with ${T.b} in × ${T.tf} in flanges and a web ${T.tw} in thick. Find its area and the moment of inertia about the horizontal centroidal axis.`,
    parts: [
      num('A', ($) => $.A, 'in²', { label: 'A' }),
      num('Ix', ($) => $.Ix, 'in⁴', { label: String.raw`$\bar{I}_x$` }),
    ],
    hints: [
      'The section is symmetric, so the centroid is at mid-depth — no table needed for ȳ.',
      String.raw`Quickest route: the full $b \times d$ rectangle minus the two empty rectangles beside the web, both centred on the same axis, so no $Ad^2$ at all.`,
    ],
    steps: ($, f) => [
      String.raw`$\bar{I}_x = \frac{bd^3}{12} - \frac{(b - t_w)(d - 2t_f)^3}{12} = ${texNum($.Ix)}\ \text{in}^4$`,
    ],
    sim: {
      scenario: 'I',
      setup: (s, $) => void Object.assign(s, { p: [$.b, $.d, $.tf, $.tw] }),
      read: (c) => ({ A: c.sec.A, Ix: c.sec.Ix }),
    },
    cases: [kase('hand', { b: 6, d: 10, tf: 1, tw: 0.75 }, { A: 18, Ix: 276 })],
  }),
];
