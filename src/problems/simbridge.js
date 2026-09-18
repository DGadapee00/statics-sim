/**
 * Load a problem instance into a lab's state slice. Used by the Problems panel (browser) and by
 * scripts/problems-check.mjs (Node), so what the student sees is what the test checked.
 */
import { applyScenario as applyDataScenario } from '../data/scenarios.js';

export function scenarioList(lab) {
  return typeof lab.scenarios === 'function' ? lab.scenarios() : lab.scenarios || [];
}

/**
 * Reset `slice` to the problem's base scenario, then let the template adjust it.
 * Returns the note to show under the problem (e.g. "positions scaled ×0.28"), or ''.
 */
export function applyProblem(lab, slice, inst) {
  const sim = inst.tpl.sim;
  if (!sim) return '';
  const list = scenarioList(lab);
  const id = sim.scenario ?? list[0]?.id;
  if (id != null) {
    if (lab.applyScenario) lab.applyScenario(id, slice);
    else applyDataScenario(lab.id, id, slice);
  }
  const note = sim.setup ? sim.setup(slice, inst.$) : '';
  slice.problemId = inst.tpl.id;
  slice.dirty = true;
  return typeof note === 'string' ? note : '';
}

/** A Node-safe ctx for lab.recompute (labs only touch pool views and the clock there). */
export function headlessCtx() {
  const view = {
    setVisible() {},
    sync() {},
    rebuild: () => ({ pieces: [] }),
    clear() {},
    update() {},
    labelEl: {},
    label: { position: { set() {} } },
    partial: { E: { x: 0, y: 0, z: 0 }, mag: 0, V: 0 },
  };
  return {
    clock: { elapsedTime: 0, getElapsedTime: () => 0 },
    pool: new Proxy({}, { get: () => () => view }),
    grid: {},
    handle: {},
  };
}
