import * as THREE from 'three';
import { defineLab } from './define.js';
import { label, sliderRow, bindSlider, putSlider, showBlock, arcSegments } from './parts.js';
import { M, fatSegments, Arrow, markAnswer, setFatSegments, segmentCapacity } from '../scene/manim.js';
import { inclineState, inclineRange, tipOrSlip, beltTension } from '../physics/friction.js';
import { kv, cells, qv, eq } from '../ui/shared.js';

/**
 * Ch 8 · dry friction.
 *
 * The chapter's hard part is not F = μN — it is knowing when that equation applies. So the lab
 * always answers "is it moving?" first. On the incline the friction cone makes that visible: the
 * contact force (N and F together) must lie inside a cone of half-angle atan μs, and the block
 * slides the moment equilibrium would need it outside. Tip-or-slip does the same for the other
 * way a block can fail, and the belt shows why a few turns of rope hold a ship.
 */

const DEG = Math.PI / 180;

const SCENARIOS = [
  { id: 'incline', name: 'Block on an incline · will it slide?', mode: 'incline', W: 100, theta: 25, mus: 0.4, muk: 0.3, P: 0, phi: 0 },
  { id: 'push', name: 'Push up the incline · the band of P that holds it', mode: 'incline', W: 100, theta: 35, mus: 0.3, muk: 0.25, P: 60, phi: 10 },
  { id: 'tip', name: 'Tip or slip?', mode: 'tip', W: 200, b: 2, h: 4, hp: 3, mus: 0.35, P: 40 },
  { id: 'belt', name: 'Rope around a post · belt friction', mode: 'belt', T1: 50, mu: 0.3, beta: 180 },
];

const FORCE = 2.0;

export default defineLab({
  id: 'friction',
  exam: 'u4',
  title: 'Friction',
  hint: 'Is it moving? Answer that first — friction is only μN on the verge of slipping or while sliding',
  orbit: false,
  camera: { pos: new THREE.Vector3(0.4, 0.2, 13), target: new THREE.Vector3(0.4, 0.2, 0) },
  keys: { r: 'reset', R: 'reset' },
  scenarios: SCENARIOS,
  defaultState() {
    return { scenarioId: 'incline', mode: 'incline', W: 100, theta: 25, mus: 0.4, muk: 0.3, P: 0, phi: 0, b: 2, h: 4, hp: 3, T1: 50, mu: 0.3, beta: 180 };
  },
  applyScenario(id, state) {
    const sc = SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
    Object.assign(state, sc, { scenarioId: sc.id });
    delete state.id;
    delete state.name;
  },
  controls() {
    return `
        <div class="lab-block">
          <div id="fx-inc">
            ${sliderRow('fx-W', 'Weight W (lb)', 100, 0, 500, 5)}
            ${sliderRow('fx-theta', 'Slope θ (°)', 25, 0, 70, 0.5)}
            ${sliderRow('fx-mus', 'Static coefficient μs', 0.4, 0, 1.2, 0.01)}
            ${sliderRow('fx-muk', 'Kinetic coefficient μk', 0.3, 0, 1.2, 0.01)}
            ${sliderRow('fx-P', 'Push P (lb)', 0, 0, 400, 1)}
            ${sliderRow('fx-phi', 'P angle above the slope φ (°)', 0, -30, 60, 1)}
          </div>
          <div id="fx-tip">
            ${sliderRow('fx-tW', 'Weight W (lb)', 200, 10, 600, 5)}
            ${sliderRow('fx-b', 'Width b (ft)', 2, 0.5, 6, 0.1)}
            ${sliderRow('fx-h', 'Height h (ft)', 4, 0.5, 8, 0.1)}
            ${sliderRow('fx-hp', 'Push height (ft)', 3, 0.1, 8, 0.1)}
            ${sliderRow('fx-tmus', 'Static coefficient μs', 0.35, 0, 1.2, 0.01)}
            ${sliderRow('fx-tP', 'Push P (lb)', 40, 0, 400, 1)}
          </div>
          <div id="fx-belt">
            ${sliderRow('fx-T1', 'Holding tension T₁ (lb)', 50, 1, 300, 1)}
            ${sliderRow('fx-mu', 'Coefficient μ', 0.3, 0, 1, 0.01)}
            ${sliderRow('fx-beta', 'Wrap angle β (°)', 180, 0, 1080, 5)}
          </div>
          <p class="tiny" id="fx-note"></p>
        </div>`;
  },
  bind(api) {
    const map = {
      'fx-W': 'W', 'fx-theta': 'theta', 'fx-mus': 'mus', 'fx-muk': 'muk', 'fx-P': 'P', 'fx-phi': 'phi',
      'fx-tW': 'W', 'fx-b': 'b', 'fx-h': 'h', 'fx-hp': 'hp', 'fx-tmus': 'mus', 'fx-tP': 'P',
      'fx-T1': 'T1', 'fx-mu': 'mu', 'fx-beta': 'beta',
    };
    for (const [id, key] of Object.entries(map)) bindSlider(api, id, (s, val) => { s[key] = val; });
  },
  syncControls(state) {
    const put = (id, v, d = 0) => putSlider(id, v, d);
    put('fx-W', state.W); put('fx-theta', state.theta, 1); put('fx-mus', state.mus, 2); put('fx-muk', state.muk, 2);
    put('fx-P', state.P); put('fx-phi', state.phi);
    put('fx-tW', state.W); put('fx-b', state.b, 1); put('fx-h', state.h, 1); put('fx-hp', state.hp, 1);
    put('fx-tmus', state.mus, 2); put('fx-tP', state.P);
    put('fx-T1', state.T1); put('fx-mu', state.mu, 2); put('fx-beta', state.beta);
    showBlock('fx-inc', state.mode === 'incline');
    showBlock('fx-tip', state.mode === 'tip');
    showBlock('fx-belt', state.mode === 'belt');
    const note = document.getElementById('fx-note');
    if (note) {
      note.textContent = {
        incline: 'Grey is the weight, yellow the push, green the normal force and orange friction. The gold lines are the friction cone. The dashed line is the contact force (N and F together) that equilibrium needs: inside the cone it holds; when it would have to lean outside, it turns red and the block slides.',
        tip: 'The green arrow is where the floor pushes up — the resultant of the normal force. As P grows it walks toward the front corner. If it reaches the corner before friction runs out, the box tips; otherwise it slides.',
        belt: 'T₂ is the pull the rope can resist when T₁ holds the other end. The ratio depends only on μ and the angle of contact — not on the size of the post.',
      }[state.mode];
    }
  },
  init(ctx) {
    const group = new THREE.Group();
    ctx.scene.add(group);
    const ground = fatSegments(segmentCapacity(20), { color: M.grey, width: 3 });
    const cone = markAnswer(fatSegments(segmentCapacity(2), { color: M.gold, width: 1.6, dashed: true }));
    const resultant = markAnswer(fatSegments(segmentCapacity(1), { color: M.green, width: 1.6, dashed: true }));
    const rope = fatSegments(segmentCapacity(220), { color: M.teal, width: 4 });
    group.add(ground, cone, resultant, rope);
    const block = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: M.blueE, transparent: true, opacity: 0.85, toneMapped: false, side: THREE.DoubleSide }));
    const drum = new THREE.Mesh(new THREE.CircleGeometry(1.1, 64), new THREE.MeshBasicMaterial({ color: M.greyDark, toneMapped: false }));
    group.add(block, drum);
    const mk = (color, w = 0.035) => new Arrow(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, color, 0.24, 0.18, w);
    const arrows = { W: mk(M.grey), P: mk(M.yellow), N: markAnswer(mk(M.green)), F: markAnswer(mk(M.gold)), T1: mk(M.teal), T2: markAnswer(mk(M.teal)), move: markAnswer(mk(M.red, 0.02)) };
    Object.values(arrows).forEach((a) => group.add(a));
    const labels = { W: label(''), P: label(''), N: markAnswer(label('')), F: markAnswer(label('')), T1: label(''), T2: markAnswer(label('')), state: markAnswer(label('')), corner: label('') };
    Object.values(labels).forEach((l) => group.add(l));
    group.visible = false;
    return { group, ground, cone, resultant, rope, block, drum, arrows, labels, slide: 0, tilt: 0 };
  },
  enter(ctx, handle) {
    handle.group.visible = true;
  },
  exit(ctx, handle) {
    handle.group.visible = false;
  },
  recompute(state, computed) {
    if (state.mode === 'incline') {
      const s = inclineState(state);
      computed.fr = { mode: 'incline', ...s, ...inclineRange(state) };
    } else if (state.mode === 'tip') {
      computed.fr = { mode: 'tip', ...tipOrSlip(state) };
    } else {
      const T2 = beltTension(state.T1, state.mu, state.beta);
      computed.fr = { mode: 'belt', T2, ratio: T2 / state.T1, perTurn: Math.exp(2 * Math.PI * state.mu) };
    }
  },
  afterFrame(dt, state, computed, ctx) {
    // A sliding block drifts along the slope and a tipping box leans — motion you can see, so the
    // regime is never only a word in the panel.
    const h = ctx.handle;
    const c = computed.fr;
    if (!h || !c) return false;
    let moved = false;
    if (c.mode === 'incline' && c.dir) {
      h.slide += c.dir * dt * 0.8;
      if (Math.abs(h.slide) > 1.6) h.slide = 0;
      moved = true;
    } else if (c.mode === 'incline' && h.slide) {
      h.slide = 0;
      moved = true;
    }
    if (c.mode === 'tip') {
      const want = c.state === 'tip' ? 10 * DEG : 0;
      const nt = h.tilt + (want - h.tilt) * Math.min(1, dt * 4);
      if (Math.abs(nt - h.tilt) > 1e-4) moved = true;
      h.tilt = nt;
      const ws = c.state === 'slip' ? h.slide + dt * 0.8 : 0;
      h.slide = ws > 1.5 ? 0 : ws;
      if (c.state === 'slip') moved = true;
    }
    if (moved) this.syncViews(state, computed, ctx);
    return moved;
  },
  syncViews(state, computed, ctx) {
    const h = ctx.handle;
    const c = computed.fr;
    if (!h || !c) return;
    const A = h.arrows;
    const L = h.labels;
    Object.values(A).forEach((a) => { a.visible = false; });
    Object.values(L).forEach((l) => { l.visible = false; });
    h.block.visible = false;
    h.drum.visible = false;
    setFatSegments(h.cone, []);
    setFatSegments(h.resultant, []);
    setFatSegments(h.rope, []);
    const put = (lab, p, html) => {
      lab.visible = true;
      lab.position.copy(p);
      lab.element.innerHTML = html;
    };
    const force = (arrow, lab, at, F, k, text, tail = false) => {
      const m = Math.hypot(F.x, F.y);
      if (m < 1e-9) return;
      const dir = new THREE.Vector3(F.x, F.y, 0).normalize();
      const len = Math.max(0.3, m * k);
      arrow.visible = true;
      // `tail`: the arrow starts at the point (pulls); otherwise it ends there (pushes).
      arrow.position.copy(tail ? at : at.clone().addScaledVector(dir, -len));
      arrow.setDirection(dir);
      arrow.setLength(len);
      if (lab) put(lab, (tail ? at.clone().addScaledVector(dir, len + 0.3) : at.clone().addScaledVector(dir, -len - 0.3)), text);
    };

    if (c.mode === 'incline') {
      const t = state.theta * DEG;
      const along = new THREE.Vector3(Math.cos(t), Math.sin(t), 0);
      const normal = new THREE.Vector3(-Math.sin(t), Math.cos(t), 0);
      const origin = new THREE.Vector3(-2.8, -1.6, 0);
      const end = origin.clone().addScaledVector(along, 6.4);
      setFatSegments(h.ground, [origin.x, origin.y, 0, end.x, end.y, 0, origin.x, origin.y, 0, end.x, origin.y, 0]);
      const size = 1.1;
      const contact = origin.clone().addScaledVector(along, 3.0 + h.slide);
      const centre = contact.clone().addScaledVector(normal, size / 2);
      h.block.visible = true;
      h.block.scale.set(size, size, 1);
      h.block.position.copy(centre);
      h.block.rotation.set(0, 0, t);
      const k = FORCE / Math.max(state.W, state.P, 1e-9);
      force(A.W, L.W, centre, { x: 0, y: -state.W }, k, `W = ${state.W.toFixed(0)}`, true);
      if (state.P > 0) {
        const pd = along.clone().multiplyScalar(Math.cos(state.phi * DEG)).addScaledVector(normal, Math.sin(state.phi * DEG));
        force(A.P, L.P, centre.clone().addScaledVector(along, -size / 2), { x: pd.x * state.P, y: pd.y * state.P }, k, `P = ${state.P.toFixed(0)}`);
      }
      if (c.N > 0) {
        const Nv = normal.clone().multiplyScalar(c.N);
        const Fv = along.clone().multiplyScalar(c.F);
        force(A.N, L.N, contact, Nv, k, `N = ${c.N.toFixed(1)}`, true);
        if (Math.abs(c.F) > 1e-9) force(A.F, L.F, contact.clone().addScaledVector(along, 0.25 * Math.sign(c.F)), Fv, k, `F = ${Math.abs(c.F).toFixed(1)}`, true);
        // The friction cone, and the contact force that must stay inside it.
        const phis = Math.atan(state.mus);
        const len = 2.2;
        const e1 = normal.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), phis).multiplyScalar(len).add(contact);
        const e2 = normal.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), -phis).multiplyScalar(len).add(contact);
        setFatSegments(h.cone, [contact.x, contact.y, 0.02, e1.x, e1.y, 0.02, contact.x, contact.y, 0.02, e2.x, e2.y, 0.02]);
        h.cone.computeLineDistances();
        // At rest, the contact force that acts (green, inside the cone). Sliding, the one that
        // equilibrium would have needed (red): it falls outside the cone, which is why it slides.
        const R = Nv.clone().add(along.clone().multiplyScalar(c.dir ? c.need : c.F));
        h.resultant.material.color.set(c.dir ? M.red : M.green);
        const Rend = contact.clone().addScaledVector(R.normalize(), len * 0.92);
        setFatSegments(h.resultant, [contact.x, contact.y, 0.03, Rend.x, Rend.y, 0.03]);
        h.resultant.computeLineDistances();
      }
      if (c.dir) {
        A.move.visible = true;
        A.move.position.copy(centre.clone().addScaledVector(normal, size * 0.9));
        A.move.setDirection(along.clone().multiplyScalar(c.dir));
        A.move.setLength(0.9);
      }
      put(L.state, new THREE.Vector3(0.4, 2.9, 0), `<b>${c.regime}</b>`);
    } else if (c.mode === 'tip') {
      const s = 3.2 / Math.max(state.h, state.b, 1e-9);
      const bw = state.b * s;
      const bh = state.h * s;
      const floorY = -1.2;
      setFatSegments(h.ground, [-3.4, floorY, 0, 4.2, floorY, 0]);
      const x0 = -bw / 2 + 0.4 + h.slide;
      const corner = new THREE.Vector3(x0 + bw, floorY, 0);
      // Lean about the front corner when tipping.
      const rot = (p) => p.clone().sub(corner).applyAxisAngle(new THREE.Vector3(0, 0, 1), -h.tilt).add(corner);
      h.block.visible = true;
      h.block.scale.set(bw, bh, 1);
      h.block.rotation.set(0, 0, -h.tilt);
      h.block.position.copy(rot(new THREE.Vector3(x0 + bw / 2, floorY + bh / 2, 0)));
      const k = 1.5 / Math.max(state.W, state.P, 1e-9);
      const centre = rot(new THREE.Vector3(x0 + bw / 2, floorY + bh / 2, 0));
      force(A.W, L.W, centre, { x: 0, y: -state.W }, k, `W = ${state.W.toFixed(0)}`, true);
      if (state.P > 0) force(A.P, L.P, rot(new THREE.Vector3(x0, floorY + Math.min(state.hp, state.h) * s, 0)), { x: state.P, y: 0 }, k, `P = ${state.P.toFixed(0)}`);
      const xN = Math.min(c.x, state.b / 2);
      const nAt = rot(new THREE.Vector3(x0 + bw / 2 + xN * s, floorY, 0));
      force(A.N, L.N, nAt, { x: 0, y: state.W }, k, `N at ${xN.toFixed(2)} ft from centre`);
      if (c.F > 1e-9) force(A.F, L.F, rot(new THREE.Vector3(x0 + bw / 2, floorY, 0)), { x: -c.F, y: 0 }, k, `F = ${c.F.toFixed(1)}`);
      put(L.corner, corner.clone().add(new THREE.Vector3(0.2, -0.25, 0)), '<span class="tiny">corner</span>');
      put(L.state, new THREE.Vector3(0.4, 2.9, 0), `<b>${c.state === 'rest' ? `at rest — ${c.first === 'tip' ? 'will tip' : 'will slip'} first` : c.state === 'tip' ? 'tips' : c.state === 'slip' ? 'slides' : 'tips and slides together'}</b>`);
    } else {
      h.drum.visible = true;
      h.drum.position.set(0.4, 0.6, 0);
      const r = 1.15;
      const cx = 0.4;
      const cy = 0.6;
      const beta = state.beta * DEG;
      // Contact from a1 (left, holding side) clockwise over the top to a2; each turn a little wider.
      const a1 = Math.PI / 2 + beta / 2;
      const n = Math.max(2, Math.ceil(state.beta / 5));
      const seg = [];
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const a = a1 - (beta * i) / n;
        const rr = r + 0.05 * ((beta * i) / n / (2 * Math.PI));
        const p = [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
        if (prev) seg.push(prev[0], prev[1], 0.02, p[0], p[1], 0.02);
        prev = p;
      }
      setFatSegments(h.rope, seg);
      const a2 = a1 - beta;
      const rEnd = r + 0.05 * (beta / (2 * Math.PI));
      const p1 = new THREE.Vector3(cx + r * Math.cos(a1), cy + r * Math.sin(a1), 0);
      const p2 = new THREE.Vector3(cx + rEnd * Math.cos(a2), cy + rEnd * Math.sin(a2), 0);
      const t1 = { x: -Math.sin(a1), y: Math.cos(a1) };
      const t2 = { x: Math.sin(a2), y: -Math.cos(a2) };
      const k = 2.4 / Math.max(c.T2, state.T1, 1e-9);
      force(A.T1, L.T1, p1, { x: t1.x * state.T1, y: t1.y * state.T1 }, k, `T₁ = ${state.T1.toFixed(0)}`, true);
      force(A.T2, L.T2, p2, { x: t2.x * c.T2, y: t2.y * c.T2 }, k, `T₂ = ${c.T2.toFixed(0)}`, true);
      put(L.state, new THREE.Vector3(0.4, 2.9, 0), `<b>T₂ / T₁ = ${c.ratio.toFixed(2)}</b>`);
      setFatSegments(h.ground, []);
    }
    ctx.grid.visible = false;
  },
  law: (state) => (state?.mode === 'belt'
    ? [String.raw`T_2 = T_1\,e^{\mu\beta}\quad(\beta\text{ in radians})`]
    : [String.raw`F \le \mu_s N \text{ at rest}, \qquad F = \mu_k N \text{ sliding}`, String.raw`\tan\phi_s = \mu_s`]),
  liveRows(state, computed) {
    const c = computed.fr;
    if (!c) return '';
    const f = (x, d = 1) => x.toFixed(d);
    if (c.mode === 'incline') {
      return [
        kv('normal force $N$', `${f(c.N)} lb`),
        kv('friction equilibrium needs', `${f(Math.abs(c.need))} lb ${c.need >= 0 ? 'up' : 'down'} the slope`),
        kv(String.raw`most static friction can give, $\mu_s N$`, `${f(c.Fmax)} lb`),
        kv('so the block', qv(c.dir ? 'qI' : 'qR', c.regime)),
        kv('friction actually acting', qv('qV', `${f(Math.abs(c.F))} lb${c.dir ? ` (kinetic, μk N)` : ''}`)),
        kv(String.raw`P that holds it: from $P_{hold}$ to $P_{push}$`, qv('qV', `${f(c.Phold)} – ${f(c.Ppush)} lb`)),
        kv(String.raw`angle of repose $\phi_s = \tan^{-1}\mu_s$`, `${f(c.repose)}°`),
      ].join('');
    }
    if (c.mode === 'tip') {
      return [
        kv(String.raw`slips at $P = \mu_s W$`, `${f(c.Pslip)} lb`),
        kv(String.raw`tips at $P\,h_P = W\,b/2$`, `${f(c.Ptip)} lb`),
        kv('happens first', qv('qV', c.first === 'both' ? 'both at once' : c.first === 'tip' ? 'tipping' : 'slipping')),
        kv('normal force sits', `${f(Math.min(c.x, state.b / 2), 2)} ft ahead of centre (corner at ${f(state.b / 2, 2)})`),
        kv('now', qv(c.state === 'rest' ? 'qR' : 'qI', c.state)),
      ].join('');
    }
    return [
      kv(String.raw`$\beta$`, `${state.beta}° = ${f(state.beta * DEG, 3)} rad`),
      kv(String.raw`$T_2 = T_1 e^{\mu\beta}$`, qv('qV', `${f(c.T2)} lb`)),
      kv('ratio', `${f(c.ratio, 3)}`),
      kv('each extra full turn multiplies by', `${f(c.perTurn, 2)}`),
    ].join('');
  },
  readout(state, computed) {
    const c = computed.fr;
    if (!c) return '';
    const f = (x, d = 1) => x.toFixed(d);
    if (c.mode === 'incline') {
      return cells([
        ['state', c.regime, c.dir ? 'bad' : 'ok'],
        ['$F$ acting', `${f(Math.abs(c.F))} lb`, ''],
        ['$\\mu_s N$', `${f(c.Fmax)} lb`, ''],
        ['holds for P in', `${f(c.Phold, 0)}–${f(c.Ppush, 0)} lb`, ''],
      ]);
    }
    if (c.mode === 'tip') {
      return cells([
        ['first', c.first === 'tip' ? 'tips' : c.first === 'slip' ? 'slips' : 'both', 'ok'],
        ['at P =', `${f(c.Pcrit)} lb`, 'ok'],
        ['$P_{slip}$', `${f(c.Pslip)} lb`, ''],
        ['$P_{tip}$', `${f(c.Ptip)} lb`, ''],
      ]);
    }
    return cells([
      ['$T_2$', `${f(c.T2)} lb`, 'ok'],
      ['$T_2/T_1$', f(c.ratio, 2), ''],
      ['$\\beta$', `${state.beta}°`, ''],
      ['per turn', `× ${f(c.perTurn, 2)}`, ''],
    ]);
  },
  coach(state, computed) {
    const c = computed.fr;
    if (!c) return { title: '', body: '' };
    if (c.mode === 'belt') {
      return {
        title: 'Friction that grows exponentially',
        body: [
          String.raw`Each small arc of rope pressed on the post adds friction in proportion to the tension already there, $dT = \mu T\,d\theta$. Integrate and the tension grows exponentially with the angle of contact:`,
          eq(String.raw`\frac{T_2}{T_1} = e^{\mu\beta}`),
          `That is why a sailor holds a ship with a few turns round a bollard: with μ = ${state.mu}, each full turn multiplies the holding force by ${c.perTurn.toFixed(1)}. β must be in radians, and T₂ is always the side about to win.`,
        ],
      };
    }
    if (c.mode === 'tip') {
      return {
        title: 'Two ways to fail — find both, the smaller one wins',
        body: [
          String.raw`Assume it slips: $P = \mu_s W$. Assume it tips: the normal force has moved to the front corner, so moments about that corner give $P\,h_P = W\,b/2$.`,
          `Whichever needs the smaller push happens first — here ${c.first === 'tip' ? 'tipping' : c.first === 'slip' ? 'slipping' : 'both at once'}, at ${c.Pcrit.toFixed(1)} lb. Push lower, or make the box wider, and tipping gets harder; raise μ and slipping does.`,
          'Watch the green arrow: the floor does not push at the centre. As P grows its line of action walks forward, and tipping is the moment it runs out of box.',
        ],
      };
    }
    return {
      title: c.dir ? 'It slides: now friction is μk N, pointing against the motion' : 'At rest: friction is only what equilibrium needs',
      body: [
        String.raw`Assume the block is at rest and solve for the friction that equilibrium needs. Then compare it with the most static friction can give, $\mu_s N$. Only if it fits is the assumption right.`,
        c.dir
          ? `Here it needs ${Math.abs(c.need).toFixed(1)} lb but only ${c.Fmax.toFixed(1)} lb is available, so the block ${c.regime.replace('slides', 'slides')} and friction drops to the kinetic value, μk·N = ${Math.abs(c.F).toFixed(1)} lb.`
          : `Here it needs ${Math.abs(c.need).toFixed(1)} lb and up to ${c.Fmax.toFixed(1)} lb is available — so F = ${Math.abs(c.F).toFixed(1)} lb, not μsN. Writing F = μsN for a block that is not about to slip is the chapter's most common mistake.`,
        String.raw`The friction cone says the same thing geometrically: the total contact force must lean no further than $\phi_s = \tan^{-1}\mu_s$ from the normal. With no push, that makes the steepest slope a block can sit on exactly $\phi_s$ — the angle of repose, ${c.repose.toFixed(1)}° here.`,
      ],
    };
  },
});
