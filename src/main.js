import 'katex/dist/katex.min.css';
import * as THREE from 'three';
import { createScene } from './scene/createScene.js';
import { createHUD } from './ui/hud.js';
import { applyScenario } from './data/scenarios.js';
import { EXAMS, examById, examForLab } from './data/catalog.js';
import { parseHash, writeHash, neighborExam, problemQuery } from './engine/router.js';
import { createViewPool } from './engine/views.js';
import { createChargePointer } from './engine/pointer.js';
import { loadLab, loadExamLabs } from './labs/load.js';
import { setFrame, refit, defaultView, sceneScale, workPlane } from './engine/frame.js';
import { applyProblem } from './problems/simbridge.js';
import { createPractice } from './ui/problems.js';
import { ANSWER_LAYER } from './scene/manim.js';

const canvas = document.getElementById('c');
const { renderer, scene, camera, controls, labels, grid } = createScene(canvas);
const pool = createViewPool(scene);
const clock = new THREE.Clock();
camera.layers.enable(ANSWER_LAYER);

const ctx = { scene, camera, controls, pool, grid, clock, renderer };

const app = {
  examId: 'u1',
  labId: 'vectors',
  lab: null,
  handles: {},
  slices: {},
  gen: 0,
  dirty: true,
  /** '?p=…&s=…' while a practice problem is open, so the URL reopens it. */
  query: '',
};

const computed = {};
/** Practice panel (src/ui/problems.js); created once the lab-switching functions exist. */
let practice = null;

function slice() {
  return app.slices[app.labId] || {};
}

let loadingProblem = false;

function bump(physics = true) {
  app.dirty = true;
  if (physics && !loadingProblem) practice?.noteEdit();
  const s = app.slices[app.labId];
  if (s) {
    s.dirty = true;
    if (physics && s.anim) s.anim.playing = false;
  }
}

function publicState() {
  const s = slice();
  s.lab = app.labId;
  s.examId = app.examId;
  return s;
}

const hud = createHUD({
  setLab,
  setExam,
  setScenario,
  setLabIndex,
  shiftExam,
  resetCamera,
  toggleShow,
  toggleSweep,
  handleKey,
  togglePractice: () => practice.toggle(),
  escape: () => practice.escape(),
  bump,
  slice,
  // No charge editor in statics; labs own their setup controls.
  addCharge: () => {},
  deleteSelected: () => {},
  setChargeQ: () => {},
  setCoord: (point, axis, v) => {
    void point; void axis; void v;
    bump();
  },
  fitView: () => {
    applyFrame({ force: true });
    goCamera(app.lab);
    bump(false);
  },
  selectCharge: (id) => {
    slice().selectedId = id;
    bump(false);
  },
});

const pointer = createChargePointer({
  camera,
  controls,
  canvas,
  getState: publicState,
  getPool: () => pool,
  getHandle: () => app.handles[app.labId],
  getLab: () => app.lab,
  bump: () => {
    app.dirty = true;
    practice?.noteEdit();
  },
});

let camTween = null;
controls.addEventListener('start', () => {
  camTween = null;
});

function goCamera(lab) {
  // cameraFor(state) lets one lab frame different scenarios differently (particle orbit vs a wire).
  const cam = lab?.cameraFor?.(slice()) || lab?.camera;
  if (!cam) return;
  camTween = {
    t: 0,
    fromPos: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPos: cam.pos,
    toTarget: cam.target,
  };
}

function stepCamera(dt) {
  if (!camTween) return;
  camTween.t = Math.min(1, camTween.t + dt / 0.9);
  const t = camTween.t;
  const k = t * t * t * (t * (6 * t - 15) + 10);
  camera.position.lerpVectors(camTween.fromPos, camTween.toPos, k);
  controls.target.lerpVectors(camTween.fromTarget, camTween.toTarget, k);
  if (t >= 1) camTween = null;
}

function resetCamera() {
  goCamera(app.lab);
}

function setOrbit(on) {
  controls.enableRotate = on !== false;
}

function toggleShow(key) {
  const s = slice();
  if (!s.show) s.show = {};
  s.show[key] = !s.show[key];
  app.dirty = true;
}

function toggleSweep() {
  const s = slice();
  if (!s.anim) return;
  if (s.anim.playing) {
    s.anim.playing = false;
    s.anim.i = 1e9;
  } else {
    s.anim.playing = true;
    s.anim.i = 0;
  }
  app.dirty = true;
}

function handleKey(e) {
  const lab = app.lab;
  if (!lab) return;
  const action = lab.keys[e.key];
  if (!action) return;
  if (action === 'sweep') {
    e.preventDefault();
    toggleSweep();
  }

  if (action === 'delete') {
    /* no charge list in statics */
    bump();
  }
  if (action === 'reset') resetCamera();
}

function applyLabScenario(lab, id, s) {
  if (lab.applyScenario) lab.applyScenario(id, s);
  else applyScenario(lab.id, id, s);
  // Scenarios are authored in the floor plane; a problem sets its own view in its setup().
  if (lab.frame) s.view = defaultView();
}

/**
 * Push the active lab's view (scene units per meter, and which plane the 2D work happens in) into
 * the scene, refitting when the content has outgrown the frame. Labs without `frame` keep the
 * fixed default scale, so their scenes are untouched.
 */
function applyFrame({ force = false } = {}) {
  const lab = app.lab;
  const s = slice();
  if (lab?.frame) {
    s.view = refit(s, { force, extent: lab.extent?.(s) });
    setFrame(s.view);
  } else {
    setFrame(null);
  }
  grid.setScale(sceneScale());
  grid.setPlane(workPlane());
}

function setScenario(id) {
  const lab = app.lab;
  if (!lab) return;
  practice?.noteEdit();
  applyLabScenario(lab, id, slice());
  applyFrame({ force: true });
  goCamera(lab);
  bump();
}

function setLabIndex(i) {
  const exam = examById(app.examId);
  const id = exam.labs[i];
  if (id) setLab(id);
}

function shiftExam(dir) {
  const next = neighborExam(app.examId, dir);
  if (next.id !== app.examId) setExam(next.id);
}

async function setExam(examId, preferredLab) {
  const exam = examById(examId);
  app.examId = exam.id;
  await loadExamLabs(exam.labs);
  const id = preferredLab && exam.labs.includes(preferredLab) ? preferredLab : exam.labs[0];
  if (id) {
    await setLab(id);
  } else {
    if (app.lab) app.lab.exit(ctx, app.handles[app.labId], slice());
    app.lab = null;
    app.labId = null;
    pool.hideAll();
    hud.mount(null, exam, { examId: exam.id });
    practice?.onMount({ byProblem: loadingProblem });
    writeHash(exam.id, '', { replace: booting, query: app.query });
    app.dirty = true;
  }
}

async function setLab(labId) {
  if (!labId) return;
  if (app.labId === labId && app.lab) return;
  const my = ++app.gen;
  const exam = examForLab(labId);
  await loadExamLabs(exam.labs);
  const lab = await loadLab(labId);
  if (!lab || my !== app.gen) return;

  if (app.lab) app.lab.exit(ctx, app.handles[app.labId], slice());

  app.examId = lab.exam || exam.id;
  app.labId = labId;
  app.lab = lab;
  if (!app.handles[labId]) app.handles[labId] = lab.init(ctx);
  if (!app.slices[labId]) {
    const s = lab.defaultState();
    const list = typeof lab.scenarios === 'function' ? lab.scenarios() : lab.scenarios || [];
    if (list[0]) applyLabScenario(lab, list[0].id, s);
    app.slices[labId] = s;
  }
  const s = app.slices[labId];
  s.lab = labId;
  applyFrame();
  lab.enter(ctx, app.handles[labId], s);
  setOrbit(lab.orbit);
  goCamera(lab);
  hud.mount(lab, examById(app.examId), s);
  practice?.onMount({ byProblem: loadingProblem });
  writeHash(app.examId, labId, { replace: booting, query: app.query });
  app.dirty = true;
}

let booting = true;

/**
 * Put the app into a problem's setup: switch to its lab (or its exam when it has no lab yet),
 * load the numbers into the lab, and frame the camera. Returns the template's note, if any.
 */
async function openProblemInApp(inst, { push = true, query = true } = {}) {
  const tpl = inst.tpl;
  app.query = query ? problemQuery(tpl.id, inst.seed) : '';
  loadingProblem = true;
  try {
    if (tpl.lab) {
      await setLab(tpl.lab);
      // A lab switch started elsewhere (e.g. a second URL event) can supersede ours; finish the switch.
      if (app.lab?.id !== tpl.lab) await setLab(tpl.lab);
    } else if (app.examId !== tpl.exam) await setExam(tpl.exam);
    let note = '';
    if (tpl.lab && app.lab?.id === tpl.lab) {
      note = applyProblem(app.lab, slice(), inst);
      applyFrame();
      goCamera(app.lab);
      bump();
    }
    writeHash(app.examId, app.labId, { replace: !push, query: app.query });
    return note;
  } finally {
    loadingProblem = false;
  }
}

practice = createPractice({
  openInLab: openProblemInApp,
  clearQuery({ push = false } = {}) {
    if (!app.query) return;
    app.query = '';
    writeHash(app.examId, app.labId, { replace: !push });
  },
  /** Blind mode: hide answer arrows (the veil in problems.js handles the text). */
  setSceneBlind(on) {
    if (on) camera.layers.disable(ANSWER_LAYER);
    else camera.layers.enable(ANSWER_LAYER);
  },
  labId: () => app.labId,
  examId: () => app.examId,
  setExam: (id) => setExam(id),
  slice,
  computed,
  labelLayer: labels.domElement,
});

function followUrl() {
  const { examId, labId, problemId, seed } = parseHash();
  if (practice.followUrl(problemId, seed)) return;
  if (examId === app.examId && labId === app.labId) return;
  if (labId) setLab(labId);
  else setExam(examId);
}
// Typed / bookmarked hashes fire hashchange; Back / Forward over pushState entries fire popstate.
window.addEventListener('hashchange', followUrl);
window.addEventListener('popstate', followUrl);

function recompute() {
  const lab = app.lab;
  const s = slice();
  if (!lab) return;
  applyFrame();
  ctx.handle = app.handles[app.labId];
  lab.recompute(s, computed, ctx);
  computed.coach = lab.coach(s, computed);
}

function syncViews() {
  const lab = app.lab;
  pool.hideAll();
  if (!lab) {
    grid.visible = true;
    return;
  }
  ctx.handle = app.handles[app.labId];
  lab.syncViews(slice(), computed, ctx);
}

/**
 * The practice panel is wider than the equation panel, so while it is open the picture slides
 * right to stay centered in the free space (a projection offset: orbit, picking, and labels all follow).
 */
const view = { shift: 0, w: 0, h: 0 };
function stepViewShift() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  let target = 0;
  if (document.body.classList.contains('practice-open') && w > 720) {
    const left = document.getElementById('problems').getBoundingClientRect().right;
    const controlsEl = document.getElementById('controls');
    const right = controlsEl.offsetParent ? controlsEl.getBoundingClientRect().left : w;
    target = Math.max(0, Math.round((left + right) / 2 - w / 2));
  }
  const next = Math.abs(target - view.shift) < 0.5 ? target : view.shift + (target - view.shift) * 0.2;
  if (next === view.shift && w === view.w && h === view.h) return;
  view.shift = next;
  view.w = w;
  view.h = h;
  if (Math.abs(next) < 0.5) camera.clearViewOffset();
  else camera.setViewOffset(w, h, -next, 0, w, h);
}

function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  stepCamera(dt);
  stepViewShift();
  controls.update();

  const lab = app.lab;
  const s = slice();
  if (lab?.tick && s.anim) {
    if (lab.tick(dt, s, computed, ctx)) app.dirty = true;
  }

  const live = !!lab?.live;
  if (app.dirty || s.dirty || pointer.dragging || live) {
    recompute();
    syncViews();
    hud.update(publicState(), computed, lab);
    practice.afterUpdate();
    app.dirty = false;
    if (s.dirty !== undefined) s.dirty = false;
  }
  if (lab?.afterFrame) lab.afterFrame(dt, s, computed, ctx);
  practice.frame();

  renderer.render(scene, camera);
  labels.render(scene, camera);
  requestAnimationFrame(frame);
}

window.__gauss = {
  get state() {
    return publicState();
  },
  computed,
  app,
  camera,
  controls,
  practice,
};

const boot = parseHash();
setExam(boot.examId, boot.labId).then(() => {
  booting = false;
  if (boot.problemId) practice.followUrl(boot.problemId, boot.seed);
  recompute();
  syncViews();
  hud.update(publicState(), computed, app.lab);
  frame();
});
