/**
 * Practice panel: browse the problem bank, work a problem against the lab, review what's due,
 * and sit a timed practice exam.
 *
 * The loop it is built around:
 *   1. Opening a problem loads its setup into the lab, with the lab's numbers veiled.
 *   2. The student answers. Wrong parts get feedback (sign, power of ten, factor of 2) and can be retried.
 *   3. Once solved (or the solution is opened), the veil lifts and the lab checks the answers live.
 *   4. The result feeds spaced review (src/problems/progress.js).
 *
 * The panel takes the left column (where the equation panel lives). Main owns lab switching;
 * this module only calls api.openInLab(inst) and reads api.computed / api.slice().
 */
import { PROBLEMS, problemById, problemsForExam, CHAPTER_ORDER, CHAPTER_TITLES } from '../problems/index.js';
import { instance, render, grade, expected, sig, withinTol, compile, checkUnits } from '../problems/engine.js';
import { createProgress, pickSet, MASTERED_BOX, INTERVAL_DAYS } from '../problems/progress.js';
import { examById, LAB_META } from '../data/catalog.js';
import { mathProse } from './shared.js';

const EXAM_MINUTES = 50;
const EXAM_SIZE = 8;
const MIXED_SIZE = 5;

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** Bank prose: escaped, with `$…$` typeset — the same markup the lab panels use. */
const prose = (s) => mathProse(s);

const KIND_LABEL = { numeric: 'Numeric', conceptual: 'Concept', derivation: 'Derivation' };
const STATUS_LABEL = {
  new: 'Not tried yet',
  learning: 'Solved — review scheduled',
  due: 'Due for review',
  missed: 'Missed last time',
  mastered: 'Mastered',
};

function levelDots(n) {
  return `<span class="pb-level" title="Level ${n} of 3">${'●'.repeat(n)}${'○'.repeat(3 - n)}</span>`;
}

function fmtClock(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function fmtDays(days) {
  if (days < 1) return 'in a few minutes';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

/** What a numeric/choice value looks like to the student (display units, option labels). */
function showValue(part, rendered, si) {
  if (part.kind === 'numeric') return `${sig(si / part.scale)}${part.unit ? ` ${part.unit}` : ''}`;
  if (part.kind === 'choice') {
    const vals = [].concat(si);
    return vals.map((v) => rendered.options.find((o) => o.value === v)?.label ?? String(v)).join('; ');
  }
  return String(si);
}

const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
const ID_NAMES = {
  emf: 'ε', tau: 'τ', Phi: 'Φ', phi: 'φ', lam: 'λ', th: 'θ', mu: 'μ', sigma: 'σ', w: 'ω',
  Req: 'R_eq', Ceq: 'C_eq', KJ: 'K (J)', KeV: 'K (eV)', vd: 'v_d', dV: 'ΔV', dT: 'ΔT', Irms: 'I_rms', Vp: 'V_p',
  FL: 'F/L', pct: 'Loss (%)', kWh: 'Energy', cost: 'Cost', dir: 'Direction', type: 'Type', sign: 'Sign',
};
/** Part ids double as labels when a template gives none: "I1" → "I₁", "tau" → "τ". */
function prettyId(id) {
  if (ID_NAMES[id]) return ID_NAMES[id];
  const m = /^([A-Za-z]+?)([0-9]+)$/.exec(id);
  return m ? (ID_NAMES[m[1]] || m[1]) + [...m[2]].map((d) => SUB[d]).join('') : id;
}

function partLabel(part, rendered, count) {
  if (rendered.label) return rendered.label;
  if (count === 1) return part.kind === 'choice' ? 'Choose one' : 'Answer';
  return part.kind === 'choice' && part.id === 'ans' ? 'Choose one' : prettyId(part.id);
}

// ---------------------------------------------------------------------------------------------
// Veil: hide numbers the lab prints (in-scene labels) while a problem is unsolved.
// Givens drawn as colored V / R / B spans and charge labels stay; values and verdicts are masked.
const KEEP = '.charge-label, .axis-label, .circuit-sign';
const GIVEN = '.qV, .qR, .qB';
const TELLS = /\d|real image|virtual image|attract|repel|against the grey|final \(|intermediate \(|rays leave parallel|total internal/i;
const HARMLESS = /^[\s2FCVO′']*$/; // focal-point / center-of-curvature marks like "2F"
const INLINE = /^(I|SUB|SUP|BR|B|EM|SPAN)$/;

function veilNode(el) {
  if (el.matches(KEEP)) return;
  const text = el.textContent || '';
  const kids = [...el.children].filter((k) => !(INLINE.test(k.tagName) && !k.className));
  const looseTell = [...el.childNodes].some((n) => n.nodeType === 3 && TELLS.test(n.textContent) && !HARMLESS.test(n.textContent));
  if (looseTell || kids.length === 0) {
    el.classList.toggle('veiled', TELLS.test(text) && !HARMLESS.test(text));
    return;
  }
  el.classList.remove('veiled');
  for (const k of kids) {
    if (k.matches(GIVEN)) k.classList.remove('veiled');
    else veilNode(k);
  }
}

// ---------------------------------------------------------------------------------------------

export function createPractice(api) {
  const $ = (id) => document.getElementById(id);
  const panel = $('problems');
  const body = document.body;
  const progress = createProgress();

  // The header grows with the Practice row; park the left column just below it.
  const brand = $('brand');
  const placeColumns = () => document.documentElement.style.setProperty('--below-brand', `${Math.ceil(brand.getBoundingClientRect().bottom + 12)}px`);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(placeColumns).observe(brand);
  placeColumns();

  const st = {
    open: false,
    view: 'list', // 'list' | 'problem' | 'exam' | 'results'
    listExam: api.examId() || 'u1',
    filter: { kind: 'all', lab: false },
    cur: null, // the attempt on screen
    session: null, // { label, ids, i }
    exam: progress.loadExam(), // saved practice exam (may be finished or in progress)
    edited: false,
    token: 0,
    lastLabRefresh: 0,
    lastTick: 0,
  };
  if (st.exam && !Array.isArray(st.exam.items)) st.exam = null;

  // ------------------------------------------------------------------ panel state
  function setOpen(on) {
    st.open = on;
    panel.hidden = !on;
    body.classList.toggle('practice-open', on);
    $('btn-practice').setAttribute('aria-expanded', on ? 'true' : 'false');
    $('btn-practice').classList.toggle('active', on);
    syncBlind();
    updateBrand();
  }

  function examActive() {
    return !!(st.exam && !st.exam.done);
  }

  function inExamView() {
    return st.view === 'exam' && examActive();
  }

  /** Blind while an attempt is unsolved and not peeked, and for the whole of a practice exam. */
  function syncBlind() {
    const cur = st.cur;
    const blind = st.open && ((inExamView() && !!cur) || (!!cur && cur.mode === 'practice' && !cur.finished && !cur.peeked));
    body.classList.toggle('problem-blind', blind);
    api.setSceneBlind?.(blind);
  }

  function updateBrand() {
    const el = $('practice-stat');
    if (!el) return;
    if (examActive()) {
      el.textContent = `Practice exam · ${fmtClock(st.exam.endsAt - Date.now())} left`;
      return;
    }
    const ids = problemsForExam(api.examId()).map((p) => p.id);
    const c = progress.counts(ids);
    const due = progress.dueIds(PROBLEMS.map((p) => p.id)).length;
    el.textContent = `${ids.length} problems · ${c.mastered} mastered${due ? ` · ${due} due` : ''}`;
  }

  // ------------------------------------------------------------------ attempts
  function newAttempt(id, seed, mode) {
    const tpl = problemById(id);
    if (!tpl) return null;
    const inst = instance(tpl, seed);
    inst.seed = seed;
    return {
      id,
      seed,
      tpl,
      inst,
      mode, // 'practice' | 'exam' | 'review'
      view: render(inst),
      note: '',
      inputs: {},
      results: {},
      self: {}, // partId → { shown, ok }
      checks: 0,
      firstTry: null,
      hints: 0,
      peeked: false,
      revealed: false,
      finished: false,
      correct: false,
      recorded: null,
    };
  }

  async function loadAttempt(cur, { push = true } = {}) {
    const my = ++st.token;
    st.loading = true;
    st.cur = cur;
    st.edited = false;
    syncBlind();
    renderPanel();
    const note = await api.openInLab(cur.inst, { push, query: cur.mode !== 'exam' });
    if (my !== st.token) return;
    st.loading = false;
    cur.note = note;
    st.edited = false;
    syncBlind();
    renderPanel();
  }

  function openProblem(id, { seed, session, push = true } = {}) {
    const s = seed ?? progress.nextSeed(id);
    const cur = newAttempt(id, s, 'practice');
    if (!cur) return;
    st.session = session || null;
    st.view = 'problem';
    setOpen(true);
    loadAttempt(cur, { push });
  }

  function leaveProblem({ push = true } = {}) {
    st.cur = null;
    st.view = 'list';
    st.token++;
    api.clearQuery({ push });
    syncBlind();
    renderPanel();
  }

  function isDetached() {
    const cur = st.cur;
    if (!cur?.tpl.lab) return false;
    return st.edited || api.labId() !== cur.tpl.lab;
  }

  function readInputs(cur) {
    const form = panel.querySelector('.pb-parts');
    if (!form) return;
    cur.tpl.parts.forEach((part, i) => {
      if (part.kind === 'numeric' || part.kind === 'symbolic') {
        const el = form.querySelector(`[data-input="${i}"]`);
        if (el) cur.inputs[part.id] = el.value;
      } else if (part.kind === 'choice') {
        const picked = [...form.querySelectorAll(`[data-choice="${i}"]:checked`)].map((el) => Number(el.value));
        cur.inputs[part.id] = part.multi ? picked : picked.length ? picked[0] : null;
      }
    });
  }

  /** Student's input for a part in the grader's terms (option values rather than indices). */
  function gradedInput(cur, part) {
    const raw = cur.inputs[part.id];
    if (part.kind !== 'choice') return raw;
    const opts = part.options;
    if (part.multi) return (raw || []).map((i) => opts[i]?.value);
    return raw == null ? null : opts[raw]?.value;
  }

  function isEmpty(part, raw) {
    if (part.kind === 'choice') return part.multi ? !(raw || []).length : raw == null;
    return raw == null || String(raw).trim() === '';
  }

  function gradeAll(cur) {
    let answered = 0;
    let right = 0;
    let scored = 0;
    for (const part of cur.tpl.parts) {
      if (part.kind === 'self') continue;
      scored++;
      const raw = cur.inputs[part.id];
      if (isEmpty(part, raw)) {
        cur.results[part.id] = { empty: true, correct: false, feedback: '' };
        continue;
      }
      answered++;
      const r = grade(part, cur.inst.$, gradedInput(cur, part));
      cur.results[part.id] = r;
      if (r.correct) right++;
    }
    return { answered, right, scored };
  }

  function check() {
    const cur = st.cur;
    if (!cur || cur.finished) return;
    readInputs(cur);
    const { answered, right, scored } = gradeAll(cur);
    if (answered === 0 && scored > 0) {
      renderPanel();
      return;
    }
    cur.checks++;
    if (cur.firstTry === null && answered === scored) cur.firstTry = right === scored;
    else if (cur.firstTry === null && right < answered) cur.firstTry = false;
    maybeFinish();
    renderPanel({ focusWrong: !cur.finished });
    if (cur.finished) panel.querySelector('.pb-solution')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function selfParts(cur) {
    return cur.tpl.parts.filter((p) => p.kind === 'self');
  }

  function maybeFinish() {
    const cur = st.cur;
    const objectiveDone = cur.tpl.parts.every((p) => p.kind === 'self' || cur.results[p.id]?.correct);
    const selfDone = selfParts(cur).every((p) => cur.self[p.id]?.ok !== undefined);
    if (objectiveDone && selfDone) finish(selfParts(cur).every((p) => cur.self[p.id].ok));
  }

  function finish(correct) {
    const cur = st.cur;
    if (!cur || cur.finished) return;
    cur.finished = true;
    cur.correct = correct && !cur.revealed;
    if (cur.mode === 'practice') {
      const clean = cur.correct && cur.firstTry !== false && cur.hints === 0 && !cur.peeked;
      cur.recorded = progress.record(cur.id, { correct: cur.correct, clean, hints: cur.hints, peeked: cur.peeked, revealed: cur.revealed, seed: cur.seed });
      cur.clean = clean;
    }
    syncBlind();
    updateBrand();
  }

  function reveal() {
    const cur = st.cur;
    if (!cur) return;
    readInputs(cur);
    gradeAll(cur);
    cur.revealed = true;
    if (!cur.finished) finish(false);
    renderPanel();
  }

  function restoreSetup() {
    const cur = st.cur;
    if (!cur) return;
    loadAttempt(cur, { push: false });
  }

  // ------------------------------------------------------------------ sessions
  function listIds() {
    const tpls = filteredTemplates(st.listExam);
    return orderByChapter(tpls).map((t) => t.id);
  }

  function nextInSession() {
    const s = st.session;
    if (!s) return null;
    const i = s.ids.indexOf(st.cur?.id);
    return s.ids[i + 1] || null;
  }

  function startMixed() {
    const tpls = problemsForExam(st.listExam);
    const ids = pickSet(tpls, progress, { n: Math.min(MIXED_SIZE, tpls.length), maxConceptual: 0.4 }).map((t) => t.id);
    if (!ids.length) return;
    openProblem(ids[0], { session: { label: 'Mixed set', ids } });
  }

  function startReview() {
    const ids = progress.dueIds(PROBLEMS.map((p) => p.id));
    if (!ids.length) return;
    openProblem(ids[0], { session: { label: 'Review', ids } });
  }

  // ------------------------------------------------------------------ practice exam
  function startExam() {
    const examId = st.listExam;
    const tpls = problemsForExam(examId);
    const set = pickSet(tpls, progress, { n: Math.min(EXAM_SIZE, tpls.length) });
    const now = Date.now();
    st.exam = {
      examId,
      items: set.map((t) => ({ id: t.id, seed: 1 + Math.floor(Math.random() * 99999), inputs: {} })),
      i: 0,
      startedAt: now,
      endsAt: now + EXAM_MINUTES * 60e3,
      done: false,
    };
    progress.saveExam(st.exam);
    st.session = null;
    showExamItem(0);
  }

  function showExamItem(i) {
    const ex = st.exam;
    if (!ex) return;
    if (Date.now() >= ex.endsAt) return submitExam();
    saveExamInputs();
    ex.i = Math.max(0, Math.min(ex.items.length - 1, i));
    progress.saveExam(ex);
    const item = ex.items[ex.i];
    const cur = newAttempt(item.id, item.seed, 'exam');
    if (!cur) return;
    cur.inputs = { ...item.inputs };
    st.view = 'exam';
    setOpen(true);
    loadAttempt(cur, { push: false });
  }

  function saveExamInputs() {
    const ex = st.exam;
    const cur = st.cur;
    if (!ex || ex.done || !cur || cur.mode !== 'exam' || st.view !== 'exam') return;
    readInputs(cur);
    const item = ex.items.find((it) => it.id === cur.id && it.seed === cur.seed);
    if (item) item.inputs = { ...cur.inputs };
    progress.saveExam(ex);
  }

  function submitExam() {
    const ex = st.exam;
    if (!ex || ex.done) return;
    saveExamInputs();
    ex.done = true;
    ex.finishedAt = Math.min(Date.now(), ex.endsAt);
    for (const item of ex.items) {
      const cur = newAttempt(item.id, item.seed, 'review');
      if (!cur) continue;
      cur.inputs = { ...item.inputs };
      const { right, scored } = gradeAll(cur);
      item.right = right;
      item.scored = scored;
      const correct = scored > 0 && right === scored;
      progress.record(item.id, { correct, clean: correct, seed: item.seed });
    }
    progress.saveExam(ex);
    st.cur = null;
    st.token++;
    st.view = 'results';
    syncBlind();
    updateBrand();
    renderPanel();
  }

  function reviewExamItem(i) {
    const ex = st.exam;
    const item = ex?.items[i];
    if (!item) return;
    const cur = newAttempt(item.id, item.seed, 'review');
    cur.inputs = { ...item.inputs };
    gradeAll(cur);
    cur.revealed = true;
    cur.finished = true;
    cur.correct = item.scored > 0 && item.right === item.scored;
    st.view = 'problem';
    st.session = { label: 'Exam results', ids: ex.items.map((it) => it.id), exam: true };
    setOpen(true);
    loadAttempt(cur, { push: false });
  }

  // ------------------------------------------------------------------ list helpers
  function filteredTemplates(examId) {
    let tpls = problemsForExam(examId);
    if (st.filter.kind !== 'all') tpls = tpls.filter((t) => t.kind === st.filter.kind);
    if (st.filter.lab) tpls = tpls.filter((t) => t.lab === api.labId());
    return tpls;
  }

  function orderByChapter(tpls) {
    return [...tpls].sort((a, b) => CHAPTER_ORDER.indexOf(a.ch) - CHAPTER_ORDER.indexOf(b.ch));
  }

  // ------------------------------------------------------------------ rendering
  function renderPanel(opts = {}) {
    if (!st.open) return;
    const scroll = panel.scrollTop;
    const sameView = panel.dataset.view === st.view && panel.dataset.key === (st.cur ? `${st.cur.id}:${st.cur.seed}` : '');
    if (st.view === 'list') panel.innerHTML = listHTML();
    else if (st.view === 'results') panel.innerHTML = resultsHTML();
    else if (st.cur) panel.innerHTML = problemHTML(st.cur);
    else panel.innerHTML = listHTML();
    panel.dataset.view = st.view;
    panel.dataset.key = st.cur ? `${st.cur.id}:${st.cur.seed}` : '';
    panel.scrollTop = sameView ? scroll : 0;
    refreshLabChecks(true);
    if (opts.focusWrong) {
      const bad = panel.querySelector('.pb-part.bad .pb-input, .pb-part.empty .pb-input');
      bad?.focus();
    }
  }

  function listHTML() {
    const exam = examById(st.listExam);
    const all = problemsForExam(exam.id);
    const ids = all.map((t) => t.id);
    const c = progress.counts(ids);
    const pct = Math.round(progress.mastery(ids) * 100);
    const due = progress.dueIds(PROBLEMS.map((p) => p.id)).length;
    const labId = api.labId();
    const labHere = labId && all.some((t) => t.lab === labId);
    const tpls = orderByChapter(filteredTemplates(exam.id));

    const ex = st.exam;
    let examBtn;
    if (ex && !ex.done) {
      examBtn = `<button type="button" class="btn accent" data-act="exam-resume">Resume practice exam · ${fmtClock(ex.endsAt - Date.now())} left</button>`;
    } else {
      examBtn = `<button type="button" class="btn accent" data-act="exam-start">Practice exam · ${Math.min(EXAM_SIZE, all.length)} problems · ${EXAM_MINUTES} min</button>`;
    }
    const lastResults = ex && ex.done && ex.examId === exam.id ? `<button type="button" class="linkish" data-act="exam-results">Last exam results</button>` : '';

    const chip = (key, value, label) =>
      `<button type="button" class="pb-chip${st.filter[key] === value ? ' on' : ''}" data-filter="${key}:${value}">${label}</button>`;

    const groups = [];
    for (const ch of CHAPTER_ORDER) {
      const inCh = tpls.filter((t) => t.ch === ch);
      if (!inCh.length) continue;
      const chIds = all.filter((t) => t.ch === ch).map((t) => t.id);
      const cc = progress.counts(chIds);
      const cm = Math.round(progress.mastery(chIds) * 100);
      groups.push(`<section class="pb-ch">
        <div class="pb-ch-head">
          <span class="pb-ch-name">Ch ${esc(ch)} · ${esc(CHAPTER_TITLES[ch] || '')}</span>
          <span class="pb-ch-meter" title="${cm}% mastery"><i style="width:${cm}%"></i></span>
          <span class="pb-ch-count">${cc.mastered}/${cc.total}</span>
        </div>
        ${inCh
          .map((t) => {
            const s = progress.status(t.id);
            const labTitle = t.lab ? LAB_META[t.lab]?.title : '';
            const here = t.lab && t.lab === labId;
            return `<button type="button" class="pb-item" data-open="${esc(t.id)}">
              <span class="pb-dot s-${s}" title="${STATUS_LABEL[s]}"></span>
              <span class="pb-item-title">${esc(t.title)}</span>
              <span class="pb-item-meta">${levelDots(t.level)}${labTitle ? `<span class="pb-lab-badge${here ? ' here' : ''}">${esc(labTitle)}</span>` : ''}</span>
            </button>`;
          })
          .join('')}
      </section>`);
    }

    return `<div class="pb-head">
        <div>
          <div class="pb-kicker">Practice · ${exam.id === 'wave' ? 'Final exam' : `Exam ${exam.n}`} · Ch ${esc(exam.chapters)}</div>
          <h2 class="pb-h">${esc(exam.title)}</h2>
        </div>
        <button type="button" class="pb-x" data-act="close" title="Back to the lab (P)" aria-label="Close practice">×</button>
      </div>
      <div class="pb-meter" title="Mastery: a problem counts once you've solved it cleanly on ${MASTERED_BOX} spaced reviews">
        <div class="pb-meter-bar"><i style="width:${pct}%"></i></div>
        <div class="pb-meter-text"><span>${c.mastered} of ${c.total} mastered</span><span>${c.seen} tried</span></div>
      </div>
      <div class="pb-actions">
        ${examBtn}
        <div class="pb-row">
          <button type="button" class="btn" data-act="mixed">Mixed set · ${Math.min(MIXED_SIZE, all.length)}</button>
          <button type="button" class="btn${due ? ' due' : ''}" data-act="review" ${due ? '' : 'disabled'} title="Problems from any exam whose review date has come">Review due · ${due}</button>
        </div>
        ${lastResults}
      </div>
      <div class="pb-filters">
        ${chip('kind', 'all', 'All')}${chip('kind', 'numeric', 'Numeric')}${chip('kind', 'conceptual', 'Concept')}${chip('kind', 'derivation', 'Derivation')}
        ${labHere ? `<button type="button" class="pb-chip${st.filter.lab ? ' on' : ''}" data-filter="lab:toggle">${esc(LAB_META[labId].title)} lab only</button>` : ''}
      </div>
      <div class="pb-list">${groups.join('') || '<p class="pb-empty">No problems match these filters.</p>'}</div>
      <p class="pb-foot">Your first try uses the worksheet's numbers when there is one; after that the numbers change every time. Progress stays in this browser. <button type="button" class="linkish" data-act="reset-progress">Reset progress</button></p>`;
  }

  /**
   * What to show under a symbolic input: a parse error, or the units the expression comes out in.
   * The units line is the check by hand — write the answer in symbols, see where it lands — run
   * live on what is in the box.
   */
  function parseMessage(part, value) {
    if (part.kind !== 'symbolic' || !String(value ?? '').trim()) return { cls: '', html: '' };
    try {
      compile(value, part.vars, part.alias);
    } catch (err) {
      return { cls: 'bad', html: esc(err.message) };
    }
    const u = checkUnits(value, part);
    if (!u) return { cls: '', html: '' };
    return u.ok
      ? { cls: 'ok', html: `units: ${esc(u.text)} ✓` }
      : { cls: 'bad', html: u.want ? `units: ${esc(u.text)} — this one should come out in ${esc(u.want)}` : esc(u.text) };
  }

  /**
   * Whether an input is held until the formula above it is right. Writing the expression first is
   * how the work earns partial credit on an exam, and it keeps a number from being guessed into
   * place. An exam attempt never locks — there is no feedback to unlock it.
   */
  function pendingSymbol(cur, i) {
    if (cur.mode === 'exam' || cur.finished || cur.revealed) return null;
    for (let j = 0; j < i; j++) {
      const p = cur.tpl.parts[j];
      if (p.kind !== 'symbolic') continue;
      if (!cur.results[p.id]?.correct) return p;
    }
    return null;
  }

  function partHTML(cur, part, i) {
    const r = cur.view.parts[i];
    const exam = cur.mode === 'exam';
    const locked = cur.finished;
    const res = exam ? null : cur.results[part.id];
    const state = !res ? '' : res.empty ? ' empty' : res.correct ? ' ok' : ' bad';
    const label = prose(partLabel(part, r, cur.tpl.parts.length));
    const review = cur.mode === 'review';
    const fb = !res ? '' : res.empty ? (review ? 'No answer given.' : 'Answer this part.') : res.correct ? '' : res.feedback || (review || cur.finished ? 'Incorrect.' : 'Not yet — try again.');
    const mark = !res || res.empty ? '' : res.correct ? '✓' : '✗';
    const labSlot = `<div class="pb-labval" data-lab-part="${esc(part.id)}"></div>`;

    if (part.kind === 'numeric' || part.kind === 'symbolic') {
      const sym = part.kind === 'symbolic';
      const val = cur.inputs[part.id] ?? '';
      const held = sym ? null : pendingSymbol(cur, i);
      const help = sym
        ? `<div class="pb-symhelp">Symbols: ${part.vars.map(esc).join(', ')} · constants k, eps0, mu0, pi, c, g · e.g. <code>2*k*lam/R</code>, <code>sqrt(x^2 + d^2)</code></div>`
        : '';
      const msg = parseMessage(part, val);
      return `<div class="pb-part${state}${held ? ' held' : ''}" data-part="${esc(part.id)}">
        <label class="pb-label" for="pb-in-${i}">${label}</label>
        <div class="pb-field">
          <input id="pb-in-${i}" class="pb-input${sym ? ' sym' : ''}" data-input="${i}" type="text" spellcheck="false" autocomplete="off"
            ${sym ? '' : 'inputmode="decimal"'} value="${esc(val)}" ${locked ? 'readonly' : ''} ${held ? 'disabled' : ''} placeholder="${sym ? 'formula' : 'e.g. 2.5e-6'}" />
          ${part.unit ? `<span class="pb-unit">${esc(part.unit)}</span>` : ''}
          <span class="pb-mark">${mark}</span>
        </div>
        ${help}
        ${held ? '<div class="pb-held">Write the formula above first — then put the numbers in.</div>' : ''}
        <div class="pb-parse ${msg.cls}" data-parse="${i}">${msg.html}</div>
        <div class="pb-fb">${esc(fb)}</div>
        ${cur.revealed || (cur.finished && !res?.correct) ? `<div class="pb-want">Answer: ${esc(sym ? part.expr : showValue(part, r, part.get(cur.inst.$)))}</div>` : ''}
        ${labSlot}
      </div>`;
    }
    if (part.kind === 'choice') {
      const type = part.multi ? 'checkbox' : 'radio';
      const picked = [].concat(cur.inputs[part.id] ?? []);
      const want = [].concat(expected(part, cur.inst.$));
      const opts = r.options
        .map((o, oi) => {
          const on = picked.includes(oi);
          const showKey = cur.revealed || (cur.finished && cur.mode !== 'exam');
          const cls = showKey && want.includes(o.value) ? ' key' : showKey && on ? ' wrong' : '';
          return `<label class="pb-opt${cls}"><input type="${type}" name="pb-c-${i}" data-choice="${i}" value="${oi}" ${on ? 'checked' : ''} ${locked ? 'disabled' : ''} /><span>${prose(o.label)}</span></label>`;
        })
        .join('');
      return `<fieldset class="pb-part choice${state}" data-part="${esc(part.id)}">
        <legend class="pb-label">${label}${part.multi ? ' <span class="pb-dim">(select all that apply)</span>' : ''} <span class="pb-mark">${mark}</span></legend>
        ${opts}
        <div class="pb-fb">${esc(fb)}</div>
        ${labSlot}
      </fieldset>`;
    }
    // self-check
    const s = cur.self[part.id] || {};
    if (exam) {
      return `<div class="pb-part self"><div class="pb-label">${prose(part.label)}</div><p class="pb-dim">Work this one on paper; you'll compare it with the rubric after the exam.</p></div>`;
    }
    let inner;
    if (!s.shown && !cur.revealed) {
      inner = `<p class="pb-dim">Sketch or write it on paper first.</p><button type="button" class="btn ghost" data-self-show="${esc(part.id)}">Compare with the rubric</button>`;
    } else {
      const verdict =
        s.ok === undefined
          ? cur.finished
            ? ''
            : `<div class="pb-row"><button type="button" class="btn" data-self="${esc(part.id)}:1">I had this</button><button type="button" class="btn ghost" data-self="${esc(part.id)}:0">I missed something</button></div>`
          : `<div class="pb-fb ${s.ok ? 'good' : ''}">${s.ok ? 'Marked as matching the rubric.' : 'Marked as missing something — read the rubric again.'}</div>`;
      inner = `<div class="pb-rubric">${prose(part.rubric)}</div>${verdict}`;
    }
    return `<div class="pb-part self" data-part="${esc(part.id)}"><div class="pb-label">${prose(part.label)}</div>${inner}</div>`;
  }

  function bannerHTML(cur) {
    if (cur.mode === 'exam') return '';
    if (!cur.tpl.lab) return '';
    const labTitle = LAB_META[cur.tpl.lab]?.title || cur.tpl.lab;
    if (api.labId() !== cur.tpl.lab) {
      return `<div class="pb-banner warn"><span>The ${esc(labTitle)} lab for this problem isn't on screen.</span><button type="button" class="linkish" data-act="restore">Show it</button></div>`;
    }
    if (st.edited) {
      return `<div class="pb-banner warn"><span>You changed the setup, so the lab no longer matches this problem.</span><button type="button" class="linkish" data-act="restore">Reset to the problem</button></div>`;
    }
    if (!cur.finished && !cur.peeked) {
      return `<div class="pb-banner"><span>The ${esc(labTitle)} lab shows this setup. Its numbers are hidden until you solve it.</span><button type="button" class="linkish" data-act="peek" title="Counts as a peek: this attempt won't count as a clean solve">Peek</button></div>`;
    }
    if (cur.tpl.sim?.read) {
      return `<div class="pb-banner good"><span>The lab is live: its numbers are shown next to your answers. Change the setup to explore.</span></div>`;
    }
    return `<div class="pb-banner quiet"><span>The lab is live. Change the setup to explore what-ifs.</span></div>`;
  }

  function solutionHTML(cur) {
    if (!(cur.finished || cur.revealed) || cur.mode === 'exam') return '';
    const tpl = cur.tpl;
    const steps = cur.view.steps.map((s) => `<li>${prose(s)}</li>`).join('');
    let verdict = '';
    if (cur.mode === 'review') {
      verdict = cur.correct ? 'You got this one on the exam.' : 'Here is the worked solution.';
    } else if (cur.correct && cur.clean) {
      const days = INTERVAL_DAYS[cur.recorded?.box ?? 0];
      verdict = `Right on the first try. Next review ${fmtDays(days)}.`;
    } else if (cur.correct) {
      verdict = 'Solved. It will come back for review soon, so you can do it clean.';
    } else {
      verdict = 'Study the steps, then try it again with new numbers.';
    }
    const kase = cur.seed === 0 ? tpl.cases[0] : null;
    const key = kase?.key ? `<p class="pb-key">Worksheet key (${esc(kase.src)}): ${esc(kase.key)}${kase.note ? `<br><span class="pb-dim">${esc(kase.note)}</span>` : ''}</p>` : '';
    const nextId = nextInSession();
    const exams = st.session?.exam;
    const nextBtn = exams
      ? `<button type="button" class="btn" data-act="exam-results">Back to results</button>`
      : nextId
        ? `<button type="button" class="btn accent" data-act="next">Next in ${esc(st.session.label.toLowerCase())} →</button>`
        : `<button type="button" class="btn accent" data-act="list">More problems</button>`;
    return `<section class="pb-solution">
      <div class="pb-verdict ${cur.correct ? 'good' : ''}">${esc(verdict)}</div>
      <h3>Solution</h3>
      <ol class="pb-steps">${steps}</ol>
      ${key}
      <div class="pb-labchecks" id="pb-labchecks"></div>
      <div class="pb-row">
        <button type="button" class="btn" data-act="again">${cur.correct ? 'Same problem, new numbers' : 'Try again with new numbers'}</button>
        ${nextBtn}
      </div>
    </section>`;
  }

  function problemHTML(cur) {
    const tpl = cur.tpl;
    const exam = cur.mode === 'exam';
    const hints = exam ? '' : cur.view.hints.slice(0, cur.hints).map((h) => `<li>${prose(h)}</li>`).join('');
    const moreHints = !exam && !cur.finished && cur.hints < cur.view.hints.length;
    const src = cur.seed === 0 && tpl.src ? ` · ${esc(tpl.src)}` : '';

    let head;
    if (exam) {
      const ex = st.exam;
      const nav = ex.items
        .map((it, i) => {
          const tplI = problemById(it.id);
          const answered = tplI?.parts.some((p) => p.kind !== 'self' && !isEmpty(p, it.inputs[p.id]));
          return `<button type="button" class="${i === ex.i ? 'on' : ''}${answered ? ' done' : ''}" data-exam-go="${i}" aria-label="Problem ${i + 1}">${i + 1}</button>`;
        })
        .join('');
      head = `<div class="pb-head">
          <div><div class="pb-kicker">Practice exam · ${esc(examById(ex.examId).title)}</div><div class="pb-timer" id="pb-timer">${fmtClock(ex.endsAt - Date.now())}</div></div>
          <button type="button" class="btn ghost" data-act="exam-submit">Submit exam</button>
        </div>
        <nav class="pb-examnav" aria-label="Exam problems">${nav}</nav>`;
    } else {
      const s = st.session;
      const pos = s && s.ids.includes(cur.id) ? ` · ${s.ids.indexOf(cur.id) + 1} of ${s.ids.length}` : '';
      head = `<div class="pb-head">
          <button type="button" class="pb-back" data-act="list">← ${s ? esc(s.label) + pos : 'Problems'}</button>
          <button type="button" class="pb-x" data-act="close" title="Back to the lab (P)" aria-label="Close practice">×</button>
        </div>`;
    }

    const buttons = exam
      ? `<div class="pb-row">
          <button type="button" class="btn" data-act="exam-prev" ${st.exam.i === 0 ? 'disabled' : ''}>← Previous</button>
          ${st.exam.i < st.exam.items.length - 1 ? `<button type="button" class="btn accent" data-act="exam-next">Next →</button>` : `<button type="button" class="btn accent" data-act="exam-submit">Submit exam</button>`}
        </div>
        <p class="pb-foot">No hints or feedback until you submit. The lab shows each setup with its numbers hidden. Answers save as you type.</p>`
      : cur.finished
        ? ''
        : `<div class="pb-row pb-buttons">
          <button type="button" class="btn accent" data-act="check">Check</button>
          <button type="button" class="btn ghost" data-act="hint" ${moreHints ? '' : 'disabled'} title="Using a hint means this attempt won't count as a clean solve">${!cur.view.hints.length ? 'No hints' : moreHints ? `Hint · ${cur.view.hints.length - cur.hints} left` : 'No more hints'}</button>
          <button type="button" class="btn ghost" data-act="reveal">Show solution</button>
        </div>`;

    return `${head}
      <div class="pb-kicker">Ch ${esc(tpl.ch)} · ${esc(CHAPTER_TITLES[tpl.ch] || '')} · ${levelDots(tpl.level)} ${KIND_LABEL[tpl.kind] || ''}${src}</div>
      <h2 class="pb-h">${esc(tpl.title)}</h2>
      <p class="pb-text">${prose(cur.view.text)}</p>
      ${cur.note ? `<p class="pb-note">${esc(cur.note)}</p>` : ''}
      ${bannerHTML(cur)}
      <form class="pb-parts" onsubmit="return false">${tpl.parts.map((p, i) => partHTML(cur, p, i)).join('')}</form>
      ${buttons}
      ${hints ? `<ol class="pb-hints">${hints}</ol>` : ''}
      ${solutionHTML(cur)}`;
  }

  function resultsHTML() {
    const ex = st.exam;
    if (!ex?.done) return listHTML();
    const byCh = new Map();
    let right = 0;
    let scored = 0;
    for (const it of ex.items) {
      const tpl = problemById(it.id);
      if (!tpl) continue;
      right += it.right || 0;
      scored += it.scored || 0;
      const c = byCh.get(tpl.ch) || { right: 0, scored: 0 };
      c.right += it.right || 0;
      c.scored += it.scored || 0;
      byCh.set(tpl.ch, c);
    }
    const pct = scored ? Math.round((100 * right) / scored) : 0;
    const mins = Math.round((ex.finishedAt - ex.startedAt) / 60e3);
    const rows = [...byCh.entries()]
      .sort((a, b) => CHAPTER_ORDER.indexOf(a[0]) - CHAPTER_ORDER.indexOf(b[0]))
      .map(([ch, c]) => {
        const p = c.scored ? Math.round((100 * c.right) / c.scored) : 0;
        return `<tr><td>Ch ${esc(ch)} · ${esc(CHAPTER_TITLES[ch] || '')}</td><td><span class="pb-ch-meter"><i style="width:${p}%"></i></span></td><td class="num">${c.right}/${c.scored}</td></tr>`;
      })
      .join('');
    const items = ex.items
      .map((it, i) => {
        const tpl = problemById(it.id);
        if (!tpl) return '';
        const s = it.scored && it.right === it.scored ? 'mastered' : it.right ? 'due' : 'missed';
        return `<button type="button" class="pb-item" data-review="${i}">
          <span class="pb-dot s-${s}"></span>
          <span class="pb-item-title">${i + 1}. ${esc(tpl.title)}</span>
          <span class="pb-item-meta">${it.right || 0}/${it.scored || 0}</span>
        </button>`;
      })
      .join('');
    return `<div class="pb-head">
        <div><div class="pb-kicker">Practice exam · ${esc(examById(ex.examId).title)} · ${mins} min</div><h2 class="pb-h">Score ${pct}%</h2></div>
        <button type="button" class="pb-x" data-act="close" aria-label="Close practice">×</button>
      </div>
      <div class="pb-meter"><div class="pb-meter-bar"><i style="width:${pct}%"></i></div><div class="pb-meter-text"><span>${right} of ${scored} answer parts right</span><span>Sketch parts aren't scored</span></div></div>
      <table class="pb-table">${rows}</table>
      <h3 class="pb-sub">Problems — open one for the worked solution</h3>
      <div class="pb-list">${items}</div>
      <div class="pb-row">
        <button type="button" class="btn accent" data-act="exam-start">New practice exam</button>
        <button type="button" class="btn" data-act="list">All problems</button>
      </div>
      <p class="pb-foot">Missed problems are now due for review; exact ones moved up a review box.</p>`;
  }

  // ------------------------------------------------------------------ live lab checks
  function refreshLabChecks(force = false) {
    const cur = st.cur;
    if (!st.open || !cur || cur.mode === 'exam' || st.view !== 'problem') return;
    const now = performance.now();
    if (!force && now - st.lastLabRefresh < 200) return;
    st.lastLabRefresh = now;
    const slots = panel.querySelectorAll('[data-lab-part]');
    const box = panel.querySelector('#pb-labchecks');
    const show = (cur.finished || cur.peeked) && cur.tpl.sim?.read && !isDetached();
    if (!show) {
      slots.forEach((el) => (el.innerHTML = ''));
      if (box) box.innerHTML = '';
      return;
    }
    let got;
    try {
      got = cur.tpl.sim.read(api.computed, api.slice(), cur.inst.$) || {};
    } catch {
      return;
    }
    slots.forEach((el) => {
      const id = el.dataset.labPart;
      const i = cur.tpl.parts.findIndex((p) => p.id === id);
      const part = cur.tpl.parts[i];
      if (!(id in got) || !part || part.kind === 'symbolic') {
        el.innerHTML = '';
        return;
      }
      const val = got[id];
      const r = cur.view.parts[i];
      let agrees;
      if (part.kind === 'numeric') agrees = withinTol(val / part.scale, part.get(cur.inst.$) / part.scale, part);
      else agrees = JSON.stringify([].concat(val).sort()) === JSON.stringify([].concat(expected(part, cur.inst.$)).sort());
      el.innerHTML = `<span class="pb-lab-tag">Lab</span> ${esc(showValue(part, r, val))} <span class="${agrees ? 'agree' : 'disagree'}">${agrees ? 'agrees' : 'differs'}</span>`;
    });
    if (box) {
      const extra = Object.entries(got).filter(([k]) => k.startsWith('@'));
      box.innerHTML = extra.length
        ? `<div class="pb-dim">Lab checks</div>${extra
            .map(([k, [g, w]]) => {
              const ok = Math.abs(g - w) <= Math.max(1e-3, 0.02 * Math.abs(w));
              return `<div class="pb-labrow"><span>${esc(k.slice(1))}</span><span class="${ok ? 'agree' : 'disagree'}">${esc(sig(g))} ${ok ? '✓' : ''}</span></div>`;
            })
            .join('')}`
        : '';
    }
  }

  // ------------------------------------------------------------------ events
  panel.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t || t.disabled) return;
    const cur = st.cur;
    if (t.dataset.open) {
      const ids = listIds();
      openProblem(t.dataset.open, { session: { label: 'Problems', ids } });
      return;
    }
    if (t.dataset.filter) {
      const [key, value] = t.dataset.filter.split(':');
      if (key === 'lab') st.filter.lab = !st.filter.lab;
      else st.filter[key] = value;
      renderPanel();
      return;
    }
    if (t.dataset.examGo) {
      showExamItem(Number(t.dataset.examGo));
      return;
    }
    if (t.dataset.review) {
      reviewExamItem(Number(t.dataset.review));
      return;
    }
    if (t.dataset.selfShow && cur) {
      readInputs(cur);
      cur.self[t.dataset.selfShow] = { shown: true };
      renderPanel();
      return;
    }
    if (t.dataset.self && cur) {
      readInputs(cur);
      const [pid, ok] = t.dataset.self.split(':');
      cur.self[pid] = { shown: true, ok: ok === '1' };
      maybeFinish();
      renderPanel();
      return;
    }
    switch (t.dataset.act) {
      case 'close':
        close();
        break;
      case 'list':
        if (cur && cur.mode !== 'exam') leaveProblem();
        else {
          st.view = 'list';
          renderPanel();
        }
        break;
      case 'check':
        check();
        break;
      case 'hint':
        if (cur) {
          readInputs(cur);
          cur.hints = Math.min(cur.view.hints.length, cur.hints + 1);
          renderPanel();
        }
        break;
      case 'reveal':
        reveal();
        break;
      case 'peek':
        if (cur) {
          readInputs(cur);
          cur.peeked = true;
          syncBlind();
          renderPanel();
        }
        break;
      case 'restore':
        if (cur) readInputs(cur);
        restoreSetup();
        break;
      case 'again':
        if (cur) openProblem(cur.id, { seed: 1 + Math.floor(Math.random() * 99999), session: st.session?.exam ? null : st.session });
        break;
      case 'next': {
        const id = nextInSession();
        if (id) openProblem(id, { session: st.session });
        break;
      }
      case 'mixed':
        startMixed();
        break;
      case 'review':
        startReview();
        break;
      case 'exam-start':
        if (examActive() && !confirm('Abandon the practice exam in progress and start a new one?')) break;
        st.listExam = st.exam && st.view === 'results' ? st.exam.examId : st.listExam;
        startExam();
        break;
      case 'exam-resume':
        showExamItem(st.exam?.i || 0);
        break;
      case 'exam-prev':
        showExamItem((st.exam?.i || 0) - 1);
        break;
      case 'exam-next':
        showExamItem((st.exam?.i || 0) + 1);
        break;
      case 'exam-submit': {
        saveExamInputs();
        const blank = st.exam.items.filter((it) => {
          const tpl = problemById(it.id);
          return tpl && !tpl.parts.some((p) => p.kind !== 'self' && !isEmpty(p, it.inputs[p.id]));
        }).length;
        const msg = blank ? `${blank} problem${blank > 1 ? 's have' : ' has'} no answers yet. Submit anyway?` : 'Submit the exam for grading?';
        if (confirm(msg)) submitExam();
        break;
      }
      case 'exam-results':
        st.view = 'results';
        st.cur = null;
        st.token++;
        api.clearQuery({ push: false });
        syncBlind();
        renderPanel();
        break;
      case 'reset-progress':
        if (confirm('Erase your practice history in this browser? This cannot be undone.')) {
          progress.reset();
          updateBrand();
          renderPanel();
        }
        break;
      default:
        break;
    }
  });

  panel.addEventListener('input', (e) => {
    const cur = st.cur;
    if (!cur) return;
    const el = e.target;
    if (el.dataset.input != null) {
      const part = cur.tpl.parts[Number(el.dataset.input)];
      cur.inputs[part.id] = el.value;
      if (part.kind === 'symbolic') {
        const out = panel.querySelector(`[data-parse="${el.dataset.input}"]`);
        if (out) {
          const msg = parseMessage(part, el.value);
          out.className = `pb-parse ${msg.cls}`;
          out.innerHTML = msg.html;
        }
      }
    }
    if (cur.mode === 'exam') saveExamInputs();
  });

  panel.addEventListener('change', () => {
    if (st.cur?.mode === 'exam') saveExamInputs();
  });

  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.matches('.pb-input')) return;
    e.preventDefault();
    if (st.cur?.mode === 'practice' && !st.cur.finished) check();
  });

  $('btn-practice').addEventListener('click', () => toggle());

  // ------------------------------------------------------------------ public
  function open() {
    if (inExamView() || (examActive() && st.view === 'exam')) {
      showExamItem(st.exam.i || 0);
      return;
    }
    if (st.view === 'problem' && st.cur) {
      setOpen(true);
      renderPanel();
      return;
    }
    if (st.view !== 'results') st.view = 'list';
    st.listExam = api.examId() || st.listExam;
    setOpen(true);
    renderPanel();
  }

  function close() {
    if (st.cur && st.cur.mode === 'practice') {
      // Closing mid-problem hands the lab back; an unfinished attempt simply isn't recorded.
      leaveProblem({ push: false });
    } else if (st.cur?.mode === 'review') {
      st.cur = null;
      st.view = 'results';
    } else if (st.cur?.mode === 'exam') {
      saveExamInputs();
    }
    setOpen(false);
  }

  function toggle() {
    if (st.open) close();
    else open();
  }

  return {
    toggle,
    open,
    close,
    escape() {
      const a = document.activeElement;
      if (a && panel.contains(a) && a.matches('input')) {
        a.blur();
        return;
      }
      if (st.open) close();
    },
    /** Setup changed by the student (slider, drag, scenario). */
    noteEdit() {
      if (!st.cur || st.edited || st.cur.mode === 'exam') return;
      st.edited = true;
      if (st.open && st.view === 'problem') {
        const cur = st.cur;
        readInputs(cur);
        renderPanel();
      }
    },
    /** After hud.mount: follow the exam the student navigated to (unless a problem load caused it). */
    onMount({ byProblem = false } = {}) {
      const examId = api.examId();
      if (!byProblem && !st.cur && examId && st.view === 'list') {
        st.listExam = examId;
        if (st.open) renderPanel();
      }
      if (!byProblem && st.cur && st.open && st.view === 'problem') renderPanel();
      // Wave optics has problems but no labs yet: lead with the problems.
      if (!byProblem && examById(examId).labs.length === 0 && !st.open) {
        st.listExam = examId;
        st.view = 'list';
        setOpen(true);
        renderPanel();
      }
      updateBrand();
    },
    /**
     * Keep the panel in step with the URL. Returns true when it took over (a problem is loading
     * and will switch the lab itself).
     */
    followUrl(problemId, seed) {
      if (problemId) {
        // Same problem: if it is still loading, its own lab switch owns the URL (hashchange and popstate both fire).
        if (st.cur && st.cur.id === problemId && st.cur.seed === seed) return !!st.loading;
        if (!problemById(problemId)) return false;
        if (examActive() && st.view === 'exam') return false;
        openProblem(problemId, { seed, push: false });
        return true;
      }
      if (st.cur && st.cur.mode === 'practice') {
        st.cur = null;
        st.view = 'list';
        st.token++;
        api.clearQuery({ push: false });
        syncBlind();
        renderPanel();
      }
      return false;
    },
    afterUpdate() {
      refreshLabChecks();
    },
    frame() {
      if (body.classList.contains('problem-blind')) {
        for (const el of api.labelLayer.children) veilNode(el);
      }
      const now = Date.now();
      if (now - st.lastTick < 250) return;
      st.lastTick = now;
      if (examActive()) {
        const left = st.exam.endsAt - now;
        const t = $('pb-timer');
        if (t) {
          t.textContent = fmtClock(left);
          t.classList.toggle('low', left < 5 * 60e3);
        }
        updateBrand();
        if (left <= 0) submitExam();
      }
    },
    current: () => st.cur,
    progress,
  };
}
