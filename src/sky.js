// Sky dome, sun & moon, day/night lighting and per-biome atmosphere.
import * as THREE from '../vendor/three.module.min.js';
import { BIOMES } from './data.js';
import { clamp, lerp, sstep } from './rng.js';
import { G, hourOf } from './state.js';
import { setDaylight } from './mats.js';
import { Pix } from './art.js';

const cur = { fog: [0.6, 0.7, 0.8], sky: [0.4, 0.6, 0.9], light: [1, 1, 1], far: 350 };
export const tintC = new THREE.Color(1, 1, 1);
const fogC = new THREE.Color(), topC = new THREE.Color();
let dome, sun, moon, stars;

export function initSky(scene) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying float h; void main(){ float t = floor(clamp(h*2.2,0.0,1.0)*10.0)/10.0; gl_FragColor = vec4(mix(bottom, top, t),1.0);\n#include <colorspace_fragment>\n}',
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  dome = new THREE.Mesh(new THREE.SphereGeometry(1200, 20, 10), mat); dome.renderOrder = -10; dome.frustumCulled = false; scene.add(dome);
  const disc = (c1, c2, crater) => { const p = new Pix(32, 32); for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const d = Math.hypot(x - 15.5, y - 15.5); if (d < 13) p.set(x, y, d < 10 ? c1 : c2); } if (crater) { p.ell(11, 12, 3, 3, c2); p.ell(19, 18, 4, 3, c2); p.ell(18, 9, 2, 2, c2); } return p.texture(); };
  const mk = (tex, s) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, fog: false, depthTest: false, depthWrite: false })); m.scale.set(s, s, 1); m.renderOrder = -8; scene.add(m); return m; };
  sun = mk(disc([255, 250, 200], [255, 220, 120]), 130); moon = mk(disc([226, 230, 240], [180, 186, 204], true), 90);
  const sp = []; for (let i = 0; i < 500; i++) { const a = Math.random() * 6.283, e = Math.asin(Math.random()); sp.push(Math.cos(a) * Math.cos(e) * 1100, Math.sin(e) * 1100 + 20, Math.sin(a) * Math.cos(e) * 1100); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false })); stars.renderOrder = -9; stars.frustumCulled = false; scene.add(stars);
  return { dome, sun, moon, stars };
}

export function dayFactor(h = hourOf()) { return sstep(5, 7.5, h) * (1 - sstep(19, 21.5, h)); }

export function updateSky(dt, scene, camera, snap) {
  const P = G.player, W = G.world, h = hourOf(), df = dayFactor(h);
  const dusk = Math.max(0, 1 - Math.abs(h - 6.2) / 1.4, 1 - Math.abs(h - 20.2) / 1.4);
  const nightEye = P.hasBuff('night') ? 1 : 0;
  if (!G.space) {
    W.biomeAt(P.pos.x, P.pos.z);
    const A = BIOMES[W.ba], B = BIOMES[W.bb], t = W.bt, k = snap ? 1 : clamp(dt * 0.6, 0, 1);
    for (let i = 0; i < 3; i++) {
      cur.fog[i] = lerp(cur.fog[i], lerp(B.fog[i], A.fog[i], t), k); cur.sky[i] = lerp(cur.sky[i], lerp(B.sky[i], A.sky[i], t), k); cur.light[i] = lerp(cur.light[i], lerp(B.light[i], A.light[i], t), k);
    }
    cur.far = lerp(cur.far, lerp(B.fogFar, A.fogFar, t), k);
    const nb = 0.2 + nightEye * 0.3;
    const tr = lerp(nb * 0.8, cur.light[0], df) + dusk * 0.14, tg = lerp(nb * 0.95, cur.light[1], df) + dusk * 0.02, tb = lerp(nb * 1.5, cur.light[2], df) - dusk * 0.08;
    tintC.setRGB(tr, tg, Math.max(0.1, tb));
    setDaylight(tintC, df < 0.35);
    const fb = lerp(0.1 + nightEye * 0.12, 1, df);
    fogC.setRGB((cur.fog[0] + dusk * 0.25) * fb, (cur.fog[1] + dusk * 0.05) * fb, cur.fog[2] * (fb + (1 - df) * 0.06), THREE.SRGBColorSpace);
    topC.setRGB(cur.sky[0] * fb * 0.8, cur.sky[1] * fb * 0.8, cur.sky[2] * (fb * 0.9 + (1 - df) * 0.08), THREE.SRGBColorSpace);
    scene.fog.color.copy(fogC); scene.background = null;
    G.renderer.setClearColor(fogC);
    const torch = P.equip.lhand && P.equip.lhand.type === 'torch';
    scene.fog.far = cur.far * lerp(0.55 + (torch ? 0.1 : 0) + nightEye * 0.2, 1, df); scene.fog.near = scene.fog.far * 0.22;
    dome.material.uniforms.top.value.copy(topC); dome.material.uniforms.bottom.value.copy(fogC);
    dome.position.copy(camera.position);
    const a = (h - 6) / 12 * Math.PI;
    sun.position.set(camera.position.x + Math.cos(a) * 1000, camera.position.y + Math.sin(a) * 900, camera.position.z + 250);
    moon.position.set(camera.position.x - Math.cos(a) * 1000, camera.position.y - Math.sin(a) * 900, camera.position.z - 200);
    sun.visible = Math.sin(a) > -0.08; moon.visible = Math.sin(a) < 0.08;
    stars.position.copy(camera.position); stars.material.opacity = 1 - df; stars.visible = df < 0.9;
  }
}
export function interiorFog(scene, level) {
  const P = G.player, torch = P.equip.lhand && P.equip.lhand.type === 'torch', ne = P.hasBuff('night');
  const base = level.light || 14;
  scene.fog.color.setRGB(0, 0, 0); G.renderer.setClearColor(0x000000);
  scene.fog.near = 1.5; scene.fog.far = base + (level.dark ? (torch ? 11 : 0) + (ne ? 16 : 0) : 0);
}
