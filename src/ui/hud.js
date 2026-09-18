import { EXAMS, examById, LAB_META } from '../data/catalog.js';
import { setLawEl, prose, mathText } from './shared.js';
import { drawVx, drawAC, drawVI } from './plot.js';
import { sceneScale, workPlane, lenLabel, PLANE_AXES } from '../engine/frame.js';

export function createHUD(api) {
  const $ = (id) => document.getElementById(id);
  let lawKey = '';
  let mountedId = '';
  /** Refreshers for the typed boxes beside each slider, rebuilt whenever a lab mounts. */
  const sliderBoxes = [];

  function setLaw(lines) {
    const key = (lines || []).join('\n');
    if (key === lawKey) return;
    lawKey = key;
    setLawEl($('law-line'), lines);
  }

  function fillScenarios(lab) {
    const list = !lab ? [] : typeof lab.scenarios === 'function' ? lab.scenarios() : lab.scenarios || [];
    $('scenario').innerHTML = list.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
    $('scenario').closest('label').hidden = list.length === 0;
  }

  function renderExamTabs(examId) {
    $('exam-tabs').innerHTML = EXAMS.map((e) => {
      const on = e.id === examId;
      const label = e.id === 'wave' ? 'W' : String(e.n);
      return `<button type="button" class="exam-tab${on ? ' active' : ''}" data-exam="${e.id}" aria-selected="${on}" title="Exam ${e.n}: ${e.title}">${label}</button>`;
    }).join('');
  }

  function renderLabTabs(exam, labId) {
    const labs = exam?.labs || [];
    const built = labs
      .map((id) => {
        const on = id === labId;
        const title = LAB_META[id]?.title || id;
        return `<button type="button" class="tab${on ? ' active' : ''}" data-lab="${id}" role="tab" aria-selected="${on}">${title}</button>`;
      })
      .join('');
    // Unbuilt labs stay visible so the exam's full scope is on screen.
    const soon = (exam?.coming || [])
      .map((t) => `<button type="button" class="tab soon" disabled title="Coming soon">${t}</button>`)
      .join('');
    $('lab-tabs').innerHTML = built + soon;
  }

  function renderToggles(lab, state) {
    const host = $('toggle-host');
    const items = lab?.toggles || [];
    host.innerHTML = items
      .map((t) => {
        const on = !!state?.show?.[t.key];
        return `<button type="button" class="toggle${on ? ' active' : ''}" data-key="${t.key}" aria-pressed="${on}"><span class="toggle-dot"></span> ${t.label}</button>`;
      })
      .join('');
  }

  function renderLegend(lab) {
    const host = $('legend-host');
    const L = lab?.legend;
    // The legend sits over the bottom-left corner; the equation panel stops short of it.
    document.body.classList.toggle('has-legend', !!L);
    if (!L) {
      host.innerHTML = '';
      host.hidden = true;
      return;
    }
    host.hidden = false;
    host.innerHTML = `<div class="hud legend" id="legend">
        <div class="legend-title">${L.title}</div>
        <div class="legend-bar${L.barClass ? ' ' + L.barClass : ''}"></div>
        <div class="legend-row"><span>${L.low}</span><span>${L.high}</span></div>
      </div>`;
  }

  /**
   * Give every slider a box you can type an exact value into. A slider is good for sweeping and bad
   * for matching a number in a problem, so the box writes straight into the same input — widening
   * the slider's range when the problem asks for a value it could not otherwise reach.
   */
  function enhanceSliders(host) {
    for (const row of host.querySelectorAll('.slider-row')) {
      const range = row.querySelector("input[type='range']");
      if (!range || row.querySelector('.slider-num')) continue;
      const step = Number(range.step);
      // Fractional steps become continuous, so a typed value is never snapped back to the grid.
      // Whole-number steps (piece counts, turns) stay discrete.
      if (Number.isFinite(step) && step > 0 && step < 1) range.step = 'any';
      const box = document.createElement('input');
      box.type = 'number';
      box.className = 'slider-num';
      box.step = Number.isFinite(step) && step > 0 ? String(step) : 'any';
      box.setAttribute('aria-label', 'Exact value');
      const show = () => {
        if (box !== document.activeElement) box.value = String(Number(Number(range.value).toPrecision(6)));
      };
      show();
      box.addEventListener('input', () => {
        const v = Number(box.value);
        if (box.value === '' || !Number.isFinite(v)) return;
        if (v < Number(range.min)) range.min = String(v);
        if (v > Number(range.max)) range.max = String(v);
        range.value = String(v);
        range.dispatchEvent(new Event('input', { bubbles: true }));
      });
      range.addEventListener('input', show);
      row.appendChild(box);
      sliderBoxes.push(show);
    }
  }

  function mount(lab, exam, state) {
    const examId = exam?.id || 'e2';
    const labId = lab?.id || '';
    renderExamTabs(examId);
    renderLabTabs(exam, labId);
    $('brand-sub').textContent = exam
      ? `Statics · Unit ${exam.n} · ${exam.title} · Ch ${exam.chapters}`
      : 'Statics';
    $('setup-hint').innerHTML = mathText(lab?.hint || exam?.coming?.join(' · ') || '');
    $('hint-action').innerHTML = mathText(lab?.hint || '');
    $('hint-orbit').textContent = lab && lab.orbit === false ? 'Rotation locked' : 'Drag to orbit';
    fillScenarios(lab);
    lawKey = '';
    

    const host = $('lab-controls');
    if (!lab) {
      const coming = (exam?.coming || []).join(', ') || 'coming next';
      host.innerHTML = `<p class="tiny">The ${coming} labs aren’t built yet. The practice problems for this unit are ready: press <b>P</b> or use Practice.</p>`;
      mountedId = '';
      renderToggles(null);
      renderLegend(null);
      return;
    }
    host.innerHTML = lab.controls();
    sliderBoxes.length = 0;
    lab.bind(api);
    enhanceSliders(host);
    mountedId = lab.id;
    renderToggles(lab, state);
    renderLegend(lab);
    if (state?.scenarioId) $('scenario').value = state.scenarioId;
  }

  $('exam-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-exam]');
    if (btn) api.setExam(btn.dataset.exam);
  });
  $('lab-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lab]');
    if (btn) api.setLab(btn.dataset.lab);
  });
  $('scenario').addEventListener('change', () => api.setScenario($('scenario').value));
  $('btn-reset-cam').addEventListener('click', () => api.resetCamera());
  $('toggle-host').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-key]');
    if (btn) api.toggleShow(btn.dataset.key);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      api.escape();
      return;
    }
    if (e.target.matches('input, select, textarea')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'p' || e.key === 'P') {
      api.togglePractice();
      return;
    }
    if (e.key === '[') {
      api.shiftExam(-1);
      return;
    }
    if (e.key === ']') {
      api.shiftExam(1);
      return;
    }
    if (e.key >= '1' && e.key <= '9') {
      api.setLabIndex(Number(e.key) - 1);
      return;
    }
    api.handleKey(e);
  });

  /** What plane a drag runs in, and what one grid square is worth — the scene's legend, in words. */
  function updatePlaneHint(lab) {
    const el = $('hint-plane');
    if (!el) return;
    const plane = workPlane();
    const off = PLANE_AXES[plane].off;
    el.textContent = lab?.frame
      ? `${plane} plane · 1 square = ${lenLabel(1 / sceneScale())} · Shift-drag for ${off}`
      : 'Shift-drag for height';
  }

  function update(state, computed, lab) {
    if (!lab) {
      $('eq-live').innerHTML = '';
      $('readout').innerHTML = '';
      $('insight-title').textContent = examById(state.examId)?.title || '';
      $('insight-body').innerHTML = prose((examById(state.examId)?.coming || []).join(', '));
      $('mini-plot').hidden = true;
      return;
    }
    if (state.scenarioId && $('scenario').value !== state.scenarioId) {
      $('scenario').value = state.scenarioId;
    }
    lab.syncControls(state);
    for (const show of sliderBoxes) show();
    updatePlaneHint(lab);
    document.querySelectorAll('#toggle-host [data-key]').forEach((b) => {
      const on = !!state.show?.[b.dataset.key];
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    const coach = computed.coach || lab.coach(state, computed) || { title: '', body: '' };
    $('insight-title').innerHTML = mathText(coach.title || '');
    $('insight-body').innerHTML = prose(coach.body || '');

    setLaw(lab.law(state, computed));
    $('eq-live').innerHTML = lab.liveRows(state, computed);
    $('readout').innerHTML = lab.readout(state, computed);

    const plot = lab.plot(state, computed);
    const canvas = $('mini-plot');
    if (!plot) {
      canvas.hidden = true;
    } else {
      canvas.hidden = false;
      if (plot.type === 'Vx') drawVx(canvas, plot.xs, plot.Vs, plot.xProbe, plot.xA);
      if (plot.type === 'ac') drawAC(canvas, plot.power, plot.t);
      if (plot.type === 'vi') drawVI(canvas, plot);
    }
  }

  return { mount, update };
}

export { sciHTML } from './format.js';
