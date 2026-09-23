import * as THREE from 'three';
import { defineLab } from './define.js';
import { label, sliderRow, bindSlider, putSlider, showBlock, arcSegments } from './parts.js';
import { M, fatSegments, Arrow, markAnswer, setFatSegments, segmentCapacity } from '../scene/manim.js';
import { v } from '../physics/vectors.js';
import { rigidBody2D, distributedLoad } from '../physics/statics.js';
import { internalAt, shearMomentDiagram } from '../physics/sections.js';
import { kv, cells, qv, eq } from '../ui/shared.js';

/**
 * Ch 5 reactions and Ch 7 internal loads, on one beam.
 *
 * The beam sits on top; its shear and moment diagrams are stacked underneath on the same x axis,
 * the way the chapter draws them, and one cut line runs through all three. Slide the cut and read
 * N, V and M off the left segment — then check them against the diagrams: the moment at the cut is
 * the area under the shear diagram up to it, and the moment peaks where the shear crosses zero.
 */

const HALF = 3.3; // beam half-width, scene units
const OX = 0.45; // shift right, clear of the equation panel
const Y_BEAM = 2.35;
const Y_V = 0.15;
const Y_M = -2.15;
const AMP = 0.9; // diagram half-height, scene units
const N_SAMPLES = 400;
const N_DIST = 13; // arrows drawn under a distributed load

const SCENARIOS = [
  { id: 'point', name: 'Simple beam · point load', support: 'simple', L: 12, P: 600, a: 4, dist: 'none', w: 0, M0: 0, c: 2 },
  { id: 'udl', name: 'Simple beam · uniform load', support: 'simple', L: 10, P: 0, a: 5, dist: 'uniform', w: 120, M0: 0, c: 5 },
  { id: 'tri', name: 'Simple beam · triangular load', support: 'simple', L: 9, P: 0, a: 4.5, dist: 'triangular', w: 90, M0: 0, c: 5.2 },
  { id: 'cantilever', name: 'Cantilever · tip load and a uniform load', support: 'cantilever', L: 8, P: 250, a: 8, dist: 'uniform', w: 50, M0: 0, c: 3 },
  { id: 'overhang', name: 'Overhang · load past the support', support: 'overhang', L: 12, xb: 8, P: 400, a: 12, dist: 'uniform', w: 60, M0: 0, c: 8 },
  { id: 'couple', name: 'Simple beam · applied couple', support: 'simple', L: 10, P: 0, a: 5, dist: 'none', w: 0, M0: 800, cm: 4, c: 4 },
];

const SUPPORT_TEXT = { simple: 'pin A · roller B', cantilever: 'fixed at A', overhang: 'pin A · roller B, overhanging' };

function reactionsFor(state) {
  const { L } = state;
  const xb = state.support === 'overhang' ? Math.min(state.xb, L) : L;
  const loads = [];
  if (state.P) loads.push({ at: v(state.a, 0, 0), F: v(0, -state.P, 0) });
  const wfn = distFn(state);
  let dist = null;
  if (wfn) {
    const d = distributedLoad(wfn, 0, L);
    dist = d;
    loads.push({ at: v(d.x, 0, 0), F: v(0, d.F, 0) });
  }
  if (state.M0) loads.push({ at: v(state.cm, 0, 0), F: v(0, 0, 0), couple: v(0, 0, state.M0) });
  const up = v(0, 1, 0);
  const right = v(1, 0, 0);
  const unknowns = state.support === 'cantilever'
    ? [{ at: v(0, 0, 0), dir: up }, { at: v(0, 0, 0), dir: right }, { couple: true }]
    : [{ at: v(0, 0, 0), dir: up }, { at: v(xb, 0, 0), dir: up }, { at: v(0, 0, 0), dir: right }];
  const sol = rigidBody2D({ loads, unknowns });
  const [r0, r1, r2] = sol.reactions;
  const reactions = state.support === 'cantilever'
    ? [{ name: 'A', x: 0, Fx: r1, Fy: r0, M: r2 }]
    : [{ name: 'A', x: 0, Fx: r2, Fy: r0 }, { name: 'B', x: xb, Fy: r1 }];
  return { reactions, residual: sol.residual, dist, xb };
}

/** w(x), positive up (so a load pressing down is negative), or null when there is none. */
function distFn(state) {
  if (state.dist === 'none' || !state.w) return null;
  const { L, w } = state;
  return state.dist === 'uniform' ? () => -w : (x) => -w * (x / L);
}

export default defineLab({
  id: 'beam',
  exam: 'u4',
  title: 'Beam',
  hint: 'Slide the cut — M at the cut is the area under V up to it, and M peaks where V crosses zero',
  orbit: false,
  camera: { pos: new THREE.Vector3(0, 0.1, 13.5), target: new THREE.Vector3(0, 0.1, 0) },
  keys: { r: 'reset', R: 'reset' },
  scenarios: SCENARIOS,
  defaultState() {
    return { scenarioId: 'point', support: 'simple', L: 12, xb: 12, P: 600, a: 4, dist: 'none', w: 0, M0: 0, cm: 4, c: 2, showCut: true };
  },
  applyScenario(id, state) {
    const sc = SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
    Object.assign(state, { xb: sc.L, cm: sc.L / 2 }, sc, { scenarioId: sc.id });
    delete state.id;
    delete state.name;
  },
  controls() {
    return `
        <div class="lab-block">
          ${sliderRow('bm-L', 'Span L (ft)', 12, 2, 30, 0.5)}
          <div id="bm-xbblock">${sliderRow('bm-xb', 'Roller B at x (ft)', 8, 1, 30, 0.5)}</div>
          ${sliderRow('bm-P', 'Point load P (lb, down)', 600, 0, 2000, 10)}
          ${sliderRow('bm-a', 'P acts at x (ft)', 4, 0, 30, 0.1)}
          <label class="field"><span>Distributed load</span>
            <select id="bm-dist">
              <option value="none">none</option>
              <option value="uniform">uniform, over the whole span</option>
              <option value="triangular">triangular, zero at A</option>
            </select>
          </label>
          <div id="bm-wblock">${sliderRow('bm-w', 'Peak intensity w (lb/ft)', 120, 0, 500, 5)}</div>
          ${sliderRow('bm-M0', 'Applied couple M₀ (lb·ft, ccw +)', 0, -2000, 2000, 25)}
          <div id="bm-cmblock">${sliderRow('bm-cm', 'M₀ acts at x (ft)', 4, 0, 30, 0.1)}</div>
          ${sliderRow('bm-c', 'Cut at x (ft)', 2, 0, 30, 0.05)}
          <label class="check"><input type="checkbox" id="bm-cutfbd" checked /> <span>free-body of the left segment</span></label>
          <p class="tiny">Blue is the shear diagram, gold the moment diagram, both on the beam's own x axis. With the free-body on, the right-hand part of the beam fades and the internal N, V and M appear on the cut face in the chapter's positive senses.</p>
        </div>`;
  },
  bind(api) {
    const clampAll = (s) => {
      s.a = Math.min(s.a, s.L);
      s.cm = Math.min(s.cm, s.L);
      s.c = Math.min(s.c, s.L);
      s.xb = Math.min(s.xb, s.L);
    };
    bindSlider(api, 'bm-L', (s, val) => { s.L = Math.max(0.5, val); clampAll(s); });
    bindSlider(api, 'bm-xb', (s, val) => { s.xb = Math.min(Math.max(0.5, val), s.L); });
    bindSlider(api, 'bm-P', (s, val) => { s.P = val; });
    bindSlider(api, 'bm-a', (s, val) => { s.a = Math.min(Math.max(0, val), s.L); });
    bindSlider(api, 'bm-w', (s, val) => { s.w = val; });
    bindSlider(api, 'bm-M0', (s, val) => { s.M0 = val; });
    bindSlider(api, 'bm-cm', (s, val) => { s.cm = Math.min(Math.max(0, val), s.L); });
    bindSlider(api, 'bm-c', (s, val) => { s.c = Math.min(Math.max(0, val), s.L); });
    document.getElementById('bm-dist').addEventListener('change', (e) => {
      const s = api.slice();
      s.dist = e.target.value;
      if (s.dist !== 'none' && !s.w) s.w = 100;
      api.bump(false);
    });
    document.getElementById('bm-cutfbd').addEventListener('change', (e) => {
      api.slice().showCut = e.target.checked;
      api.bump(false);
    });
  },
  syncControls(state) {
    putSlider('bm-L', state.L, 1);
    putSlider('bm-xb', state.xb, 1);
    putSlider('bm-P', state.P);
    putSlider('bm-a', state.a, 1);
    putSlider('bm-w', state.w);
    putSlider('bm-M0', state.M0);
    putSlider('bm-cm', state.cm, 1);
    putSlider('bm-c', state.c, 2);
    // A slider whose range runs past the span would let you place a load off the beam.
    for (const id of ['bm-a', 'bm-cm', 'bm-c', 'bm-xb']) {
      const el = document.getElementById(id);
      if (el) el.max = String(state.L);
    }
    const d = document.getElementById('bm-dist');
    if (d) d.value = state.dist;
    showBlock('bm-wblock', state.dist !== 'none');
    showBlock('bm-cmblock', !!state.M0);
    showBlock('bm-xbblock', state.support === 'overhang');
    const cb = document.getElementById('bm-cutfbd');
    if (cb) cb.checked = !!state.showCut;
  },
  init(ctx) {
    const group = new THREE.Group();
    ctx.scene.add(group);
    const beamLeft = fatSegments(segmentCapacity(1), { color: M.grey, width: 9 });
    const beamRight = fatSegments(segmentCapacity(1), { color: M.grey, width: 9 });
    const baselines = fatSegments(segmentCapacity(2), { color: M.white, width: 1.2, opacity: 0.5 });
    const vCurve = fatSegments(segmentCapacity(N_SAMPLES), { color: M.blue, width: 2.6 });
    const mCurve = fatSegments(segmentCapacity(N_SAMPLES), { color: M.gold, width: 2.6 });
    const envelope = fatSegments(segmentCapacity(40), { color: M.yellow, width: 1.6, opacity: 0.8 });
    const cutLine = fatSegments(segmentCapacity(1), { color: M.gold, width: 1.6, dashed: true });
    const wall = fatSegments(segmentCapacity(8), { color: M.green, width: 2 });
    const coupleArc = fatSegments(segmentCapacity(40), { color: M.yellow, width: 2.5 });
    const cutArc = markAnswer(fatSegments(segmentCapacity(40), { color: M.pink, width: 2.5 }));
    const wallArc = markAnswer(fatSegments(segmentCapacity(40), { color: M.green, width: 2.5 }));
    group.add(beamLeft, beamRight, baselines, vCurve, mCurve, envelope, cutLine, wall, coupleArc, cutArc, wallArc);
    beamRight.material.opacity = 1;
    beamRight.material.transparent = true;

    const fill = (color) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_SAMPLES * 6 * 3), 3));
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
      mesh.frustumCulled = false;
      return mesh;
    };
    const vFill = markAnswer(fill(M.blue));
    const mFill = markAnswer(fill(M.gold));
    group.add(vFill, mFill);
    markAnswer(vCurve);
    markAnswer(mCurve);

    const dir = new THREE.Vector3(0, -1, 0);
    const mk = (color, w = 0.035) => new Arrow(dir, new THREE.Vector3(), 1, color, 0.24, 0.18, w);
    const load = mk(M.yellow);
    const dist = Array.from({ length: N_DIST }, () => mk(M.yellow, 0.018));
    const react = [0, 1].map(() => markAnswer(mk(M.green)));
    const reactX = markAnswer(mk(M.green));
    const cutV = markAnswer(mk(M.pink));
    const cutN = markAnswer(mk(M.pink));
    const heads = [mk(M.yellow, 0.001), markAnswer(mk(M.pink, 0.001)), markAnswer(mk(M.green, 0.001))];
    group.add(load, ...dist, ...react, reactX, cutV, cutN, ...heads);

    const triGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.2, -0.32, 0), new THREE.Vector3(0.2, -0.32, 0)]);
    const pin = new THREE.Mesh(triGeo, new THREE.MeshBasicMaterial({ color: M.green, toneMapped: false, side: THREE.DoubleSide }));
    const roller = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), new THREE.MeshBasicMaterial({ color: M.green, toneMapped: false }));
    group.add(pin, roller);

    const dotGeo = new THREE.CircleGeometry(0.08, 18);
    const dots = [M.blue, M.gold].map((c) => markAnswer(new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: c, toneMapped: false }))));
    group.add(...dots);

    const labels = {
      V: label('<b>V</b>'), M: label('<b>M</b>'), P: label(''), w: label(''), M0: label(''),
      A: label('A'), B: label('B'), RA: markAnswer(label('')), RB: markAnswer(label('')), MA: markAnswer(label('')),
      cut: markAnswer(label('')), Vc: markAnswer(label('')), Mc: markAnswer(label('')), Mmax: markAnswer(label('')), x0: label('0'), xL: label(''),
    };
    Object.values(labels).forEach((l) => group.add(l));
    group.visible = false;
    return { group, beamLeft, beamRight, baselines, vCurve, mCurve, envelope, cutLine, wall, coupleArc, cutArc, wallArc, vFill, mFill, load, dist, react, reactX, cutV, cutN, heads, pin, roller, dots, labels };
  },
  enter(ctx, handle) {
    handle.group.visible = true;
  },
  exit(ctx, handle) {
    handle.group.visible = false;
  },
  recompute(state, computed) {
    const { reactions, residual, dist, xb } = reactionsFor(state);
    const wfn = distFn(state);
    const loads = [];
    if (state.P) loads.push({ x: state.a, Fy: -state.P });
    if (state.M0) loads.push({ x: state.cm, M: state.M0 });
    const setup = { reactions, loads, dist: wfn ? [{ w: wfn, a: 0, b: state.L }] : [] };
    const pts = shearMomentDiagram(state.L, setup, N_SAMPLES);
    const at = internalAt(state.c, setup);

    // ∫V dx from 0 to the cut — the moment diagram's other definition. V jumps at every point load
    // and is at most quadratic in between, so split at the loads and Simpson is exact on each piece
    // (trapezoids on the sampled diagram lose P·Δx/2 at every jump).
    const breaks = [0, state.c, ...[...reactions, ...loads].map((r) => r.x)]
      .filter((x) => x >= 0 && x <= state.c)
      .sort((p, q) => p - q);
    const Vat = (x) => internalAt(x, setup).V;
    let areaV = 0;
    for (let i = 1; i < breaks.length; i++) {
      const x0 = breaks[i - 1];
      const x1 = breaks[i];
      if (x1 - x0 < 1e-12) continue;
      const e = (x1 - x0) * 1e-9;
      areaV += ((x1 - x0) / 6) * (Vat(x0 + e) + 4 * Vat((x0 + x1) / 2) + Vat(x1 - e));
    }
    // Couples and a fixed wall's moment jump M without any shear, so add those jumps back in.
    // M is zero just left of the beam's end, so M(c) = ∫V dx plus those jumps.
    const jumps = [...reactions, ...loads].filter((r) => r.M && r.x <= state.c + 1e-12).reduce((s, r) => s - r.M, 0);

    // The peak moment sits at a kink (a point load or support) or where V crosses zero, and either
    // can fall between samples — so evaluate those exact points as candidates too.
    const kinks = [...reactions, ...loads].map((r) => r.x).filter((x) => x >= 0 && x <= state.L);
    const cand = [...pts];
    for (const x of kinks) for (const e of [-1e-9, 1e-9]) if (x + e >= 0 && x + e <= state.L) cand.push({ x, ...internalAt(x + e, setup) });
    const zeroV = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1].V;
      const b = pts[i].V;
      if ((a > 1e-9 && b < -1e-9) || (a < -1e-9 && b > 1e-9)) {
        // A point load makes V jump across zero; only a smooth crossing is a stationary point of M.
        const x0 = pts[i - 1].x;
        const x1 = pts[i].x;
        const jump = kinks.find((x) => x >= x0 - 1e-9 && x <= x1 + 1e-9);
        zeroV.push(jump ?? x0 + (x1 - x0) * (a / (a - b)));
      }
    }
    for (const x of zeroV) cand.push({ x, ...internalAt(x, setup) });
    let best = cand[0];
    for (const p of cand) if (Math.abs(p.M) > Math.abs(best.M) + 1e-9) best = p;
    computed.beam = {
      reactions,
      residual,
      dist,
      xb,
      pts,
      at,
      areaV,
      MfromV: areaV + jumps,
      Mmax: best,
      zeroV,
      wfn,
    };
  },
  syncViews(state, computed, ctx) {
    const h = ctx.handle;
    const c = computed.beam;
    if (!h || !c) return;
    const L = state.L;
    const X = (x) => OX - HALF + (2 * HALF * x) / L;
    const Lb = h.labels;
    const put = (lab, x, y, html) => {
      lab.visible = true;
      lab.position.set(x, y, 0);
      if (html != null) lab.element.innerHTML = html;
    };
    const aim = (arrow, from, to) => {
      const d = to.clone().sub(from);
      const len = d.length();
      arrow.visible = len > 1e-4;
      if (!arrow.visible) return;
      arrow.position.copy(from);
      arrow.setDirection(d.normalize());
      arrow.setLength(len);
    };
    const cutX = X(state.c);
    const fbd = state.showCut;

    // The beam, faded to the right of the cut when the left segment is the free body.
    setFatSegments(h.beamLeft, [X(0), Y_BEAM, 0, fbd ? cutX : X(L), Y_BEAM, 0]);
    setFatSegments(h.beamRight, fbd ? [cutX, Y_BEAM, 0, X(L), Y_BEAM, 0] : []);
    h.beamRight.material.opacity = 0.22;
    setFatSegments(h.baselines, [X(0), Y_V, 0, X(L), Y_V, 0, X(0), Y_M, 0, X(L), Y_M, 0]);
    put(Lb.V, X(0) - 0.45, Y_V, '<b>V</b>');
    put(Lb.M, X(0) - 0.45, Y_M, '<b>M</b>');
    put(Lb.x0, X(0), Y_M - AMP - 0.3, '0');
    put(Lb.xL, X(L), Y_M - AMP - 0.3, `${L} ft`);

    // Supports.
    const faded = (x) => fbd && x > state.c + 1e-9;
    h.pin.visible = false;
    h.roller.visible = false;
    const wall = [];
    if (state.support === 'cantilever') {
      const x = X(0);
      wall.push(x, Y_BEAM - 0.6, 0, x, Y_BEAM + 0.6, 0);
      for (let i = 0; i < 5; i++) {
        const y = Y_BEAM - 0.55 + i * 0.27;
        wall.push(x, y, 0, x - 0.2, y - 0.18, 0);
      }
    } else {
      h.pin.visible = true;
      h.pin.position.set(X(0), Y_BEAM - 0.06, 0);
      h.roller.visible = true;
      h.roller.position.set(X(c.xb), Y_BEAM - 0.22, 0);
    }
    setFatSegments(h.wall, wall);
    put(Lb.A, X(0), Y_BEAM + 0.3, 'A');
    Lb.B.visible = false;
    if (state.support !== 'cantilever') put(Lb.B, X(c.xb), Y_BEAM + 0.3, 'B');

    // Loads: point load, distributed load (arrows under an envelope), applied couple.
    const peakW = Math.max(state.w, 1e-9);
    h.load.visible = false;
    Lb.P.visible = false;
    // Loads past the cut are not on the left segment's free body: dim them rather than hide them.
    const tone = (x, col) => (faded(x) ? M.greyDark : col);
    if (state.P) {
      h.load.setColor(tone(state.a, M.yellow));
      aim(h.load, new THREE.Vector3(X(state.a), Y_BEAM + 1.35, 0), new THREE.Vector3(X(state.a), Y_BEAM + 0.1, 0));
      put(Lb.P, X(state.a), Y_BEAM + 1.55, `P = ${state.P.toFixed(0)} lb`);
    }
    const env = [];
    h.dist.forEach((a) => { a.visible = false; });
    Lb.w.visible = false;
    if (c.wfn) {
      const top = (x) => Y_BEAM + 0.15 + (0.75 * -c.wfn(x)) / peakW;
      const xEnd = L;
      const n = 30;
      for (let i = 0; i < n; i++) {
        const x0 = (xEnd * i) / n;
        const x1 = (xEnd * (i + 1)) / n;
        env.push(X(x0), top(x0), 0, X(x1), top(x1), 0);
      }
      h.dist.forEach((arrow, i) => {
        const x = (L * i) / (N_DIST - 1);
        if (x > xEnd + 1e-9 || -c.wfn(x) < 1e-9) return;
        arrow.setColor(tone(x, M.yellow));
        aim(arrow, new THREE.Vector3(X(x), top(x), 0), new THREE.Vector3(X(x), Y_BEAM + 0.08, 0));
      });
      put(Lb.w, X(xEnd * 0.25), top(xEnd * 0.25) + 0.25, `w = ${state.w.toFixed(0)} lb/ft${state.dist === 'triangular' ? ' (peak)' : ''}`);
    }
    setFatSegments(h.envelope, env);

    const [headCouple, headCut, headWall] = h.heads;
    headCouple.visible = false;
    headCut.visible = false;
    headWall.visible = false;
    Lb.M0.visible = false;
    let cArc = [];
    if (state.M0) {
      const ctr = new THREE.Vector3(X(state.cm), Y_BEAM, 0);
      cArc = curl(headCouple, ctr, 0.42, Math.sign(state.M0));
      put(Lb.M0, ctr.x, ctr.y + 0.7, `M₀ = ${state.M0.toFixed(0)} lb·ft`);
    }
    setFatSegments(h.coupleArc, cArc);

    // Reactions, in green, scaled against the biggest force on the beam.
    const Fs = [state.P, Math.abs(c.dist?.F || 0), ...c.reactions.map((r) => Math.hypot(r.Fx || 0, r.Fy))];
    const kF = 1.15 / Math.max(...Fs, 1e-9);
    h.react.forEach((a) => { a.visible = false; });
    h.reactX.visible = false;
    [Lb.RA, Lb.RB, Lb.MA].forEach((l) => { l.visible = false; });
    c.reactions.forEach((r, i) => {
      h.react[i].setColor(tone(r.x, M.green));
      const x = X(r.x);
      const base = Y_BEAM - (state.support === 'cantilever' ? 0.08 : 0.42);
      const len = Math.max(0.25, Math.abs(r.Fy) * kF);
      if (Math.abs(r.Fy) > 1e-9) {
        const up = r.Fy > 0;
        aim(h.react[i], new THREE.Vector3(x, up ? base - len : base, 0), new THREE.Vector3(x, up ? base : base - len, 0));
      }
      put(i === 0 ? Lb.RA : Lb.RB, x + 0.1, base - len - 0.28, `${r.name}<sub>y</sub> = ${r.Fy.toFixed(1)} lb`);
    });
    const RA = c.reactions[0];
    let wArc = [];
    if (RA.M) {
      wArc = curl(headWall, new THREE.Vector3(X(0), Y_BEAM, 0), 0.5, Math.sign(RA.M));
      put(Lb.MA, X(0) - 0.2, Y_BEAM + 0.85, `M<sub>A</sub> = ${RA.M.toFixed(0)} lb·ft`);
    }
    setFatSegments(h.wallArc, wArc);

    // Diagrams.
    const pts = c.pts;
    const peakV = Math.max(1e-9, ...pts.map((p) => Math.abs(p.V)));
    const peakM = Math.max(1e-9, ...pts.map((p) => Math.abs(p.M)));
    const yV = (V) => Y_V + (AMP * V) / peakV;
    const yM = (m) => Y_M + (AMP * m) / peakM;
    const curve = (fn) => {
      const out = [];
      for (let i = 1; i < pts.length; i++) out.push(X(pts[i - 1].x), fn(pts[i - 1]), 0.01, X(pts[i].x), fn(pts[i]), 0.01);
      return out;
    };
    setFatSegments(h.vCurve, curve((p) => yV(p.V)));
    setFatSegments(h.mCurve, curve((p) => yM(p.M)));
    setFill(h.vFill, pts, X, (p) => yV(p.V), Y_V);
    setFill(h.mFill, pts, X, (p) => yM(p.M), Y_M);
    put(Lb.Mmax, X(c.Mmax.x), yM(c.Mmax.M) + (c.Mmax.M >= 0 ? 0.28 : -0.28), `|M|<sub>max</sub> = ${Math.abs(c.Mmax.M).toFixed(0)}`);

    // The cut: one line through the beam and both diagrams, with the values it reads.
    setFatSegments(h.cutLine, [cutX, Y_BEAM + 1.0, 0, cutX, Y_M - AMP - 0.1, 0]);
    h.cutLine.computeLineDistances();
    h.dots[0].position.set(cutX, yV(c.at.V), 0.02);
    h.dots[1].position.set(cutX, yM(c.at.M), 0.02);
    put(Lb.Vc, cutX + 0.12, yV(c.at.V) + 0.25, `V = ${c.at.V.toFixed(1)}`);
    put(Lb.Mc, cutX + 0.12, yM(c.at.M) + 0.25, `M = ${c.at.M.toFixed(1)}`);
    put(Lb.cut, cutX, Y_BEAM + 1.15, `cut · x = ${state.c.toFixed(2)} ft`);
    Lb.cut.visible = !(state.P && Math.abs(state.a - state.c) < L * 0.08);

    // Internal forces on the left segment's cut face, in their positive senses: V down, M
    // counterclockwise, N pulling away. Drawn in the direction they actually act.
    h.cutV.visible = false;
    h.cutN.visible = false;
    let arc = [];
    if (fbd && state.c > 1e-6) {
      const face = new THREE.Vector3(cutX, Y_BEAM, 0);
      if (Math.abs(c.at.V) > 1e-9) {
        const down = c.at.V > 0;
        aim(h.cutV, face.clone().add(new THREE.Vector3(0.12, down ? 0.75 : -0.75, 0)), face.clone().add(new THREE.Vector3(0.12, 0, 0)));
      }
      if (Math.abs(c.at.N) > 1e-9) aim(h.cutN, face, face.clone().add(new THREE.Vector3(c.at.N > 0 ? 0.7 : -0.7, 0, 0)));
      if (Math.abs(c.at.M) > 1e-9) arc = curl(headCut, face, 0.38, Math.sign(c.at.M));
    }
    setFatSegments(h.cutArc, arc);
    ctx.grid.visible = false;
  },
  law: () => [
    String.raw`\frac{dV}{dx} = w(x), \qquad \frac{dM}{dx} = V`,
    String.raw`M(x) = M(0) + \int_0^x V\,dx \;+\; \text{couple jumps}`,
  ],
  liveRows(state, computed) {
    const c = computed.beam;
    if (!c) return '';
    const f = (x, d = 1) => x.toFixed(d);
    const rows = [kv('supports', SUPPORT_TEXT[state.support])];
    for (const r of c.reactions) {
      rows.push(kv(`$${r.name}_y$`, qv('qV', `${f(r.Fy)} lb`)));
      if (r.M) rows.push(kv(`$M_${r.name}$ (wall)`, qv('qV', `${f(r.M)} lb·ft`)));
    }
    if (c.dist) rows.push(kv('distributed resultant', `${f(Math.abs(c.dist.F))} lb at x = ${f(c.dist.x, 2)} ft`));
    rows.push(kv(`at the cut, $x = ${f(state.c, 2)}$ ft`, `N = ${f(c.at.N)} · V = ${f(c.at.V)} lb`));
    rows.push(kv('$M$ at the cut (left segment)', qv('qV', `${f(c.at.M)} lb·ft`)));
    rows.push(kv(String.raw`$M(0) + \int_0^x V\,dx$ + jumps`, qv(Math.abs(c.MfromV - c.at.M) < 0.01 * Math.max(1, Math.abs(c.Mmax.M)) ? 'qR' : 'qI', `${f(c.MfromV)} lb·ft`)));
    rows.push(kv('$|M|_{max}$', `${f(Math.abs(c.Mmax.M))} lb·ft at x = ${f(c.Mmax.x, 2)} ft`));
    if (c.zeroV.length) rows.push(kv('$V = 0$ at', `x = ${c.zeroV.map((x) => f(x, 2)).join(', ')} ft`));
    rows.push(kv(String.raw`$\sum F_y,\ \sum M_A$`, qv('qR', `${c.residual.Fy.toExponential(1)}, ${c.residual.M.toExponential(1)}`)));
    return rows.join('');
  },
  readout(state, computed) {
    const c = computed.beam;
    if (!c) return '';
    return cells([
      ['$V$ at cut', `${c.at.V.toFixed(1)} lb`, 'ok'],
      ['$M$ at cut', `${c.at.M.toFixed(1)} lb·ft`, 'ok'],
      ['$|M|_{max}$', `${Math.abs(c.Mmax.M).toFixed(0)} lb·ft`, ''],
      [c.reactions[1] ? '$A_y$ · $B_y$' : '$A_y$ · $M_A$', c.reactions[1] ? `${c.reactions[0].Fy.toFixed(0)} · ${c.reactions[1].Fy.toFixed(0)} lb` : `${c.reactions[0].Fy.toFixed(0)} lb · ${c.reactions[0].M.toFixed(0)}`, ''],
    ]);
  },
  coach(state, computed) {
    const c = computed.beam;
    if (!c) return { title: '', body: '' };
    if (state.support === 'cantilever') {
      return {
        title: 'A cantilever needs no reactions to cut',
        body: [
          'Take the free body to the right of the cut instead: it carries only the loads you were given, so V and M come out without solving for the wall at all.',
          String.raw`The moment is negative everywhere — the beam hogs, stretched on top — and largest at the wall, where it must balance every load's moment. That wall value is the fixed-support reaction $M_A$ with the sign turned into the beam convention.`,
          'Hibbeler signs: V positive when it pushes the left segment\'s face down; M positive when the beam sags (compression on top).',
        ],
      };
    }
    if (state.M0) {
      return {
        title: 'A couple jumps the moment diagram, and leaves shear alone',
        body: [
          String.raw`A couple adds no force, so the shear diagram does not notice it. The moment diagram jumps by $M_0$ right where it acts — down for a counterclockwise couple, up for a clockwise one.`,
          String.raw`That is why the panel's check adds "couple jumps" to $\int V\,dx$: area under the shear only accounts for forces.`,
        ],
      };
    }
    return {
      title: 'Read the diagrams off each other',
      body: [
        String.raw`Three relationships do almost all of the work:`,
        eq(String.raw`\frac{dV}{dx} = w, \qquad \frac{dM}{dx} = V, \qquad \Delta M = \int V\,dx`),
        String.raw`A uniform load makes the shear a sloped line and the moment a parabola; a point load makes a jump in $V$ and a kink in $M$. The moment peaks where the shear crosses zero${c.zeroV.length ? ` — here at x = ${c.zeroV[0].toFixed(2)} ft` : ''}.`,
        String.raw`Slide the cut: the gold $M$ at the cut equals the blue area to its left. The panel computes both, from the free body and from the diagram, and they agree.`,
      ],
    };
  },
});

/** Fill between a sampled curve and its baseline, two triangles per sample interval. */
function setFill(mesh, pts, X, yOf, base) {
  const arr = mesh.geometry.attributes.position.array;
  let k = 0;
  for (let i = 1; i < pts.length && k + 18 <= arr.length; i++) {
    const x0 = X(pts[i - 1].x);
    const x1 = X(pts[i].x);
    const y0 = yOf(pts[i - 1]);
    const y1 = yOf(pts[i]);
    const quad = [x0, base, x0, y0, x1, y1, x0, base, x1, y1, x1, base];
    for (let j = 0; j < 6; j++) {
      arr[k++] = quad[2 * j];
      arr[k++] = quad[2 * j + 1];
      arr[k++] = 0;
    }
  }
  mesh.geometry.attributes.position.needsUpdate = true;
  mesh.geometry.setDrawRange(0, k / 3);
}

/** A curled arrow around `c` for a couple: sign +1 counterclockwise. Returns the arc segments. */
function curl(head, c, r, sign) {
  const sweep = sign * 1.4 * Math.PI;
  const start = Math.PI / 2 - sweep / 2;
  const endA = start + sweep;
  const end = new THREE.Vector3(c.x + r * Math.cos(endA), c.y + r * Math.sin(endA), c.z);
  const tangent = new THREE.Vector3(-Math.sin(endA), Math.cos(endA), 0).multiplyScalar(sign);
  head.visible = true;
  head.position.copy(end).addScaledVector(tangent, -0.22);
  head.setDirection(tangent);
  head.setLength(0.22, 0.2, 0.16);
  return arcSegments(c, r, start, sweep * 0.9, 36);
}
