#!/usr/bin/env node
/**
 * Problem-bank check (no browser):
 *   node scripts/problems-check.mjs [--samples N] [--only idPrefix] [--list]
 *
 * For every template:
 *   1. worked cases reproduce their expected answers (the worksheet key where one exists)
 *   2. N seeded samples satisfy valid(), give finite answers, and give choice answers that are options
 *   3. text, labels, steps render without throwing or printing "undefined"/"NaN"
 *   4. symbolic keys equal get($); the grader accepts the key and rejects a perturbed one
 *   5. sim agreement: load the instance into the real lab (applyProblem), run lab.recompute
 *      headless, and compare sim.read(...) with the problem's own answers
 */
import { PROBLEMS, CHAPTER_ORDER, CHAPTER_TITLES, problemsForExam } from '../src/problems/index.js';
import { createProgress, memoryStorage, pickSet, INTERVAL_DAYS } from '../src/problems/progress.js';
import { build, instance, render, expected, withinTol, evalSymbolic, gradeSymbolic, grade, parseNumber, parseExpr, dimensionOf } from '../src/problems/engine.js';
import { parseUnit, dimEqual, formatDim } from '../src/physics/units.js';
import { applyProblem, headlessCtx } from '../src/problems/simbridge.js';
import { mathProse } from '../src/ui/shared.js';
import { loadLab } from '../src/labs/load.js';
import { LAB_META, EXAMS } from '../src/data/catalog.js';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : dflt;
};
const SAMPLES = Number(opt('--samples', 60));
const ONLY = opt('--only', '');

const errors = [];
const notes = [];
let simChecks = 0;
const err = (id, msg) => errors.push(`${id}: ${msg}`);

function checkRender(tpl, inst) {
  const r = render(inst);
  const strings = [r.text, ...r.parts.map((p) => `${p.label ?? ''} ${(p.options || []).map((o) => o.label).join(' ')} ${p.rubric ?? ''}`), ...r.steps, ...r.hints];
  const blob = strings.join('\n');
  if (/undefined|NaN|\[object/.test(blob)) err(tpl.id, `rendered text contains undefined/NaN:\n${blob.slice(0, 300)}`);
  // The panel typesets `$…$` (src/ui/shared.js); KaTeX marks what it cannot parse instead of throwing.
  for (const s of strings) {
    const html = mathProse(s);
    if (html.includes('katex-error')) err(tpl.id, `KaTeX cannot parse this: ${s}`);
  }
}

function checkAnswers(tpl, inst, label) {
  for (const p of tpl.parts) {
    const want = expected(p, inst.$);
    if (p.kind === 'numeric' && !Number.isFinite(want)) err(tpl.id, `${label} part ${p.id} not finite (${JSON.stringify(inst.values)})`);
    if (p.kind === 'choice') {
      const opts = new Set(p.options.map((o) => o.value));
      for (const w of [].concat(want)) if (!opts.has(w)) err(tpl.id, `${label} part ${p.id} answer ${w} not among options (${JSON.stringify(inst.values)})`);
    }
    if (p.kind === 'symbolic') {
      const a = evalSymbolic(p, inst.$);
      const b = p.get(inst.$);
      if (!(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)))) err(tpl.id, `${label} symbolic ${p.id}: key gives ${a}, get() gives ${b}`);
      // The key has to come out in the unit the part claims — the same check the student does by hand.
      if (p.unit && p.units) {
        try {
          const got = dimensionOf(parseExpr(p.expr, p.vars, p.alias), p.units);
          if (!dimEqual(got, parseUnit(p.unit))) {
            err(tpl.id, `symbolic ${p.id}: the key is in ${formatDim(got)}, but the part says ${p.unit}`);
          }
        } catch (e) {
          err(tpl.id, `symbolic ${p.id}: units — ${e.message}`);
        }
      } else if (p.unit || p.units) {
        err(tpl.id, `symbolic ${p.id}: declare both the symbol units and the answer unit, or neither`);
      }
    }
  }
}

async function checkSim(tpl, inst, label) {
  if (!tpl.sim) return;
  const lab = await loadLab(tpl.lab);
  if (!lab) return err(tpl.id, `unknown lab ${tpl.lab}`);
  const slice = lab.defaultState();
  applyProblem(lab, slice, inst);
  if (!tpl.sim.read) return;
  const computed = {};
  const ctx = headlessCtx();
  lab.recompute(slice, computed, ctx);
  const got = tpl.sim.read(computed, slice, inst.$);
  for (const [key, val] of Object.entries(got)) {
    simChecks++;
    if (key.startsWith('@')) {
      const [g, w] = val;
      if (!(Math.abs(g - w) <= Math.max(1e-3, 0.02 * Math.abs(w)))) err(tpl.id, `${label} sim ${key}: ${g} vs ${w} (${JSON.stringify(inst.values)})`);
      continue;
    }
    const part = tpl.parts.find((p) => p.id === key);
    if (!part) {
      err(tpl.id, `sim.read returned unknown part ${key}`);
      continue;
    }
    if (part.kind === 'choice') {
      const want = expected(part, inst.$);
      if (val !== want) err(tpl.id, `${label} sim ${key}: lab says ${val}, problem says ${want} (${JSON.stringify(inst.values)})`);
    } else {
      const want = part.get(inst.$);
      const p2 = { ...part, abs: (part.abs ?? 0) * (part.scale ?? 1) };
      if (!withinTol(val, want, p2)) err(tpl.id, `${label} sim ${key}: lab ${val.toPrecision(5)} vs problem ${want.toPrecision(5)} (${JSON.stringify(inst.values)})`);
    }
  }
}

const seen = new Set();
const labsUsed = {};
for (const tpl of PROBLEMS) {
  if (ONLY && !tpl.id.startsWith(ONLY)) continue;
  if (seen.has(tpl.id)) err(tpl.id, 'duplicate id');
  seen.add(tpl.id);
  if (!EXAMS.some((e) => e.id === tpl.exam)) err(tpl.id, `unknown exam ${tpl.exam}`);
  if (tpl.lab && !LAB_META[tpl.lab]) err(tpl.id, `unknown lab ${tpl.lab}`);
  if (tpl.lab && LAB_META[tpl.lab] && LAB_META[tpl.lab].exam !== tpl.exam) notes.push(`${tpl.id}: lives in exam ${tpl.exam} but uses lab ${tpl.lab} (${LAB_META[tpl.lab].exam})`);
  if (!CHAPTER_ORDER.includes(tpl.ch)) err(tpl.id, `unknown chapter ${tpl.ch}`);
  if (!CHAPTER_TITLES[tpl.ch]) err(tpl.id, `chapter ${tpl.ch} has no title`);
  if (tpl.sim && !tpl.lab) err(tpl.id, 'sim without lab');
  if (!tpl.cases.length) err(tpl.id, 'no worked case');
  labsUsed[tpl.lab || '(none)'] = (labsUsed[tpl.lab || '(none)'] || 0) + 1;

  // 1. worked cases
  for (const c of tpl.cases) {
    let inst;
    try {
      inst = build(tpl, c.v);
    } catch (e) {
      err(tpl.id, `case ${c.src}: ${e.message}`);
      continue;
    }
    if (!tpl.valid(inst.$)) err(tpl.id, `case ${c.src} fails valid()`);
    for (const [pid, want] of Object.entries(c.want)) {
      const part = tpl.parts.find((p) => p.id === pid);
      if (!part) {
        err(tpl.id, `case ${c.src}: no part ${pid}`);
        continue;
      }
      const got = expected(part, inst.$);
      const ok =
        part.kind === 'numeric'
          ? withinTol(got, want, { tol: 0.01, abs: Math.max(part.abs ?? 0, 1e-9) })
          : JSON.stringify([].concat(got).sort()) === JSON.stringify([].concat(want).sort());
      if (!ok) err(tpl.id, `case ${c.src} part ${pid}: got ${typeof got === 'number' ? got.toPrecision(5) : JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
      // the grader must accept the expected value as typed by a student
      if (part.kind === 'numeric' && !grade(part, inst.$, String(want)).correct && withinTol(got, want, { tol: 0.01, abs: part.abs ?? 0 })) {
        err(tpl.id, `case ${c.src} part ${pid}: grader rejects ${want}`);
      }
    }
    if (c.note) notes.push(`${tpl.id} [${c.src}] ${c.note}`);
    checkAnswers(tpl, inst, `case ${c.src}`);
    checkRender(tpl, inst);
    try {
      await checkSim(tpl, inst, `case ${c.src}`);
    } catch (e) {
      err(tpl.id, `case ${c.src} sim threw: ${e.stack.split('\n').slice(0, 3).join(' | ')}`);
    }
  }

  // 2–5. random samples
  const n = Object.keys(tpl.vars).length ? SAMPLES : 1;
  for (let seed = 1; seed <= n; seed++) {
    let inst;
    try {
      inst = instance(tpl, seed);
    } catch (e) {
      err(tpl.id, e.message);
      break;
    }
    checkAnswers(tpl, inst, `seed ${seed}`);
    try {
      checkRender(tpl, inst);
    } catch (e) {
      err(tpl.id, `render threw: ${e.message}`);
    }
    if (seed <= 3) {
      for (const p of tpl.parts.filter((q) => q.kind === 'symbolic')) {
        if (!gradeSymbolic(p, p.expr).correct) err(tpl.id, `grader rejects its own key for ${p.id}`);
        if (gradeSymbolic(p, `(${p.expr})*1.1`).correct) err(tpl.id, `grader accepts a wrong answer for ${p.id}`);
      }
    }
    try {
      await checkSim(tpl, inst, `seed ${seed}`);
    } catch (e) {
      err(tpl.id, `seed ${seed} sim threw: ${e.stack.split('\n').slice(0, 3).join(' | ')}`);
      break;
    }
  }
}

// grader self-test
for (const [s, v] of [
  ['2.52e7', 2.52e7], ['2.52x10^7', 2.52e7], ['2.52 × 10^-7', 2.52e-7], ['−3', -3], ['1/2', 0.5], ['2.5×10⁻⁶', 2.5e-6],
  // students type units and spaces; the unit is ignored, never misread as part of the number
  ['2.5 A', 2.5], ['3.3e-5 C/m²', 3.3e-5], ['1.6 × 10^-19 C', 1.6e-19], ['5e13 electrons', 5e13], ['$20.25', 20.25], ['-30 °', -30],
]) {
  if (parseNumber(s) !== v) err('engine', `parseNumber(${s}) = ${parseNumber(s)}`);
}
if (!Number.isNaN(parseNumber('abc'))) err('engine', 'parseNumber accepts text');
{
  const angle = { kind: 'numeric', get: () => 330, scale: 1, tol: 0.005, abs: 0.6, wrap: 360, unit: '°' };
  if (!grade(angle, {}, '-30').correct) err('engine', 'wrapped angle: −30° should equal 330°');
  if (grade(angle, {}, '150').correct) err('engine', 'wrapped angle: 150° accepted for 330°');
  const plain = { kind: 'numeric', get: () => 2.5e-6, scale: 1, tol: 0.02, abs: 0, unit: 'C' };
  if (!/10\^3/.test(grade(plain, {}, '2.5e-3').feedback)) err('engine', 'power-of-ten feedback missing');
  if (!/sign/.test(grade(plain, {}, '-2.5e-6').feedback)) err('engine', 'wrong-sign feedback missing');
}

// practice progress: spaced review and set picking
{
  const p = createProgress(memoryStorage());
  const t0 = Date.parse('2026-09-01T12:00:00Z');
  const DAY = 864e5;
  let it = p.record('e2.36a.collinear', { correct: true, clean: true, now: t0 });
  if (it.box !== 1 || it.due !== t0 + INTERVAL_DAYS[1] * DAY) err('progress', `clean solve should move to box 1, due in ${INTERVAL_DAYS[1]} day(s)`);
  it = p.record('e2.36a.collinear', { correct: true, clean: true, now: t0 + DAY });
  if (it.box !== 2) err('progress', 'second clean solve should reach box 2');
  it = p.record('e2.36a.collinear', { correct: true, clean: false, hints: 1, now: t0 + 2 * DAY });
  if (it.box !== 1) err('progress', 'solving with help should drop one box');
  it = p.record('e2.36a.collinear', { correct: false, revealed: true, now: t0 + 3 * DAY });
  if (it.box !== 0 || p.status('e2.36a.collinear', t0 + 3 * DAY) !== 'missed') err('progress', 'a miss should reset to box 0 and show as missed');
  if (p.dueIds(['e2.36a.collinear', 'e2.36a.dipole'], t0 + 4 * DAY).join() !== 'e2.36a.collinear') err('progress', 'dueIds should list only seen, overdue problems');
  if (p.nextSeed('e2.36a.dipole') !== 0 || p.nextSeed('e2.36a.collinear') === 0) err('progress', 'first attempt uses the worksheet (seed 0), later ones fresh numbers');

  for (const exam of ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'wave']) {
    const tpls = problemsForExam(exam);
    const n = Math.min(8, tpls.length);
    const a = pickSet(tpls, p, { n, seed: 42 });
    const b = pickSet(tpls, p, { n, seed: 42 });
    const chapters = new Set(tpls.map((t) => t.ch));
    if (a.length !== n) err('pickSet', `${exam}: picked ${a.length} of ${n}`);
    if (new Set(a.map((t) => t.id)).size !== a.length) err('pickSet', `${exam}: duplicate problem`);
    if (a.map((t) => t.id).join() !== b.map((t) => t.id).join()) err('pickSet', `${exam}: same seed gave different sets`);
    if (new Set(a.map((t) => t.ch)).size < Math.min(n, chapters.size)) err('pickSet', `${exam}: set skips chapters it had room for`);
    if (a.filter((t) => t.kind === 'conceptual').length > Math.max(1, Math.floor(n * 0.25))) err('pickSet', `${exam}: too many conceptual problems`);
  }
}

const byExam = {};
const byCh = {};
for (const p of PROBLEMS) {
  byExam[p.exam] = (byExam[p.exam] || 0) + 1;
  byCh[p.ch] = (byCh[p.ch] || 0) + 1;
}
console.log(`${seen.size} templates · ${PROBLEMS.reduce((a, p) => a + p.cases.length, 0)} worked cases · ${simChecks} sim comparisons`);
console.log('by exam:', Object.entries(byExam).map(([k, v]) => `${k}:${v}`).join('  '));
console.log('by chapter:', CHAPTER_ORDER.map((c) => `${c}:${byCh[c] || 0}`).join('  '));
if (args.includes('--list')) {
  console.log('by lab:', labsUsed);
  for (const n of notes) console.log('NOTE ', n);
}
for (const e of errors) console.log('FAIL ', e);
console.log(errors.length ? `${errors.length} failure(s)` : 'problems: all checks passed');
process.exit(errors.length ? 1 : 0);
