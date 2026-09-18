import * as THREE from 'three';
import { sceneScale } from '../engine/frame.js';
import { M } from './manim.js';

const MAX = 900;
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _d = new THREE.Vector3();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color();

const SHAFT = new THREE.CylinderGeometry(1, 1, 1, 8, 1).translate(0, 0.5, 0);
const TIP = new THREE.ConeGeometry(1, 1, 12, 1).translate(0, -0.5, 0);
const SHAFT_R = 0.032;
const TIP_L = 0.22;
const TIP_R = 0.085;

function makeInstanced(geo, color) {
  const mat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  return mesh;
}

/** Instanced Manim vectors: shaft stretches with length, tip keeps a constant size. */
export class VectorBatch {
  constructor(group, color) {
    this.shaft = makeInstanced(SHAFT, color);
    this.tip = makeInstanced(TIP, color);
    group.add(this.shaft, this.tip);
    this.n = 0;
  }

  begin() {
    this.n = 0;
  }

  push(origin, dir, L, color) {
    if (this.n >= MAX) return;
    const hl = Math.min(TIP_L, L * 0.55);
    _q.setFromUnitVectors(_up, dir);
    _s.set(SHAFT_R, Math.max(1e-4, L - hl * 0.85), SHAFT_R);
    _m.compose(origin, _q, _s);
    this.shaft.setMatrixAt(this.n, _m);
    _p.copy(origin).addScaledVector(dir, L);
    _s.set(TIP_R, hl, TIP_R);
    _m.compose(_p, _q, _s);
    this.tip.setMatrixAt(this.n, _m);
    if (color) {
      this.shaft.setColorAt(this.n, color);
      this.tip.setColorAt(this.n, color);
    }
    this.n += 1;
  }

  end(show) {
    for (const mesh of [this.shaft, this.tip]) {
      mesh.count = show ? this.n : 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
}

export class ArrowView {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.E = new VectorBatch(this.group, 0xffffff);
    this.N = new VectorBatch(this.group, M.green);
  }

  setVisible(v) {
    this.group.visible = v;
  }

  sync(patches, samples, showE, showN, extraEScale = 5e4) {
    const u = sceneScale();
    const n = patches.length;
    // About 150 arrows at most: enough to read the pattern without a thicket.
    const stride = Math.max(2, Math.ceil(n / 150));
    this.E.begin();
    this.N.begin();

    for (let i = 0; i < n; i += stride) {
      const p = patches[i];
      const s = samples[i];
      if (showE) {
        _d.set(s.Ex, s.Ey, s.Ez);
        const mag = _d.length();
        if (mag > 1e-6) {
          _d.multiplyScalar(1 / mag);
          const L = (0.05 + 0.09 * Math.tanh(mag / extraEScale)) * u;
          _p.set(p.x * u, p.y * u, p.z * u);
          _c.set(s.En >= 0 ? M.yellow : M.blue);
          this.E.push(_p, _d, L, _c);
        }
      }
      if (showN) {
        _d.set(p.nx, p.ny, p.nz).normalize();
        _p.set(p.x * u, p.y * u, p.z * u);
        this.N.push(_p, _d, 0.12 * u);
      }
    }
    this.E.end(showE);
    this.N.end(showN);
  }
}
