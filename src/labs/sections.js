import * as THREE from 'three';
import { defineLab } from './define.js';
import { label, sliderRow, bindSlider, putSlider } from './parts.js';
import { M, fatSegments, markAnswer, setFatSegments, segmentCapacity, disposeTree } from '../scene/manim.js';
import { rectI, triI, circI, semiI, radiusOfGyration } from '../physics/sections.js';
import { kv, cells, qv, eq } from '../ui/shared.js';

/**
 * Ch 9 centroids and Ch 10 area moments of inertia, by composite parts.
 *
 * The lab is the table you would fill in on an exam — A, x̄, ȳ, Ax̄, Aȳ for the centroid, then
 * Ī + Ad² for the inertia — computed live beside the shape it describes. Holes are parts with
 * negative area. The check: I about the base, and Ī + Aȳ² from the centroidal answer, must agree.
 */

const COLORS = [M.blue, M.teal, M.purple, M.green];

/** Parameters per shape: [label, default, min, max, step]. */
const SHAPES = {
  L: { name: 'L-section', dims: [['base width w₁', 6, 1, 12, 0.5], ['base height h₁', 2, 0.5, 8, 0.5], ['upright width w₂', 2, 0.5, 12, 0.5], ['upright height h₂', 4, 0.5, 10, 0.5]] },
  T: { name: 'T-section', dims: [['flange width b', 6, 1, 14, 0.5], ['web height h', 8, 1, 14, 0.5], ['thickness t', 2, 0.5, 5, 0.25]] },
  I: { name: 'I-beam', dims: [['flange width b', 6, 1, 14, 0.5], ['total depth d', 10, 2, 16, 0.5], ['flange thickness t_f', 1, 0.25, 4, 0.25], ['web thickness t_w', 0.75, 0.25, 4, 0.25]] },
  hole: { name: 'Plate with a hole', dims: [['plate width w', 8, 2, 14, 0.5], ['plate height h', 5, 2, 12, 0.5], ['hole radius r', 1.2, 0.25, 5, 0.05], ['hole centre x', 5.5, 0.5, 14, 0.25]] },
  tri: { name: 'Rectangle + triangle', dims: [['width w', 6, 1, 12, 0.5], ['rectangle height h', 3, 0.5, 10, 0.5], ['triangle height hₜ', 4, 0.5, 10, 0.5]] },
  arch: { name: 'Rectangle + semicircle', dims: [['width w', 6, 1, 12, 0.5], ['rectangle height h', 4, 0.5, 10, 0.5]] },
};

const SCENARIOS = [
  { id: 'L', name: 'L-section · centroid', shape: 'L', mode: 'centroid' },
  { id: 'T', name: 'T-section · moment of inertia', shape: 'T', mode: 'inertia' },
  { id: 'I', name: 'I-beam · why the flanges matter', shape: 'I', mode: 'inertia' },
  { id: 'hole', name: 'Plate with a hole · negative area', shape: 'hole', mode: 'centroid' },
  { id: 'tri', name: 'Rectangle + triangle', shape: 'tri', mode: 'centroid' },
  { id: 'arch', name: 'Rectangle + semicircle', shape: 'arch', mode: 'inertia' },
];

/**
 * The shape as parts. Each part: { name, kind, sign, A, x, y, Ix, Iy, draw } with Ix, Iy about the
 * part's own centroid and signed (a hole subtracts). `draw` is what the scene needs to build it.
 */
export function partsFor(shape, p) {
  const out = [];
  const rect = (name, w, h, x0, y0, sign = 1) => {
    const I = rectI(w, h);
    out.push({ name, kind: 'rect', sign, A: sign * w * h, x: x0 + w / 2, y: y0 + h / 2, Ix: sign * I.Ix, Iy: sign * I.Iy, draw: { w, h, x0, y0 } });
  };
  const tri = (name, b, h, x0, y0) => {
    const I = triI(b, h);
    out.push({ name, kind: 'tri', sign: 1, A: (b * h) / 2, x: x0 + b / 3, y: y0 + h / 3, Ix: I.Ix, Iy: I.Iy, draw: { b, h, x0, y0 } });
  };
  const circ = (name, r, cx, cy, sign = -1) => {
    const I = circI(r);
    out.push({ name, kind: 'circ', sign, A: sign * Math.PI * r * r, x: cx, y: cy, Ix: sign * I.Ix, Iy: sign * I.Iy, draw: { r, cx, cy } });
  };
  const semi = (name, r, cx, cy) => {
    const I = semiI(r);
    out.push({ name, kind: 'semi', sign: 1, A: (Math.PI * r * r) / 2, x: cx, y: cy + (4 * r) / (3 * Math.PI), Ix: I.Ix, Iy: I.Iy, draw: { r, cx, cy } });
  };
  if (shape === 'L') {
    const [w1, h1, w2, h2] = p;
    rect('base', w1, h1, 0, 0);
    rect('upright', Math.min(w2, w1), h2, 0, h1);
  } else if (shape === 'T') {
    const [b, h, t] = p;
    rect('web', t, h, -t / 2, 0);
    rect('flange', b, t, -b / 2, h);
  } else if (shape === 'I') {
    const [b, d, tf, tw] = p;
    const f = Math.min(tf, d / 2.2);
    rect('bottom flange', b, f, -b / 2, 0);
    rect('web', Math.min(tw, b), d - 2 * f, -Math.min(tw, b) / 2, f);
    rect('top flange', b, f, -b / 2, d - f);
  } else if (shape === 'hole') {
    const [w, h, r, xh] = p;
    const cx = Math.min(Math.max(xh, 0.3), w - 0.3);
    const rr = Math.min(r, h / 2 - 0.1, cx - 0.1, w - cx - 0.1);
    rect('plate', w, h, 0, 0);
    circ('hole', Math.max(0.05, rr), cx, h / 2);
  } else if (shape === 'tri') {
    const [w, h, ht] = p;
    rect('rectangle', w, h, 0, 0);
    tri('triangle', w, ht, 0, h);
  } else {
    const [w, h] = p;
    rect('rectangle', w, h, -w / 2, 0);
    semi('semicircle', w / 2, 0, h);
  }
  return out;
}

/** Centroid, and both inertias, straight from the table columns. */
export function analyse(parts) {
  const A = parts.reduce((s, q) => s + q.A, 0);
  const xbar = parts.reduce((s, q) => s + q.A * q.x, 0) / A;
  const ybar = parts.reduce((s, q) => s + q.A * q.y, 0) / A;
  const rows = parts.map((q) => ({ ...q, dy: q.y - ybar, dx: q.x - xbar }));
  const Ix = rows.reduce((s, q) => s + q.Ix + q.A * q.dy ** 2, 0);
  const Iy = rows.reduce((s, q) => s + q.Iy + q.A * q.dx ** 2, 0);
  const IxBase = rows.reduce((s, q) => s + q.Ix + q.A * q.y ** 2, 0);
  return { A, xbar, ybar, rows, Ix, Iy, IxBase, kx: radiusOfGyration(Ix, A), ky: radiusOfGyration(Iy, A) };
}

const f = (x, d = 2) => (Math.abs(x) < 5e-13 ? (0).toFixed(d) : x.toFixed(d));

export default defineLab({
  id: 'sections',
  exam: 'u4',
  title: 'Sections',
  hint: 'Change a dimension and watch every column of the table move — the table is the method',
  orbit: false,
  camera: { pos: new THREE.Vector3(0.2, 0.2, 13), target: new THREE.Vector3(0.2, 0.2, 0) },
  keys: { r: 'reset', R: 'reset' },
  scenarios: SCENARIOS,
  defaultState() {
    return { scenarioId: 'L', shape: 'L', mode: 'centroid', p: SHAPES.L.dims.map((d) => d[1]) };
  },
  applyScenario(id, state) {
    const sc = SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
    Object.assign(state, { scenarioId: sc.id, shape: sc.shape, mode: sc.mode, p: SHAPES[sc.shape].dims.map((d) => d[1]) });
  },
  controls() {
    const rows = [0, 1, 2, 3].map((i) => `<div id="sc-row${i}">${sliderRow(`sc-p${i}`, `<span id="sc-l${i}">p${i}</span> (in)`, 1, 0.25, 14, 0.25)}</div>`).join('');
    return `
        <div class="lab-block">
          <div class="seg" role="group">
            <label class="check"><input type="radio" name="sc-mode" value="centroid" /> <span>centroid (Ch 9)</span></label>
            <label class="check"><input type="radio" name="sc-mode" value="inertia" /> <span>moment of inertia (Ch 10)</span></label>
          </div>
          ${rows}
          <p class="tiny">Each coloured piece is one row of the table; its dot is that piece's own centroid. Gold is the composite centroid. In the inertia view, the dashed line is the centroidal axis and the pink bars are each piece's d — the distance the parallel-axis theorem squares.</p>
        </div>`;
  },
  bind(api) {
    [0, 1, 2, 3].forEach((i) => bindSlider(api, `sc-p${i}`, (s, val) => { s.p[i] = val; }));
    document.querySelectorAll('input[name="sc-mode"]').forEach((el) => el.addEventListener('change', (e) => {
      api.slice().mode = e.target.value;
      api.bump(false);
    }));
  },
  syncControls(state) {
    const dims = SHAPES[state.shape].dims;
    [0, 1, 2, 3].forEach((i) => {
      const row = document.getElementById(`sc-row${i}`);
      if (row) row.style.display = dims[i] ? '' : 'none';
      if (!dims[i]) return;
      const [text, , min, max, step] = dims[i];
      const l = document.getElementById(`sc-l${i}`);
      if (l) l.textContent = text;
      const s = document.getElementById(`sc-p${i}`);
      if (s) Object.assign(s, { min: String(min), max: String(max), step: String(step) });
      putSlider(`sc-p${i}`, state.p[i], 2);
    });
    document.querySelectorAll('input[name="sc-mode"]').forEach((el) => { el.checked = el.value === state.mode; });
  },
  init(ctx) {
    const group = new THREE.Group();
    ctx.scene.add(group);
    const partsGroup = new THREE.Group();
    const axes = fatSegments(segmentCapacity(2), { color: M.white, width: 1.4, opacity: 0.5 });
    const outline = fatSegments(segmentCapacity(80), { color: M.red, width: 2, dashed: true });
    const cross = markAnswer(fatSegments(segmentCapacity(2), { color: M.gold, width: 3 }));
    const caxis = markAnswer(fatSegments(segmentCapacity(1), { color: M.gold, width: 1.6, dashed: true }));
    const dbars = markAnswer(fatSegments(segmentCapacity(4), { color: M.pink, width: 2.5 }));
    group.add(partsGroup, axes, outline, cross, caxis, dbars);
    const labels = { x: label('x'), y: label('y'), O: label('O'), C: markAnswer(label('')), parts: [0, 1, 2, 3].map(() => label('')), d: [0, 1, 2, 3].map(() => markAnswer(label(''))) };
    group.add(labels.x, labels.y, labels.O, labels.C, ...labels.parts, ...labels.d);
    group.visible = false;
    return { group, partsGroup, axes, outline, cross, caxis, dbars, labels };
  },
  enter(ctx, handle) {
    handle.group.visible = true;
  },
  exit(ctx, handle) {
    handle.group.visible = false;
  },
  recompute(state, computed) {
    const parts = partsFor(state.shape, state.p);
    computed.sec = { parts, ...analyse(parts) };
  },
  syncViews(state, computed, ctx) {
    const h = ctx.handle;
    const c = computed.sec;
    if (!h || !c) return;

    // Fit the shape (and the origin) into the space between the panels.
    const box = { x0: 0, x1: 0, y0: 0, y1: 0 };
    for (const q of c.parts) {
      const d = q.draw;
      const [x0, x1, y0, y1] = q.kind === 'rect' ? [d.x0, d.x0 + d.w, d.y0, d.y0 + d.h]
        : q.kind === 'tri' ? [d.x0, d.x0 + d.b, d.y0, d.y0 + d.h]
          : q.kind === 'circ' ? [d.cx - d.r, d.cx + d.r, d.cy - d.r, d.cy + d.r]
            : [d.cx - d.r, d.cx + d.r, d.cy, d.cy + d.r];
      box.x0 = Math.min(box.x0, x0);
      box.x1 = Math.max(box.x1, x1);
      box.y0 = Math.min(box.y0, y0);
      box.y1 = Math.max(box.y1, y1);
    }
    const s = Math.min(6.4 / (box.x1 - box.x0 || 1), 5.2 / (box.y1 - box.y0 || 1));
    const ox = -((box.x0 + box.x1) / 2) * s + 0.2;
    const oy = -((box.y0 + box.y1) / 2) * s + 0.2;
    const P = (x, y, z = 0) => new THREE.Vector3(ox + x * s, oy + y * s, z);

    // Rebuild the pieces: dimensions change their geometry, and this is cheap.
    disposeTree(h.partsGroup);
    h.partsGroup.clear();
    const outline = [];
    c.parts.forEach((q, i) => {
      const hole = q.sign < 0;
      const mat = new THREE.MeshBasicMaterial({ color: hole ? M.bg : COLORS[i % COLORS.length], transparent: !hole, opacity: hole ? 1 : 0.55, toneMapped: false, side: THREE.DoubleSide, depthWrite: false });
      const d = q.draw;
      let geo;
      let at;
      if (q.kind === 'rect') {
        geo = new THREE.PlaneGeometry(d.w * s, d.h * s);
        at = P(d.x0 + d.w / 2, d.y0 + d.h / 2, 0.01 * i);
      } else if (q.kind === 'tri') {
        const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(d.b * s, 0), new THREE.Vector2(0, d.h * s)]);
        geo = new THREE.ShapeGeometry(sh);
        at = P(d.x0, d.y0, 0.01 * i);
      } else if (q.kind === 'circ') {
        geo = new THREE.CircleGeometry(d.r * s, 48);
        at = P(d.cx, d.cy, 0.05);
        for (let k = 0; k < 40; k++) {
          const a0 = (k / 40) * 2 * Math.PI;
          const a1 = ((k + 1) / 40) * 2 * Math.PI;
          const p0 = P(d.cx + d.r * Math.cos(a0), d.cy + d.r * Math.sin(a0), 0.06);
          const p1 = P(d.cx + d.r * Math.cos(a1), d.cy + d.r * Math.sin(a1), 0.06);
          outline.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
        }
      } else {
        geo = new THREE.CircleGeometry(d.r * s, 48, 0, Math.PI);
        at = P(d.cx, d.cy, 0.01 * i);
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(at);
      h.partsGroup.add(mesh);
      if (hole) mesh.renderOrder = 2;
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.07, 16), new THREE.MeshBasicMaterial({ color: hole ? M.red : M.white, toneMapped: false }));
      dot.position.copy(P(q.x, q.y, 0.08));
      dot.renderOrder = 3;
      h.partsGroup.add(dot);
      const L = h.labels.parts[i];
      L.visible = true;
      L.position.copy(P(q.x, q.y)).add(new THREE.Vector3(0, -0.24, 0));
      L.element.innerHTML = `<span class="tiny">${i + 1} · ${q.name}</span>`;
    });
    for (let i = c.parts.length; i < 4; i++) h.labels.parts[i].visible = false;
    setFatSegments(h.outline, outline);
    h.outline.computeLineDistances();

    // Reference axes through the origin the table measures from.
    const o = P(0, 0);
    const xEnd = P(box.x1 + 0.6 / s * 1.2, 0);
    const yEnd = P(0, box.y1 + 0.6 / s * 1.2);
    const xStart = P(Math.min(box.x0, 0) - 0.3 / s, 0);
    setFatSegments(h.axes, [xStart.x, o.y, 0.1, xEnd.x, o.y, 0.1, o.x, o.y, 0.1, o.x, yEnd.y, 0.1]);
    h.labels.x.position.set(xEnd.x + 0.18, o.y, 0);
    h.labels.y.position.set(o.x, yEnd.y + 0.2, 0);
    h.labels.O.position.set(o.x - 0.2, o.y - 0.22, 0);

    // The composite centroid.
    const C = P(c.xbar, c.ybar, 0.12);
    const r = 0.26;
    setFatSegments(h.cross, [C.x - r, C.y, C.z, C.x + r, C.y, C.z, C.x, C.y - r, C.z, C.x, C.y + r, C.z]);
    h.labels.C.position.set(C.x + 0.55, C.y + 0.26, 0);
    h.labels.C.element.innerHTML = `C (${f(c.xbar)}, ${f(c.ybar)})`;

    // Inertia view: the centroidal axis and each part's d.
    const inertia = state.mode === 'inertia';
    const a0 = P(box.x0, c.ybar, 0.12);
    const a1 = P(box.x1, c.ybar, 0.12);
    setFatSegments(h.caxis, inertia ? [a0.x - 0.4, a0.y, a0.z, a1.x + 0.4, a1.y, a1.z] : []);
    h.caxis.computeLineDistances();
    const bars = [];
    c.rows.forEach((q, i) => {
      const L = h.labels.d[i];
      L.visible = inertia && Math.abs(q.dy) > 1e-6;
      if (!L.visible) return;
      const off = (i - (c.rows.length - 1) / 2) * 0.12;
      const p0 = P(q.x, q.y, 0.14).add(new THREE.Vector3(off, 0, 0));
      const p1 = P(q.x, c.ybar, 0.14).add(new THREE.Vector3(off, 0, 0));
      bars.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      L.position.copy(p0.clone().lerp(p1, 0.5)).add(new THREE.Vector3(0.42, 0, 0));
      L.element.innerHTML = `<span class="tiny">d<sub>${i + 1}</sub> = ${f(Math.abs(q.dy))}</span>`;
    });
    for (let i = c.rows.length; i < 4; i++) h.labels.d[i].visible = false;
    setFatSegments(h.dbars, bars);
    ctx.grid.visible = false;
  },
  law: (state) => (state?.mode === 'inertia'
    ? [String.raw`\bar{I}_x = \sum\left(\bar{I}_{x,i} + A_i d_i^2\right)`, String.raw`k_x = \sqrt{\bar{I}_x / A}`]
    : [String.raw`\bar{x} = \frac{\sum A_i \tilde{x}_i}{\sum A_i}, \qquad \bar{y} = \frac{\sum A_i \tilde{y}_i}{\sum A_i}`]),
  liveRows(state, computed) {
    const c = computed.sec;
    if (!c) return '';
    const inertia = state.mode === 'inertia';
    const head = inertia
      ? '<tr><th>#</th><th>A</th><th>d</th><th>Ī<sub>x</sub></th><th>Ad²</th></tr>'
      : '<tr><th>#</th><th>A</th><th>x̃</th><th>ỹ</th><th>Ax̃</th><th>Aỹ</th></tr>';
    const body = c.rows.map((q, i) => (inertia
      ? `<tr><td>${i + 1}</td><td>${f(q.A)}</td><td>${f(q.dy)}</td><td>${f(q.Ix)}</td><td>${f(q.A * q.dy ** 2)}</td></tr>`
      : `<tr><td>${i + 1}</td><td>${f(q.A)}</td><td>${f(q.x)}</td><td>${f(q.y)}</td><td>${f(q.A * q.x)}</td><td>${f(q.A * q.y)}</td></tr>`)).join('');
    const sum = inertia
      ? `<tr class="sum"><td>Σ</td><td>${f(c.A)}</td><td></td><td>${f(c.rows.reduce((s, q) => s + q.Ix, 0))}</td><td>${f(c.rows.reduce((s, q) => s + q.A * q.dy ** 2, 0))}</td></tr>`
      : `<tr class="sum"><td>Σ</td><td>${f(c.A)}</td><td></td><td></td><td>${f(c.A * c.xbar)}</td><td>${f(c.A * c.ybar)}</td></tr>`;
    const table = `<table class="ptab">${head}${body}${sum}</table>`;
    const rows = [table];
    if (inertia) {
      rows.push(kv(String.raw`$\bar{I}_x$ (centroidal)`, qv('qV', `${f(c.Ix)} in⁴`)));
      rows.push(kv(String.raw`$I_x$ about the base, direct`, `${f(c.IxBase)} in⁴`));
      rows.push(kv(String.raw`$\bar{I}_x + A\bar{y}^2$`, qv(Math.abs(c.Ix + c.A * c.ybar ** 2 - c.IxBase) < 1e-9 * Math.max(1, c.IxBase) ? 'qR' : 'qI', `${f(c.Ix + c.A * c.ybar ** 2)} in⁴`)));
      rows.push(kv(String.raw`$\bar{I}_y$ · $k_x$ · $k_y$`, `${f(c.Iy)} in⁴ · ${f(c.kx, 3)} · ${f(c.ky, 3)} in`));
    } else {
      rows.push(kv('$A$', qv('qV', `${f(c.A)} in²`)));
      rows.push(kv(String.raw`$\bar{x},\ \bar{y}$`, qv('qV', `${f(c.xbar, 3)}, ${f(c.ybar, 3)} in`)));
    }
    return rows.join('');
  },
  readout(state, computed) {
    const c = computed.sec;
    if (!c) return '';
    return cells(state.mode === 'inertia'
      ? [['$\\bar{y}$', `${f(c.ybar, 3)} in`, ''], ['$\\bar{I}_x$', `${f(c.Ix, 1)} in⁴`, 'ok'], ['$\\bar{I}_y$', `${f(c.Iy, 1)} in⁴`, ''], ['$k_x$', `${f(c.kx, 3)} in`, '']]
      : [['$A$', `${f(c.A)} in²`, 'ok'], ['$\\bar{x}$', `${f(c.xbar, 3)} in`, 'ok'], ['$\\bar{y}$', `${f(c.ybar, 3)} in`, 'ok'], ['parts', `${c.parts.length}`, '']]);
  },
  coach(state, computed) {
    const c = computed.sec;
    if (!c) return { title: '', body: '' };
    if (state.mode === 'inertia') {
      const share = c.rows.reduce((s, q) => s + q.A * q.dy ** 2, 0) / c.Ix;
      return {
        title: `Here ${Math.round(share * 100)}% of Ī comes from the Ad² column`,
        body: [
          String.raw`Every piece contributes its own $\bar{I}$ about its own centroid, plus $Ad^2$ for being a distance $d$ from the composite centroid:`,
          eq(String.raw`\bar{I}_x = \sum \left(\bar{I}_i + A_i d_i^2\right)`),
          String.raw`Because $d$ is squared, area far from the axis counts for much more than area near it. That is the whole design of an I-beam: put the material in the flanges, as far out as possible, and keep the web thin.`,
          String.raw`Order matters: find $\bar{y}$ first, then measure every $d$ from it. The panel checks you another way — $I$ about the base computed directly must equal $\bar{I}_x + A\bar{y}^2$.`,
        ],
      };
    }
    const hole = c.parts.some((q) => q.sign < 0);
    return {
      title: hole ? 'A hole is a part with negative area' : 'Weight each centroid by its area',
      body: hole
        ? [
          String.raw`Treat the plate as if it were solid, then subtract the hole as a second row with $A < 0$. Its $A\tilde{x}$ and $A\tilde{y}$ come out negative too, and the arithmetic takes care of the rest.`,
          'Slide the hole toward one edge and watch the centroid move the other way — the material that is left is heavier on the far side.',
        ]
        : [
          String.raw`Split the area into shapes whose centroids you know, and keep a table: $A$, $\tilde{x}$, $\tilde{y}$, then the products. The centroid is the area-weighted average:`,
          eq(String.raw`\bar{x} = \frac{\sum A\tilde{x}}{\sum A}, \qquad \bar{y} = \frac{\sum A\tilde{y}}{\sum A}`),
          String.raw`The centroid of a triangle sits a third of the way up from its base; a semicircle's sits $4r/3\pi$ from its flat edge. Everything else in this chapter is bookkeeping — which is why the table is worth writing out every time.`,
        ],
    };
  },
});
