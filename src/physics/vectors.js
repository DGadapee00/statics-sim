/**
 * Cartesian vectors for statics · Hibbeler Ch 2.
 *
 * Plain {x, y, z} objects, no classes, so a problem template and a lab can pass the same thing
 * around. Angles are in degrees at the edges (that is how the problems are stated) and radians
 * inside.
 */

export const DEG = Math.PI / 180;
export const v = (x = 0, y = 0, z = 0) => ({ x, y, z });

export const add = (a, b) => v(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a, k) => v(a.x * k, a.y * k, a.z * k);
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const mag = (a) => Math.hypot(a.x, a.y, a.z);

export const cross = (a, b) =>
  v(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

/** Unit vector. Returns the zero vector for a zero-length input rather than NaNs. */
export function unit(a) {
  const m = mag(a);
  return m < 1e-12 ? v(0, 0, 0) : scale(a, 1 / m);
}

/** The position vector from A to B, and the unit vector along it — r_AB and u_AB. */
export const posVec = (A, B) => sub(B, A);
export const unitAB = (A, B) => unit(sub(B, A));

/**
 * A force of magnitude F directed from A toward B: the F = F·u form the problems ask for.
 */
export const forceAlong = (F, A, B) => scale(unitAB(A, B), F);

/**
 * Coordinate direction angles α, β, γ in degrees — the angles the vector makes with +x, +y, +z.
 * cos²α + cos²β + cos²γ = 1 always, which is the check the problems want you to run.
 */
export function directionAngles(a) {
  const m = mag(a);
  if (m < 1e-12) return { alpha: NaN, beta: NaN, gamma: NaN, m: 0 };
  const deg = (c) => (Math.acos(Math.max(-1, Math.min(1, c))) / DEG);
  return { alpha: deg(a.x / m), beta: deg(a.y / m), gamma: deg(a.z / m), m };
}

/** Build a vector from its magnitude and two coordinate direction angles (γ follows). */
export function fromAngles(F, alphaDeg, betaDeg, gammaSign = 1) {
  const ca = Math.cos(alphaDeg * DEG);
  const cb = Math.cos(betaDeg * DEG);
  const cg2 = 1 - ca * ca - cb * cb;
  const cg = Math.sign(gammaSign) * Math.sqrt(Math.max(0, cg2));
  return v(F * ca, F * cb, F * cg);
}

/** 2D force from a magnitude and an angle measured counterclockwise from +x. */
export const fromAngle2D = (F, thetaDeg) => v(F * Math.cos(thetaDeg * DEG), F * Math.sin(thetaDeg * DEG), 0);

/** Angle of a 2D vector from +x, in degrees, wrapped to [0, 360). */
export const angle2D = (a) => ((Math.atan2(a.y, a.x) / DEG) + 360) % 360;

/** The angle between two vectors, from the dot product. Degrees. */
export function angleBetween(a, b) {
  const d = mag(a) * mag(b);
  if (d < 1e-12) return NaN;
  return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / d))) / DEG;
}

/** Component of a along the direction of b (a scalar), and the vector projection. */
export const projMag = (a, b) => dot(a, unit(b));
export const proj = (a, b) => scale(unit(b), projMag(a, b));

/** The component of a perpendicular to b. */
export const perp = (a, b) => sub(a, proj(a, b));

/** Sum of any number of vectors — the resultant. */
export const resultant = (...list) => list.reduce((s, f) => add(s, f), v(0, 0, 0));

/**
 * Parallelogram law: two forces at a known angle between them.
 * Returns the resultant magnitude and the angle it makes with the first force (degrees).
 */
export function parallelogram(F1, F2, betweenDeg) {
  // The triangle's interior angle is the supplement of the angle between the two forces.
  const R = Math.sqrt(F1 ** 2 + F2 ** 2 + 2 * F1 * F2 * Math.cos(betweenDeg * DEG));
  const sinPhi = (F2 * Math.sin(betweenDeg * DEG)) / (R || 1);
  return { R, phi: Math.asin(Math.max(-1, Math.min(1, sinPhi))) / DEG };
}

/** Law of cosines / sines helpers, used by the Ch 2 parallelogram problems. */
export const lawOfCosines = (a, b, Cdeg) => Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(Cdeg * DEG));
export const lawOfSines = (a, Adeg, Bdeg) => (a * Math.sin(Bdeg * DEG)) / Math.sin(Adeg * DEG);
