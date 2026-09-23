import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/**
 * Small pieces the Ch 3–4 labs share: a slider row with a typed-number box, the listeners that
 * go with it, and the z-up mapping for 3D statics.
 */

export function label(html, cls = 'circuit-label') {
  const el = document.createElement('div');
  el.className = cls;
  el.innerHTML = html;
  return new CSS2DObject(el);
}

export const sliderRow = (id, text, val, min, max, step = 1) => `
          <label class="field">
            <span>${text}</span>
            <div class="slider-row">
              <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" />
              <span class="mono val" id="${id}-val">${val}</span>
              <input type="number" class="num" id="${id}-num" step="${step}" value="${val}" />
            </div>
          </label>`;

/** Wire a sliderRow: `apply(slice, value)` writes the state; typed values may widen the range. */
export function bindSlider(api, id, apply) {
  const s = document.getElementById(id);
  const n = document.getElementById(`${id}-num`);
  if (!s) return;
  const set = (val) => {
    apply(api.slice(), val);
    api.bump(false);
  };
  s.addEventListener('input', (e) => set(Number(e.target.value)));
  if (n) {
    n.addEventListener('change', (e) => {
      const val = Number(e.target.value);
      if (!Number.isFinite(val)) return;
      if (val < Number(s.min)) s.min = String(val);
      if (val > Number(s.max)) s.max = String(val);
      set(val);
    });
  }
}

export function putSlider(id, val, digits = 0) {
  const s = document.getElementById(id);
  if (s) {
    if (val < Number(s.min)) s.min = String(val);
    if (val > Number(s.max)) s.max = String(val);
    s.value = String(val);
  }
  const t = document.getElementById(`${id}-val`);
  if (t) t.textContent = Number(val).toFixed(digits);
  const n = document.getElementById(`${id}-num`);
  if (n && document.activeElement !== n) n.value = digits ? String(Number(Number(val).toFixed(digits + 2))) : String(val);
}

export function showBlock(id, on) {
  const el = document.getElementById(id);
  if (el) el.style.display = on ? '' : 'none';
}

/**
 * Hibbeler draws 3D problems with z up; three.js has y up. (x, y, z) → (x, z, −y) keeps the
 * frame right-handed, so a cross product computed in statics coordinates still points the way it
 * is drawn.
 */
export const zUp = (p) => new THREE.Vector3(p.x, p.z, -p.y);
export const flat = (p) => new THREE.Vector3(p.x, p.y, p.z);

/** Arc of `sweep` radians around `c` in the screen plane, as flat segment pairs for setFatSegments. */
export function arcSegments(c, r, start, sweep, n = 32) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a0 = start + (sweep * i) / n;
    const a1 = start + (sweep * (i + 1)) / n;
    out.push(c.x + r * Math.cos(a0), c.y + r * Math.sin(a0), c.z, c.x + r * Math.cos(a1), c.y + r * Math.sin(a1), c.z);
  }
  return out;
}
