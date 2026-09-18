import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { defineLab } from './define.js';
import { M, fatLine, fatSegments, Arrow, markAnswer, setFatSegments, segmentCapacity } from '../scene/manim.js';
import { v, add, sub, scale, mag, unit, unitAB, forceAlong, directionAngles, resultant, angleBetween, proj, DEG } from '../physics/vectors.js';
import { kv, cells, qv, eq } from '../ui/shared.js';

/**
 * Ch 2 · Cartesian force vectors.
 *
 * Two forces in 3D, given either by components or as F = F·u along a line from A to B. The panel
 * shows the components, the magnitude, the coordinate direction angles, and the check the chapter
 * keeps asking for: cos²α + cos²β + cos²γ = 1.
 */

const U = 1.0;

const SCENARIOS = [
  { id: 'two', name: 'Two forces at a point', mode: 'components', F1: [50, 40, -30], F2: [-20, 60, 45] },
  { id: 'cable', name: 'F = F·u along a cable', mode: 'along', Fmag: 700, A: [0, 0, 0], B: [2, 3, 6], F2: [0, -300, 0] },
  { id: 'bracket', name: 'Bracket · three forces', mode: 'components', F1: [300, 0, 0], F2: [-120, 250, 0], F3: [0, -100, 180] },
];

function label(html) {
  const el = document.createElement('div');
  el.className = 'circuit-label';
  el.innerHTML = html;
  return new CSS2DObject(el);
}

const arrowFor = (vec, color, width = 0.04) =>
  new Arrow(new THREE.Vector3(vec.x, vec.y, vec.z).normalize(), new THREE.Vector3(0, 0, 0), 1, color, 0.3, 0.22, width);

export default defineLab({
  id: 'vectors',
  exam: 'u1',
  title: 'Vectors',
  hint: 'Drag the sliders and watch the direction angles — cos²α + cos²β + cos²γ stays 1',
  orbit: true,
  camera: { pos: new THREE.Vector3(6, 5, 9), target: new THREE.Vector3(0, 0, 0) },
  keys: { r: 'reset', R: 'reset' },
  scenarios: SCENARIOS,
  defaultState() {
    return { scenarioId: 'two', mode: 'components', F1: [50, 40, -30], F2: [-20, 60, 45], F3: null, Fmag: 700, A: [0, 0, 0], B: [2, 3, 6], showResultant: true };
  },
  applyScenario(id, state) {
    const sc = SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
    Object.assign(state, {
      scenarioId: sc.id,
      mode: sc.mode,
      F1: sc.F1 ? [...sc.F1] : state.F1,
      F2: sc.F2 ? [...sc.F2] : state.F2,
      F3: sc.F3 ? [...sc.F3] : null,
      Fmag: sc.Fmag ?? state.Fmag,
      A: sc.A ? [...sc.A] : state.A,
      B: sc.B ? [...sc.B] : state.B,
    });
  },
  controls() {
    const row = (id, text, val, min, max) => `
          <label class="field">
            <span>${text}</span>
            <div class="slider-row">
              <input type="range" id="${id}" min="${min}" max="${max}" step="1" value="${val}" />
              <span class="mono val" id="${id}-val">${val}</span>
              <input type="number" class="num" id="${id}-num" step="1" value="${val}" />
            </div>
          </label>`;
    return `
        <div class="lab-block" id="vc-components">
          ${row('vc-f1x', 'F₁ x', 50, -400, 400)}
          ${row('vc-f1y', 'F₁ y', 40, -400, 400)}
          ${row('vc-f1z', 'F₁ z', -30, -400, 400)}
          ${row('vc-f2x', 'F₂ x', -20, -400, 400)}
          ${row('vc-f2y', 'F₂ y', 60, -400, 400)}
          ${row('vc-f2z', 'F₂ z', 45, -400, 400)}
          <label class="check"><input type="checkbox" id="vc-res" checked /> <span>show the resultant</span></label>
          <p class="tiny">Blue and teal are the two forces; gold is their resultant. The panel reads off the magnitude and the coordinate direction angles α, β, γ — the angles each vector makes with the +x, +y and +z axes.</p>
        </div>`;
  },
  bind(api) {
    const $ = (id) => document.getElementById(id);
    const link = (id, apply) => {
      const s = $(id);
      const n = $(`${id}-num`);
      const set = (val) => {
        apply(api.slice(), val);
        api.bump(false);
      };
      s.addEventListener('input', (e) => set(Number(e.target.value)));
      if (n) {
        n.addEventListener('change', (e) => {
          const val = Number(e.target.value);
          if (!Number.isFinite(val)) return;
          if (val < Number(s.min)) s.min = String(val);
          if (val > Number(s.max)) s.max = String(val);
          set(val);
        });
      }
    };
    [['x', 0], ['y', 1], ['z', 2]].forEach(([ax, i]) => {
      link(`vc-f1${ax}`, (st, val) => { st.F1[i] = val; });
      link(`vc-f2${ax}`, (st, val) => { st.F2[i] = val; });
    });
    $('vc-res').addEventListener('change', (e) => {
      api.slice().showResultant = e.target.checked;
      api.bump(false);
    });
  },
  syncControls(state) {
    const $ = (id) => document.getElementById(id);
    const put = (id, val) => {
      const s = $(id);
      if (s) {
        if (val < Number(s.min)) s.min = String(val);
        if (val > Number(s.max)) s.max = String(val);
        s.value = String(val);
      }
      const t = $(`${id}-val`);
      if (t) t.textContent = String(Math.round(val));
      const n = $(`${id}-num`);
      if (n && document.activeElement !== n) n.value = String(val);
    };
    [['x', 0], ['y', 1], ['z', 2]].forEach(([ax, i]) => {
      put(`vc-f1${ax}`, state.F1[i]);
      put(`vc-f2${ax}`, state.F2[i]);
    });
    const r = $('vc-res');
    if (r) r.checked = !!state.showResultant;
  },
  init(ctx) {
    const group = new THREE.Group();
    ctx.scene.add(group);
    const axes = fatSegments(segmentCapacity(3), { color: M.white, width: 1.6, opacity: 0.6 });
    group.add(axes);
    const f1 = arrowFor(v(1, 0, 0), M.blue);
    const f2 = arrowFor(v(0, 1, 0), M.teal);
    const res = arrowFor(v(0, 0, 1), M.gold, 0.05);
    markAnswer(res);
    group.add(f1, f2, res);
    const guides = fatSegments(segmentCapacity(12), { color: M.greyDark, width: 1.2, opacity: 0.6 });
    group.add(guides);
    const labels = { f1: label('F₁'), f2: label('F₂'), res: label('R'), x: label('x'), y: label('y'), z: label('z') };
    markAnswer(labels.res);
    Object.values(labels).forEach((l) => group.add(l));
    group.visible = false;
    return { group, axes, f1, f2, res, guides, labels };
  },
  enter(ctx, handle) {
    handle.group.visible = true;
  },
  exit(ctx, handle) {
    handle.group.visible = false;
  },
  recompute(state, computed) {
    const F1 = v(...state.F1);
    const F2 = v(...state.F2);
    const list = [F1, F2];
    if (state.F3) list.push(v(...state.F3));
    const R = resultant(...list);
    computed.vec = {
      F1,
      F2,
      R,
      d1: directionAngles(F1),
      d2: directionAngles(F2),
      dR: directionAngles(R),
      between: angleBetween(F1, F2),
      proj12: mag(proj(F1, F2)) * Math.sign(angleBetween(F1, F2) < 90 ? 1 : -1),
      check: (c) => Math.cos(c.alpha * DEG) ** 2 + Math.cos(c.beta * DEG) ** 2 + Math.cos(c.gamma * DEG) ** 2,
    };
  },
  syncViews(state, computed, ctx) {
    const h = ctx.handle;
    const c = computed.vec;
    if (!h || !c) return;
    const peak = Math.max(mag(c.F1), mag(c.F2), mag(c.R), 1);
    const SC = (4.2 * U) / peak;

    setFatSegments(h.axes, [
      0, 0, 0, 5, 0, 0,
      0, 0, 0, 0, 5, 0,
      0, 0, 0, 0, 0, 5,
    ]);

    const place = (arrow, vec, on = true) => {
      const m = mag(vec);
      arrow.visible = on && m > 1e-6;
      if (!arrow.visible) return;
      arrow.setDirection(new THREE.Vector3(vec.x, vec.y, vec.z).normalize());
      arrow.setLength(m * SC);
    };
    place(h.f1, c.F1);
    place(h.f2, c.F2);
    place(h.res, c.R, state.showResultant);

    // Component guide lines for the resultant, so the x/y/z split is visible.
    const g = [];
    if (state.showResultant) {
      const R = scale(c.R, SC);
      g.push(0, 0, 0, R.x, 0, 0);
      g.push(R.x, 0, 0, R.x, R.y, 0);
      g.push(R.x, R.y, 0, R.x, R.y, R.z);
    }
    setFatSegments(h.guides, g);

    const put = (l, vec, text) => {
      const p = scale(vec, SC);
      l.position.set(p.x, p.y, p.z);
      l.element.innerHTML = text;
      l.visible = mag(vec) > 1e-6;
    };
    put(h.labels.f1, c.F1, `F₁ = ${mag(c.F1).toFixed(0)}`);
    put(h.labels.f2, c.F2, `F₂ = ${mag(c.F2).toFixed(0)}`);
    h.labels.res.visible = state.showResultant;
    if (state.showResultant) put(h.labels.res, c.R, `R = ${mag(c.R).toFixed(1)}`);
    h.labels.x.position.set(5.2, 0, 0);
    h.labels.y.position.set(0, 5.2, 0);
    h.labels.z.position.set(0, 0, 5.2);

    ctx.grid.visible = false;
  },
  law: () => [
    String.raw`\vec{F} = F\,\hat{u} = F\frac{\vec{r}}{|\vec{r}|}`,
    String.raw`\cos^2\alpha + \cos^2\beta + \cos^2\gamma = 1`,
  ],
  liveRows(state, computed) {
    const c = computed.vec;
    if (!c) return '';
    const fmt = (F) => `(${F.x.toFixed(0)}, ${F.y.toFixed(0)}, ${F.z.toFixed(0)})`;
    const ang = (d) => `${d.alpha.toFixed(1)}°, ${d.beta.toFixed(1)}°, ${d.gamma.toFixed(1)}°`;
    return [
      kv(String.raw`$\vec{F}_1$`, `${fmt(c.F1)} lb · |F₁| = ${mag(c.F1).toFixed(1)}`),
      kv(String.raw`$\alpha, \beta, \gamma$ of $\vec{F}_1$`, ang(c.d1)),
      kv(String.raw`$\vec{F}_2$`, `${fmt(c.F2)} lb · |F₂| = ${mag(c.F2).toFixed(1)}`),
      kv(String.raw`$\alpha, \beta, \gamma$ of $\vec{F}_2$`, ang(c.d2)),
      kv(String.raw`$\vec{R} = \vec{F}_1 + \vec{F}_2$`, qv('qV', `${fmt(c.R)} lb`)),
      kv('$|R|$', qv('qV', `${mag(c.R).toFixed(2)} lb`)),
      kv(String.raw`$\alpha, \beta, \gamma$ of $\vec{R}$`, qv('qV', ang(c.dR))),
      kv(String.raw`$\cos^2\alpha+\cos^2\beta+\cos^2\gamma$`, c.check(c.dR).toFixed(6)),
      kv('angle between $F_1$ and $F_2$', `${c.between.toFixed(2)}°`),
    ].join('');
  },
  readout(state, computed) {
    const c = computed.vec;
    if (!c) return '';
    return cells([
      ['$|R|$', `${mag(c.R).toFixed(2)} lb`, 'ok'],
      [String.raw`$\alpha$`, `${c.dR.alpha.toFixed(1)}°`, ''],
      [String.raw`$\beta$`, `${c.dR.beta.toFixed(1)}°`, ''],
      [String.raw`$\gamma$`, `${c.dR.gamma.toFixed(1)}°`, ''],
    ]);
  },
  coach(state, computed) {
    const c = computed.vec;
    return {
      title: 'A force is its components, and its components are its direction cosines',
      body: [
        String.raw`Writing $\vec{F} = F_x\hat{i} + F_y\hat{j} + F_z\hat{k}$ is the whole of Chapter 2. Adding forces then means adding three ordinary numbers — no triangles, no law of cosines.`,
        String.raw`When a force is given as "$F$ along the cable from $A$ to $B$", build the unit vector first and scale it:`,
        eq(String.raw`\vec{F} = F\,\hat{u}_{AB} = F\,\frac{\vec{r}_{AB}}{|\vec{r}_{AB}|}`),
        String.raw`The coordinate direction angles are just the components divided by the magnitude: $\cos\alpha = F_x/F$, and so on. They are not independent — squaring and adding always gives 1` + (c ? `, and the panel shows ${c.check(c.dR).toFixed(4)} for the resultant right now.` : '.'),
        String.raw`That identity is the cheapest error check in the chapter: if your three angles do not satisfy it, one of them is wrong.`,
      ],
    };
  },
});
