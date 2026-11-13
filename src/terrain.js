// Streaming outdoor terrain: heightfield chunks, flora, forage nodes, buildings and colliders.
import * as THREE from '../vendor/three.module.min.js';
import { RNG, hash2, clamp, lerp, sstep } from './rng.js';
import { BIOMES, B_FOREST, B_DESERT, B_PLAINS, B_MOUNT, B_SWAMP, FORAGE } from './data.js';
import { CHUNK, ckey, HALF } from './world.js';
import { getLayout } from './settlement.js';
import { FLORA, PROPS } from './art.js';
import { M, Bucket, BillBucket, disposeGroup } from './mats.js';
import { addBuilding, addWall, addTower } from './exterior.js';
import { G, dayOf } from './state.js';

const N = 16, S = CHUNK / N, V = N + 1;
export const viewR = () => (G.opts && G.opts.view) || 7;
const lin = (v) => Math.pow(v, 2.2);
const FLORA_SETS = [
  { dens: 0.8, sp: [['oak', 4, 0.45], ['oak2', 3, 0.45], ['pine', 3, 0.4], ['birch', 2, 0.3], ['bush', 2.5, 0], ['rock2', 0.5, 0.5], ['deadtree', 0.3, 0.3], ['grass', 2, 0]] },
  { dens: 0.085, sp: [['cactus', 3, 0.4], ['shrub', 4, 0], ['sandrock', 2, 1.1], ['palm', 0.5, 0.35], ['deadtree', 0.3, 0.3]] },
  { dens: 0.2, sp: [['oak', 0.7, 0.45], ['bush', 1.2, 0], ['grass', 7, 0], ['rock2', 0.6, 0.5], ['birch', 0.4, 0.3]] },
  { dens: 0.24, sp: [['pine', 3, 0.4], ['rock1', 3, 1.1], ['rock2', 2, 0.5], ['deadtree', 0.5, 0.3], ['grass', 1, 0]] },
  { dens: 0.5, sp: [['willow', 3, 0.5], ['reeds', 4, 0], ['deadtree', 2, 0.3], ['bush', 1, 0], ['grass', 1.5, 0]] },
];
const FORAGE_RATE = [3.6, 1.0, 1.9, 1.4, 2.4];
const SAND = [lin(0.78), lin(0.7), lin(0.48)], GRAVEL = [lin(0.33), lin(0.33), lin(0.3)];
const ROCK = [lin(0.4), lin(0.39), lin(0.37)], SNOW = [0.9, 0.92, 0.96], DIRT = [lin(0.42), lin(0.35), lin(0.24)], COBBLE = [lin(0.45), lin(0.43), lin(0.4)], ROAD = [lin(0.5), lin(0.4), lin(0.27)], MUD = [lin(0.2), lin(0.19), lin(0.13)];
const BCOL = BIOMES.map((b) => [b.ground.map(lin), b.ground2.map(lin)]);

export class Terrain {
  constructor(scene, world) {
    this.scene = scene; this.world = world; this.chunks = new Map(); this.queue = []; this.pcx = 1e9; this.pcz = 1e9;
    this.pendingCamps = [];
    this.group = new THREE.Group(); scene.add(this.group);
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(3600, 3600).rotateX(-Math.PI / 2), M.water);
    this.water.position.y = 0; this.water.renderOrder = 2; this.group.add(this.water);
  }
  dispose() { for (const c of this.chunks.values()) disposeGroup(c.group); this.chunks.clear(); this.scene.remove(this.group); }

  update(px, pz, budgetMs = 5, night = false) {
    const cx = Math.floor(px / CHUNK), cz = Math.floor(pz / CHUNK), VIEW_R = viewR();
    if (cx !== this.pcx || cz !== this.pcz) {
      this.pcx = cx; this.pcz = cz; this.queue.length = 0;
      for (let j = -VIEW_R; j <= VIEW_R; j++) for (let i = -VIEW_R; i <= VIEW_R; i++) {
        if (i * i + j * j > (VIEW_R + 0.5) * (VIEW_R + 0.5)) continue;
        if (!this.chunks.has(ckey(cx + i, cz + j))) this.queue.push([i * i + j * j, cx + i, cz + j]);
      }
      this.queue.sort((a, b) => b[0] - a[0]);
      for (const [k, c] of this.chunks) if (Math.abs(c.cx - cx) > VIEW_R + 1 || Math.abs(c.cz - cz) > VIEW_R + 1) { disposeGroup(c.group); this.chunks.delete(k); }
    }
    const t0 = performance.now();
    while (this.queue.length && performance.now() - t0 < budgetMs) { const q = this.queue.pop(); this.build(q[1], q[2]); }
    this.water.position.x = Math.round(px / 32) * 32; this.water.position.z = Math.round(pz / 32) * 32;
    M.water.map.offset.x = performance.now() * 0.00002; M.water.map.repeat.set(450, 450); M.river.map.offset.y = -performance.now() * 0.00012;
    const sh = G.opts && G.opts.shadows ? (G.opts.shadows > 1 ? 3 : 2) : -1;
    for (const c of this.chunks.values()) c.shadowMesh.visible = Math.abs(c.cx - cx) <= sh && Math.abs(c.cz - cz) <= sh;
    if (night !== this.night) { this.night = night; for (const c of this.chunks.values()) if (c.nightMesh) c.nightMesh.visible = night; }
    return this.queue.length;
  }
  // throw away chunks near a point so they are rebuilt (a settlement changed)
  rebuildNear(x, z, r) { for (const [k, c] of this.chunks) { const cx = (c.cx + 0.5) * CHUNK, cz = (c.cz + 0.5) * CHUNK; if (Math.abs(cx - x) < r + CHUNK && Math.abs(cz - z) < r + CHUNK) { disposeGroup(c.group); this.chunks.delete(k); } } this.pcx = 1e9; }
  loadAround(px, pz) { this.pcx = 1e9; while (this.update(px, pz, 50, this.night) > 0); }
  chunkAt(x, z) { return this.chunks.get(ckey(Math.floor(x / CHUNK), Math.floor(z / CHUNK))); }

  groundAt(x, z) {
    const c = this.chunkAt(x, z);
    if (!c) return this.world.height(x, z);
    const fx = (x - c.cx * CHUNK) / S, fz = (z - c.cz * CHUNK) / S;
    const i = clamp(Math.floor(fx), 0, N - 1), j = clamp(Math.floor(fz), 0, N - 1), u = fx - i, v = fz - j, H = c.H;
    const a = H[j * V + i], b = H[j * V + i + 1], d = H[(j + 1) * V + i], e = H[(j + 1) * V + i + 1];
    let g = u + v <= 1 ? a + (b - a) * u + (d - a) * v : e + (d - e) * (1 - u) + (b - e) * (1 - v);
    const bs = this.world.bridgesNear(x, z);
    if (bs) for (const br of bs) { const rx = x - br.x, rz = z - br.z; if (Math.abs(rx * br.dx + rz * br.dz) <= br.half + 0.6 && Math.abs(-rx * br.dz + rz * br.dx) <= 2.8 && g < br.y) g = br.y; }
    return g;
  }
  waterLevel(x, z) { return this.world.waterLevel(x, z); }

  build(cx, cz) {
    const W = this.world, ox = cx * CHUNK, oz = cz * CHUNK, E = V + 2;
    const hs = new Float32Array(E * E), H = new Float32Array(V * V);
    const ba = new Uint8Array(V * V), bb = new Uint8Array(V * V), bt = new Float32Array(V * V), lw = new Float32Array(V * V), locs = new Array(V * V);
    const locSet = new Set(), rs = new Float32Array(V * V);
    for (let j = 0; j < E; j++) for (let i = 0; i < E; i++) {
      const h = W.height(ox + (i - 1) * S, oz + (j - 1) * S); hs[j * E + i] = h;
      if (i > 0 && j > 0 && i <= V && j <= V) { const k = (j - 1) * V + i - 1; H[k] = h; rs[k] = W.rvNear; ba[k] = W.ba; bb[k] = W.bb; bt[k] = W.bt; lw[k] = W.locW; locs[k] = W.inLoc; if (W.inLoc) locSet.add(W.inLoc); }
    }
    const pos = new Float32Array(V * V * 3), col = new Float32Array(V * V * 3), uv = new Float32Array(V * V * 2);
    const nrmY = new Float32Array(V * V), nrm = new Float32Array(V * V * 3);
    for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
      const k = j * V + i, x = ox + i * S, z = oz + j * S, h = H[k];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z; uv[k * 2] = x / 4; uv[k * 2 + 1] = z / 4;
      const dx = hs[(j + 1) * E + i + 2] - hs[(j + 1) * E + i], dz = hs[(j + 2) * E + i + 1] - hs[j * E + i + 1];
      let nx = -dx, ny = 2 * S, nz = -dz; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l; nrmY[k] = ny; nrm[k * 3] = nx; nrm[k * 3 + 1] = ny; nrm[k * 3 + 2] = nz;
      const A = BCOL[ba[k]], Bc = BCOL[bb[k]], t = bt[k];
      const n1 = W.N.n2(x / 70, z / 70) * 0.5 + 0.5, n2 = (hash2(x, z, 3) & 255) / 255;
      let r = lerp(lerp(Bc[0][0], Bc[1][0], n1), lerp(A[0][0], A[1][0], n1), t), g = lerp(lerp(Bc[0][1], Bc[1][1], n1), lerp(A[0][1], A[1][1], n1), t), b = lerp(lerp(Bc[0][2], Bc[1][2], n1), lerp(A[0][2], A[1][2], n1), t);
      const mnt = ba[k] === B_MOUNT ? t : bb[k] === B_MOUNT ? 1 - t : 0;
      const rk = clamp((0.86 - ny) * 5 + mnt * 0.35, 0, 1) * (ba[k] === B_DESERT ? 0.3 : 1);
      r = lerp(r, ROCK[0], rk); g = lerp(g, ROCK[1], rk); b = lerp(b, ROCK[2], rk);
      const sn = sstep(170, 215, h + n1 * 30) * clamp((ny - 0.55) * 4, 0, 1);
      r = lerp(r, SNOW[0], sn); g = lerp(g, SNOW[1], sn); b = lerp(b, SNOW[2], sn);
      const sw = ba[k] === B_SWAMP ? t : bb[k] === B_SWAMP ? 1 - t : 0;
      if (h < 2 && sw < 0.6) { const m = (1 - sstep(0.7, 2, h)) * (1 - sw) * (1 - sstep(-6, -14, h) * 0.5); r = lerp(r, SAND[0], m); g = lerp(g, SAND[1], m); b = lerp(b, SAND[2], m); }
      if (h < 0.15 && sw > 0) { const m = clamp((0.15 - h) * 2, 0, 1) * sw; r = lerp(r, MUD[0], m); g = lerp(g, MUD[1], m); b = lerp(b, MUD[2], m); }
      if (rs[k] === rs[k] && h < rs[k] + 0.4) { r = lerp(r, GRAVEL[0], 0.8); g = lerp(g, GRAVEL[1], 0.8); b = lerp(b, GRAVEL[2], 0.8); }
      const L = locs[k];
      if (L && L.civ) {
        const w = lw[k]; let c = DIRT, a = 0.5 * w;
        if (L.type === 'farm') { const d = Math.hypot(x - L.x, z - L.z); if (d > 28 && d < L.r + 40 && ((x - L.x) * (z - L.z) > 0)) { a = w * 0.85; c = (Math.floor(x / 4) & 1) ? DIRT : [lin(0.5), lin(0.47), lin(0.16)]; } }
        else if (L.type !== 'village') {
          const gi = Math.round((x - L.x) / 12), gj = Math.round((z - L.z) / 12);
          const inC = L.type === 'castle' ? Math.max(Math.abs(x - L.x), Math.abs(z - L.z)) < (L.r - 10) / 1.42 + 4 || Math.abs(x - L.x) < 5 || Math.abs(z - L.z) < 5 : Math.hypot(x - L.x, z - L.z) < L.r * 0.95;
          if (inC && (((gi % 5) + 5) % 5 === 0 || ((gj % 3) + 3) % 3 === 0 || (Math.abs(gi) <= 1 && Math.abs(gj) <= 1))) { c = COBBLE; a = w * 0.95; } else a = w * (inC ? 0.55 : 0.2);
        } else a = w * 0.6 * (1 - sstep(0.3, 1, Math.hypot(x - L.x, z - L.z) / L.r) * 0.6);
        r = lerp(r, c[0], a); g = lerp(g, c[1], a); b = lerp(b, c[2], a);
      } else if (L) { const a = lw[k] * 0.5; r = lerp(r, ROCK[0], a); g = lerp(g, ROCK[1], a); b = lerp(b, ROCK[2], a); }
      const rd = W.roadDist(x, z);
      if (rd < 6) { const a = (1 - sstep(2.5, 6, rd)) * 0.9; r = lerp(r, ROAD[0], a); g = lerp(g, ROAD[1], a); b = lerp(b, ROAD[2], a); }
      const shade = (0.62 + 0.5 * clamp(nx * 0.45 + ny * 0.8 + nz * 0.4, 0, 1)) * (0.9 + n2 * 0.2);
      col[k * 3] = r * shade; col[k * 3 + 1] = g * shade; col[k * 3 + 2] = b * shade;
    }
    const idx = new Uint16Array(N * N * 6); let q = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * V + i, b = a + 1, c = a + V, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere();
    const group = new THREE.Group(); group.matrixAutoUpdate = false;
    const mesh = new THREE.Mesh(geo, M.terrain); mesh.matrixAutoUpdate = false; group.add(mesh);
    const shadowMesh = new THREE.Mesh(geo, M.shadow); shadowMesh.matrixAutoUpdate = false; shadowMesh.receiveShadow = true; shadowMesh.visible = false; shadowMesh.renderOrder = 1; group.add(shadowMesh);
    this.riverMesh(group, rs, ox, oz);
    const c = { cx, cz, H, group, shadowMesh, rs, boxes: [], circles: [], inter: [], flora: [], forage: [], floraMesh: null, propList: [], ba, bt, bb, lw, nrmY };
    this.chunks.set(ckey(cx, cz), c);
    this.genFlora(c, ox, oz);
    this.genStructures(c, locSet, ox, oz);
    this.genPoi(c, ox, oz);
    this.refreshFlora(c);
    this.refreshProps(c);
    this.group.add(group);
    return c;
  }

  // water surface for any river running through the chunk
  riverMesh(group, rs, ox, oz) {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const ks = [j * V + i, j * V + i + 1, (j + 1) * V + i + 1, (j + 1) * V + i]; let sum = 0, n = 0;
      for (const k of ks) if (rs[k] === rs[k]) { sum += rs[k]; n++; }
      if (!n) continue;
      const b = pos.length / 3;
      ks.forEach((k, q) => { const x = ox + (i + (q === 1 || q === 2 ? 1 : 0)) * S, z = oz + (j + (q >= 2 ? 1 : 0)) * S; pos.push(x, rs[k] === rs[k] ? rs[k] : sum / n, z); uv.push(x / 8, z / 8); });
      idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 2);
    }
    if (!idx.length) return;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, M.river); m.matrixAutoUpdate = false; m.renderOrder = 2; group.add(m);
  }

  genFlora(c, ox, oz) {
    const W = this.world, rng = new RNG(hash2(c.cx, c.cz, W.seed ^ 0xf107a));
    const at = (x, z) => clamp(Math.round((z - oz) / S), 0, N) * V + clamp(Math.round((x - ox) / S), 0, N);
    for (let n = 0; n < 78; n++) {
      const x = ox + rng.next() * CHUNK, z = oz + rng.next() * CHUNK, k = at(x, z), r1 = rng.next(), r2 = rng.next(), r3 = rng.next(), r4 = rng.next();
      const b = r1 < c.bt[k] ? c.ba[k] : c.bb[k], set = FLORA_SETS[b];
      if (r2 > set.dens) continue;
      if (c.lw[k] > 0.03 && r3 > 0.04) continue;
      if (c.rs[k] === c.rs[k]) continue; // not in a river
      const y = this.groundAt(x, z);
      if (y < -0.9 || (y < 0.1 && b !== B_SWAMP)) continue;
      if (c.nrmY[k] < 0.72) continue;
      if (W.roadDist(x, z) < 4.5) continue;
      let tot = 0; for (const s of set.sp) tot += s[1];
      let pick = r3 * tot, sp = set.sp[0];
      for (const s of set.sp) { pick -= s[1]; if (pick <= 0) { sp = s; break; } }
      let name = sp[0];
      if (b === B_MOUNT) { if (y > 190 && name !== 'rock1' && name !== 'rock2') continue; if (name === 'pine' && y > 120) name = 'snowpine'; }
      if (y < 0.1 && name !== 'reeds' && name !== 'willow' && name !== 'deadtree') name = 'reeds';
      const sc = 0.8 + r4 * 0.55;
      c.flora.push([name, x, y - 0.05, z, sc, 0.82 + ((r4 * 977) % 1) * 0.3, r1 > 0.5]);
      if (sp[2]) c.circles.push({ x, z, r: sp[2] * sc });
    }
    // forage nodes
    const kc = at(ox + CHUNK / 2, oz + CHUNK / 2), bc = c.ba[kc];
    let cnt = FORAGE_RATE[bc]; cnt = Math.floor(cnt) + (rng.next() < cnt % 1 ? 1 : 0);
    for (let n = 0; n < cnt; n++) {
      const x = ox + rng.next() * CHUNK, z = oz + rng.next() * CHUNK, k = at(x, z), b = c.ba[k];
      const list = FORAGE[BIOMES[b].id], f = list[Math.floor(rng.next() * list.length)], sc = 0.9 + rng.next() * 0.3;
      if (c.lw[k] > 0.03 || c.nrmY[k] < 0.7 || c.rs[k] === c.rs[k]) continue;
      const y = this.groundAt(x, z); if (y < 0.05 && f[0] !== 'boglily') continue;
      if (b === B_MOUNT && y > 200) continue;
      c.forage.push({ kind: 'forage', id: c.cx + ',' + c.cz + ',' + n, x, y, z, ing: f[0], sprite: f[1], tool: f[2], sc });
    }
  }

  genStructures(c, locSet, ox, oz) {
    const key = ckey(c.cx, c.cz), buckets = new Map();
    const get = (name) => { let b = buckets.get(name); if (!b) buckets.set(name, b = new Bucket()); return b; };
    const sign = new BillBucket();
    for (const L of locSet) {
      const lay = getLayout(this.world, L), part = lay.byChunk.get(key);
      if (!part) continue;
      for (const b of part.b) {
        const gy = this.world.height(b.door.x + b.door.nx * 0.5, b.door.z + b.door.nz * 0.5);
        b.gy = gy;
        addBuilding(get, sign, b, gy);
        c.boxes.push({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 });
        if (b.roof === 'castle') for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.boxes.push({ x0: b.x + sx * b.w / 2 - 4, x1: b.x + sx * b.w / 2 + 4, z0: b.z + sz * b.d / 2 - 4, z1: b.z + sz * b.d / 2 + 4 });
        if (b.dtype === 'ruin') { const R = 9; c.boxes.push({ x0: b.x - R, x1: b.x - 1, z0: b.z - R, z1: b.z - R + 0.9 }, { x0: b.x + 2, x1: b.x + R, z0: b.z - R, z1: b.z - R + 0.9 }, { x0: b.x - R, x1: b.x + 1, z0: b.z + R - 0.9, z1: b.z + R }, { x0: b.x + 4, x1: b.x + R, z0: b.z + R - 0.9, z1: b.z + R }, { x0: b.x - R, x1: b.x - R + 0.9, z0: b.z - R, z1: b.z + 3 }, { x0: b.x + R - 0.9, x1: b.x + R, z0: b.z - 4, z1: b.z + R }); }
        if (b.type !== 'barn') c.inter.push({ kind: 'door', x: b.door.x, y: gy + 1.2, z: b.door.z, b, loc: L });
      }
      for (const w of part.w) { addWall(get, w, this.world.height((w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2)); c.boxes.push(w); }
      for (const t of part.t) { addTower(get, t, this.world.height(t.x, t.z)); c.boxes.push({ x0: t.x - t.s / 2, x1: t.x + t.s / 2, z0: t.z - t.s / 2, z1: t.z + t.s / 2 }); }
      for (const p of part.p) {
        const y = this.world.height(p.x, p.z);
        c.propList.push([p.type, p.x, y, p.z, 1]);
        if (p.type === 'lamp') c.propList.push(['lampLit', p.x, y, p.z, 1, true]);
        if (p.solid) c.circles.push({ x: p.x, z: p.z, r: p.solid });
      }
    }
    // bridges whose middle lies in this chunk
    const seenB = new Set();
    for (const gx of [0, CHUNK]) for (const gz of [0, CHUNK]) for (const br of this.world.bridgesNear(ox + gx, oz + gz) || []) {
      if (seenB.has(br) || br.x < ox || br.x >= ox + CHUNK || br.z < oz || br.z >= oz + CHUNK) continue; seenB.add(br);
      const Wd = get('wood'), St = get('stone'), ax = br.dx, az = br.dz, px = -br.dz, pz = br.dx, y = br.y, hl = br.half + 0.6;
      const P = (u, v, yy) => [br.x + ax * u + px * v, yy, br.z + az * u + pz * v];
      Wd.quad(P(-hl, 2.7, y), P(hl, 2.7, y), P(hl, -2.7, y), P(-hl, -2.7, y), hl / 2, 1.35, 1);
      Wd.quad(P(-hl, 2.7, y - 0.45), P(hl, 2.7, y - 0.45), P(hl, -2.7, y - 0.45), P(-hl, -2.7, y - 0.45), hl / 2, 1.35, 0.5);
      for (const s of [-1, 1]) {
        Wd.quad(P(-hl, s * 2.7, y - 0.45), P(hl, s * 2.7, y - 0.45), P(hl, s * 2.7, y), P(-hl, s * 2.7, y), hl / 2, 0.12, 0.7);
        Wd.quad(P(-hl, s * 2.6, y + 0.75), P(hl, s * 2.6, y + 0.75), P(hl, s * 2.6, y + 1), P(-hl, s * 2.6, y + 1), hl / 2, 0.08, 0.9);
        for (let u = -hl; u <= hl + 0.01; u += (2 * hl) / Math.max(2, Math.round(hl / 2.5))) Wd.quad(P(u - 0.12, s * 2.6, y), P(u + 0.12, s * 2.6, y), P(u + 0.12, s * 2.6, y + 1), P(u - 0.12, s * 2.6, y + 1), 0.06, 0.25, 0.8);
      }
      for (const u of br.half > 12 ? [-br.half * 0.4, br.half * 0.4] : [0]) { // stone piers
        St.quad(P(u - 0.7, 2.2, y - 6), P(u + 0.7, 2.2, y - 6), P(u + 0.7, 2.2, y - 0.45), P(u - 0.7, 2.2, y - 0.45), 0.35, 1.4); St.quad(P(u - 0.7, -2.2, y - 6), P(u + 0.7, -2.2, y - 6), P(u + 0.7, -2.2, y - 0.45), P(u - 0.7, -2.2, y - 0.45), 0.35, 1.4);
        St.quad(P(u - 0.7, -2.2, y - 6), P(u - 0.7, 2.2, y - 6), P(u - 0.7, 2.2, y - 0.45), P(u - 0.7, -2.2, y - 0.45), 1.1, 1.4); St.quad(P(u + 0.7, -2.2, y - 6), P(u + 0.7, 2.2, y - 6), P(u + 0.7, 2.2, y - 0.45), P(u + 0.7, -2.2, y - 0.45), 1.1, 1.4);
      }
    }
    for (const [name, b] of buckets) { const m = b.mesh(M[name]); if (m) c.group.add(m); }
    const sm = sign.mesh(M.props); if (sm) c.group.add(sm);
  }

  genPoi(c, ox, oz) {
    const pois = this.world.poisNear(ox + CHUNK / 2, oz + CHUNK / 2, CHUNK / 2);
    for (const p of pois) {
      if (p.x < ox || p.x >= ox + CHUNK || p.z < oz || p.z >= oz + CHUNK) continue;
      const rng = new RNG(p.seed), put = (type, dx, dz, solid, sc = 1) => { const x = p.x + dx, z = p.z + dz, y = this.world.height(x, z); c.propList.push([type, x, y, z, sc]); if (solid) c.circles.push({ x, z, r: solid }); return { x, y, z }; };
      const y = this.world.height(p.x, p.z);
      if (p.type === 'shrine') { put('shrine', 0, 0, 0.6); c.inter.push({ kind: 'shrine', x: p.x, y: y + 1.2, z: p.z, poi: p }); }
      else if (p.type === 'stones') { for (let i = 0; i < 6; i++) put('stone', Math.cos(i * 1.047) * 6, Math.sin(i * 1.047) * 6, 0.5, 0.9 + rng.next() * 0.3); put('stone', 0, 0, 0.6, 1.3); c.inter.push({ kind: 'stones', x: p.x, y: y + 1.4, z: p.z, poi: p }); }
      else if (p.type === 'ore') { for (let i = 0; i < 3; i++) { const q = put('ore', rng.range(-7, 7), rng.range(-7, 7), 0.7); c.inter.push({ kind: 'ore', id: 'ore' + p.id + '_' + i, x: q.x, y: q.y + 0.7, z: q.z, tier: rng.weighted(p.biome === B_MOUNT ? [[0, 5], [1, 3.5], [2, 2], [3, 1], [4, 0.3]] : [[0, 6], [1, 2]]), coal: rng.chance(0.25) }); } }
      else if (p.type === 'cache') { put('cart', 2.5, 0, 1.2); const q = put('chest', -0.5, 0.8, 0.5); c.inter.push({ kind: 'chest', id: 'poi' + p.id, x: q.x, y: q.y + 0.6, z: q.z, tier: 1 + (p.seed % 3), lock: p.seed % 5 < 2 ? 1 + (p.seed % 3) : 0, respawn: 12 }); }
      else if (p.type === 'camp') { put('tent', -3.5, -1, 1.4); put('tent', 3, -2.5, 1.4); put('campfire', 0, 1.5, 0.5); const q = put('chest', -2, 3.5, 0.5); c.inter.push({ kind: 'chest', id: 'poi' + p.id, x: q.x, y: q.y + 0.6, z: q.z, tier: 2, lock: p.seed % 3 ? 0 : 2, respawn: 10 }); this.pendingCamps.push(p); }
      else if (p.type === 'ring') { const list = FORAGE[BIOMES[p.biome].id], f = list.find((e) => e[1].startsWith('mushroom')) || list[0]; for (let i = 0; i < 7; i++) { const x = p.x + Math.cos(i * 0.9) * 3.2, z = p.z + Math.sin(i * 0.9) * 3.2; c.forage.push({ kind: 'forage', id: 'ring' + p.id + '_' + i, x, y: this.world.height(x, z), z, ing: f[0], sprite: f[1], tool: f[2], sc: 1.1 }); } }
    }
  }

  refreshFlora(c) {
    if (c.floraMesh) { c.floraMesh.geometry.dispose(); c.group.remove(c.floraMesh); }
    const bb = new BillBucket(), day = dayOf(), hv = G.save ? G.save.harvested : {};
    for (const f of c.flora) bb.add(FLORA[f[0]], f[1], f[2], f[3], f[4], f[5], f[6]);
    for (const n of c.forage) { n.gone = hv[n.id] !== undefined && day - hv[n.id] < 3; if (!n.gone) bb.add(FLORA[n.sprite], n.x, n.y - 0.03, n.z, n.sc, 1.05); }
    c.floraMesh = bb.mesh(M.flora); if (c.floraMesh) c.group.add(c.floraMesh);
  }
  refreshProps(c) {
    if (c.propMesh) { c.propMesh.geometry.dispose(); c.group.remove(c.propMesh); }
    if (c.nightMesh) { c.nightMesh.geometry.dispose(); c.group.remove(c.nightMesh); c.nightMesh = null; }
    const bb = new BillBucket(), nb = new BillBucket();
    for (const p of c.propList) (p[5] ? nb : bb).add(PROPS[p[0]], p[1], p[2] - 0.03, p[3], p[4], 1);
    c.propMesh = bb.mesh(M.props); if (c.propMesh) c.group.add(c.propMesh);
    c.nightMesh = nb.mesh(M.props); if (c.nightMesh) { c.nightMesh.visible = !!this.night; c.nightMesh.renderOrder = 1; c.group.add(c.nightMesh); }
  }
  setProp(c, x, z, from, to) { for (const p of c.propList) if (p[0] === from && Math.abs(p[1] - x) < 0.1 && Math.abs(p[3] - z) < 0.1) p[0] = to; this.refreshProps(c); }

  // push a circle (x,z,r) out of solids; returns [x,z]
  collide(x, z, r) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    for (let pass = 0; pass < 2; pass++) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const c = this.chunks.get(ckey(cx + i, cz + j)); if (!c) continue;
      for (const b of c.boxes) {
        if (x < b.x0 - r || x > b.x1 + r || z < b.z0 - r || z > b.z1 + r) continue;
        const nx = clamp(x, b.x0, b.x1), nz = clamp(z, b.z0, b.z1); let dx = x - nx, dz = z - nz; const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) { const d = Math.sqrt(d2); x = nx + dx / d * r; z = nz + dz / d * r; }
        else { const l = x - b.x0, rr = b.x1 - x, t = z - b.z0, bo = b.z1 - z, m = Math.min(l, rr, t, bo); if (m === l) x = b.x0 - r; else if (m === rr) x = b.x1 + r; else if (m === t) z = b.z0 - r; else z = b.z1 + r; }
      }
      for (const o of c.circles) { const dx = x - o.x, dz = z - o.z, rr = r + o.r, d2 = dx * dx + dz * dz; if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2); x = o.x + dx / d * rr; z = o.z + dz / d * rr; } }
    }
    return [x, z];
  }
  blocked(x, z, r) { const p = this.collide(x, z, r); return Math.abs(p[0] - x) > 0.01 || Math.abs(p[1] - z) > 0.01; }
  // gather interactables near a point
  interactables(x, z, out) {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const c = this.chunks.get(ckey(cx + i, cz + j)); if (!c) continue; for (const o of c.inter) out.push(o); for (const o of c.forage) if (!o.gone) out.push(o); }
    return out;
  }
}
export { HALF };
