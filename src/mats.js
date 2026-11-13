// Shared materials + geometry buckets.
import * as THREE from '../vendor/three.module.min.js';
import { T } from './art.js';

export const M = {};
const outdoor = [], billboards = [];

function basic(map, opts = {}) {
  return new THREE.MeshBasicMaterial(Object.assign({ map, vertexColors: true, side: THREE.DoubleSide }, opts));
}
export function billboardMat(map) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, tint: { value: new THREE.Color(1, 1, 1) } }]),
    vertexShader: `attribute vec2 off; attribute float shade; varying vec2 vUv; varying float vShade;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vShade = shade;
        vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
        vec4 wp = modelMatrix * vec4(position, 1.0); wp.xyz += right * off.x; wp.y += off.y;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 tint; varying vec2 vUv; varying float vShade;
      #include <fog_pars_fragment>
      void main(){ vec4 c = texture2D(map, vUv); if (c.a < 0.5) discard;
        gl_FragColor = vec4(c.rgb * tint * vShade, 1.0);
        #include <fog_fragment>
        #include <colorspace_fragment>
      }`,
    fog: true,
  });
  m.uniforms.map.value = map; m.shadowSide = THREE.DoubleSide;
  // depth-only twin so billboards cast shadows (they turn to face the sun)
  m.depth = new THREE.ShaderMaterial({
    uniforms: { map: { value: map } },
    vertexShader: `attribute vec2 off; varying vec2 vUv;
      void main(){ vUv = uv;
        vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
        vec4 wp = modelMatrix * vec4(position, 1.0); wp.xyz += right * off.x; wp.y += off.y;
        gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `#include <packing>
      uniform sampler2D map; varying vec2 vUv;
      void main(){ if (texture2D(map, vUv).a < 0.5) discard; gl_FragColor = packDepthToRGBA(gl_FragCoord.z); }`,
  });
  billboards.push(m);
  return m;
}

export function makeMaterials() {
  M.terrain = new THREE.MeshBasicMaterial({ map: T.ground, vertexColors: true });
  for (const k of ['plaster', 'stone', 'wood', 'sandstone', 'thatch', 'shingle', 'slate', 'flat', 'rock', 'door', 'dark']) M[k] = basic(T[k]);
  M.window = basic(T.window);
  M.water = new THREE.MeshBasicMaterial({ map: T.water, transparent: true, opacity: 0.78, depthWrite: false });
  { const t = T.water.clone(); t.needsUpdate = true; M.river = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.8, depthWrite: false }); outdoor.push(M.river); }
  outdoor.push(M.terrain, M.plaster, M.stone, M.wood, M.sandstone, M.thatch, M.shingle, M.slate, M.flat, M.rock, M.door, M.dark, M.water);
  M.flora = billboardMat(T.flora); M.props = billboardMat(T.props);
  M.shadow = new THREE.ShadowMaterial({ opacity: 0.35, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  M.wallMats = [M.plaster, M.stone, M.wood, M.sandstone];
  // interiors (never tinted by daylight)
  M.in = {};
  for (const k of ['floorwood', 'floorstone', 'dirt', 'cavewall', 'cryptwall', 'ruinwall', 'towerwall', 'plasterin', 'woodwall', 'ceil', 'ceilstone', 'carpet', 'crate', 'altar', 'stone', 'door', 'dark']) M.in[k] = basic(T[k]);
  M.inProps = billboardMat(T.props); billboards.pop(); M.inProps._interior = true;
}
// tint: THREE.Color applied to all outdoor materials; night toggles lit windows
export function setDaylight(tint, night) {
  for (const m of outdoor) m.color.copy(tint);
  for (const m of billboards) m.uniforms.tint.value.copy(tint);
  M.window.map = night ? T.windowLit : T.window;
  M.window.color.setScalar(night ? 1 : 1).multiply(night ? WHITE : tint);
}
const WHITE = new THREE.Color(1, 1, 1);

const SUN = new THREE.Vector3(0.45, 0.8, 0.4).normalize();
export class Bucket {
  constructor() { this.pos = []; this.uv = []; this.col = []; this.idx = []; }
  // a,b,c,d = bottom-left, bottom-right, top-right, top-left
  quad(a, b, c, d, u1 = 1, v1 = 1, shade = null, u0 = 0, v0 = 0) {
    const n = this.pos.length / 3;
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    this.uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    const s = shade === null ? faceShade(a, b, d) : shade;
    for (let i = 0; i < 4; i++) this.col.push(s, s, s);
    this.idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  quadc(a, b, c, d, u1, v1, cols) { // per-vertex brightness
    const n = this.pos.length / 3;
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    this.uv.push(0, 0, u1, 0, u1, v1, 0, v1);
    for (let i = 0; i < 4; i++) this.col.push(cols[i], cols[i], cols[i]);
    this.idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  tri(a, b, c, ua, ub, uc, shade = null) {
    const n = this.pos.length / 3;
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
    const s = shade === null ? faceShade(a, b, c) : shade;
    for (let i = 0; i < 3; i++) this.col.push(s, s, s);
    this.idx.push(n, n + 1, n + 2);
  }
  // axis-aligned box sides (no top/bottom); uv tiles every `tile` meters
  box(x0, z0, x1, z1, y0, y1, tile = 4, top = false) {
    const u = (x1 - x0) / tile, w = (z1 - z0) / tile, v = (y1 - y0) / tile;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], u, v);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], u, v);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], w, v);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], w, v);
    if (top) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], u, w, 1);
  }
  mesh(mat) {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; m.castShadow = true; return m;
  }
}
function faceShade(a, b, d) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  return 0.8 + 0.22 * Math.abs((nx * SUN.x + ny * SUN.y + nz * SUN.z) / l) + (nx / l > 0.5 ? 0.06 : nx / l < -0.5 ? -0.1 : 0);
}
export class BillBucket {
  constructor() { this.pos = []; this.off = []; this.uv = []; this.shade = []; this.idx = []; }
  add(r, x, y, z, scale = 1, shade = 1, flip = false) {
    const n = this.pos.length / 3, w = r.w * scale / 2, h = r.h * scale;
    for (let i = 0; i < 4; i++) { this.pos.push(x, y, z); this.shade.push(shade); }
    this.off.push(-w, 0, w, 0, w, h, -w, h);
    const u0 = flip ? r.u1 : r.u0, u1 = flip ? r.u0 : r.u1;
    this.uv.push(u0, r.v0, u1, r.v0, u1, r.v1, u0, r.v1);
    this.idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  mesh(mat) {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('off', new THREE.Float32BufferAttribute(this.off, 2));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('shade', new THREE.Float32BufferAttribute(this.shade, 1));
    g.setIndex(this.idx);
    g.computeBoundingSphere(); g.boundingSphere.radius += 12;
    const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false;
    if (mat.depth) { m.castShadow = true; m.customDepthMaterial = mat.depth; }
    return m;
  }
}
export function disposeGroup(group) {
  group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  if (group.parent) group.parent.remove(group);
}
