/** Ch 8 · dry friction. Not found in the extracted problem decks; written from the chapter's standard cases. */
import { problem, kase, range, choice, num, mc, texNum } from '../kit.js';

const U4 = { exam: 'u4' };
const DEG = Math.PI / 180;

export default [
  problem({
    ...U4, id: 'ch8.incline-band', ch: '8', lab: 'friction', title: 'The band of P that holds a block on a slope', kind: 'numeric', level: 2, topics: ['friction', 'impending-motion'],
    vars: { W: range(20, 400, 10, 'lb'), th: range(10, 60, 1, '°'), mus: range(0.1, 0.8, 0.05, '') },
    derive: ($) => {
      const s = Math.sin($.th * DEG);
      const c = Math.cos($.th * DEG);
      return { Ppush: $.W * (s + $.mus * c), Phold: Math.max(0, $.W * (s - $.mus * c)), holds: s <= $.mus * c };
    },
    text: (T) => `A ${T.W} lb block rests on a ${T.th}° slope with μs = ${T.mus}. A force P is applied parallel to the slope, pushing up it. Find the smallest P that starts the block moving up the slope, and the smallest P that keeps it from sliding down (zero if it holds by itself).`,
    parts: [
      num('Ppush', ($) => $.Ppush, 'lb', { label: 'P to start it up the slope' }),
      num('Phold', ($) => $.Phold, 'lb', { label: 'P to keep it from sliding down', abs: 0.05 }),
    ],
    hints: [
      'Two separate impending-motion problems. In each, friction is μsN — but it points the opposite way.',
      String.raw`About to move up: friction acts down the slope. About to slide down: friction acts up it. $N = W\cos\theta$ both times, since P is parallel to the slope.`,
    ],
    steps: ($, f) => [
      String.raw`$N = W\cos\theta$`,
      String.raw`Up: $P = W\sin\theta + \mu_s W\cos\theta = ${texNum($.Ppush)}$ lb`,
      $.holds
        ? String.raw`Down: $W\sin\theta \le \mu_s W\cos\theta$ — the slope is below the angle of repose, so it holds with $P = 0$.`
        : String.raw`Down: $P = W\sin\theta - \mu_s W\cos\theta = ${texNum($.Phold)}$ lb`,
    ],
    sim: {
      scenario: 'push',
      setup: (s, $) => void Object.assign(s, { W: $.W, theta: $.th, mus: $.mus, muk: $.mus * 0.8, phi: 0, P: 0 }),
      read: (c) => ({ Ppush: c.fr.Ppush, Phold: c.fr.Phold }),
    },
    cases: [kase('hand', { W: 100, th: 35, mus: 0.3 }, { Ppush: 81.93, Phold: 32.78 })],
  }),
  problem({
    ...U4, id: 'ch8.tip-or-slip', ch: '8', lab: 'friction', title: 'Tip or slip?', kind: 'numeric', level: 2, topics: ['friction', 'tipping'],
    vars: { W: range(50, 500, 10, 'lb'), b: range(0.5, 4, 0.25, 'ft'), hp: range(0.5, 6, 0.25, 'ft'), mus: range(0.15, 0.8, 0.05, '') },
    derive: ($) => {
      const Pslip = $.mus * $.W;
      const Ptip = ($.W * $.b) / (2 * $.hp);
      return { Pslip, Ptip, first: Ptip < Pslip ? 'tip' : 'slip', P: Math.min(Pslip, Ptip) };
    },
    valid: ($) => Math.abs($.Pslip - $.Ptip) > 0.03 * Math.min($.Pslip, $.Ptip),
    text: (T) => `A crate weighing ${T.W} lb is ${T.b} ft wide and tall enough that a horizontal push can be applied ${T.hp} ft above the floor. The coefficient of static friction is ${T.mus}. As the push grows from zero, does the crate tip or slip first, and at what push?`,
    parts: [
      mc('first', [['tip', 'It tips'], ['slip', 'It slips']], ($) => $.first, { label: 'first' }),
      num('P', ($) => $.P, 'lb', { label: 'push when it happens' }),
    ],
    hints: [
      String.raw`Work both cases. Slip: $P = \mu_s W$. Tip: the normal force has moved to the front corner, so $\sum M$ there gives $P\,h = W\,b/2$.`,
      'The one needing the smaller push happens first.',
    ],
    steps: ($, f) => [
      String.raw`Slip at $P = \mu_s W = ${texNum($.Pslip)}$ lb; tip at $P = \frac{Wb}{2h} = ${texNum($.Ptip)}$ lb`,
      String.raw`So it ${$.first === 'tip' ? 'tips' : 'slips'} first, at $P = ${texNum($.P)}$ lb.`,
    ],
    sim: {
      scenario: 'tip',
      setup: (s, $) => void Object.assign(s, { W: $.W, b: $.b, hp: $.hp, h: Math.max($.hp + 0.5, 2 * $.b), mus: $.mus, P: 0 }),
      read: (c) => ({ first: c.fr.first, P: c.fr.Pcrit }),
    },
    cases: [kase('hand', { W: 200, b: 2, hp: 3, mus: 0.35 }, { first: 'tip', P: 66.667 })],
  }),
  problem({
    ...U4, id: 'ch8.belt', ch: '8', lab: 'friction', title: 'Rope around a post', kind: 'numeric', topics: ['friction', 'belt'],
    vars: { T1: range(10, 200, 5, 'lb'), mu: range(0.1, 0.6, 0.05, ''), turns: choice([0.5, 'half a turn'], [1, 'one full turn'], [1.5, 'one and a half turns'], [2, 'two full turns']) },
    derive: ($) => ({ beta: 360 * $.turns, T2: $.T1 * Math.exp($.mu * 2 * Math.PI * $.turns) }),
    text: (T) => `A rope is wrapped ${T.turns} around a fixed post (μ = ${T.mu}). A person holds the free end with ${T.T1} lb. What is the largest pull on the other end the rope can resist without slipping?`,
    parts: [num('T2', ($) => $.T2, 'lb', { label: String.raw`$T_2$` })],
    hints: [String.raw`$T_2 = T_1 e^{\mu\beta}$, with β the total contact angle in radians — a full turn is 2π.`],
    steps: ($, f) => [String.raw`$\beta = ${texNum($.beta * DEG)}$ rad, $T_2 = T_1 e^{\mu\beta} = ${texNum($.T2)}$ lb`],
    sim: {
      scenario: 'belt',
      setup: (s, $) => void Object.assign(s, { T1: $.T1, mu: $.mu, beta: $.beta }),
      read: (c) => ({ T2: c.fr.T2 }),
    },
    cases: [kase('hand', { T1: 50, mu: 0.3, turns: 0.5 }, { T2: 128.31 })],
  }),
];
