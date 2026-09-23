import * as THREE from 'three';
import { defineLab } from './define.js';
import { label, sliderRow, bindSlider, putSlider, showBlock } from './parts.js';
import { M, fatSegments, Arrow, markAnswer, setFatSegments, segmentCapacity } from '../scene/manim.js';
import { solveFrame } from '../physics/frames.js';
import { kv, cells, qv, eq } from '../ui/shared.js';

/**
 * Ch 6 · frames and machines.
 *
 * Several members pinned together. Assembled, the pin forces are invisible: each one acts equal
 * and opposite on the two members it joins, so they cancel. The explode slider pulls the members
 * apart into their own free-body diagrams and the pin forces appear — the same force, reversed,
 * on each side. That picture is the method: one FBD per member, Newton's third law at every pin.
 */

const BODY_COLORS = [M.blue, M.teal, M.purple, M.maroon];
const POOL = 18;

const SCENARIOS = [
  { id: 'aframe', name: 'A-frame · load on one leg', P: 600, t: 0.5, Q: 0 },
  { id: 'aframe2', name: 'A-frame · both legs loaded', P: 600, t: 0.5, Q: 400 },
  { id: 'bracket', name: 'Wall bracket · boom and strut', P: 400, t: 0.75, Q: 0 },
  { id: 'pliers', name: 'Pliers · a machine', P: 50, t: 0.5, Q: 0, b: 3 },
];

/** The model for a scenario, sized by the sliders. */
export function modelFor(state) {
  const { P, t } = state;
  if (state.scenarioId === 'bracket') {
    const D = [4 * t, 0];
    return {
      points: { A: [0, 0], B: [4, 0], C: [0, -3], D },
      bodies: { AB: ['A', 'D', 'B'], CB: ['C', 'B'] },
      pins: [{ at: 'B', bodies: ['AB', 'CB'] }],
      supports: [{ at: 'A', body: 'AB', kind: 'pin' }, { at: 'C', body: 'CB', kind: 'pin' }],
      loads: [{ body: 'AB', at: 'D', F: [0, -P] }],
      units: ['lb', 'ft'],
      explode: { AB: [0.3, 1], CB: [-0.3, -1] },
    };
  }
  if (state.scenarioId === 'pliers') {
    const b = state.b ?? 3;
    const Pl = { J1: [-1, 0.3], J2: [-1, -0.3], C: [0, 0], H1: [b, -0.7], H2: [b, 0.7] };
    return {
      points: Pl,
      bodies: { upper: ['J1', 'C', 'H1'], lower: ['J2', 'C', 'H2'], bolt: ['J1', 'J2'] },
      pins: [{ at: 'C', bodies: ['upper', 'lower'] }],
      contacts: [{ at: 'J1', bodies: ['upper', 'bolt'], dir: [0, 1] }, { at: 'J2', bodies: ['lower', 'bolt'], dir: [0, -1] }],
      loads: [{ body: 'upper', at: 'H1', F: [0, P] }, { body: 'lower', at: 'H2', F: [0, -P] }],
      units: ['N', 'in'],
      // Pull the jaws apart vertically and the bolt out to the left, so no free body crosses another.
      explode: { upper: [0.2, 1], lower: [0.2, -1], bolt: [-1.4, 0] },
    };
  }
  const D = [2 * t, 3 * t];
  const E = [4 - 2 * t, 3 * t];
  const two = state.scenarioId === 'aframe2';
  return {
    points: { A: [0, 0], B: [2, 3], C: [4, 0], D, ...(two ? { E } : {}) },
    bodies: { AB: ['A', 'D', 'B'], BC: two ? ['B', 'E', 'C'] : ['B', 'C'] },
    pins: [{ at: 'B', bodies: ['AB', 'BC'] }],
    supports: [{ at: 'A', body: 'AB', kind: 'pin' }, { at: 'C', body: 'BC', kind: 'pin' }],
    loads: [{ body: 'AB', at: 'D', F: [0, -P] }, ...(two ? [{ body: 'BC', at: 'E', F: [0, -(state.Q || 0)] }] : [])],
    units: ['lb', 'ft'],
    explode: { AB: [-1, 0.15], BC: [1, 0.15] },
  };
}

/** Members with no load of their own and exactly two connections carry force only along their line. */
function twoForceMembers(model) {
  const out = [];
  for (const [name, pts] of Object.entries(model.bodies)) {
    if ((model.loads || []).some((L) => L.body === name && (Math.hypot(...(L.F || [0, 0])) > 1e-12 || L.M))) continue;
    const links = new Set();
    for (const p of model.pins || []) if (p.bodies.includes(name)) links.add(p.at);
    for (const c of model.contacts || []) if (c.bodies.includes(name)) links.add(c.at);
    for (const s of model.supports || []) if (s.body === name) links.add(s.at);
    if (links.size === 2 && pts.length === 2) out.push(name);
  }
  return out;
}

const pt = (model, at) => (Array.isArray(at) ? at : model.points[at]);

export default defineLab({
  id: 'frame',
  exam: 'u3',
  title: 'Frame',
  hint: 'Drag "explode" — the pin forces appear, equal and opposite on the two members they join',
  orbit: false,
  camera: { pos: new THREE.Vector3(0.2, 0, 13), target: new THREE.Vector3(0.2, 0, 0) },
  keys: { r: 'reset', R: 'reset' },
  scenarios: SCENARIOS,
  defaultState() {
    return { scenarioId: 'aframe', P: 600, t: 0.5, Q: 0, b: 3, explode: 0.6 };
  },
  applyScenario(id, state) {
    const sc = SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
    Object.assign(state, { scenarioId: sc.id, P: sc.P, t: sc.t, Q: sc.Q, b: sc.b ?? 3 });
  },
  controls() {
    return `
        <div class="lab-block">
          ${sliderRow('fr-explode', 'Explode into free bodies', 0.6, 0, 1, 0.01)}
          ${sliderRow('fr-P', '<span id="fr-Plabel">Load P</span>', 600, 0, 2000, 10)}
          <div id="fr-tblock">${sliderRow('fr-t', 'Load position along the member (0 → 1)', 0.5, 0.05, 1, 0.01)}</div>
          <div id="fr-Qblock">${sliderRow('fr-Q', 'Load Q on BC (lb)', 400, 0, 2000, 10)}</div>
          <div id="fr-bblock">${sliderRow('fr-b', 'Handle length b (in)', 3, 1, 8, 0.1)}</div>
          <p class="tiny">Yellow is applied, green is a support reaction, pink is a pin or contact force — drawn on the member it acts on. Assembled, the pink pairs cancel; exploded, you can see they are the same force reversed.</p>
        </div>`;
  },
  bind(api) {
    bindSlider(api, 'fr-explode', (s, val) => { s.explode = val; });
    bindSlider(api, 'fr-P', (s, val) => { s.P = val; });
    bindSlider(api, 'fr-t', (s, val) => { s.t = val; });
    bindSlider(api, 'fr-Q', (s, val) => { s.Q = val; });
    bindSlider(api, 'fr-b', (s, val) => { s.b = val; });
  },
  syncControls(state) {
    putSlider('fr-explode', state.explode, 2);
    putSlider('fr-P', state.P);
    putSlider('fr-t', state.t, 2);
    putSlider('fr-Q', state.Q);
    putSlider('fr-b', state.b, 1);
    const pliers = state.scenarioId === 'pliers';
    const l = document.getElementById('fr-Plabel');
    if (l) l.textContent = pliers ? 'Hand force P on each handle (N)' : 'Load P (lb)';
    showBlock('fr-tblock', !pliers);
    showBlock('fr-Qblock', state.scenarioId === 'aframe2');
    showBlock('fr-bblock', pliers);
  },
  init(ctx) {
    const group = new THREE.Group();
    ctx.scene.add(group);
    const bodies = [0, 1, 2, 3].map((i) => fatSegments(segmentCapacity(6), { color: BODY_COLORS[i], width: 8 }));
    const ground = fatSegments(segmentCapacity(24), { color: M.green, width: 2 });
    const twoForce = fatSegments(segmentCapacity(4), { color: M.yellow, width: 1.4, dashed: true });
    group.add(...bodies, ground, twoForce);
    const ringGeo = new THREE.RingGeometry(0.08, 0.14, 24);
    const rings = Array.from({ length: 12 }, () => {
      const r = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: M.white, toneMapped: false }));
      group.add(r);
      return r;
    });
    const arrows = Array.from({ length: POOL }, () => {
      const a = new Arrow(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, M.pink, 0.24, 0.18, 0.032);
      group.add(a);
      return a;
    });
    const tags = Array.from({ length: POOL }, () => {
      const l = label('');
      group.add(l);
      return l;
    });
    const names = Array.from({ length: 12 }, () => {
      const l = label('');
      group.add(l);
      return l;
    });
    group.visible = false;
    return { group, bodies, ground, twoForce, rings, arrows, tags, names };
  },
  enter(ctx, handle) {
    handle.group.visible = true;
  },
  exit(ctx, handle) {
    handle.group.visible = false;
  },
  recompute(state, computed) {
    const model = modelFor(state);
    const sol = solveFrame(model);
    computed.frame = { model, sol, twoForce: twoForceMembers(model) };
  },
  syncViews(state, computed, ctx) {
    const h = ctx.handle;
    const c = computed.frame;
    if (!h || !c) return;
    const { model, sol } = c;
    const [uF] = model.units;
    const names = Object.keys(model.bodies);

    // Fit, then work out each body's explode offset: away from the assembly's centre.
    const all = Object.values(model.points);
    const xs = all.map((p) => p[0]);
    const ys = all.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const s = Math.min(4.6 / (Math.max(...xs) - Math.min(...xs) || 1), 3.4 / (Math.max(...ys) - Math.min(...ys) || 1));
    const offset = {};
    names.forEach((b) => {
      // Each scenario says which way its members come apart; otherwise, away from the centre.
      const pts = model.bodies[b].map((n) => model.points[n]);
      const [mx, my] = model.explode?.[b] || [pts.reduce((a, p) => a + p[0], 0) / pts.length - cx, pts.reduce((a, p) => a + p[1], 0) / pts.length - cy];
      const L = Math.hypot(mx, my) || 1;
      offset[b] = new THREE.Vector3((mx / L) * 1.1 * state.explode, (my / L) * 1.1 * state.explode, 0);
    });
    const P = (p, body) => new THREE.Vector3((p[0] - cx) * s + 0.75, (p[1] - cy) * s, 0).add(body ? offset[body] : new THREE.Vector3());

    // Members.
    h.bodies.forEach((line, i) => {
      const b = names[i];
      if (!b) return setFatSegments(line, []);
      const seg = [];
      const pts = model.bodies[b];
      for (let k = 1; k < pts.length; k++) {
        const p0 = P(model.points[pts[k - 1]], b);
        const p1 = P(model.points[pts[k]], b);
        seg.push(p0.x, p0.y, 0, p1.x, p1.y, 0);
      }
      setFatSegments(line, seg);
    });

    // Two-force members get a dashed line of action, extended past both ends.
    const tf = [];
    for (const b of c.twoForce) {
      const [p, q] = model.bodies[b].map((n) => P(model.points[n], b));
      const d = q.clone().sub(p).normalize().multiplyScalar(0.6);
      tf.push(p.x - d.x, p.y - d.y, 0.01, q.x + d.x, q.y + d.y, 0.01);
    }
    setFatSegments(h.twoForce, tf);
    h.twoForce.computeLineDistances();

    // Pins and contacts: a ring on each member they touch. Supports: a hatched ground glyph.
    let ri = 0;
    const ring = (v3) => {
      if (ri >= h.rings.length) return;
      const r = h.rings[ri++];
      r.visible = true;
      r.position.set(v3.x, v3.y, 0.02);
    };
    h.rings.forEach((r) => { r.visible = false; });
    for (const p of [...(model.pins || []), ...(model.contacts || [])]) for (const b of p.bodies) ring(P(pt(model, p.at), b));
    const g = [];
    for (const sp of model.supports || []) {
      const v3 = P(pt(model, sp.at), sp.body);
      ring(v3);
      const y = v3.y - 0.34;
      g.push(v3.x, v3.y, 0, v3.x - 0.22, y, 0, v3.x, v3.y, 0, v3.x + 0.22, y, 0, v3.x - 0.34, y, 0, v3.x + 0.34, y, 0);
      for (let k = 0; k < 4; k++) g.push(v3.x - 0.3 + k * 0.18, y, 0, v3.x - 0.42 + k * 0.18, y - 0.14, 0);
    }
    setFatSegments(h.ground, g);

    // Forces, from one pool: loads (yellow), reactions (green), pin/contact forces (pink).
    const Fmax = Math.max(1e-9, ...(model.loads || []).map((L) => Math.hypot(...L.F)), ...names.flatMap((b) => sol.onBody[b].map((f) => Math.hypot(...f.F))));
    const k = 1.25 / Fmax;
    let ai = 0;
    const draw = (atV3, F, color, text, answer) => {
      const m = Math.hypot(F[0], F[1]);
      if (ai >= POOL || m < 1e-9 || !Number.isFinite(m)) return;
      const a = h.arrows[ai];
      const tag = h.tags[ai];
      ai++;
      const len = Math.max(0.3, m * k);
      const dir = new THREE.Vector3(F[0], F[1], 0).normalize();
      // Arrows end at the point they act on, so they read as pushes and pulls on that member.
      a.visible = true;
      a.position.copy(atV3).addScaledVector(dir, -len - 0.1);
      a.setDirection(dir);
      a.setLength(len);
      a.setColor(color);
      a.layers.set(0);
      a.traverse((o) => o.layers.set(answer ? 1 : 0));
      tag.visible = true;
      tag.position.copy(atV3).addScaledVector(dir, -len - 0.35);
      tag.element.innerHTML = `<span class="tiny">${text}</span>`;
      tag.layers.set(answer ? 1 : 0);
    };
    h.arrows.forEach((a) => { a.visible = false; });
    h.tags.forEach((t) => { t.visible = false; });
    for (const L of model.loads || []) draw(P(pt(model, L.at), L.body), L.F, M.yellow, `${Math.hypot(...L.F).toFixed(0)} ${uF}`, false);
    const showInternal = state.explode > 0.04;
    for (const b of names) {
      for (const f of sol.onBody[b]) {
        if (f.kind !== 'support' && !showInternal) continue;
        const m = Math.hypot(...f.F);
        draw(P(f.at, b), f.F, f.kind === 'support' ? M.green : M.pink, `${f.group}: ${m.toFixed(0)}`, true);
      }
    }

    // Point names, on the assembled position (or the first member's copy when exploded).
    h.names.forEach((l) => { l.visible = false; });
    let ni = 0;
    for (const [n, p] of Object.entries(model.points)) {
      if (ni >= h.names.length) break;
      const owner = names.find((b) => model.bodies[b].includes(n));
      const l = h.names[ni++];
      l.visible = true;
      l.position.copy(P(p, owner)).add(new THREE.Vector3(0.18, 0.2, 0));
      l.element.innerHTML = `<b>${n}</b>`;
    }
    ctx.grid.visible = false;
  },
  law: () => [
    String.raw`\text{each member: } \sum F_x = \sum F_y = \sum M = 0`,
    String.raw`\text{at a pin: } \vec{F}_{\text{on }1} = -\vec{F}_{\text{on }2}`,
  ],
  liveRows(state, computed) {
    const c = computed.frame;
    if (!c) return '';
    const { sol, model } = c;
    const [uF, uL] = model.units;
    const rows = [
      kv('members · equations · unknowns', `${sol.counts.bodies} · ${sol.counts.equations} · ${sol.counts.unknowns}`),
    ];
    if (c.twoForce.length) rows.push(kv('two-force members', c.twoForce.join(', ')));
    const groups = {};
    for (const u of sol.unknowns) (groups[u.key.slice(0, -1)] ||= []).push(u);
    // A pin's components are the force on the first member it joins; the other member feels the reverse.
    for (const [g, us] of Object.entries(groups)) {
      const vals = us.map((u) => `${u.label.replace(/_(\w+)/, '<sub>$1</sub>')} = ${sol.values[u.key].toFixed(1)}`).join(' · ');
      const kind = us[0].kind === 'support' ? 'support' : us[0].kind === 'contact' ? 'contact' : 'pin';
      const mag = us.length === 2 ? ` · |${g}| = ${Math.hypot(sol.values[us[0].key], sol.values[us[1].key]).toFixed(1)}` : '';
      const on = kind === 'pin' ? ` (on ${(model.pins || []).find((p) => p.at === g)?.bodies[0]})` : '';
      rows.push(kv(`${kind} ${g}${on}`, qv('qV', `${vals}${mag}`)));
    }
    rows.push(kv('worst member residual', qv(sol.worstResidual < 1e-6 ? 'qR' : 'qI', `${sol.worstResidual.toExponential(1)} ${uF}, ${uF}·${uL}`)));
    if (model.contacts) {
      const grip = sol.values.J1n;
      rows.push(kv('mechanical advantage (grip / hand force)', qv('qV', `${(grip / state.P).toFixed(2)}`)));
    }
    return rows.join('');
  },
  readout(state, computed) {
    const c = computed.frame;
    if (!c) return '';
    const { sol, model } = c;
    const [uF] = model.units;
    if (model.contacts) {
      const C = Math.hypot(sol.values.Cx, sol.values.Cy);
      return cells([
        ['grip at the jaws', `${sol.values.J1n.toFixed(1)} ${uF}`, 'ok'],
        ['hand force', `${state.P.toFixed(0)} ${uF}`, ''],
        ['pin C carries', `${C.toFixed(1)} ${uF}`, ''],
        ['ΣF, ΣM close to', sol.worstResidual.toExponential(1), sol.worstResidual < 1e-6 ? 'ok' : 'bad'],
      ]);
    }
    const B = Math.hypot(sol.values.Bx, sol.values.By);
    const sup = (model.supports || []).map((s) => `${s.at}: ${Math.hypot(sol.values[`${s.at}x`], sol.values[`${s.at}y`]).toFixed(0)}`).join(' · ');
    return cells([
      ['pin B', `${B.toFixed(1)} ${uF}`, 'ok'],
      [`$B_x$ · $B_y$ on ${model.pins[0].bodies[0]}`, `${sol.values.Bx.toFixed(1)} · ${sol.values.By.toFixed(1)}`, ''],
      ['supports', sup, ''],
      ['ΣF, ΣM close to', sol.worstResidual.toExponential(1), sol.worstResidual < 1e-6 ? 'ok' : 'bad'],
    ]);
  },
  coach(state, computed) {
    const c = computed.frame;
    if (!c) return { title: '', body: '' };
    const { model, sol } = c;
    if (model.contacts) {
      return {
        title: `A machine: ${state.P.toFixed(0)} N in, ${sol.values.J1n.toFixed(0)} N out`,
        body: [
          'A machine turns an input force into an output force; nothing holds it to the ground, so its applied loads must balance among themselves.',
          String.raw`Take moments about the pin on one handle alone and the pin force drops out. With the jaw a distance $a$ from the pin and the hand force a distance $b$:`,
          eq(String.raw`N\,a = P\,b \;\Rightarrow\; N = P\,\frac{b}{a}`),
          'Lengthen the handles and the grip grows in proportion — but the pin has to carry the sum of the two, which is why pliers fail at the pivot.',
        ],
      };
    }
    if (c.twoForce.length) {
      return {
        title: `${c.twoForce.join(' and ')} is a two-force member — spot it first`,
        body: [
          String.raw`A member loaded only at two pins, and nowhere else, can only push or pull along the line joining them. That dashed line is the direction of the pin force before you write a single equation.`,
          String.raw`It turns two unknowns ($B_x$, $B_y$) into one magnitude, which is usually what makes the frame solvable by hand in the order you want: moments about a support on the other member.`,
          'Load both legs and the dashed line disappears — the member now bends, and its pin forces point wherever equilibrium puts them.',
        ],
      };
    }
    return {
      title: 'One free-body per member, Newton\'s third law at every pin',
      body: [
        String.raw`Each member gives three equations. Every pin between two members adds two unknowns — but only two, because the force on one member is exactly the reverse of the force on the other.`,
        eq(String.raw`3 \times ${sol.counts.bodies} \text{ equations} = ${sol.counts.unknowns} \text{ unknowns}`),
        'Drag explode to 0: the pink pairs vanish, because inside the assembled frame they cancel. The whole frame as one free body only sees the supports and the loads — a good first equation, before you take it apart.',
      ],
    };
  },
});
