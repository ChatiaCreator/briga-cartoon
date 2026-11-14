// Renderer, side camera and the cartoon street arena.
import * as THREE from 'three';
import { skyTexture, groundTexture, buildingTexture, billboardTexture } from './textures.js';
import { WALL } from '../sim/fighter.js';

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  return renderer;
}

export class Arena {
  constructor(canImg) {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xd7385e, 22, 60);
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200);
    this.camX = 0; this.camZ = 9; this.shake = 0;

    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xfff1e0, 0x553366, 1.7));
    const sun = new THREE.DirectionalLight(0xffe2c0, 2.4);
    sun.position.set(-4, 9, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 6, bottom: -2, near: 1, far: 30 });
    sun.shadow.bias = -0.0005;
    this.sun = sun;
    s.add(sun, sun.target);
    // Rim light from behind for the cartoon look.
    const rim = new THREE.DirectionalLight(0x9fd8ff, 1.2);
    rim.position.set(3, 4, -6);
    s.add(rim);

    const sky = new THREE.Mesh(new THREE.PlaneGeometry(160, 50), new THREE.MeshBasicMaterial({ map: skyTexture(), fog: false }));
    sky.position.set(0, 18, -40);
    s.add(sky);

    const gtex = groundTexture();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2 * WALL / 1000 + 8, 7),
      new THREE.MeshToonMaterial({ map: gtex }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 0.5);
    ground.receiveShadow = true;
    s.add(ground);
    // Sidewalk and far street.
    const far = new THREE.Mesh(new THREE.PlaneGeometry(120, 30), new THREE.MeshToonMaterial({ color: 0x3a3347 }));
    far.rotation.x = -Math.PI / 2; far.position.set(0, -0.01, -14);
    s.add(far);
    const curb = new THREE.Mesh(new THREE.BoxGeometry(2 * WALL / 1000 + 8, 0.25, 0.4), new THREE.MeshToonMaterial({ color: 0xb8a9c9 }));
    curb.position.set(0, 0.12, -3.2);
    s.add(curb);

    // Buildings behind the street.
    const colors = ['#5b3b8c', '#2f6f8f', '#8c3b5b', '#3b8c6b', '#8c6b3b', '#4b4b8c'];
    for (let i = 0; i < 14; i++) {
      const w = 3 + (i * 37 % 5) * 0.6, h = 6 + (i * 53 % 7) * 1.4;
      const tex = buildingTexture(i + 11, colors[i % colors.length]);
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 3), new THREE.MeshToonMaterial({ map: tex }));
      b.position.set(-26 + i * 4.1, h / 2, -9 - (i % 3) * 2.5);
      s.add(b);
    }
    // Billboards.
    const bb1 = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), new THREE.MeshBasicMaterial({ map: billboardTexture('garra', canImg) }));
    bb1.position.set(-4.5, 3.3, -7.5);
    const bb2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), new THREE.MeshBasicMaterial({ map: billboardTexture('racao') }));
    bb2.position.set(4.8, 3.2, -7.5);
    s.add(bb1, bb2);
    for (const bb of [bb1, bb2]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4), new THREE.MeshToonMaterial({ color: 0x222222 }));
      pole.position.set(bb.position.x, 1.1, -7.6);
      s.add(pole);
    }
    // Props at the stage edges.
    const crateMat = new THREE.MeshToonMaterial({ color: 0xb87333 });
    const barrelMat = new THREE.MeshToonMaterial({ color: 0x2e86de });
    for (const side of [-1, 1]) {
      const x = side * (WALL / 1000 + 1.6);
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), crateMat);
      crate.position.set(x, 0.5, -1.2); crate.rotation.y = 0.3 * side; crate.castShadow = true;
      const crate2 = crate.clone(); crate2.position.set(x + side * 0.3, 1.5, -1.3); crate2.rotation.y = -0.2;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.1, 16), barrelMat);
      barrel.position.set(x - side * 0.6, 0.55, -2.3); barrel.castShadow = true;
      s.add(crate, crate2, barrel);
    }
    // Street lamps.
    for (const x of [-9, 0, 9]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5.5), new THREE.MeshToonMaterial({ color: 0x1e1e2e }));
      pole.position.set(x, 2.75, -4);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
      lamp.position.set(x, 5.5, -4);
      s.add(pole, lamp);
    }
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    // Narrow (phone) screens get a wider view so both fighters fit.
    this.camera.fov = w / h < 1.2 ? 48 : 30;
    this.camera.updateProjectionMatrix();
  }

  // Follow the midpoint of the fighters; zoom out as they move apart.
  updateCamera(xa, xb, dt) {
    const mid = (xa + xb) / 2;
    const dist = Math.abs(xa - xb);
    const limit = WALL / 1000 - 2.6;
    const targetX = Math.max(-limit, Math.min(limit, mid));
    const targetZ = Math.max(9.4, Math.min(13, 7.4 + dist * 0.85));
    const k = 1 - Math.pow(0.001, dt);
    this.camX += (targetX - this.camX) * k;
    this.camZ += (targetZ - this.camZ) * k;
    this.shake *= Math.pow(0.002, dt);
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    this.camera.position.set(this.camX + sx, 1.9 + sy, this.camZ);
    this.camera.lookAt(this.camX, 1.3, 0);
    this.sun.position.set(this.camX - 4, 9, 7);
    this.sun.target.position.set(this.camX, 0, 0);
  }
}
