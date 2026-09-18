import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { M, fatSegments } from './manim.js';
import { GRID_HALF, lenLabel } from '../engine/frame.js';

/**
 * Manim-style NumberPlane with ticks labeled in real units.
 *
 * The plane is built in xy and rotated onto the floor for the xz labs, so the same object serves
 * both: `setPlane('xy')` stands it up in the plane the problems are written in (x right, y up),
 * `setPlane('xz')` lays it down (the original floor). `setScale` re-labels the ticks — one square
 * is always a round distance, which is what makes a drag or a typed coordinate readable.
 */
export class NumberPlane {
  constructor(half = GRID_HALF) {
    this.half = half;
    this.group = new THREE.Group();
    this.plane = new THREE.Group();
    this.group.add(this.plane);

    const major = [];
    const minor = [];
    for (let i = -half; i <= half; i++) {
      if (i !== 0) {
        major.push(i, -half, 0, i, half, 0);
        major.push(-half, i, 0, half, i, 0);
      }
      if (i < half) {
        const m = i + 0.5;
        minor.push(m, -half, 0, m, half, 0);
        minor.push(-half, m, 0, half, m, 0);
      }
    }
    this.plane.add(fatSegments(minor, { color: M.blueE, width: 1, opacity: 0.28 }));
    this.plane.add(fatSegments(major, { color: M.blueD, width: 1.4, opacity: 0.42 }));

    const t = 0.08;
    const axes = [-half, 0, 0, half, 0, 0, 0, -half, 0, 0, half, 0];
    const ticks = [];
    for (let i = -half + 1; i < half; i++) {
      if (i === 0) continue;
      ticks.push(i, -t, 0, i, t, 0);
      ticks.push(-t, i, 0, t, i, 0);
    }
    this.plane.add(fatSegments(axes, { color: M.white, width: 2, opacity: 0.8 }));
    this.plane.add(fatSegments(ticks, { color: M.white, width: 1.6, opacity: 0.7 }));

    // Out-of-plane axis: vertical for the floor plane, into the screen for the standing one.
    this.off = new THREE.Group();
    this.off.add(fatSegments([0, 0, 0, 0, 4.8, 0], { color: M.white, width: 2, opacity: 0.55 }));
    const offTicks = [];
    for (let i = 1; i < 5; i++) offTicks.push(-t, i, 0, t, i, 0);
    this.off.add(fatSegments(offTicks, { color: M.white, width: 1.6, opacity: 0.5 }));
    this.group.add(this.off);

    // Tick labels every other square, on both in-plane axes.
    this.ticks = [];
    for (let i = -half + 1; i < half; i++) {
      if (i === 0 || i % 2 !== 0) continue;
      // Offset off the axis line so the number never sits on top of it.
      this.ticks.push(this.makeTick(i, i, 0.4, 0));
      this.ticks.push(this.makeTick(i, -0.52, i, 0));
    }

    this.nameA = this.makeName('x', half + 0.4, 0, 0);
    this.nameB = this.makeName('z', 0, half + 0.35, 0);
    this.nameOff = this.makeName('y', 0, 0, 0);
    this.nameOff.position.set(0, 5.2, 0);
    this.group.add(this.nameOff);

    this.scale = 0;
    this.planeId = '';
    this.setPlane('xz');
    this.setScale(8);
  }

  makeTick(i, x, y, z) {
    const div = document.createElement('div');
    div.className = 'grid-tick';
    const obj = new CSS2DObject(div);
    obj.position.set(x, y, z);
    this.plane.add(obj);
    return { i, el: div, obj, axis: x !== 0 ? 'a' : 'b' };
  }

  makeName(text, x, y, z) {
    const div = document.createElement('div');
    div.className = 'axis-label';
    div.textContent = text;
    const obj = new CSS2DObject(div);
    obj.position.set(x, y, z);
    this.plane.add(obj);
    return obj;
  }

  /** One scene unit is 1/upm meters; label every other tick with the distance it stands for. */
  setScale(upm) {
    if (upm === this.scale) return;
    this.scale = upm;
    for (const t of this.ticks) t.el.textContent = lenLabel(t.i / upm);
  }

  setPlane(id) {
    if (id === this.planeId) return;
    this.planeId = id;
    const floor = id !== 'xy';
    this.plane.rotation.x = floor ? Math.PI / 2 : 0;
    // The out-of-plane axis is world y on the floor, world z when the plane stands up.
    this.off.rotation.x = floor ? 0 : Math.PI / 2;
    this.nameB.element.textContent = floor ? 'z' : 'y';
    this.nameOff.element.textContent = floor ? 'y' : 'z';
    this.nameOff.position.set(0, floor ? 5.2 : 0, floor ? 0 : 5.2);
  }

  get visible() {
    return this.group.visible;
  }

  set visible(v) {
    this.group.visible = v;
  }
}
