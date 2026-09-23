import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { defineLab } from './define.js';
import { M, fatLine, fatSegments, Arrow, markAnswer, setFatSegments, segmentCapacity } from '../scene/manim.js';
import { solveTruss, zeroForceMembers, memberForce, stateOf, sectionCheck, methodOfSections } from '../physics/truss.js';
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
    cuts: [
      { name: 'through ED, DB, BC', keep: ['A', 'B', 'E'] },
      { name: 'through AB, EB, ED', keep: ['A', 'E'] },
    ],
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
    cuts: [
      { name: 'through BC, EC, EF (second panel)', keep: ['A', 'B', 'E'] },
      { name: 'through CD, FC, EF (third panel)', keep: ['A', 'B', 'C', 'E'] },
      { name: 'through AB, EB, EF (first panel)', keep: ['A', 'E'] },
    ],
  },
  {
    id: 'pratt-uneven',
    name: 'Pratt truss · uneven loads (method of sections)',
    joints: { A: [0, 0], B: [3, 0], C: [6, 0], D: [9, 0], E: [3, 3], F: [6, 3] },
    members: [['A', 'B'], ['B', 'C'], ['C', 'D'], ['A', 'E'], ['E', 'F'], ['F', 'D'], ['E', 'B'], ['F', 'C'], ['E', 'C']],
    loads: { B: [0, -900], C: [0, -300] },
    supports: { A: 'pin', D: 'rollerY' },
    section: true,
    cuts: [
      { name: 'through BC, EC, EF (second panel)', keep: ['A', 'B', 'E'] },
      { name: 'through CD, FC, EF (third panel)', keep: ['A', 'B', 'C', 'E'] },
      { name: 'through AB, EB, EF (first panel)', keep: ['A', 'E'] },
    ],
  },
];

const toVec = (p) => v(p[0], p[1], 0);
const cutsFor = (state) => SCENARIOS.find((sc) => sc.id === state.scenarioId)?.cuts || [];
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
    return { scenarioId: 'three', scale: 1, showZero: true, selected: null, section: false, cutIdx: 0 };
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
      section: !!sc.section,
      cutIdx: 0,
    });
  },
  controls() {
    return `
        <div class="lab-block">
          <label class="field">
            <span>Load scale</span>
            <div class="slider-row">
              <input type="range" id="tr-scale" min="0" max="3" step="0.05" value="1" />
            </div>
          </label>
          <label class="check"><input type="checkbox" id="tr-zero" checked /> <span>mark zero-force members</span></label>
          <div id="tr-secblock">
            <label class="check"><input type="checkbox" id="tr-section" /> <span>method of sections — cut the truss</span></label>
            <label class="field" id="tr-cutfield"><span>Cut</span><select id="tr-cut"></select></label>
          </div>
          <div id="tr-members" class="lab-list"></div>
          <p class="tiny">Tension is positive and drawn in blue; compression is red. The residual row is the check: it is ΣF at the worst joint, recomputed from the member forces. If it is not zero the truss is not in equilibrium.</p>
        </div>`;
  },
  bind(api) {
    const $ = (id) => document.getElementById(id);
    // The HUD's typed-value box drives this range input too (and widens it), so one listener serves both.
    $('tr-scale').addEventListener('input', (e) => {
      api.slice().scale = Math.max(0, Number(e.target.value));
      api.bump(false);
    });
    $('tr-zero').addEventListener('change', (e) => {
      api.slice().showZero = e.target.checked;
      api.bump(false);
    });
    $('tr-section').addEventListener('change', (e) => {
      api.slice().section = e.target.checked;
      api.bump(false);
    });
    $('tr-cut').addEventListener('change', (e) => {
      api.slice().cutIdx = Number(e.target.value);
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
    const cuts = cutsFor(state);
    const block = $('tr-secblock');
    if (block) block.style.display = cuts.length ? '' : 'none';
    const sec = $('tr-section');
    if (sec) sec.checked = !!state.section;
    const sel = $('tr-cut');
    if (sel) {
      const html = cuts.map((c, i) => `<option value="${i}">${c.name}</option>`).join('');
      if (sel.dataset.html !== html) {
        sel.innerHTML = html;
        sel.dataset.html = html;
      }
      sel.value = String(Math.min(state.cutIdx, Math.max(0, cuts.length - 1)));
    }
    const f = $('tr-cutfield');
    if (f) f.style.display = state.section ? '' : 'none';
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
    const cutLine = fatSegments(segmentCapacity(1), { color: M.gold, width: 2, dashed: true });
    const cutGroup = new THREE.Group();
    markAnswer(cutGroup);
    group.add(cutLine, cutGroup);
    group.visible = false;
    return { group, membersLine, zeroLine, jointDots, arrows, labels, cutLine, cutGroup };
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
    const cuts = cutsFor(state);
    const cutDef = state.section && cuts.length ? cuts[Math.min(state.cutIdx, cuts.length - 1)] : null;
    const mos = cutDef ? methodOfSections(input, cutDef.keep) : null;
    computed.truss = {
      mos,
      keep: cutDef ? new Set(cutDef.keep) : null,
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
      // With a section taken, the removed side fades: the kept side is the free body.
      if (c.keep && !(c.keep.has(p) && c.keep.has(q))) {
        const isCut = c.keep.has(p) !== c.keep.has(q);
        tint.lerp(new THREE.Color(M.bg), isCut ? 0.35 : 0.8);
      }
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

    // Method of sections: the cut, the three member forces on the kept side, and moment points.
    while (h.cutGroup.children.length) h.cutGroup.remove(h.cutGroup.children[0]);
    let cutSeg = [];
    if (c.mos?.ok) {
      const mids = c.mos.cut.map((m) => ({ x: (joints[m.inside].x + joints[m.outside].x) / 2, y: (joints[m.inside].y + joints[m.outside].y) / 2 }));
      mids.sort((a, b) => a.y - b.y);
      const lo = mids[0];
      const hi = mids[mids.length - 1];
      const d = { x: hi.x - lo.x, y: hi.y - lo.y };
      const L = Math.hypot(d.x, d.y) || 1;
      const ext = 0.8;
      cutSeg = [(lo.x - (d.x / L) * ext) * U, (lo.y - (d.y / L) * ext) * U, 0.04, (hi.x + (d.x / L) * ext) * U, (hi.y + (d.y / L) * ext) * U, 0.04];
      const peak = Math.max(1e-9, ...c.mos.cut.map((m) => Math.abs(m.force)));
      c.mos.cut.forEach((m, i) => {
        const P = joints[m.inside];
        const O = joints[m.outside];
        // Tension pulls the kept joint toward the cut; draw it at the cut, pointing along the member.
        const at = new THREE.Vector3((P.x + (O.x - P.x) * 0.5) * U, (P.y + (O.y - P.y) * 0.5) * U, 0.05);
        // Tension: an arrow from the cut, pointing away from the kept side. Compression: pushing in.
        const dir = new THREE.Vector3(m.u.x, m.u.y, 0).multiplyScalar(m.force >= 0 ? 1 : -1);
        const len = 0.35 + 0.6 * (Math.abs(m.force) / peak);
        const start = m.force >= 0 ? at.clone() : at.clone().addScaledVector(dir, -len);
        h.cutGroup.add(new Arrow(dir, start, len, m.force >= 0 ? M.blue : M.red, 0.2, 0.15, 0.03));
        const tag = label(`<span class="mono">${m.member}</span>`);
        tag.position.copy(at).add(new THREE.Vector3(0.3, -0.28, 0));
        h.cutGroup.add(tag);
        if (m.point) {
          const pt = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 24), new THREE.MeshBasicMaterial({ color: M.gold, toneMapped: false }));
          pt.position.set(m.point.x * U, m.point.y * U, 0.06);
          h.cutGroup.add(pt);
          const pl = label(`<span class="tiny">ΣM here → ${m.member}</span>`);
          pl.position.set(m.point.x * U, m.point.y * U - 0.3 - i * 0.2, 0);
          h.cutGroup.add(pl);
        }
      });
    }
    setFatSegments(h.cutLine, cutSeg);
    h.cutLine.computeLineDistances();

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
    if (c.section && !c.mos) rows.push(kv('section cut ΣM', `${c.section.sumM.toExponential(1)} lb·ft`));
    if (c.mos?.ok) {
      for (const m of c.mos.cut) {
        const how = m.point ? `ΣM about (${m.point.x.toFixed(1)}, ${m.point.y.toFixed(1)})` : 'ΣF ⟂ the other two';
        const joint = memberForce(sol, m.member[0], m.member[1]);
        rows.push(kv(`${m.member} by ${how}`, qv(Math.abs(joint - m.force) < 1e-6 * Math.max(1, Math.abs(joint)) ? 'qR' : 'qI', `${m.force.toFixed(1)} lb ${stateOf(m.force) === 'tension' ? '(T)' : stateOf(m.force) === 'compression' ? '(C)' : ''}`)));
      }
      rows.push(kv('joints method gives', c.mos.cut.map((m) => `${m.member} ${memberForce(sol, m.member[0], m.member[1]).toFixed(1)}`).join(' · ')));
    } else if (c.mos && !c.mos.ok) rows.push(kv('section', c.mos.reason));
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
    if (c.mos?.ok) {
      const byM = c.mos.cut.filter((m) => m.point).map((m) => m.member);
      const byF = c.mos.cut.filter((m) => !m.point).map((m) => m.member);
      return {
        title: 'Cut through three members, then one equation per member',
        body: [
          String.raw`The method of joints walks the whole truss to reach a member in the middle. The method of sections goes straight there: cut through at most three members, and keep one side as a single rigid body — three equations, three unknowns.`,
          String.raw`The trick is where you take moments. The gold rings are where two of the cut members' lines cross; summing moments about that point removes both, and leaves the third alone.${byM.length ? ` Here that works for ${byM.join(', ')}.` : ''}`,
          byF.length
            ? String.raw`${byF.join(', ')} has no such point — the other two members are parallel and meet only at infinity — so use $\sum F$ perpendicular to them instead ($\sum F_y$ here).`
            : 'Every cut member here has a finite moment point.',
          'The panel shows each answer next to the method-of-joints value for the same member. They agree — two methods, one truss.',
        ],
      };
    }
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
