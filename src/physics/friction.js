/**
 * Dry friction · Hibbeler Ch 8.
 *
 * Coulomb's model: at rest the friction force is whatever equilibrium needs, up to F_max = μs·N;
 * once sliding it is μk·N, opposing the motion. Every function here says which of those regimes
 * it is in, because "is it moving?" has to be answered before any friction force can be written.
 */

const DEG = Math.PI / 180;

/**
 * A block of weight W on a plane inclined at θ, pushed by P at φ above the slope (P along the slope
 * when φ = 0, up-slope positive). Returns the normal force, the friction that equilibrium would
 * need (positive = acting up the slope), the most static friction can supply, and the regime.
 */
export function inclineState({ W, theta, mus, muk, P = 0, phi = 0 }) {
  const t = theta * DEG;
  const p = phi * DEG;
  const N = W * Math.cos(t) - P * Math.sin(p);
  const need = W * Math.sin(t) - P * Math.cos(p); // friction up the slope that would hold it
  const Fmax = mus * Math.max(N, 0);
  if (N <= 0) return { N, need, Fmax: 0, F: 0, regime: 'lifts off', dir: 0, net: 0 };
  if (Math.abs(need) <= Fmax + 1e-12) {
    const impending = Math.abs(Math.abs(need) - Fmax) < 1e-9 * Math.max(1, Fmax);
    return { N, need, Fmax, F: need, regime: impending ? 'impending' : 'static', dir: 0, net: 0 };
  }
  // Sliding: down the slope if gravity wins (need > 0), up if P wins. Kinetic friction opposes it.
  const dir = need > 0 ? -1 : 1;
  const F = -dir * muk * N;
  return { N, need, Fmax, F, regime: dir < 0 ? 'slides down' : 'slides up', dir, net: -need + F };
}

/**
 * The band of P (at angle φ to the slope) that keeps the block at rest: below P_hold it slides
 * down, above P_push it starts up. P_hold is 0 when the block holds itself (θ below the angle of
 * repose). Closed form from the two impending-motion cases.
 */
export function inclineRange({ W, theta, mus, phi = 0 }) {
  const t = theta * DEG;
  const p = phi * DEG;
  const Ppush = (W * (Math.sin(t) + mus * Math.cos(t))) / (Math.cos(p) + mus * Math.sin(p));
  const down = (W * (Math.sin(t) - mus * Math.cos(t))) / (Math.cos(p) - mus * Math.sin(p));
  return { Ppush, Phold: Math.max(0, down), repose: Math.atan(mus) / DEG };
}

/**
 * A box of weight W, width b and height h on a floor, pushed horizontally with P at height hp.
 * It either slides (P reaches μs·W) or tips about its front corner (P·hp reaches W·b/2), whichever
 * comes first. `x` is how far the resultant normal force has moved from the centre toward that
 * corner — tipping is x reaching b/2.
 */
export function tipOrSlip({ W, b, hp, mus, P = 0 }) {
  const Pslip = mus * W;
  const Ptip = (W * b) / (2 * hp);
  const x = (P * hp) / W;
  const first = Pslip < Ptip ? 'slip' : Ptip < Pslip ? 'tip' : 'both';
  const Pcrit = Math.min(Pslip, Ptip);
  const state = P < Pcrit - 1e-12 ? 'rest' : first;
  return { Pslip, Ptip, first, Pcrit, x, state, F: Math.min(P, Pslip), N: W };
}

/** Flat belt or rope over a fixed drum, on the verge of slipping: T2 = T1·e^(μβ), β in degrees. */
export const beltTension = (T1, mu, betaDeg) => T1 * Math.exp(mu * betaDeg * DEG);
