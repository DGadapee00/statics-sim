import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { defineLab } from './define.js';
import { M, fatLine, fatSegments, Arrow, markAnswer, setFatSegments, segmentCapacity } from '../scene/manim.js';
import { solveTruss, zeroForceMembers, memberForce, stateOf, sectionCheck } from '../physics/truss.js';
import { v, sub, mag } from '../physics/vectors.js';
import { kv, cells, qv, eq } from '../ui/shared.js';

/**
 * Ch 6 · plane trusses by the method of joints.
 *
 * The point of this lab is the residual. It does not only report "AC = 601 lb (C)"; it reports
 * ΣFx and ΣFy at every joint, computed from the member forces it solved for. When you close a
 * joint by hand and your numbers agree, those residuals are what agreed with you.
 */

const U = 1.1; // scene units per foot/metre of truss

const SCENARIOS = [
  {
    id: 'three',
    name: 'Three-member truss · 1000 lb at the apex',
    joints: { A: [0, 0], B: [4, 0], C: [2, 3] },
    members: [['A', 'B'], ['A', 'C'], ['B', 'C']],
    loads: { C: [0, -1000] },
    supports: { A: 'pin', B: 'rollerY' },
  },
  {
    id: 'howe',
    name: 'Howe truss · two panel loads',
    joints: { A: [0, 0], B: [4, 0], C: [8, 0], D: [6, 3], E: [2, 3] },
    members: [['A', 'B'], ['B', 'C'], ['A', 'E'], ['E', 'D'], ['D', 'C'], ['E', 'B'], ['D', 'B']],
    loads: { E: [0, -800], D: [0, -400] },
    supports: { A: 'pin', C: 'rollerY' },
  },
  {
    id: 'zero',
    name: 'Zero-force members · the unloaded overhang',
    joints: { A: [0, 0], B: [4, 0], C: [2, 3], D: [6, 3] },
    members: [['A', 'B'], ['A', 'C'], ['B', 'C'], ['B', 'D'], ['C', 'D']],
    loads: { C: [0, -1000] },
    supports: { A: 'pin', B: 'rollerY' },
  },
  {
    id: 'pratt',
    name: 'Pratt truss · four panels',
    joints: { A: [0, 0], B: [3, 0], C: [6, 0], D: [9, 0], E: [3, 3], F: [6, 3] },
    members: [['A', 'B'], ['B', 'C'], ['C', 'D'], ['A', 'E'], ['E', 'F'], ['F', 'D'], ['E', 'B'], ['F', 'C'], ['E', 'C']],
    loads: { B: [0, -600], C: [0, -600] },
    supports: { A: 'pin', D: 'rollerY' },
  },
];

const toVec = (p) => v(p[0], p[1], 0);
const jointsOf = (sc) => Object.fromEntries(Object.entries(sc.joints).map(([k, p]) => [k, toVec(p)]));
const loadsOf = (sc) => Object.fromEntries(Object.entries(sc.loads || {}).map(([k, p]) => [k, { x: p[0], y: p[1] }]));

function label(html, cls = 'circuit-label') {
  const el = document.createElement('div');
  el.className = cls;
  el.innerHTML = html;
  return new CSS2DObject(el);
}

export default defineLab({
  id: 'truss',
  exam: 'u3',
  title: 'Truss',
  hint: 'Every joint must close — watch ΣFx and ΣFy as you change the load',
  orbit: false,
  camera: { pos: new THREE.Vector3(0, 0, 13), target: new THREE.Vector3(0, 0, 0) },
  keys: { r: 'reset', R: 'reset' },
  scenarios: SCENARIOS,
  defaultState() {
    return { scenarioId: 'three', scale: 1, showZero: true, selected: null };
  },
  applyScenario(id, state) {
    const sc = SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
    Object.assign(state, {
      scenarioId: sc.id,
      joints: JSON.parse(JSON.stringify(sc.joints)),
      members: sc.members.map((m) => [...m]),
      loads: JSON.parse(JSON.stringify(sc.loads || {})),
      supports: { ...sc.supports },
      scale: 1,
    });
  },
  controls() {
    return `
        <div class="lab-block">
          <label class="field">
            <span>Load scale</span>
            <div class="slider-row">
              <input type="range" id="tr-scale" min="0" max="3" step="0.05" value="1" />
              <span class="mono val" id="tr-scale-val">1.00 ×</span>
              <input type="number" class="num" id="tr-scale-num" min="0" max="10" step="0.05" value="1" />
            </div>
          </label>
          <label class="check"><input type="checkbox" id="tr-zero" checked /> <span>mark zero-force members</span></label>
          <div id="tr-members" class="lab-list"></div>
          <p class="tiny">Tension is positive and drawn in blue; compression is red. The residual row is the check: it is ΣF at the worst joint, recomputed from the member forces. If it is not zero the truss is not in equilibrium.</p>
        </div>`;
  },
  bind(api) {
    const $ = (id) => document.getElementById(id);
    const s = $('tr-scale');
    const n = $('tr-scale-num');
    s.addEventListener('input', (e) => {
      api.slice().scale = Number(e.target.value);
      api.bump(false);
    });
    n.addEventListener('change', (e) => {
      const val = Number(e.target.value);
      if (!Number.isFinite(val) || val < 0) return;
      api.slice().scale = val;
      if (val > Number(s.max)) s.max = String(val);
      api.bump(false);
    });
    $('tr-zero').addEventListener('change', (e) => {
      api.slice().showZero = e.target.checked;
      api.bump(false);
    });
  },
  syncControls(state) {
    const $ = (id) => document.getElementById(id);
    const s = $('tr-scale');
    if (s) {
      if (state.scale > Number(s.max)) s.max = String(state.scale);
      s.value = String(state.scale);
    }
    const val = $('tr-scale-val');
    if (val) val.textContent = `${state.scale.toFixed(2)} ×`;
    const n = $('tr-scale-num');
    if (n && document.activeElement !== n) n.value = String(state.scale);
    const z = $('tr-zero');
    if (z) z.checked = !!state.showZero;
  },
  init(ctx) {
    const group = new THREE.Group();
    ctx.scene.add(group);
    const membersLine = fatSegments(segmentCapacity(64), { color: M.grey, width: 5 });
    group.add(membersLine);
    const zeroLine = fatSegments(segmentCapacity(32), { color: M.yellow, width: 2.5 });
    group.add(zeroLine);
    const jointDots = new THREE.Group();
    group.add(jointDots);
    const arrows = new THREE.Group();
    group.add(arrows);
    const labels = new THREE.Group();
    group.add(labels);
    markAnswer(labels);
    group.visible = false;
    return { group, membersLine, zeroLine, jointDots, arrows, labels };
  },
  enter(ctx, handle) {
    handle.group.visible = true;
  },
  exit(ctx, handle) {
    handle.group.visible = false;
  },
  recompute(state, computed) {
    if (!state.joints) return;
    const joints = Object.fromEntries(Object.entries(state.joints).map(([k, p]) => [k, toVec(p)]));
    const loads = Object.fromEntries(
      Object.entries(state.loads || {}).map(([k, p]) => [k, { x: p[0] * state.scale, y: p[1] * state.scale }]),
    );
    const input = { joints, members: state.members, loads, supports: state.supports };
    const sol = solveTruss(input);
    const zero = zeroForceMembers(input);
    // Second opinion: cut the truss and check that the kept side is itself in equilibrium.
    const names = Object.keys(joints);
    let section = null;
    if (names.length > 3) {
      const keep = [names[0]];
      const cut = state.members.filter(([p, q]) => (p === names[0]) !== (q === names[0]));
      if (cut.length) section = sectionCheck(input, keep, cut, joints[names[1]]);
    }
    computed.truss = {
      sol,
      joints,
      loads,
      zero: zero.map(([p, q]) => `${p}${q}`),
      section,
      totalLoad: Object.values(loads).reduce((s, L) => s + Math.abs(L.y), 0),
    };
  },
  syncViews(state, computed, ctx) {
    const h = ctx.handle;
    const c = computed.truss;
    if (!h || !c) return;
    const { sol, joints } = c;

    // Centre the truss on the origin and scale it to fit, so a long span and a short one both
    // fill the same space between the panels.
    const xs = Object.values(joints).map((p) => p.x);
    const ys = Object.values(joints).map((p) => p.y);
    const spanX = Math.max(...xs) - Math.min(...xs) || 1;
    const spanY = Math.max(...ys) - Math.min(...ys) || 1;
    const fit = Math.min(7.5 / spanX, 4.5 / spanY);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    h.group.scale.setScalar(fit / U);
    h.group.position.set(-cx * fit, -cy * fit, 0);

    // Members, coloured by what they carry.
    const seg = [];
    const colors = [];
    const push = (a, b, col) => {
      seg.push(a.x * U, a.y * U, 0, b.x * U, b.y * U, 0);
      colors.push(col.r, col.g, col.b, col.r, col.g, col.b);
    };
    const tint = new THREE.Color();
    for (const [p, q] of state.members) {
      const F = memberForce(sol, p, q);
      const st = stateOf(F);
      const peak = Math.max(1, ...Object.values(sol.forces).map((x) => Math.abs(x)));
      const t = Math.min(1, Math.abs(F) / peak);
      if (st === 'tension') tint.setHex(M.blue).lerp(new THREE.Color(M.white), 1 - t);
      else if (st === 'compression') tint.setHex(M.red).lerp(new THREE.Color(M.white), 1 - t);
      else tint.setHex(M.greyDark);
      push(joints[p], joints[q], tint);
    }
    setFatSegments(h.membersLine, seg);
    h.membersLine.geometry.setColors(colors);
    h.membersLine.material.vertexColors = true;
    h.membersLine.material.needsUpdate = true;

    // Zero-force members get a dashed overlay.
    const zseg = [];
    if (state.showZero) {
      for (const name of c.zero) {
        const [p, q] = [name[0], name[1]];
        if (!joints[p] || !joints[q]) continue;
        zseg.push(joints[p].x * U, joints[p].y * U, 0.02, joints[q].x * U, joints[q].y * U, 0.02);
      }
    }
    setFatSegments(h.zeroLine, zseg);

    // Joints, loads, reactions and member labels.
    while (h.jointDots.children.length) h.jointDots.remove(h.jointDots.children[0]);
    while (h.arrows.children.length) h.arrows.remove(h.arrows.children[0]);
    while (h.labels.children.length) h.labels.remove(h.labels.children[0]);

    const dotGeo = new THREE.CircleGeometry(0.11, 20);
    for (const [name, P] of Object.entries(joints)) {
      const kind = state.supports[name];
      const col = kind ? M.green : M.white;
      const dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: col, toneMapped: false }));
      dot.position.set(P.x * U, P.y * U, 0.03);
      h.jointDots.add(dot);
      const jl = label(`<b>${name}</b>${kind ? ` <span class="tiny">(${kind === 'pin' ? 'pin' : 'roller'})</span>` : ''}`);
      jl.position.set(P.x * U, P.y * U + 0.3, 0);
      h.jointDots.add(jl);
    }

    const peakLoad = Math.max(1, ...Object.values(c.loads).map((L) => Math.hypot(L.x, L.y)));
    for (const [name, L] of Object.entries(c.loads)) {
      const P = joints[name];
      const len = 0.4 + 1.1 * (Math.hypot(L.x, L.y) / peakLoad);
      const dir = new THREE.Vector3(L.x, L.y, 0).normalize();
      const start = new THREE.Vector3(P.x * U, P.y * U, 0).addScaledVector(dir, -len);
      h.arrows.add(new Arrow(dir, start, len, M.yellow, 0.22, 0.18, 0.035));
      const ll = label(`${Math.hypot(L.x, L.y).toFixed(0)} lb`);
      ll.position.set(start.x, start.y - 0.2, 0);
      h.arrows.add(ll);
    }

    for (const [j, R] of Object.entries(sol.reactions)) {
      const P = joints[j];
      const m = Math.hypot(R.x, R.y);
      if (m < 1e-6) continue;
      const dir = new THREE.Vector3(R.x, R.y, 0).normalize();
      const len = 0.4 + 1.1 * (m / peakLoad);
      const arrow = new Arrow(dir, new THREE.Vector3(P.x * U, P.y * U, 0), len, M.green, 0.2, 0.16, 0.03);
      markAnswer(arrow);
      h.arrows.add(arrow);
    }

    for (const [p, q] of state.members) {
      const F = memberForce(sol, p, q);
      const mid = { x: (joints[p].x + joints[q].x) / 2, y: (joints[p].y + joints[q].y) / 2 };
      const st = stateOf(F);
      const tag = st === 'zero' ? '0' : `${Math.abs(F).toFixed(0)} ${st === 'tension' ? 'T' : 'C'}`;
      const ml = label(`<span class="mono">${tag}</span>`);
      ml.position.set(mid.x * U, mid.y * U + 0.16, 0);
      h.labels.add(ml);
    }

    ctx.grid.visible = false;
  },
  law: () => [
    String.raw`\text{At each joint: }\sum F_x = 0,\quad \sum F_y = 0`,
    String.raw`m + r = 2j \quad\text{(statically determinate)}`,
  ],
  liveRows(state, computed) {
    const c = computed.truss;
    if (!c) return '';
    const { sol } = c;
    const rows = [
      kv('joints $j$ · members $m$ · reactions $r$', `${sol.counts.j} · ${sol.counts.m} · ${sol.counts.r}`),
      kv('$m + r$ vs $2j$', `${sol.counts.m + sol.counts.r} vs ${2 * sol.counts.j}${sol.determinate ? ' ✓' : ' — not determinate'}`),
      kv('total applied load', `${c.totalLoad.toFixed(0)} lb`),
    ];
    for (const [j, R] of Object.entries(sol.reactions)) {
      rows.push(kv(`reaction at ${j}`, qv('qV', `(${R.x.toFixed(0)}, ${R.y.toFixed(0)}) lb`)));
    }
    rows.push(kv('worst joint residual', qv(sol.worstResidual < 1e-6 ? 'qR' : 'qI', `${sol.worstResidual.toExponential(1)} lb`)));
    if (c.section) rows.push(kv('section cut ΣM', `${c.section.sumM.toExponential(1)} lb·ft`));
    return rows.join('');
  },
  readout(state, computed) {
    const c = computed.truss;
    if (!c) return '';
    const { sol } = c;
    const forces = Object.entries(sol.forces);
    const maxT = forces.reduce((m, [, F]) => Math.max(m, F), 0);
    const maxC = forces.reduce((m, [, F]) => Math.min(m, F), 0);
    return cells([
      ['largest tension', `${maxT.toFixed(0)} lb`, 'ok'],
      ['largest compression', `${Math.abs(maxC).toFixed(0)} lb`, ''],
      ['zero-force members', c.zero.length ? c.zero.join(', ') : 'none', ''],
      ['ΣF closes to', `${sol.worstResidual.toExponential(1)} lb`, sol.worstResidual < 1e-6 ? 'ok' : 'bad'],
    ]);
  },
  coach(state, computed) {
    const c = computed.truss;
    if (!c) return { title: '', body: '' };
    if (c.zero.length && state.showZero) {
      return {
        title: `${c.zero.length} zero-force member${c.zero.length === 1 ? '' : 's'} here`,
        body: [
          String.raw`A member carrying nothing is not a mistake in the truss — it is there to hold geometry, or to carry a load case that is not the one drawn.`,
          String.raw`Two rules find them without solving anything. At an unloaded, unsupported joint: if exactly two members meet and they are not in line, both are zero. If three meet and two of them are collinear, the odd one out is zero.`,
          String.raw`Spotting them first makes the rest of the truss much smaller — which is the whole reason the chapter teaches it before the method of sections.`,
        ],
      };
    }
    return {
      title: 'The method of joints is just ΣF = 0, one joint at a time',
      body: [
        String.raw`Cut the truss apart at the pins. Every member is a two-force member, so whatever it carries acts along its own length — that is what makes a truss tractable.`,
        String.raw`At each joint, two equations are available:`,
        eq(String.raw`\sum F_x = 0, \qquad \sum F_y = 0`),
        String.raw`Start where only two members are unknown, solve, and carry the answers to the next joint. The row marked "worst joint residual" is every one of those equations re-evaluated with the solved forces — when you close a joint by hand and it works, that residual is what agreed with you.`,
        String.raw`A positive force means the member pulls on its joints: tension. Negative means it pushes: compression. Assume tension every time and let the sign tell you, rather than guessing the sense from the picture.`,
      ],
    };
  },
});
