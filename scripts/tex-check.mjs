#!/usr/bin/env node
/**
 * Guard for the panel markup (src/ui/shared.js): TeX written inside an ordinary template literal.
 *
 * `` `$V_{\text{rms}}$` `` is not the string it looks like — JavaScript turns `\t` into a tab, so
 * KaTeX receives `V_{<TAB>ext{rms}}` and silently renders "extrms". The same trap is waiting in
 * \vec (\v), \frac (\f), \rho (\r), \neq (\n) and \begin (\b).
 *
 * Fix one of two ways: tag the literal with String.raw, or double the backslash.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('src');
const EATEN = /\\+[tnvfrb0xu]/g;

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

/** Template literals, with `${…}` skipped so a nested literal does not end this one early. */
function literals(src) {
  const out = [];
  for (let i = 0; i < src.length; i++) {
    if (src[i] !== '`') continue;
    let j = i + 1;
    let depth = 0;
    while (j < src.length) {
      if (src[j] === '\\') { j += 2; continue; }
      if (src[j] === '`' && depth === 0) break;
      if (src[j] === '$' && src[j + 1] === '{') { depth++; j += 2; continue; }
      if (src[j] === '}' && depth > 0) depth--;
      j++;
    }
    out.push({ start: i, text: src.slice(i + 1, j), raw: src.slice(Math.max(0, i - 10), i).endsWith('String.raw') });
    i = j;
  }
  return out;
}

const problems = [];
for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, 'utf8');
  for (const lit of literals(src)) {
    // A `$` that does not open an interpolation is an inline-math delimiter; math needs a pair.
    const delims = (lit.text.match(/\$(?!\{)/g) || []).length;
    if (lit.raw || delims < 2) continue;
    for (const m of lit.text.matchAll(EATEN)) {
      // An even run of backslashes is a literal backslash: `\\text` is fine, `\text` is not.
      if ((m[0].length - 1) % 2 === 0) continue;
      const line = src.slice(0, lit.start).split('\n').length;
      const near = lit.text.slice(Math.max(0, m.index - 40), m.index + 30);
      problems.push(`${file}:${line}: \\${m[0].slice(-1)} is a JS escape here, so the TeX is eaten — …${near}…`);
    }
  }
}

if (problems.length) {
  console.error(`tex-check: ${problems.length} literal(s) where JavaScript eats the TeX\n`);
  for (const p of problems) console.error('  ' + p);
  console.error('\nUse String.raw`…` or double the backslash.');
  process.exit(1);
}
console.log('tex-check: panel markup is clean');
