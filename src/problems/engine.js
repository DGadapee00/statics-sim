/**
 * Problem engine: seeded sampling, text formatting, grading. No DOM, no Three.js, so the same
 * code runs in the browser and in scripts/problems-check.mjs.
 */
import { G, G_FT } from './kit.js';
import { ZERO, CONST_DIMS, parseUnit, formatDim, dimEqual, isDimensionless, dimMul, dimDiv, dimScale } from '../physics/units.js';

// ---------- seeded RNG ----------
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---------- building an instance ----------
const clean = (x) => Number(x.toPrecision(12));

export function build(tpl, values) {
  const $ = {};
  const T = {};
  for (const [name, spec] of Object.entries(tpl.vars)) {
    const v = values[name];
    if (v === undefined) throw new Error(`${tpl.id}: missing value for ${name}`);
    if (spec.type === 'range') {
      $[name] = v * spec.si;
      T[name] = fmtPlain(v);
    } else {
      const opt = spec.options.find((o) => o.value === v);
      if (!opt) throw new Error(`${tpl.id}: ${name}=${v} is not an option`);
      $[name] = v;
      T[name] = opt.label;
    }
  }
  Object.assign($, tpl.derive($));
  return { tpl, values, $, T };
}

export function sampleValues(tpl, rand) {
  for (let tries = 0; tries < 4000; tries++) {
    const values = {};
    for (const [name, spec] of Object.entries(tpl.vars)) {
      if (spec.type === 'choice') {
        values[name] = spec.options[Math.floor(rand() * spec.options.length)].value;
      } else {
        const steps = Math.round((spec.max - spec.min) / spec.step);
        let v;
        do v = clean(spec.min + spec.step * Math.floor(rand() * (steps + 1)));
        while (spec.exclude?.includes(v));
        values[name] = v;
      }
    }
    let inst;
    try {
      inst = build(tpl, values);
    } catch {
      continue;
    }
    if (!tpl.valid(inst.$)) continue;
    if (tpl.parts.some((p) => p.get && !Number.isFinite(p.get(inst.$)))) continue;
    return values;
  }
  throw new Error(`${tpl.id}: could not satisfy valid() in 4000 tries`);
}

/** Instance from a seed; seed 0 (or `worksheet: true`) gives the first worked case. */
export function instance(tpl, seed, { worksheet = false } = {}) {
  if ((worksheet || seed === 0) && tpl.cases[0]) return build(tpl, tpl.cases[0].v);
  return build(tpl, sampleValues(tpl, rng(hashSeed(`${tpl.id}:${seed}`))));
}

// ---------- rendering ----------
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

function fmtPlain(v) {
  const s = String(clean(v));
  return s.includes('e') ? sig(v) : s;
}

/** 3 significant figures; scientific (× 10ⁿ) outside [0.01, 1e5). */
export function sig(x, n = 3) {
  if (!Number.isFinite(x)) return '—';
  if (x === 0 || Math.abs(x) < 1e-300) return '0';
  const a = Math.abs(x);
  if (a >= 0.01 && a < 1e5) return String(Number(x.toPrecision(n)));
  const [m, e] = x.toExponential(n - 1).split('e');
  const exp = String(Number(e)).replace(/./g, (c) => SUP[c]);
  return `${Number(m)} × 10${exp}`;
}

export function render(inst) {
  const { tpl, $, T } = inst;
  return {
    text: tpl.text(T, $, sig),
    parts: tpl.parts.map((p) => ({
      id: p.id,
      kind: p.kind,
      label: typeof p.label === 'function' ? p.label(T, $, sig) : p.label,
      unit: p.unit ?? null,
      options: p.options?.map((o) => ({ value: o.value, label: typeof o.label === 'function' ? o.label(T, $) : o.label })),
      multi: p.multi ?? false,
      rubric: p.rubric ?? null,
    })),
    hints: tpl.hints,
    steps: tpl.steps($, sig, T),
  };
}

// ---------- answers ----------
export function expected(part, $) {
  if (part.kind === 'numeric') return part.get($) / part.scale;
  if (part.kind === 'choice') return typeof part.correct === 'function' ? part.correct($) : part.correct;
  if (part.kind === 'symbolic') return part.expr;
  return null;
}

export function answers(inst) {
  return Object.fromEntries(inst.tpl.parts.map((p) => [p.id, expected(p, inst.$)]));
}

/** Accepts 2.52e7, 2.52x10^7, 2.52×10^7, 2.52*10^7, 2.52 E7, 1/2, −3, and a trailing unit ("2.5 A", "$20.25"). */
export function parseNumber(input) {
  if (typeof input === 'number') return input;
  const s = String(input)
    .trim()
    .replace(/[−–]/g, '-')
    .replace(/,/g, '')
    .replace(/^\$/, '')
    .replace(/10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_, m) => '10^' + [...m].map((c) => Object.keys(SUP).find((k) => SUP[k] === c)).join(''))
    .replace(/\s*[x×*·]\s*10\s*\^?\s*\(?\s*(-?\d+)\s*\)?/i, 'e$1')
    .replace(/(\d|\.)\s*(?![eE][-+]?\d)[A-Za-zμΩ°%$/·²³⁻\s()][^\d]*$/, '$1')
    .replace(/\s+/g, '');
  if (/^-?[\d.]+\/[\d.]+$/.test(s)) {
    const [a, b] = s.split('/').map(Number);
    return a / b;
  }
  const v = Number(s);
  return Number.isFinite(v) ? v : NaN;
}

export function withinTol(got, want, part) {
  let diff = got - want;
  if (part.wrap) diff = ((((diff + part.wrap / 2) % part.wrap) + part.wrap) % part.wrap) - part.wrap / 2;
  return Math.abs(diff) <= Math.max(part.abs ?? 0, (part.tol ?? 0.02) * Math.abs(want), 1e-12 * Math.abs(want));
}

/**
 * Grade one part. Returns { correct, feedback }.
 * input: string/number (numeric, symbolic), value or array (choice), boolean (self).
 */
export function grade(part, $, input) {
  if (part.kind === 'numeric') {
    const want = expected(part, $);
    const got = parseNumber(input);
    if (!Number.isFinite(got)) return { correct: false, feedback: 'Enter a number, e.g. 2.5e-6 or 2.5×10^-6.' };
    if (withinTol(got, want, part)) return { correct: true, feedback: '' };
    if (part.wrap) {
      const near = withinTol(got, want, { ...part, tol: 0, abs: 10 });
      return { correct: false, feedback: near ? 'Close — recheck your arithmetic.' : 'Check the quadrant: which signs do the components have?' };
    }
    if (withinTol(-got, want, part)) return { correct: false, feedback: 'Right size, wrong sign.' };
    if (want !== 0 && got !== 0) {
      const r = Math.log10(Math.abs(got / want));
      const k = Math.round(r);
      if (k !== 0 && Math.abs(r - k) < 0.01) {
        return { correct: false, feedback: part.unit ? `Off by 10^${k} — check unit prefixes (${part.unit}).` : `Off by a factor of 10^${k}.` };
      }
      const r2 = Math.abs(got / want);
      if (Math.abs(r2 - 2) < 0.02 || Math.abs(r2 - 0.5) < 0.01) return { correct: false, feedback: 'Off by a factor of 2.' };
    }
    return { correct: false, feedback: '' };
  }
  if (part.kind === 'choice') {
    const want = expected(part, $);
    if (part.multi) {
      const a = [...(Array.isArray(input) ? input : [input])].sort();
      const b = [...(Array.isArray(want) ? want : [want])].sort();
      return { correct: a.length === b.length && a.every((x, i) => x === b[i]), feedback: '' };
    }
    return { correct: input === want, feedback: '' };
  }
  if (part.kind === 'symbolic') return gradeSymbolic(part, input);
  return { correct: !!input, feedback: '' };
}

// ---------- symbolic ----------
const CONSTS = { pi: Math.PI, g: G, gft: G_FT };
const FUNCS = {
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  abs: Math.abs,
};
const GREEK = { 'π': 'pi', 'λ': 'lam', 'σ': 'sig', 'ρ': 'rho', 'θ': 'th', 'ω': 'omega', 'ε0': 'eps0', 'ε₀': 'eps0', 'μ0': 'mu0', 'μ₀': 'mu0', 'φ': 'phi', 'α': 'alpha' };

/**
 * Tiny expression parser → AST. Supports + − * / ^, unary minus, parentheses, the functions above,
 * and implicit multiplication ("2k lam/R", "2(a+b)", "k q/r^2"). Identifiers are matched
 * longest-first against `symbols`, so "kQ" reads as k·Q.
 *
 * The AST is evaluated two ways: `compile` gives the numeric evaluator the grader uses, and
 * `dimensionOf` (below) works out the units of the same expression.
 */
export function parseExpr(src, symbols = [], alias = {}) {
  let s = String(src).replace(/[−–]/g, '-').replace(/[·×]/g, '*').replace(/²/g, '^2').replace(/³/g, '^3').replace(/√/g, 'sqrt');
  for (const [from, to] of Object.entries({ ...GREEK, ...alias }).sort((a, b) => b[0].length - a[0].length)) {
    s = s.split(from).join(` ${to} `);
  }
  const names = [...new Set([...symbols, ...Object.keys(CONSTS), ...Object.keys(FUNCS)])].sort((a, b) => b.length - a.length);
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[\d.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
      toks.push({ t: 'num', v: Number(m[0]) });
      i += m[0].length;
    } else if (/[A-Za-z_]/.test(c)) {
      const rest = s.slice(i);
      const hit = names.find((n) => rest.startsWith(n));
      if (!hit) throw new Error(`Unknown symbol near "${rest.slice(0, 6)}"`);
      toks.push({ t: FUNCS[hit] && /^\s*\(/.test(rest.slice(hit.length)) ? 'fn' : 'id', v: hit });
      i += hit.length;
    } else if ('+-*/^()'.includes(c)) {
      toks.push({ t: c });
      i++;
    } else {
      throw new Error(`Unexpected "${c}"`);
    }
  }
  // insert implicit '*'
  const out = [];
  for (const tk of toks) {
    const prev = out[out.length - 1];
    const endsFactor = prev && (prev.t === 'num' || prev.t === 'id' || prev.t === ')');
    const startsFactor = tk.t === 'num' || tk.t === 'id' || tk.t === 'fn' || tk.t === '(';
    if (endsFactor && startsFactor) out.push({ t: '*' });
    out.push(tk);
  }
  let p = 0;
  const peek = () => out[p];
  const eat = (t) => {
    if (out[p]?.t !== t) throw new Error(`Expected ${t}`);
    return out[p++];
  };
  function expr() {
    let node = term();
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = out[p++].t;
      node = { t: 'op', op, l: node, r: term() };
    }
    return node;
  }
  function term() {
    let node = unary();
    while (peek() && (peek().t === '*' || peek().t === '/')) {
      const op = out[p++].t;
      node = { t: 'op', op, l: node, r: unary() };
    }
    return node;
  }
  function unary() {
    if (peek()?.t === '-') {
      p++;
      return { t: 'neg', x: unary() };
    }
    if (peek()?.t === '+') {
      p++;
      return unary();
    }
    return power();
  }
  function power() {
    const base = atom();
    if (peek()?.t === '^') {
      p++;
      return { t: 'op', op: '^', l: base, r: unary() };
    }
    return base;
  }
  function atom() {
    const tk = out[p++];
    if (!tk) throw new Error('Unexpected end');
    if (tk.t === 'num') return { t: 'num', v: tk.v };
    if (tk.t === 'id') {
      if (tk.v in CONSTS && !symbols.includes(tk.v)) return { t: 'const', name: tk.v };
      return { t: 'sym', name: tk.v };
    }
    if (tk.t === 'fn') {
      eat('(');
      const a = expr();
      eat(')');
      return { t: 'fn', name: tk.v, arg: a };
    }
    if (tk.t === '(') {
      const e = expr();
      eat(')');
      return e;
    }
    throw new Error(`Unexpected ${tk.t}`);
  }
  const ast = expr();
  if (p !== out.length) throw new Error('Unexpected trailing input');
  return ast;
}

const OPS = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => a / b,
  '^': (a, b) => Math.pow(a, b),
};

export function evalAst(ast, sc) {
  switch (ast.t) {
    case 'num':
      return ast.v;
    case 'const':
      return CONSTS[ast.name];
    case 'sym':
      if (!(ast.name in sc)) throw new Error(`No value for ${ast.name}`);
      return sc[ast.name];
    case 'neg':
      return -evalAst(ast.x, sc);
    case 'fn':
      return FUNCS[ast.name](evalAst(ast.arg, sc));
    default:
      return OPS[ast.op](evalAst(ast.l, sc), evalAst(ast.r, sc));
  }
}

/** The evaluator the grader uses: compile once, call with a scope of symbol values. */
export function compile(src, symbols = [], alias = {}) {
  const ast = parseExpr(src, symbols, alias);
  return (sc) => evalAst(ast, sc);
}

/**
 * The units of an expression, from the units of its symbols — the check a student does by hand.
 * Throws with a readable reason when the expression is not dimensionally consistent, which is
 * itself the useful answer ("cannot add m to m/s").
 */
export function dimensionOf(ast, units) {
  const walk = (n) => {
    switch (n.t) {
      case 'num':
        return ZERO;
      case 'const': {
        const d = CONST_DIMS[n.name];
        if (!d) throw new Error(`No units known for the constant ${n.name}`);
        return d;
      }
      case 'sym': {
        const u = units[n.name];
        if (u === undefined) throw new Error(`No units declared for ${n.name}`);
        return typeof u === 'string' ? parseUnit(u) : u;
      }
      case 'neg':
        return walk(n.x);
      case 'fn': {
        const a = walk(n.arg);
        if (n.name === 'sqrt') return dimScale(a, 0.5);
        if (n.name === 'abs') return a;
        if (!isDimensionless(a)) throw new Error(`${n.name}() needs a plain number, but its argument is in ${formatDim(a)}`);
        return ZERO;
      }
      default: {
        if (n.op === '^') {
          let e;
          try {
            e = evalAst(n.r, {});
          } catch {
            throw new Error('An exponent has to be a number');
          }
          return dimScale(walk(n.l), e);
        }
        const a = walk(n.l);
        const b = walk(n.r);
        if (n.op === '*') return dimMul(a, b);
        if (n.op === '/') return dimDiv(a, b);
        if (!dimEqual(a, b)) throw new Error(`Cannot ${n.op === '+' ? 'add' : 'subtract'} ${formatDim(b)} and ${formatDim(a)}`);
        return a;
      }
    }
  };
  return walk(ast);
}

/** Units of what the student typed, against what the answer should be. */
export function checkUnits(input, part) {
  if (!part.unit || !part.units) return null;
  let want;
  try {
    want = parseUnit(part.unit);
  } catch (e) {
    return { ok: false, text: e.message };
  }
  let got;
  try {
    got = dimensionOf(parseExpr(input, part.vars, part.alias), part.units);
  } catch (e) {
    return { ok: false, text: e.message };
  }
  if (dimEqual(got, want)) return { ok: true, text: part.unit };
  return { ok: false, text: formatDim(got), want: part.unit };
}

export function gradeSymbolic(part, input) {
  let want;
  let got;
  try {
    want = compile(part.expr, part.vars, part.alias);
  } catch (e) {
    return { correct: false, feedback: `Bad answer key: ${e.message}` };
  }
  try {
    got = compile(input, part.vars, part.alias);
  } catch (e) {
    return { correct: false, feedback: e.message };
  }
  const r = rng(12345);
  const scopes = [];
  for (let n = 0; n < 8; n++) scopes.push(Object.fromEntries(part.vars.map((v) => [v, 0.3 + 2.7 * r()])));

  /*
   * Compare against the size of the key itself, not against 1. An expression like E r²/k is around
   * 1e-10 at these sample values, and a fixed absolute tolerance would wave through any wrong
   * answer of the same size. The typical magnitude across all the samples is the yardstick, so one
   * sample where the expression happens to cancel does not make the test impossibly strict.
   */
  let sum = 0;
  const wants = [];
  for (const sc of scopes) {
    let a;
    try {
      a = want(sc);
    } catch (e) {
      return { correct: false, feedback: `Bad answer key: ${e.message}` };
    }
    wants.push(a);
    if (Number.isFinite(a)) sum += a * a;
  }
  const typical = Math.sqrt(sum / scopes.length);

  for (let n = 0; n < scopes.length; n++) {
    const a = wants[n];
    let b;
    try {
      b = got(scopes[n]);
    } catch (e) {
      return { correct: false, feedback: e.message };
    }
    if (!Number.isFinite(b)) return { correct: false, feedback: 'Expression is undefined for some values.' };
    const tol = 1e-6 * Math.max(Math.abs(a), typical);
    if (Math.abs(a - b) > tol) return { correct: false, feedback: '' };
  }
  return { correct: true, feedback: '' };
}

export function evalSymbolic(part, $) {
  return compile(part.expr, part.vars, part.alias)($);
}
