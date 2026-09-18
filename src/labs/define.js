import * as THREE from 'three';

/**
 * Head-on camera for a lab whose work plane is standing up (xy). Looking straight down −z turns the
 * scene into the graph paper the problem is written on; orbiting still works from there.
 */
const XY_CAMERA = { pos: new THREE.Vector3(0, 0, 14), target: new THREE.Vector3(0, 0, 0) };

export function planeCamera(state) {
  return state?.view?.plane === 'xy' ? XY_CAMERA : null;
}

/**
 * Lab contract. Every lab is a plain object from defineLab().
 *
 * id, exam, title
 * live          — recompute every frame (Ohm, Power, AC, EM wave, Faraday)
 * orbit         — OrbitControls rotation; false locks the camera (circuits, optics)
 * hint          — setup + hint-bar copy
 * camera        — { pos: THREE.Vector3, target: THREE.Vector3 }
 * keys          — map of key → action name ('sweep' | 'add+' | 'add-' | 'delete' | 'reset' | custom)
 * toggles       — [{ key, label, labs? }]
 * legend        — { id, title, low, high, barClass? } | null
 * defaultState  — per-lab slice; restored when you come back
 * scenarios     — list (or getter) for the Setup dropdown
 * controls()    — Setup panel HTML (injected; IDs must be unique while mounted)
 * bind(api)     — listeners on the injected controls
 * syncControls(state)
 * init(ctx)     — build scene objects once; return a handle
 * enter(ctx, handle, state) / exit(ctx, handle, state)
 * recompute(state, computed, ctx)
 * syncViews(state, computed, ctx)
 * tick(dt, state, computed) — optional; return true to keep dirty
 * law(state, computed)      — KaTeX strings
 * liveRows(state, computed) — eq-live HTML
 * readout(state, computed)  — bottom four cells HTML
 * coach(state, computed) — { title, body }: the explainer under the readout. `title` and the
 *                           string blocks of `body` are prose with inline math between `$…$`;
 *                           `body` may also be a list mixing those with eq(`…`) display
 *                           equations (src/ui/shared.js). Row labels in liveRows() and readout()
 *                           take the same markup.
 * plot(state, computed)     — null | { type:'Vx'|'ac', ... }
 * pointer                   — null = default charge drag; or { down, move, up }
 * probe                     — true: clicking empty space moves state.probe in the work plane
 * frame                     — true: state.view ({ upm, plane }) drives the scene scale and the
 *                             number plane, and the view refits when the content outgrows it
 * extent(state)             — optional, with `frame`: how far the lab's own geometry reaches, in
 *                             meters, when it is not made of charges (a rod's half-length, say)
 * cameraFor(state)          — optional per-scenario camera; falls back to `camera`
 * applyScenario(id, state)  — optional; otherwise data/scenarios.js applyScenario(lab.id, …)
 * afterFrame(dt, state, computed, ctx) — per-frame animation that does not need a recompute
 */
export function defineLab(spec) {
  return {
    live: false,
    orbit: true,
    hint: '',
    keys: {},
    toggles: [],
    legend: null,
    defaultState: () => ({}),
    scenarios: [],
    controls: () => '',
    bind() {},
    syncControls() {},
    init: () => ({}),
    enter() {},
    exit() {},
    recompute() {},
    syncViews() {},
    tick: null,
    law: () => [],
    liveRows: () => '',
    readout: () => '',
    coach: () => ({ title: '', body: '' }),
    plot: () => null,
    pointer: null,
    ...spec,
  };
}
