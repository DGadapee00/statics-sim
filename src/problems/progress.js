/**
 * Practice progress: per-problem history, spaced review, and picking problem sets.
 * No DOM. Storage is injected (localStorage in the browser, a Map-backed stub in tests),
 * and every read/write is guarded because private windows can refuse storage.
 *
 * Spaced review uses Leitner boxes 0–5. A clean solve (right on the first check, no hints,
 * no peeking) moves a problem up a box; needing help keeps it low; missing it or opening
 * the solution sends it back to box 0. A problem is due again after INTERVAL_DAYS[box].
 */
import { CHAPTER_ORDER } from './index.js';
import { rng } from './engine.js';

export const STORE_KEY = 'flux.problems.v1';
export const EXAM_KEY = 'flux.exam.v1';
export const INTERVAL_DAYS = [10 / 1440, 1, 3, 7, 16, 35];
export const MASTERED_BOX = 3;
const DAY = 864e5;

export function browserStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

function readJSON(storage, key) {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJSON(storage, key, value) {
  try {
    if (value == null) storage?.removeItem(key);
    else storage?.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: progress just isn't kept */
  }
}

export function createProgress(storage = browserStorage()) {
  let data = readJSON(storage, STORE_KEY);
  if (!data || data.v !== 1 || typeof data.items !== 'object') data = { v: 1, items: {} };

  const get = (id) => data.items[id] || null;

  /**
   * Record one finished attempt.
   * correct: every part right in the end · clean: right on the first check with no help.
   */
  function record(id, { correct, clean = false, hints = 0, peeked = false, revealed = false, seed = 0, now = Date.now() }) {
    const it = data.items[id] || { attempts: 0, solved: 0, clean: 0, peeks: 0, hints: 0, box: 0, due: 0, last: 0, lastSeed: 0 };
    it.attempts++;
    if (correct) it.solved++;
    if (clean) it.clean++;
    if (peeked) it.peeks++;
    it.hints += hints;
    if (clean) it.box = Math.min(5, it.box + 1);
    else if (correct && !revealed) it.box = Math.max(1, it.box - 1);
    else it.box = 0;
    it.due = now + INTERVAL_DAYS[it.box] * DAY;
    it.last = now;
    it.lastSeed = seed;
    it.lastOk = !!correct && !revealed;
    data.items[id] = it;
    writeJSON(storage, STORE_KEY, data);
    return it;
  }

  /** 'new' | 'mastered' | 'learning' | 'missed' — for the list icons. */
  function status(id, now = Date.now()) {
    const it = get(id);
    if (!it) return 'new';
    if (!it.lastOk) return 'missed';
    if (it.due <= now) return 'due';
    return it.box >= MASTERED_BOX ? 'mastered' : 'learning';
  }

  /** Fraction 0–1: mean box / 5 over the given ids (unseen problems count as 0). */
  function mastery(ids) {
    if (!ids.length) return 0;
    return ids.reduce((acc, id) => acc + (get(id)?.box || 0), 0) / (5 * ids.length);
  }

  function counts(ids, now = Date.now()) {
    let seen = 0;
    let mastered = 0;
    let due = 0;
    for (const id of ids) {
      const it = get(id);
      if (!it) continue;
      seen++;
      if (it.box >= MASTERED_BOX) mastered++;
      if (it.due <= now) due++;
    }
    return { total: ids.length, seen, mastered, due };
  }

  /** Seen problems whose review time has come, most overdue first. */
  function dueIds(ids, now = Date.now()) {
    return ids.filter((id) => get(id) && get(id).due <= now).sort((a, b) => get(a).due - get(b).due);
  }

  /** Seed for the next attempt: the worksheet numbers first, fresh numbers after that. */
  function nextSeed(id, rand = Math.random) {
    return get(id) ? 1 + Math.floor(rand() * 99999) : 0;
  }

  function reset() {
    data = { v: 1, items: {} };
    writeJSON(storage, STORE_KEY, data);
  }

  return {
    get,
    record,
    status,
    mastery,
    counts,
    dueIds,
    nextSeed,
    reset,
    loadExam: () => readJSON(storage, EXAM_KEY),
    saveExam: (exam) => writeJSON(storage, EXAM_KEY, exam),
    get data() {
      return data;
    },
  };
}

/**
 * Pick n templates spread across chapters, weakest first. Chapters are visited round-robin in
 * syllabus order so every chapter shows up before any repeats; inside a chapter the lowest
 * box goes first (unseen counts as lowest), ties broken at random. At most a quarter of the
 * set is conceptual so an exam set is mostly problems to work.
 */
export function pickSet(templates, progress, { n = 8, seed = Date.now(), maxConceptual = 0.25 } = {}) {
  const rand = rng(seed >>> 0);
  const byCh = new Map();
  for (const t of templates) {
    if (!byCh.has(t.ch)) byCh.set(t.ch, []);
    byCh.get(t.ch).push({ t, key: (progress.get(t.id)?.box ?? -1) + rand() * 0.9 });
  }
  const chapters = [...byCh.keys()].sort((a, b) => CHAPTER_ORDER.indexOf(a) - CHAPTER_ORDER.indexOf(b));
  for (const ch of chapters) byCh.get(ch).sort((a, b) => a.key - b.key);
  // Start the round-robin at a random chapter so short sets don't always favor the first chapters.
  const offset = Math.floor(rand() * chapters.length);
  const order = chapters.map((_, i) => chapters[(i + offset) % chapters.length]);
  const capConcept = Math.max(1, Math.floor(n * maxConceptual));
  const out = [];
  let concept = 0;
  let progressMade = true;
  while (out.length < n && progressMade) {
    progressMade = false;
    for (const ch of order) {
      if (out.length >= n) break;
      const list = byCh.get(ch);
      const i = list.findIndex(({ t }) => t.kind !== 'conceptual' || concept < capConcept);
      if (i < 0) continue;
      const [{ t }] = list.splice(i, 1);
      if (t.kind === 'conceptual') concept++;
      out.push(t);
      progressMade = true;
    }
  }
  // Present in syllabus order, like a printed exam.
  return out.sort((a, b) => CHAPTER_ORDER.indexOf(a.ch) - CHAPTER_ORDER.indexOf(b.ch));
}
