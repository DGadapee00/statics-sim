import * as THREE from 'three';
import { defineLab } from './define.js';
import { label, sliderRow, bindSlider, putSlider, showBlock, zUp, arcSegments } from './parts.js';
import { M, fatSegments, Arrow, markAnswer, setFatSegments, segmentCapacity } from '../scene/manim.js';
import { v, sub, scale, dot, mag, unit, fromAngle2D } from '../physics/vectors.js';
import { moment2D, momentArm, momentAbout, momentAboutAxis, coupleMoment } from '../physics/statics.js';
import { kv, cells, qv, eq } from '../ui/shared.js';

/**
 * Ch 4 · moments.
 *
 * Three views of one idea. In 2D a force and a point: the lab computes M = xF_y − yF_x and draws
 * the perpendicular distance, so the two textbook methods sit side by side and must agree. A
 * couple: move the moment point anywhere and watch the two individual moments change while their
 * sum does not. In 3D: r × F drawn as a vector, and its projection onto an axis.
 */

const U = 0.8; // scene units per metre in 2D
const U3 = 0.8;

const SCENARIOS = [
  { id: 'point', name: 'Force about a point (2D)', mode: '2d', F: 50, th: 30, x: 4, y: 3 },
  { id: 'couple', name: 'A couple, about any point', mode: 'couple', F: 80, th: 90, A: [-1.5, 0], B: [1.5, 0], px: 0, py: 2 },
  { id: 'cross', name: 'M = r × F in 3D', mode: '3d', r: [1, 2, 3], Fv: [40, 50, 60], axis: false, u: [0, 0, 1] },
  { id: 'axis', name: 'Moment about an axis', mode: '3d', r: [2, 0, 0], Fv: [0, 50, 30], axis: true, u: [0, 0, 2] },
];

const HEAD_ON = { pos: new THREE.Vector3(0, 0, 14), target: new THREE.Vector3(0, 0, 0) };
const OBLIQUE = { pos: new THREE.Vector3(6.5, 5, 8), target: new THREE.Vector3(0.6, 0.8, 0) };

const sense = (Mz) => (Math.abs(Mz) < 1e-9 ? 'none' : Mz > 0 ? 'counterclockwise' : 'clockwise');

export default defineLab({
  id: 'moments',
  exam: 'u2',
  title: 'Moments',
  hint: 'Every moment here is worked two ways — watch them agree',
  orbit: true,
  camera: HEAD_ON,
  cameraFor: (state) => (state.mode === '3d' ? OBLIQUE : HEAD_ON),
  keys: { r: 'reset', R: 'reset' },
  scenarios: SCENARIOS,
  defaultState() {
    return {
      scenarioId: 'point', mode: '2d', F: 50, th: 30, x: 4, y: 3,
      A: [-1.5, 0], B: [1.5, 0], px: 0, py: 2,
      r: [1, 2, 3], Fv: [40, 50, 60], axis: false, u: [0, 0, 1],
    };
  },
  applyScenario(id, state) {
    const sc = SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
    Object.assign(state, { scenarioId: sc.id, mode: sc.mode });
    for (const key of ['F', 'th', 'x', 'y', 'px', 'py', 'axis']) if (sc[key] != null) state[key] = sc[key];
    for (const key of ['A', 'B', 'r', 'Fv', 'u']) if (sc[key]) state[key] = [...sc[key]];
  },
  controls() {
    const trio = (p, name, unitText, vals, min, max, step) => ['x', 'y', 'z'].map((ax, i) => sliderRow(`${p}${ax}`, `${name}<sub>${ax}</sub> (${unitText})`, vals[i], min, max, step)).join('');
    return `
        <div class="lab-block">
          <div id="mo-flat">
            ${sliderRow('mo-f', 'Force F (N)', 50, 0, 500, 5)}
            ${sliderRow('mo-th', 'Direction θ (° from +x)', 30, 0, 360, 1)}
          </div>
          <div id="mo-2d">
            ${sliderRow('mo-x', 'Applied at x (m)', 4, -4, 4, 0.1)}
            ${sliderRow('mo-y', 'Applied at y (m)', 3, -4, 4, 0.1)}
            <label class="field"><span>Slide along the line of action</span>
              <div class="slide-only"><input type="range" id="mo-slide" min="-3" max="3" step="0.05" value="0" /></div>
            </label>
          </div>
          <div id="mo-couple">
            ${sliderRow('mo-px', 'Moment point P, x (m)', 0, -4, 4, 0.1)}
            ${sliderRow('mo-py', 'Moment point P, y (m)', 2, -4, 4, 0.1)}
          </div>
          <div id="mo-3d">
            ${trio('mo-r', 'r', 'm', [1, 2, 3], -4, 4, 0.5)}
            ${trio('mo-F', 'F', 'N', [40, 50, 60], -400, 400, 5)}
            <label class="check"><input type="checkbox" id="mo-axis" /> <span>moment about an axis through O</span></label>
            <div id="mo-ublock">${trio('mo-u', 'u', 'direction', [0, 0, 1], -3, 3, 0.5)}</div>
          </div>
          <p class="tiny" id="mo-note"></p>
        </div>`;
  },
  bind(api) {
    bindSlider(api, 'mo-f', (s, val) => { s.F = val; });
    bindSlider(api, 'mo-th', (s, val) => { s.th = val; });
    bindSlider(api, 'mo-x', (s, val) => { s.x = val; });
    bindSlider(api, 'mo-y', (s, val) => { s.y = val; });
    bindSlider(api, 'mo-px', (s, val) => { s.px = val; });
    bindSlider(api, 'mo-py', (s, val) => { s.py = val; });
    ['x', 'y', 'z'].forEach((ax, i) => {
      bindSlider(api, `mo-r${ax}`, (s, val) => { s.r[i] = val; });
      bindSlider(api, `mo-F${ax}`, (s, val) => { s.Fv[i] = val; });
      bindSlider(api, `mo-u${ax}`, (s, val) => { s.u[i] = val; });
    });
    // Transmissibility, as a control: moves the point of application along the force's own line.
    const slide = document.getElementById('mo-slide');
    let last = 0;
    slide.addEventListener('pointerdown', () => { last = Number(slide.value); });
    slide.addEventListener('input', (e) => {
      const s = api.slice();
      const t = Number(e.target.value);
      const d = fromAngle2D(1, s.th);
      // Kept exact: rounding the new point would knock it off the line and nudge the moment.
      s.x += d.x * (t - last);
      s.y += d.y * (t - last);
      last = t;
      api.bump(false);
    });
    slide.addEventListener('change', () => { slide.value = '0'; last = 0; });
    document.getElementById('mo-axis').addEventListener('change', (e) => {
      api.slice().axis = e.target.checked;
      api.bump(false);
    });
  },
  syncControls(state) {
    putSlider('mo-f', state.F);
    putSlider('mo-th', state.th);
    putSlider('mo-x', state.x, 2);
    putSlider('mo-y', state.y, 2);
    putSlider('mo-px', state.px, 1);
    putSlider('mo-py', state.py, 1);
    ['x', 'y', 'z'].forEach((ax, i) => {
      putSlider(`mo-r${ax}`, state.r[i], 1);
      putSlider(`mo-F${ax}`, state.Fv[i]);
      putSlider(`mo-u${ax}`, state.u[i], 1);
    });
    showBlock('mo-flat', state.mode !== '3d');
    showBlock('mo-2d', state.mode === '2d');
    showBlock('mo-couple', state.mode === 'couple');
    showBlock('mo-3d', state.mode === '3d');
    showBlock('mo-ublock', !!state.axis);
    const a = document.getElementById('mo-axis');
    if (a) a.checked = !!state.axis;
    const note = document.getElementById('mo-note');
    if (note) {
      note.textContent = {
        '2d': 'Teal is r from O to the point of application, blue is F, and gold is the moment arm d — the perpendicular from O to the dashed line of action. Moving the force along that line changes r but never d.',
        couple: 'Two equal and opposite forces. The dashed lines run from P to each one; drag P anywhere and the two moments about it change, but their sum does not.',
        '3d': 'Teal is r, blue is F applied at its tip, and gold is M = r × F drawn at O — perpendicular to both. With the axis on, pink is the part of M along that axis.',
      }[state.mode];
    }
  },
  init(ctx) {
    const group = new THREE.Group();
    ctx.scene.add(group);
    const axes = fatSegments(segmentCapacity(3), { color: M.white, width: 1.4, opacity: 0.45 });
    const line = fatSegments(segmentCapacity(4), { color: M.greyDark, width: 1.6, dashed: true });
    const arm = markAnswer(fatSegments(segmentCapacity(2), { color: M.gold, width: 3 }));
    const arc = markAnswer(fatSegments(segmentCapacity(96), { color: M.gold, width: 3 }));
    const axisLine = fatSegments(segmentCapacity(1), { color: M.pink, width: 1.6, opacity: 0.7 });
    group.add(axes, line, arm, arc, axisLine);
    const dir = new THREE.Vector3(1, 0, 0);
    const mk = (color, w = 0.035) => new Arrow(dir, new THREE.Vector3(), 1, color, 0.26, 0.2, w);
    const arrows = {
      r: mk(M.teal, 0.025),
      F: mk(M.blue),
      F2: mk(M.blue),
      rB: mk(M.teal, 0.02),
      M: markAnswer(mk(M.gold, 0.045)),
      Ma: markAnswer(mk(M.pink, 0.045)),
      tipA: markAnswer(mk(M.gold, 0.001)),
    };
    Object.values(arrows).forEach((a) => group.add(a));
    const dotGeo = new THREE.CircleGeometry(0.09, 20);
    const O = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: M.white, toneMapped: false }));
    const P = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: M.gold, toneMapped: false }));
    group.add(O, P);
    const labels = { O: label('O'), P: label('P'), A: label('A'), B: label('B'), F: label('F'), F2: label('−F'), r: label('r'), M: markAnswer(label('M')), Ma: markAnswer(label('')), d: markAnswer(label('d')), x: label('x'), y: label('y'), z: label('z') };
    Object.values(labels).forEach((l) => group.add(l));
    group.visible = false;
    return { group, axes, line, arm, arc, axisLine, arrows, O, P, labels };
  },
  enter(ctx, handle) {
    handle.group.visible = true;
  },
  exit(ctx, handle) {
    handle.group.visible = false;
  },
  recompute(state, computed) {
    const O = v(0, 0, 0);
    if (state.mode === '2d') {
      const F = fromAngle2D(state.F, state.th);
      const A = v(state.x, state.y, 0);
      const u = unit(F);
      const Mz = moment2D(O, A, F);
      const d = momentArm(O, A, F);
      computed.mom = {
        mode: '2d', F, A, Mz, d,
        Fd: state.F * d,
        foot: sub(A, scale(u, dot(A, u))), // the point on the line of action nearest O
        comps: { xFy: A.x * F.y, yFx: A.y * F.x },
      };
    } else if (state.mode === 'couple') {
      const F = fromAngle2D(state.F, state.th);
      const A = v(...state.A, 0);
      const B = v(...state.B, 0);
      const P = v(state.px, state.py, 0);
      const MA = moment2D(P, A, F);
      const MB = moment2D(P, B, scale(F, -1));
      computed.mom = {
        mode: 'couple', F, A, B, P, MA, MB,
        Mz: MA + MB,
        Mcouple: coupleMoment(sub(A, B), F).z, // r from B to A, crossed with the force at A
        d: momentArm(B, A, F),
      };
    } else {
      const r = v(...state.r);
      const F = v(...state.Fv);
      const Mv = momentAbout(O, r, F);
      const u = v(...state.u);
      const hasAxis = !!state.axis && mag(u) > 1e-9;
      const Maxis = hasAxis ? momentAboutAxis(O, u, r, F) : null;
      computed.mom = {
        mode: '3d', r, F, M: Mv, u: unit(u), Maxis, hasAxis,
        checkF: dot(Mv, F),
        checkR: dot(Mv, r),
      };
    }
  },
  syncViews(state, computed, ctx) {
    const h = ctx.handle;
    const c = computed.mom;
    if (!h || !c) return;
    const is3D = c.mode === '3d';
    const map = is3D ? (p) => zUp(p).multiplyScalar(U3) : (p) => new THREE.Vector3(p.x * U, p.y * U, 0);
    const L = h.labels;
    const A = h.arrows;
    Object.values(A).forEach((a) => { a.visible = false; });
    Object.values(L).forEach((l) => { l.visible = false; });
    h.P.visible = false;

    const put = (lab, p, html, dy = 0.28) => {
      lab.visible = true;
      lab.position.copy(p).add(new THREE.Vector3(0, dy, 0));
      if (html != null) lab.element.innerHTML = html;
    };
    const aim = (arrow, from, to) => {
      const d = to.clone().sub(from);
      const len = d.length();
      arrow.visible = len > 1e-6;
      if (!arrow.visible) return;
      arrow.position.copy(from);
      arrow.setDirection(d.normalize());
      arrow.setLength(len);
    };
    const origin = map(v(0, 0, 0));
    h.O.position.copy(origin);
    h.O.rotation.set(is3D ? -Math.PI / 2 : 0, 0, 0);
    put(L.O, origin, 'O', -0.3);

    const ax = is3D ? 3.6 : 4.6;
    const axEnds = is3D ? [zUp(v(ax, 0, 0)), zUp(v(0, ax, 0)), zUp(v(0, 0, ax))] : [new THREE.Vector3(ax, 0, 0), new THREE.Vector3(0, ax, 0), null];
    const axSeg = [];
    axEnds.forEach((e, i) => {
      if (!e) return;
      const s = is3D ? new THREE.Vector3() : e.clone().multiplyScalar(-1);
      axSeg.push(s.x, s.y, s.z, e.x, e.y, e.z);
      put([L.x, L.y, L.z][i], e, ['x', 'y', 'z'][i], 0.15);
    });
    setFatSegments(h.axes, axSeg);

    const lineSeg = [];
    let armSeg = [];
    let arcSeg = [];
    const FLEN = 1.8;

    if (c.mode === '2d') {
      const P = map(c.A);
      const u = new THREE.Vector3(c.F.x, c.F.y, 0).normalize();
      aim(A.r, origin, P);
      put(L.r, origin.clone().lerp(P, 0.5), 'r', 0.22);
      aim(A.F, P, P.clone().addScaledVector(u, FLEN));
      put(L.F, P.clone().addScaledVector(u, FLEN + 0.2), `F = ${state.F.toFixed(0)} N`, 0);
      put(L.A, P, 'A', -0.32);
      const far = 14;
      const a = P.clone().addScaledVector(u, -far);
      const b = P.clone().addScaledVector(u, far);
      lineSeg.push(a.x, a.y, 0, b.x, b.y, 0);
      const foot = map(c.foot);
      armSeg = [origin.x, origin.y, 0.01, foot.x, foot.y, 0.01];
      // Label the arm past its foot, clear of the turning arrow drawn around O.
      const out = foot.clone().sub(origin);
      const at = out.length() > 1e-6 ? foot.clone().addScaledVector(out.normalize(), 0.45) : origin.clone().add(new THREE.Vector3(0.6, -0.5, 0));
      put(L.d, at, `d = ${c.d.toFixed(3)} m`, 0);
      arcSeg = momentArc(h, A, origin, c.Mz, 0.4);
    } else if (c.mode === 'couple') {
      const u = new THREE.Vector3(c.F.x, c.F.y, 0).normalize();
      const PA = map(c.A);
      const PB = map(c.B);
      const Pp = map(c.P);
      aim(A.F, PA, PA.clone().addScaledVector(u, FLEN));
      aim(A.F2, PB, PB.clone().addScaledVector(u, -FLEN));
      put(L.F, PA.clone().addScaledVector(u, FLEN + 0.2), `F = ${state.F.toFixed(0)} N`, 0);
      put(L.F2, PB.clone().addScaledVector(u, -FLEN - 0.2), '−F', 0);
      put(L.A, PA, 'A', -0.32);
      put(L.B, PB, 'B', -0.32);
      for (const Q of [PA, PB]) lineSeg.push(Pp.x, Pp.y, 0, Q.x, Q.y, 0);
      h.P.visible = true;
      h.P.position.copy(Pp);
      put(L.P, Pp, 'P', 0.22);
      arcSeg = momentArc(h, A, Pp, c.Mz, 0.45);
    } else {
      const R = map(c.r);
      aim(A.r, origin, R);
      put(L.r, origin.clone().lerp(R, 0.5), 'r', 0.22);
      const Fdir = zUp(c.F).normalize();
      aim(A.F, R, R.clone().addScaledVector(Fdir, FLEN));
      put(L.F, R.clone().addScaledVector(Fdir, FLEN + 0.2), `F = ${mag(c.F).toFixed(0)} N`, 0);
      const Mm = mag(c.M);
      const MLEN = 2.6;
      if (Mm > 1e-9) {
        const tip = zUp(c.M).normalize().multiplyScalar(MLEN);
        aim(A.M, origin, tip);
        put(L.M, tip, `M = ${Mm.toFixed(1)} N·m`, 0.2);
      }
      if (c.hasAxis) {
        const ud = zUp(c.u);
        const e = ud.clone().multiplyScalar(4.2);
        setFatSegments(h.axisLine, [-e.x, -e.y, -e.z, e.x, e.y, e.z]);
        h.axisLine.visible = true;
        if (Mm > 1e-9 && Math.abs(c.Maxis) > 1e-9) {
          const tip = ud.clone().multiplyScalar((MLEN * c.Maxis) / Mm);
          aim(A.Ma, origin, tip);
          put(L.Ma, tip, `M<sub>axis</sub> = ${c.Maxis.toFixed(1)} N·m`, -0.3);
        }
      } else {
        h.axisLine.visible = false;
      }
    }
    if (!is3D) h.axisLine.visible = false;
    setFatSegments(h.line, lineSeg);
    h.line.computeLineDistances();
    setFatSegments(h.arm, armSeg);
    setFatSegments(h.arc, arcSeg);
    ctx.grid.visible = false;
  },
  law: () => [
    String.raw`\vec{M}_O = \vec{r}\times\vec{F}, \qquad M_O = F\,d = xF_y - yF_x`,
    String.raw`M_{a} = \hat{u}_a\cdot(\vec{r}\times\vec{F})`,
  ],
  liveRows(state, computed) {
    const c = computed.mom;
    if (!c) return '';
    const n = (x, k = 2) => x.toFixed(k);
    if (c.mode === '2d') {
      return [
        kv('$\\vec{F}$', `(${n(c.F.x)}, ${n(c.F.y)}) N`),
        kv('$\\vec{r}_{OA}$', `(${n(c.A.x)}, ${n(c.A.y)}) m`),
        kv('$xF_y - yF_x$', `${n(c.comps.xFy)} − (${n(c.comps.yFx)}) = ${qv('qV', `${n(c.Mz)} N·m`)}`),
        kv('moment arm $d$', qv('qV', `${n(c.d, 4)} m`)),
        kv('$F\\,d$', `${n(c.Fd)} N·m · ${sense(c.Mz)}`),
        kv('the two methods differ by', qv(Math.abs(Math.abs(c.Mz) - c.Fd) < 1e-9 ? 'qR' : 'qI', `${Math.abs(Math.abs(c.Mz) - c.Fd).toExponential(1)} N·m`)),
      ].join('');
    }
    if (c.mode === 'couple') {
      return [
        kv('$M_P$ of $\\vec{F}$ at A', `${n(c.MA)} N·m`),
        kv('$M_P$ of $-\\vec{F}$ at B', `${n(c.MB)} N·m`),
        kv('sum about P', qv('qV', `${n(c.Mz)} N·m`)),
        kv('$\\vec{r}_{BA}\\times\\vec{F}$ (no P in it)', `${n(c.Mcouple)} N·m`),
        kv('$F\\,d$', `${n(state.F * c.d)} N·m · d = ${n(c.d, 3)} m`),
      ].join('');
    }
    const vec = (a) => `(${n(a.x, 1)}, ${n(a.y, 1)}, ${n(a.z, 1)})`;
    const rows = [
      kv('$\\vec{r}$', `${vec(c.r)} m`),
      kv('$\\vec{F}$', `${vec(c.F)} N`),
      kv('$\\vec{M}_O = \\vec{r}\\times\\vec{F}$', qv('qV', `${vec(c.M)} N·m`)),
      kv('$|\\vec{M}_O|$', `${n(mag(c.M))} N·m`),
      kv('$\\vec{M}\\cdot\\vec{F},\\ \\vec{M}\\cdot\\vec{r}$', qv(Math.abs(c.checkF) + Math.abs(c.checkR) < 1e-6 ? 'qR' : 'qI', `${c.checkF.toExponential(1)}, ${c.checkR.toExponential(1)}`)),
    ];
    if (c.hasAxis) rows.push(kv('$M_{axis} = \\hat{u}\\cdot\\vec{M}_O$', qv('qV', `${n(c.Maxis)} N·m`)));
    return rows.join('');
  },
  readout(state, computed) {
    const c = computed.mom;
    if (!c) return '';
    const n = (x, k = 2) => x.toFixed(k);
    if (c.mode === '2d') {
      return cells([
        ['$M_O$', `${n(c.Mz)} N·m`, 'ok'],
        ['sense', sense(c.Mz), ''],
        ['$d$', `${n(c.d, 3)} m`, ''],
        ['$F d$', `${n(c.Fd)} N·m`, ''],
      ]);
    }
    if (c.mode === 'couple') {
      return cells([
        ['couple moment', `${n(c.Mz)} N·m`, 'ok'],
        ['about P, from A', `${n(c.MA)} N·m`, ''],
        ['about P, from B', `${n(c.MB)} N·m`, ''],
        ['net force', '0 N', ''],
      ]);
    }
    return cells([
      ['$M_x$', `${n(c.M.x)} N·m`, 'ok'],
      ['$M_y$', `${n(c.M.y)} N·m`, 'ok'],
      ['$M_z$', `${n(c.M.z)} N·m`, 'ok'],
      c.hasAxis ? ['$M_{axis}$', `${n(c.Maxis)} N·m`, 'ok'] : ['$|M|$', `${n(mag(c.M))} N·m`, ''],
    ]);
  },
  coach(state, computed) {
    const c = computed.mom;
    if (!c) return { title: '', body: '' };
    if (c.mode === '2d') {
      return {
        title: 'Two ways to one moment',
        body: [
          String.raw`Textbook method one: find the perpendicular distance $d$ from O to the line of action, then $M_O = Fd$ and read the sense off the picture. Method two skips the geometry entirely:`,
          eq(String.raw`M_O = xF_y - yF_x`),
          String.raw`It carries its own sign — positive is counterclockwise — and works with $\vec{r}$ to any point on the line of action. That is why the slider that moves the force along its own line leaves the moment alone: $\vec{r}$ changes, $d$ does not.`,
          Math.abs(c.Mz) < 1e-6 ? 'Right now the line of action passes through O, so the moment arm — and the moment — is zero.' : `Here the force turns the body ${sense(c.Mz)} about O.`,
        ],
      };
    }
    if (c.mode === 'couple') {
      return {
        title: 'A couple has the same moment about every point',
        body: [
          String.raw`The two forces cancel, so a couple pushes nothing anywhere — it only turns. Add up their moments about any point P and the position of P drops out:`,
          eq(String.raw`\vec{r}_{PA}\times\vec{F} + \vec{r}_{PB}\times(-\vec{F})`),
          eq(String.raw`= (\vec{r}_{PA} - \vec{r}_{PB})\times\vec{F} = \vec{r}_{BA}\times\vec{F}`),
          String.raw`That is why a couple moment is a "free vector": it can be drawn anywhere on the body. The magnitude is $F d$ with $d$ the perpendicular distance between the two lines of action — not the distance between A and B unless the forces are square to AB.`,
        ],
      };
    }
    return {
      title: c.hasAxis ? 'Moment about an axis: project r × F' : 'The moment is perpendicular to r and to F',
      body: c.hasAxis
        ? [
          String.raw`Take $\vec{r}\times\vec{F}$ about any point on the axis, then keep only the part along it:`,
          eq(String.raw`M_a = \hat{u}_a\cdot(\vec{r}\times\vec{F})`),
          String.raw`That scalar triple product is the determinant with $\hat{u}_a$ on top, then $\vec{r}$, then $\vec{F}$. A force parallel to the axis, or one whose line of action crosses it, gives zero — it cannot turn anything about that axis. Swing $\vec{u}$ until it is square to $\vec{M}_O$ and watch the pink arrow vanish.`,
        ]
        : [
          String.raw`Expand the determinant with $\hat{i}, \hat{j}, \hat{k}$ across the top, $\vec{r}$ in the middle row and $\vec{F}$ on the bottom — swap those rows and every sign flips.`,
          String.raw`The result is a vector square to both $\vec{r}$ and $\vec{F}$, so $\vec{M}\cdot\vec{F} = 0$ and $\vec{M}\cdot\vec{r} = 0$. The panel checks both; if your hand answer fails either one, a component is wrong.`,
          String.raw`The direction is the axis the force would spin the body about, by the right-hand rule.`,
        ],
    };
  },
});

/** Curved arrow around `c` showing the turning sense of Mz: counterclockwise positive. */
function momentArc(h, A, c, Mz, r) {
  if (Math.abs(Mz) < 1e-9) return [];
  const sweep = Math.sign(Mz) * 1.5 * Math.PI;
  const start = Math.PI / 2 - sweep / 2;
  const endA = start + sweep;
  const end = new THREE.Vector3(c.x + r * Math.cos(endA), c.y + r * Math.sin(endA), 0);
  const tangent = new THREE.Vector3(-Math.sin(endA), Math.cos(endA), 0).multiplyScalar(Math.sign(Mz));
  const head = A.tipA;
  head.visible = true;
  head.position.copy(end).addScaledVector(tangent, -0.24);
  head.setDirection(tangent);
  head.setLength(0.24, 0.22, 0.18);
  return arcSegments(c, r, start, sweep * 0.9, 48);
}
