import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { M } from './manim.js';
import { NumberPlane } from './numberPlane.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(M.bg, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Flat, true-to-palette colors (Manim does no filmic tone mapping).
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.05, 200);
  camera.position.set(7.2, 4.8, 11.4);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.7;
  controls.minDistance = 4.5;
  controls.maxDistance = 36;
  controls.target.set(0, 0, 0);
  controls.update();

  const labels = new CSS2DRenderer();
  labels.setSize(window.innerWidth, window.innerHeight);
  labels.domElement.style.position = 'absolute';
  labels.domElement.style.top = '0';
  labels.domElement.style.left = '0';
  labels.domElement.style.pointerEvents = 'none';
  labels.domElement.id = 'label-layer';
  canvas.parentElement.appendChild(labels.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x303038, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(6, 10, 4);
  scene.add(key);

  const grid = new NumberPlane();
  scene.add(grid.group);

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    labels.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  return { renderer, scene, camera, controls, labels, grid, onResize };
}


export { CSS2DObject };
