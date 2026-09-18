import { EXAMS, LAB_META, examById } from '../data/catalog.js';

/**
 * Parse `#/e2/gauss`, `#/gauss`, or empty, plus an optional problem query:
 * `#/e2/field?p=e2.36a.collinear&s=7` opens that problem with seed 7.
 */
export function parseHash() {
  const full = (typeof location === 'undefined' ? '' : location.hash).replace(/^#\/?/, '');
  const [raw, query = ''] = full.split('?');
  const params = new URLSearchParams(query);
  const problemId = params.get('p') || null;
  const s = Number(params.get('s'));
  const problem = { problemId, seed: Number.isFinite(s) ? Math.max(0, Math.floor(s)) : 0 };

  const [a, b] = raw.split('/').filter(Boolean);
  if (!a) return { examId: 'u1', labId: 'vectors', ...problem };
  if (LAB_META[a] && !b) {
    const meta = LAB_META[a];
    return { examId: meta.exam, labId: a, ...problem };
  }
  const exam = examById(a);
  if (b && exam.labs.includes(b)) return { examId: exam.id, labId: b, ...problem };
  if (b && LAB_META[b]) return { examId: LAB_META[b].exam, labId: b, ...problem };
  return { examId: exam.id, labId: exam.labs[0] || null, ...problem };
}

export function problemQuery(problemId, seed) {
  return problemId ? `?p=${encodeURIComponent(problemId)}&s=${seed | 0}` : '';
}

/**
 * Each lab switch is a history entry so Back / Forward walk through labs.
 * `replace` is for boot, where we only normalize the URL (e.g. `#/` → `#/e2/gauss`).
 */
export function writeHash(examId, labId, { replace = false, query = '' } = {}) {
  const next = (labId ? `#/${examId}/${labId}` : `#/${examId}`) + query;
  if (location.hash === next) return;
  if (replace) history.replaceState(null, '', next);
  else history.pushState(null, '', next);
}

export function neighborExam(examId, dir) {
  const i = EXAMS.findIndex((e) => e.id === examId);
  const j = Math.max(0, Math.min(EXAMS.length - 1, i + dir));
  return EXAMS[j];
}
