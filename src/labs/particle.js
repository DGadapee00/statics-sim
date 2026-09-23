import * as THREE from 'three';
import { defineLab } from './define.js';
import { label, sliderRow, bindSlider, putSlider, showBlock, zUp, flat } from './parts.js';
import { M, fatSegments, Arrow, markAnswer, setFatSegments, segmentCapacity } from '../scene/manim.js';
import { v, scale, mag, unit, fromAngle2D } from '../physics/vectors.js';
import { particleEq2D, particleEq3D } from '../physics/statics.js';
import { kv, cells, qv, eq } from '../ui/shared.js';

/**
 * Ch 3 · equilibrium of a particle.
 *
 * A ring held by cables (or a spring) with a weight hanging from it. The lab solves ΣF = 0 for the
 * unknown tensions and draws the force polygon beside the free-body diagram: equilibrium is the
 * polygon closing on itself, and the gap it would leave is the residual in the panel.
 */

const U = 1.0;
const CABLE = 2.3; // drawn length of a 2D cable, scene units
const FORCE = 1.9; // longest force arrow, scene units
const RING_2D = v(-1.4, 0.2, 0);
const POLY_2D = v(2.4, 1.3, 0);

const SCENARIOS = [
  { id: 'two', name: 'Ring on two cables', mode: '2d', unit: 'lb', W: 100, a1: 150, a2: 45, k: 0 },
  { id: 'spring', name: 'Spring and a horizontal cable', mode: '2d', unit: 'N', W: 200, a1: 180, a2: 30, k: 500 },
  { id: 'three', name: 'Three cables in 3D', mode: '3d', unit: 'lb', W: 600, h: 4, A: [3, 0], B: [-2, 3], C: [-2, -3] },
];

const MEMBER_COLORS = [M.blue, M.teal, M.purple];

export default defineLab({
  id: 'particle',
  exam: 'u2',
  title: 'Particle',
  hint: 'Change the angles and watch the force polygon — it closes whenever ΣF = 0',
  orbit: true,
  camera: { pos: new THREE.Vector3(0.4, 0, 14), target: new THREE.Vector3(0.4, 0, 0) },
  cameraFor(state) {
    return state.mode === '3d'
      ? { pos: new THREE.Vector3(8.5, 7, 12.5), target: new THREE.Vector3(1.4, 1.4, 0.4) }
      : null;
  },
  keys: { r: 'reset', R: 'reset' },
  scenarios: SCENARIOS,
  defaultState() {
    return { scenarioId: 'two', mode: '2d', unit: 'lb', W: 100, a1: 150, a2: 45, k: 0, h: 4, A: [3, 0], B: [-2, 3], C: [-2, -3], showPolygon: true };
  },
  applyScenario(id, state) {
    const sc = SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
    Object.assign(state, {
      scenarioId: sc.id,
      mode: sc.mode,
      unit: sc.unit,
      W: sc.W,
      a1: sc.a1 ?? state.a1,
      a2: sc.a2 ?? state.a2,
      k: sc.k ?? 0,
      h: sc.h ?? state.h,
      A: sc.A ? [...sc.A] : state.A,
      B: sc.B ? [...sc.B] : state.B,
      C: sc.C ? [...sc.C] : state.C,
    });
  },
  controls() {
    return `
        <div class="lab-block">
          ${sliderRow('pe-w', 'Weight W', 100, 0, 1000, 5)}
          <div id="pe-2d">
            ${sliderRow('pe-a1', 'Cable AB angle α₁ (° from +x)', 150, 0, 360, 1)}
            ${sliderRow('pe-a2', 'Member AC angle α₂ (° from +x)', 45, 0, 360, 1)}
            <div id="pe-kblock">${sliderRow('pe-k', 'Spring stiffness k (N/m)', 500, 50, 2000, 10)}</div>
          </div>
          <div id="pe-3d">
            ${sliderRow('pe-h', 'Anchor height h', 4, 0.5, 10, 0.1)}
          </div>
          <label class="check"><input type="checkbox" id="pe-poly" checked /> <span>show the force polygon</span></label>
          <p class="tiny">Grey is the known weight; the coloured arrows are the unknown tensions the lab solved for. On the right the same forces are laid tip to tail — in equilibrium that polygon closes, and the panel's residual is the gap it would leave.</p>
        </div>`;
  },
  bind(api) {
    bindSlider(api, 'pe-w', (s, val) => { s.W = val; });
    bindSlider(api, 'pe-a1', (s, val) => { s.a1 = val; });
    bindSlider(api, 'pe-a2', (s, val) => { s.a2 = val; });
    bindSlider(api, 'pe-k', (s, val) => { s.k = val; });
    bindSlider(api, 'pe-h', (s, val) => { s.h = val; });
    document.getElementById('pe-poly').addEventListener('change', (e) => {
      api.slice().showPolygon = e.target.checked;
      api.bump(false);
    });
  },
  syncControls(state) {
    putSlider('pe-w', state.W);
    putSlider('pe-a1', state.a1);
    putSlider('pe-a2', state.a2);
    putSlider('pe-k', state.k);
    putSlider('pe-h', state.h, 1);
    showBlock('pe-2d', state.mode !== '3d');
    showBlock('pe-3d', state.mode === '3d');
    showBlock('pe-kblock', state.k > 0);
    const p = document.getElementById('pe-poly');
    if (p) p.checked = !!state.showPolygon;
  },
  init(ctx) {
    const group = new THREE.Group();
    ctx.scene.add(group);
    const cables = fatSegments(segmentCapacity(40), { color: M.grey, width: 3 });
    const guides = fatSegments(segmentCapacity(12), { color: M.greyDark, width: 1.4, opacity: 0.7 });
    const axes = fatSegments(segmentCapacity(3), { color: M.white, width: 1.4, opacity: 0.45 });
    group.add(cables, guides, axes);
    const ringGeo = new THREE.TorusGeometry(0.16, 0.045, 10, 28);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: M.white, toneMapped: false }));
    group.add(ring);
    const anchorGeo = new THREE.SphereGeometry(0.09, 14, 10);
    const anchors = [0, 1, 2].map(() => new THREE.Mesh(anchorGeo, new THREE.MeshBasicMaterial({ color: M.green, toneMapped: false })));
    anchors.forEach((a) => group.add(a));
    const weight = new Arrow(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 1, M.grey, 0.28, 0.2, 0.04);
    const pulls = MEMBER_COLORS.map((c) => markAnswer(new Arrow(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, c, 0.26, 0.2, 0.035)));
    group.add(weight, ...pulls);
    const poly = new THREE.Group();
    const polyW = new Arrow(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 1, M.grey, 0.22, 0.16, 0.03);
    const polyT = MEMBER_COLORS.map((c) => new Arrow(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, c, 0.22, 0.16, 0.03));
    poly.add(polyW, ...polyT);
    markAnswer(poly);
    group.add(poly);
    const labels = {
      ring: label('A'),
      W: label('W'),
      T: [0, 1, 2].map(() => markAnswer(label(''))),
      anchor: ['B', 'C', 'D'].map((n) => label(n)),
      poly: markAnswer(label('<span class="tiny">force polygon</span>')),
      axes: ['x', 'y', 'z'].map((n) => label(n)),
    };
    group.add(labels.ring, labels.W, labels.poly, ...labels.T, ...labels.anchor, ...labels.axes);
    group.visible = false;
    return { group, cables, guides, axes, ring, anchors, weight, pulls, poly, polyW, polyT, labels };
  },
  enter(ctx, handle) {
    handle.group.visible = true;
  },
  exit(ctx, handle) {
    handle.group.visible = false;
  },
  recompute(state, computed) {
    const Wv = state.mode === '3d' ? v(0, 0, -state.W) : v(0, -state.W, 0);
    let members;
    let sol;
    if (state.mode === '3d') {
      const pts = [state.A, state.B, state.C].map(([x, y]) => v(x, y, state.h));
      sol = particleEq3D([Wv], pts);
      members = pts.map((P, i) => ({ name: ['AB', 'AC', 'AD'][i], anchor: P, dir: unit(P), T: sol.magnitudes[i], spring: false }));
    } else {
      const d1 = fromAngle2D(1, state.a1);
      const d2 = fromAngle2D(1, state.a2);
      sol = particleEq2D([Wv], [d1, d2]);
      members = [
        { name: 'AB', anchor: scale(d1, CABLE), dir: d1, T: sol.magnitudes[0], spring: false },
        { name: 'AC', anchor: scale(d2, CABLE), dir: d2, T: sol.magnitudes[1], spring: state.k > 0 },
      ];
    }
    const singular = !!sol.singular || members.some((m) => !Number.isFinite(m.T));
    const spring = members.find((m) => m.spring);
    computed.particle = {
      W: Wv,
      members,
      singular,
      residual: singular ? NaN : mag(sol.residual),
      residualVec: sol.residual,
      slack: members.filter((m) => Number.isFinite(m.T) && m.T < -1e-9),
      stretch: spring && state.k > 0 ? spring.T / state.k : null,
    };
  },
  syncViews(state, computed, ctx) {
    const h = ctx.handle;
    const c = computed.particle;
    if (!h || !c) return;
    const is3D = state.mode === '3d';
    const map = is3D ? zUp : flat;
    const ring = is3D ? v(0, 0, 0) : RING_2D;
    const at = (p) => map(p).add(map(ring));
    const peak = Math.max(state.W, ...c.members.map((m) => (Number.isFinite(m.T) ? Math.abs(m.T) : 0)), 1e-9);
    const k = FORCE / peak;

    h.ring.position.copy(at(v(0, 0, 0)));
    h.ring.rotation.set(is3D ? Math.PI / 2 : 0, 0, 0);
    h.labels.ring.position.copy(at(v(-0.35, 0.3, 0)));

    // Cables (a zigzag for a spring) and their anchors.
    const seg = [];
    const push = (a, b) => seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
    c.members.forEach((m, i) => {
      const A = at(v(0, 0, 0));
      const B = at(is3D ? scale(m.anchor, U) : m.anchor);
      if (m.spring) {
        const n = 10;
        const side = new THREE.Vector3(-m.dir.y, m.dir.x, 0).multiplyScalar(0.16);
        let prev = A.clone();
        for (let j = 1; j <= n; j++) {
          const t = 0.15 + (0.7 * j) / n;
          const p = A.clone().lerp(B, t).addScaledVector(side, j === n ? 0 : (j % 2 ? 1 : -1));
          push(prev, p);
          prev = p;
        }
        push(prev, B);
      } else {
        push(A, B);
      }
      h.anchors[i].visible = true;
      h.anchors[i].position.copy(B);
      h.labels.anchor[i].visible = true;
      h.labels.anchor[i].position.copy(B).add(new THREE.Vector3(0, 0.28, 0));
    });
    for (let i = c.members.length; i < 3; i++) {
      h.anchors[i].visible = false;
      h.labels.anchor[i].visible = false;
    }
    setFatSegments(h.cables, seg);

    // 3D: drop lines from each anchor to the floor, so the geometry reads without orbiting.
    const g = [];
    if (is3D) {
      for (const m of c.members) {
        const top = zUp(m.anchor);
        const foot = zUp(v(m.anchor.x, m.anchor.y, 0));
        g.push(top.x, top.y, top.z, foot.x, foot.y, foot.z, 0, 0, 0, foot.x, foot.y, foot.z);
      }
    }
    setFatSegments(h.guides, g);

    // 3D: our own z-up axes. The scene grid labels its axes in three.js' y-up frame, which would
    // call the vertical "y" when every problem in the chapter calls it z.
    const axSeg = [];
    ['x', 'y', 'z'].forEach((n, i) => {
      const e = zUp(v(i === 0 ? 3 : 0, i === 1 ? 3 : 0, i === 2 ? 3 : 0));
      if (is3D) axSeg.push(0, 0, 0, e.x, e.y, e.z);
      h.labels.axes[i].visible = is3D;
      h.labels.axes[i].position.copy(e).multiplyScalar(1.06);
    });
    setFatSegments(h.axes, axSeg);

    // Forces on the ring: the weight, then each solved tension pulling toward its anchor.
    const place = (arrow, origin, vec, lengthScale) => {
      const m = mag(vec);
      arrow.visible = m > 1e-9 && Number.isFinite(m);
      if (!arrow.visible) return;
      arrow.position.copy(origin);
      arrow.setDirection(map(vec).normalize());
      arrow.setLength(Math.max(0.3, m * lengthScale));
    };
    place(h.weight, at(v(0, 0, 0)), c.W, k);
    h.labels.W.position.copy(at(scale(c.W, (k * 1.08))));
    h.labels.W.element.innerHTML = `W = ${state.W.toFixed(0)} ${state.unit}`;
    c.members.forEach((m, i) => {
      const F = scale(m.dir, m.T);
      place(h.pulls[i], at(v(0, 0, 0)), F, k);
      h.pulls[i].setColor(m.T < 0 ? M.red : MEMBER_COLORS[i]);
      const L = h.labels.T[i];
      L.visible = Number.isFinite(m.T);
      const tip = scale(unit(F), Math.max(0.3, Math.abs(m.T) * k) + 0.35);
      L.position.copy(at(tip));
      L.element.innerHTML = `T<sub>${m.name}</sub> = ${Number.isFinite(m.T) ? m.T.toFixed(1) : '—'}`;
    });
    for (let i = c.members.length; i < 3; i++) {
      h.pulls[i].visible = false;
      h.labels.T[i].visible = false;
    }

    // The force polygon: W, then each tension, tip to tail. It closes when ΣF = 0.
    h.poly.visible = state.showPolygon && !c.singular;
    h.labels.poly.visible = h.poly.visible;
    if (h.poly.visible) {
      const start = is3D ? new THREE.Vector3(2.6, 2.4, 2.2) : flat(POLY_2D);
      let tail = start.clone();
      const step = (arrow, vec) => {
        const s = map(scale(vec, k));
        const len = s.length();
        arrow.visible = len > 1e-6;
        if (!arrow.visible) return;
        arrow.position.copy(tail);
        arrow.setDirection(s.clone().normalize());
        arrow.setLength(len);
        tail = tail.clone().add(s);
      };
      step(h.polyW, c.W);
      c.members.forEach((m, i) => {
        step(h.polyT[i], scale(m.dir, m.T));
        h.polyT[i].setColor(m.T < 0 ? M.red : MEMBER_COLORS[i]);
      });
      for (let i = c.members.length; i < 3; i++) h.polyT[i].visible = false;
      h.labels.poly.position.copy(start).add(new THREE.Vector3(0, 0.45, 0));
    }

    ctx.grid.visible = false;
  },
  law: () => [
    String.raw`\sum \vec{F} = \vec{0}`,
    String.raw`\sum F_x = 0,\quad \sum F_y = 0,\quad \sum F_z = 0`,
    String.raw`F_{\text{spring}} = k\,s`,
  ],
  liveRows(state, computed) {
    const c = computed.particle;
    if (!c) return '';
    const u = state.unit;
    const rows = [kv('weight $W$', `${state.W.toFixed(0)} ${u}`)];
    for (const m of c.members) {
      rows.push(kv(`$T_{${m.name}}$`, qv('qV', Number.isFinite(m.T) ? `${m.T.toFixed(2)} ${u}` : 'no solution')));
    }
    if (c.stretch != null) rows.push(kv('spring stretch $s = F/k$', qv('qV', `${c.stretch.toFixed(4)} m`)));
    const R = c.residualVec;
    if (!c.singular) {
      rows.push(kv(String.raw`$\sum F_x,\ \sum F_y${state.mode === '3d' ? String.raw`,\ \sum F_z` : ''}$`,
        qv(c.residual < 1e-6 ? 'qR' : 'qI', [R.x, R.y, ...(state.mode === '3d' ? [R.z] : [])].map((x) => x.toExponential(1)).join(', '))));
    }
    return rows.join('');
  },
  readout(state, computed) {
    const c = computed.particle;
    if (!c) return '';
    const u = state.unit;
    const t = c.members.map((m) => [`$T_{${m.name}}$`, Number.isFinite(m.T) ? `${m.T.toFixed(1)} ${u}` : '—', m.T < 0 ? 'bad' : 'ok']);
    const closes = ['ΣF closes to', c.singular ? '—' : `${c.residual.toExponential(1)} ${u}`, c.residual < 1e-6 ? 'ok' : 'bad'];
    // Four cells: the tensions, then (in 2D) the stretch or the weight, then the check.
    if (t.length === 3) return cells([...t, closes]);
    const third = c.stretch != null ? ['stretch $s$', `${c.stretch.toFixed(3)} m`, ''] : ['$W$', `${state.W.toFixed(0)} ${u}`, ''];
    return cells([...t, third, closes]);
  },
  coach(state, computed) {
    const c = computed.particle;
    if (!c) return { title: '', body: '' };
    if (c.singular) {
      return {
        title: 'Two cables in line cannot hold this ring',
        body: [
          String.raw`When the two members point along the same line, $\sum F_x = 0$ and $\sum F_y = 0$ stop being independent: the determinant of the $2\times 2$ system is zero and no pair of tensions balances a weight off that line.`,
          'Swing one of the angles and the solution comes back.',
        ],
      };
    }
    if (c.slack.length) {
      return {
        title: `${c.slack.map((m) => m.name).join(' and ')} would have to push`,
        body: [
          String.raw`The equations still close — the residual is zero — but the answer is negative, which means the member would have to push on the ring. A cable cannot: it goes slack and the ring swings until the geometry changes.`,
          'A negative answer from ΣF = 0 is a message about the setup, not an arithmetic slip. A strut or a spring in compression could carry it; a rope cannot.',
        ],
      };
    }
    if (c.stretch != null) {
      return {
        title: 'Equilibrium first, then Hooke',
        body: [
          String.raw`The spring does not know it is a spring until the end. Treat it as one more member with unknown force, solve $\sum F = 0$ at the ring, and only then turn the force into a stretch:`,
          eq(String.raw`s = \frac{F}{k} = \frac{${c.members[1].T.toFixed(1)}\ \text{N}}{${state.k}\ \text{N/m}} = ${c.stretch.toFixed(3)}\ \text{m}`),
          String.raw`If the problem asks for an unstretched length, it is the stretched length minus $s$ — the geometry gives you one, Hooke gives you the other.`,
        ],
      };
    }
    return {
      title: state.mode === '3d' ? 'Three unknowns, three equations' : 'The force polygon closes',
      body: state.mode === '3d'
        ? [
          String.raw`Write each cable force as $T\,\hat{u}$, with $\hat{u}$ pointing from the ring to the anchor. Then $\sum F_x$, $\sum F_y$ and $\sum F_z$ give three equations in three tensions.`,
          eq(String.raw`T_{AB}\hat{u}_{AB} + T_{AC}\hat{u}_{AC} + T_{AD}\hat{u}_{AD} + \vec{W} = \vec{0}`),
          'Raise the anchors and every tension drops — steeper cables put more of each tension into holding the weight up.',
        ]
        : [
          String.raw`Draw the ring alone with every force on it. Equilibrium is $\sum F_x = 0$ and $\sum F_y = 0$: two equations, so at most two unknowns.`,
          String.raw`Laid tip to tail, forces in equilibrium make a closed polygon — here a triangle, which is why the law of sines solves the three-force case in one line.`,
          'Flatten either cable toward horizontal and watch its tension grow without bound: a cable that is nearly level contributes almost nothing upward, so it has to pull very hard to help.',
        ],
    };
  },
});
