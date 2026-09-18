/**
 * Problem bank for Statics (Hibbeler chapters 2–10).
 * Each bank module exports an array of templates; see kit.js and PROBLEMS.md.
 */
import ch2 from './bank/ch2.js';
import ch34 from './bank/ch34.js';
import ch56 from './bank/ch56.js';
import ch7910 from './bank/ch7910.js';

export const PROBLEMS = [...ch2, ...ch34, ...ch56, ...ch7910];

const byIdMap = new Map(PROBLEMS.map((p) => [p.id, p]));

export const problemById = (id) => byIdMap.get(id) || null;
export const problemsForExam = (examId) => PROBLEMS.filter((p) => p.exam === examId);
export const problemsForLab = (labId) => PROBLEMS.filter((p) => p.lab === labId);

/** Chapters in course order, for grouping in the UI. */
export const CHAPTER_ORDER = ['2', '3', '4', '5', '6', '7', '9', '10'];

export const CHAPTER_TITLES = {
  2: 'Force vectors',
  3: 'Particle equilibrium',
  4: 'Moments',
  5: 'Rigid-body equilibrium',
  6: 'Trusses, frames & machines',
  7: 'Internal loads',
  9: 'Centroids',
  10: 'Moments of inertia',
};
