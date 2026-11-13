// Interiors of buildings and dungeons: tile-grid generation, meshing, collision and pathing.
import * as THREE from '../vendor/three.module.min.js';
import { RNG, hash2, clamp } from './rng.js';
import { DUNGEONS, DEN_MOBS, MONSTERS, BUILDINGS } from './data.js';
import { PROPS } from './art.js';
import { M, Bucket, BillBucket } from './mats.js';
import { G, dayOf } from './state.js';

const WALL = 0, FLOOR = 1, DOOR = 2;

export class Level {
  constructor(W, H, T, wallH) {
    this.W = W; this.H = H; this.T = T; this.wallH = wallH; this.grid = new Uint8Array(W * H);
    this.light = new Float32Array(W * H); this.floorMat = new Uint8Array(W * H);
    this.rooms = []; this.props = []; this.inter = []; this.circles = []; this.lights = []; this.doors = []; this.spots = []; this.mobs = [];
    this.outdoor = false; this.taken = new Set(); this.flow = new Int16Array(W * H); this.flowKey = -1;
  }
  at(tx, tz) { return tx < 0 || tz < 0 || tx >= this.W || tz >= this.H ? WALL : this.grid[tz * this.W + tx]; }
  set(tx, tz, v) { if (tx > 0 && tz > 0 && tx < this.W - 1 && tz < this.H - 1) this.grid[tz * this.W + tx] = v; }
  cx(tx) { return (tx + 0.5) * this.T; }
  tile(v) { return Math.floor(v / this.T); }
  groundAt() { return 0; }
  solidAt(x, z) { return this.at(Math.floor(x / this.T), Math.floor(z / this.T)) !== FLOOR; }
  collide(x, z, r) {
    const T = this.T, tx = Math.floor(x / T), tz = Math.floor(z / T);
    for (let pass = 0; pass < 2; pass++) for (let j = tz - 1; j <= tz + 1; j++) for (let i = tx - 1; i <= tx + 1; i++) {
      if (this.at(i, j) === FLOOR) continue;
      const x0 = i * T, x1 = x0 + T, z0 = j * T, z1 = z0 + T;
      const nx = clamp(x, x0, x1), nz = clamp(z, z0, z1), dx = x - nx, dz = z - nz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); x = nx + dx / d * r; z = nz + dz / d * r; }
      else { const l = x - x0, rr = x1 - x, t = z - z0, b = z1 - z, m = Math.min(l, rr, t, b); if (m === l) x = x0 - r; else if (m === rr) x = x1 + r; else if (m === t) z = z0 - r; else z = z1 + r; }
    }
    for (const o of this.circles) { const dx = x - o.x, dz = z - o.z, rr = r + o.r, d2 = dx * dx + dz * dz; if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2); x = o.x + dx / d * rr; z = o.z + dz / d * rr; } }
    return [x, z];
  }
  blocked(x, z, r) { const p = this.collide(x, z, r); return Math.abs(p[0] - x) > 0.01 || Math.abs(p[1] - z) > 0.01; }
  los(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / (this.T * 0.4));
    for (let i = 1; i < n; i++) { const t = i / n; if (this.solidAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return false; }
    return true;
  }
  interactables(x, z, out) { for (const o of this.inter) if (!o.gone) out.push(o); return out; }
  // BFS distance field from the player's tile, used by monsters to path around walls
  updateFlow(px, pz) {
    const tx = this.tile(px), tz = this.tile(pz), key = tz * this.W + tx;
    if (key === this.flowKey) return; this.flowKey = key;
    const f = this.flow, W = this.W; f.fill(-1);
    if (this.at(tx, tz) !== FLOOR) return;
    const q = [key]; f[key] = 0;
    for (let h = 0; h < q.length; h++) {
      const k = q[h], d = f[k]; if (d > 40) continue;
      for (const n of [k - 1, k + 1, k - W, k + W]) if (this.grid[n] === FLOOR && f[n] < 0) { f[n] = d + 1; q.push(n); }
    }
  }
  // next waypoint toward the player from (x,z)
  step(x, z) {
    const tx = this.tile(x), tz = this.tile(z), W = this.W, k = tz * W + tx, f = this.flow, d = f[k];
    if (d <= 0) return null;
    let best = d, bx = tx, bz = tz;
    for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = f[(tz + j) * W + tx + i]; if (v >= 0 && v < best) { best = v; bx = tx + i; bz = tz + j; } }
    return [this.cx(bx), this.cx(bz)];
  }
  randomFloor(rng, room) {
    for (let t = 0; t < 60; t++) {
      const tx = room ? rng.int(room.x0, room.x1) : rng.int(1, this.W - 2), tz = room ? rng.int(room.z0, room.z1) : rng.int(1, this.H - 2);
      if (this.at(tx, tz) === FLOOR && !this.taken.has(tz * this.W + tx)) return [tx, tz];
    }
    return null;
  }
  addProp(name, x, z, o = {}) {
    const p = [name, x, o.y || 0, z, o.sc || 1];
    this.props.push(p);
    if (o.solid) this.circles.push({ x, z, r: o.solid, p });
    if (o.light) this.lights.push({ x, z, r: o.light, v: o.lv || 0.9 });
    if (o.inter) { const it = Object.assign({ x, y: (o.y || 0) + (PROPS[name] ? PROPS[name].h : 1) * (o.sc || 1) * 0.5, z, prop: p }, o.inter); this.inter.push(it); return it; }
    return p;
  }
  // put a prop on a free tile of a room; wall=true hugs a wall
  furnish(rng, room, name, o = {}) {
    for (let t = 0; t < 40; t++) {
      const tx = rng.int(room.x0, room.x1), tz = rng.int(room.z0, room.z1), k = tz * this.W + tx;
      if (this.at(tx, tz) !== FLOOR || this.taken.has(k)) continue;
      const wl = this.at(tx - 1, tz) === WALL, wr = this.at(tx + 1, tz) === WALL, wu = this.at(tx, tz - 1) === WALL, wd = this.at(tx, tz + 1) === WALL;
      if (o.wall && !(wl || wr || wu || wd)) continue;
      if (o.center && (wl || wr || wu || wd) && t < 25) continue;
      this.taken.add(k);
      let x = this.cx(tx), z = this.cx(tz); const off = this.T * 0.5 - (o.gap || 0.55);
      if (o.wall) { if (wu) z -= off; else if (wl) x -= off; else if (wr) x += off; else z += off; }
      return this.addProp(name, x, z, o);
    }
    return null;
  }
  bakeLight(ambient) {
    const W = this.W, T = this.T;
    for (let tz = 0; tz < this.H; tz++) for (let tx = 0; tx < W; tx++) {
      if (this.grid[tz * W + tx] === WALL) continue;
      let l = ambient; const x = this.cx(tx), z = this.cx(tz);
      for (const s of this.lights) { const d = Math.hypot(s.x - x, s.z - z); if (d < s.r) l += s.v * (1 - d / s.r); }
      this.light[tz * W + tx] = Math.min(1.15, l);
    }
  }
  build(mats) { // mats: {floor:[names], wall, ceil}
    const B = new Map(), get = (n) => { let b = B.get(n); if (!b) B.set(n, b = new Bucket()); return b; };
    const T = this.T, W = this.W, h = this.wallH, vr = h / T;
    const group = this.group = new THREE.Group();
    for (let tz = 0; tz < this.H; tz++) for (let tx = 0; tx < W; tx++) {
      const g = this.grid[tz * W + tx]; if (g === WALL) continue;
      const x0 = tx * T, x1 = x0 + T, z0 = tz * T, z1 = z0 + T, l = this.light[tz * W + tx];
      get(mats.floor[this.floorMat[tz * W + tx]]).quad([x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], 1, 1, l);
      get(mats.ceil).quad([x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1], 1, 1, l * 0.8);
      const Wb = get(mats.wall);
      if (this.at(tx, tz - 1) === WALL) Wb.quad([x0, 0, z0], [x1, 0, z0], [x1, h, z0], [x0, h, z0], 1, vr, l * 0.95);
      if (this.at(tx, tz + 1) === WALL) Wb.quad([x1, 0, z1], [x0, 0, z1], [x0, h, z1], [x1, h, z1], 1, vr, l * 0.95);
      if (this.at(tx - 1, tz) === WALL) Wb.quad([x0, 0, z1], [x0, 0, z0], [x0, h, z0], [x0, h, z1], 1, vr, l * 0.8);
      if (this.at(tx + 1, tz) === WALL) Wb.quad([x1, 0, z0], [x1, 0, z1], [x1, h, z1], [x1, h, z0], 1, vr, l * 0.8);
    }
    for (const [n, b] of B) { const m = b.mesh(M.in[n]); if (m) group.add(m); }
    for (const d of this.doors) this.doorMesh(d);
    this.rebuildProps();
    return group;
  }
  doorMesh(d) {
    const T = this.T, b = new Bucket(), x = d.tx * T, z = d.tz * T, c = T / 2, h = Math.min(this.wallH, 2.9);
    if (d.horiz) { b.quad([x, 0, z + c], [x + T, 0, z + c], [x + T, h, z + c], [x, h, z + c], 1, 1, 0.85); if (h < this.wallH) get2(b, [x, h, z + c], [x + T, h, z + c], this.wallH); }
    else { b.quad([x + c, 0, z], [x + c, 0, z + T], [x + c, h, z + T], [x + c, h, z], 1, 1, 0.85); if (h < this.wallH) get2(b, [x + c, h, z], [x + c, h, z + T], this.wallH); }
    d.mesh = b.mesh(M.in.door); this.group.add(d.mesh);
  }
  openDoor(d) { this.grid[d.tz * this.W + d.tx] = FLOOR; d.open = true; d.gone = true; if (d.mesh) { this.group.remove(d.mesh); d.mesh.geometry.dispose(); } this.flowKey = -1; }
  rebuildProps() {
    if (this.propMesh) { this.group.remove(this.propMesh); this.propMesh.geometry.dispose(); }
    const bb = new BillBucket();
    for (const p of this.props) if (p[0]) bb.add(PROPS[p[0]], p[1], p[2], p[3], p[4], 1);
    this.propMesh = bb.mesh(M.inProps); if (this.propMesh) { this.propMesh.frustumCulled = false; this.group.add(this.propMesh); }
  }
  dispose() { this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
}
function get2(b, p, q, top) { b.quad(p, q, [q[0], top, q[2]], [p[0], top, p[2]], 1, 0.3, 0.5); }

function carve(L, x0, z0, x1, z1, mat = 0) {
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { L.set(x, z, FLOOR); L.floorMat[z * L.W + x] = mat; }
  const r = { x0, z0, x1, z1 }; return r;
}
// split [a0..a1] into n room spans separated by 1-tile walls
function spans(a0, a1, n, rng) {
  const total = a1 - a0 + 1 - (n - 1); const out = []; let base = Math.floor(total / n), extra = total - base * n, a = a0;
  const order = rng.shuffle([...Array(n).keys()]), bonus = new Set(order.slice(0, extra));
  for (let i = 0; i < n; i++) { const w = base + (bonus.has(i) ? 1 : 0); out.push([a, a + w - 1]); a += w + 1; }
  return out;
}

const PLANS = {
  house: (n) => ({ mainW: n > 3 ? 9 : 7, mainD: 3, bands: [n - 1], bd: 3, corridor: false }),
  farmhouse: (n) => ({ mainW: 9, mainD: 4, bands: [n - 1], bd: 3, corridor: false }),
  barn: () => ({ mainW: 7, mainD: 7, bands: [] }),
  trader: () => ({ mainW: 11, mainD: 4, bands: [4], bd: 3, corridor: false }),
  alchemist: () => ({ mainW: 9, mainD: 4, bands: [3], bd: 3, corridor: false }),
  arcanist: () => ({ mainW: 9, mainD: 4, bands: [3], bd: 3, corridor: false }),
  smithy: () => ({ mainW: 9, mainD: 5, bands: [5], bd: 3, corridor: true, left: 1, right: 1, sw: 3 }),
  inn: () => ({ mainW: 11, mainD: 5, bands: [7], bd: 3, corridor: true, left: 2, right: 2, sw: 3 }),
  guild: () => ({ mainW: 9, mainD: 6, bands: [4], bd: 4, corridor: true, left: 1, right: 1, sw: 4 }),
  church: () => ({ mainW: 9, mainD: 17, bands: [] }),
  castle: () => ({ mainW: 11, mainD: 11, bands: [7, 6], bd: 4, corridor: true, left: 4, right: 4, sw: 5 }),
};
const ROOM_USE = {
  house: ['bedroom', 'kitchen', 'storage'], farmhouse: ['bedroom', 'kitchen', 'storage'],
  trader: ['storage', 'bedroom', 'storage', 'kitchen'], alchemist: ['study', 'bedroom', 'storage'], arcanist: ['study', 'bedroom', 'study'],
  smithy: ['storage', 'bedroom', 'storage', 'kitchen', 'bedroom', 'armory', 'storage'],
  inn: ['guest', 'guest', 'guest', 'guest', 'guest', 'guest', 'guest', 'kitchen', 'storage', 'bedroom', 'guest'],
  guild: ['armory', 'study', 'bedroom', 'bedroom', 'storage', 'armory'],
  castle: ['bedroom', 'study', 'armory', 'royal', 'kitchen', 'storage', 'bedroom', 'barracks', 'barracks', 'study', 'storage', 'bedroom', 'armory', 'kitchen', 'guest', 'guest', 'study', 'storage', 'barracks', 'bedroom', 'guest'],
};

export function genBuilding(world, L, b) {
  const rng = new RNG(hash2(L.id, b.i, L.seed ^ 0x1e7e));
  const def = BUILDINGS[b.type], nRooms = rng.int(def.rooms[0], def.rooms[1]);
  const P = (PLANS[b.type] || PLANS.house)(nRooms);
  const sw = P.left || P.right ? P.sw : 0, bd = P.bd || 3;
  let innerW = P.mainW + (P.left ? sw + 1 : 0) + (P.right ? sw + 1 : 0);
  for (const n of P.bands) innerW = Math.max(innerW, n * 2 + n - 1);
  const W = innerW + 2, bandsH = P.bands.reduce((a) => a + bd + 1 + (P.corridor ? 2 : 0), 0), H = P.mainD + bandsH + 2;
  const tall = b.type === 'church' ? 7 : b.type === 'castle' ? 5.5 : b.type === 'guild' || b.type === 'inn' ? 3.6 : 3;
  const lv = new Level(W, H, 2.5, tall);
  lv.kind = 'building'; lv.loc = L; lv.b = b; lv.name = b.name; lv.fogFar = b.type === 'church' || b.type === 'castle' ? 70 : 34;
  const mz1 = H - 2, mz0 = mz1 - P.mainD + 1, mx0 = 1 + (P.left ? sw + 1 : 0) + Math.floor((innerW - (P.left ? sw + 1 : 0) - (P.right ? sw + 1 : 0) - P.mainW) / 2), mx1 = mx0 + P.mainW - 1;
  const stoneFloor = b.type === 'church' || b.type === 'castle' || b.type === 'smithy' ? 1 : 0;
  const main = carve(lv, P.left || P.right || !P.bands.length ? mx0 : 1, mz0, P.left || P.right || !P.bands.length ? mx1 : W - 2, mz1, stoneFloor); main.use = 'main';
  lv.rooms.push(main);
  const uses = (ROOM_USE[b.type] || ROOM_USE.house).slice(); let ui = 0;
  const addRoom = (x0, z0, x1, z1) => { const r = carve(lv, x0, z0, x1, z1, 0); r.use = uses[ui++ % uses.length] || 'storage'; lv.rooms.push(r); return r; };
  // side wings
  for (const side of ['left', 'right']) {
    const n = P[side]; if (!n) continue;
    const x0 = side === 'left' ? mx0 - 1 - sw : mx1 + 2, x1 = x0 + sw - 1;
    for (const [a, c] of spans(mz0, mz1, n, rng)) { addRoom(x0, a, x1, c); const dz = rng.int(a, c); lv.set(side === 'left' ? mx0 - 1 : mx1 + 1, dz, FLOOR); lv.taken.add(dz * W + (side === 'left' ? mx0 : mx1)); lv.taken.add(dz * W + (side === 'left' ? mx0 - 2 : mx1 + 2)); }
  }
  // bands of rooms behind the main room, optionally each fronted by a corridor
  let z = mz0 - 1, prev = null; // z = wall row above whatever is below
  const door = (dx, dz, vert) => { lv.set(dx, dz, FLOOR); if (vert) { lv.taken.add((dz + 1) * W + dx); lv.taken.add((dz - 1) * W + dx); } else { lv.taken.add(dz * W + dx - 1); lv.taken.add(dz * W + dx + 1); } };
  P.bands.forEach((n, bi) => {
    if (P.corridor) {
      const c = carve(lv, 1, z - 1, W - 2, z - 1, stoneFloor); c.use = 'corridor'; lv.rooms.push(c);
      if (!prev) { const links = main.x1 - main.x0 > 8 ? 2 : 1; for (let i = 0; i < links; i++) door(Math.round(main.x0 + (i + 1) * (main.x1 - main.x0) / (links + 1)), z, true); }
      else for (const r of [prev[0], prev[prev.length - 1], prev[prev.length >> 1]]) door(rng.int(r.x0, r.x1), z, true);
      z -= 2;
    }
    const z1 = z - 1, z0 = z1 - bd + 1, rooms = [];
    for (const [a, c] of spans(1, W - 2, n, rng)) {
      const r = addRoom(a, z0, c, z1); rooms.push(r);
      const lo = P.corridor ? a : Math.max(a, main.x0), hi = P.corridor ? c : Math.min(c, main.x1);
      if (lo <= hi) door(rng.int(lo, hi), z, true); else door(a > main.x1 ? a - 1 : c + 1, rng.int(z0, z1), false);
    }
    prev = rooms; z = z0 - 1;
  });
  // entrance
  const ex = Math.round((main.x0 + main.x1) / 2), ez = H - 1;
  lv.spawn = { x: lv.cx(ex), z: lv.cx(mz1), yaw: 0 };
  lv.taken.add(mz1 * W + ex); lv.taken.add((mz1 - 1) * W + ex);
  lv.inter.push({ kind: 'exit', x: lv.cx(ex), y: 1.2, z: mz1 * 2.5 + 2.4, label: 'Leave' });
  lv.exitDoor = { x: lv.cx(ex), z: (mz1 + 1) * 2.5 - 0.04 };
  furnishBuilding(lv, rng, b, main);
  lv.bakeLight(b.type === 'church' || b.type === 'castle' ? 0.6 : 0.55);
  const wallM = b.type === 'castle' || b.type === 'church' ? 'stone' : b.wall === 2 || b.type === 'barn' || b.type === 'inn' ? 'woodwall' : b.wall === 3 ? 'ruinwall' : 'plasterin';
  lv.build({ floor: ['floorwood', 'floorstone', 'carpet', 'dirt'], wall: wallM, ceil: b.type === 'castle' || b.type === 'church' ? 'ceilstone' : 'ceil' });
  // exit door quad
  const db = new Bucket(), d = lv.exitDoor; db.quad([d.x - 0.7, 0, d.z], [d.x + 0.7, 0, d.z], [d.x + 0.7, 2.3, d.z], [d.x - 0.7, 2.3, d.z], 1, 1, 1); lv.group.add(db.mesh(M.in.door));
  return lv;
}

function furnishBuilding(lv, rng, b, main) {
  const t = b.type, cx = (main.x0 + main.x1 + 1) / 2 * lv.T, W = lv.W;
  const spot = (role, x, z, room) => lv.spots.push({ role, x, z, room });
  const torchRow = (room, n) => { for (let i = 0; i < n; i++) lv.furnish(rng, room, 'torch', { wall: true, gap: 0.12, y: 1.35, light: 9, lv: 0.6 }); };
  const keeperZ = lv.cx(main.z0) + 0.2;
  if (BUILDINGS[t].keeper && t !== 'church') {
    // counter across the back of the main room with the keeper behind it
    const kx = cx - (t === 'smithy' ? 3 : 0);
    for (const dx of [-1.2, 1.2]) lv.addProp('counter', kx + dx, keeperZ + 1.5, { solid: 0.75 });
    spot('keeper', kx, keeperZ, main);
    for (let dx = -1; dx <= 1; dx++) { lv.taken.add(main.z0 * W + lv.tile(kx) + dx); lv.taken.add((main.z0 + 1) * W + lv.tile(kx) + dx); }
  }
  if (t === 'smithy') {
    lv.addProp('forge', cx + 6, lv.cx(main.z0) - 0.3, { solid: 1.0, light: 12, lv: 0.8, inter: { kind: 'forge', label: 'Use Forge' } });
    lv.addProp('anvil', cx + 3.2, lv.cx(main.z0 + 1), { solid: 0.6, inter: { kind: 'forge', label: 'Use Anvil' } });
    for (let i = 0; i < 3; i++) lv.furnish(rng, main, 'rack', { wall: true, gap: 0.3 });
    lv.furnish(rng, main, 'barrel', { wall: true, solid: 0.5 });
  } else if (t === 'inn') {
    for (let i = 0; i < 4; i++) { const p = lv.furnish(rng, main, 'table', { center: true, solid: 0.7 }); if (p) { lv.addProp('chair', p[1] - 1.1, p[3] + 0.1); lv.addProp('chair', p[1] + 1.1, p[3] - 0.1); spot('patron', p[1] + (i % 2 ? 1.2 : -1.2), p[3] + 0.5, main); } }
    for (let i = 0; i < 3; i++) lv.furnish(rng, main, 'barrel', { wall: true, solid: 0.5 });
    spot('server', cx + 3, lv.cx(main.z0 + 2), main);
  } else if (t === 'trader' || t === 'alchemist' || t === 'arcanist') {
    for (let i = 0; i < 4; i++) lv.furnish(rng, main, 'shelf', { wall: true, gap: 0.3 });
    lv.furnish(rng, main, t === 'trader' ? 'crate' : 'cauldron', { wall: t === 'trader', solid: 0.6, inter: t === 'alchemist' ? { kind: 'alchemy', label: 'Use Alchemy Station' } : null });
    if (t === 'trader') { lv.furnish(rng, main, 'barrel', { wall: true, solid: 0.5 }); lv.furnish(rng, main, 'sack', { wall: true }); }
    if (t === 'arcanist') { lv.furnish(rng, main, 'crystal', { wall: true, light: 6, lv: 0.4 }); lv.furnish(rng, main, 'candle', { wall: true, light: 8, lv: 0.5 }); }
  } else if (t === 'guild') {
    for (let i = 0; i < 3; i++) { const p = lv.furnish(rng, main, 'table', { center: true, solid: 0.7 }); if (p) { lv.addProp('chair', p[1] - 1.1, p[3]); spot('member', p[1] + 1.2, p[3] + 0.4, main); } }
    lv.furnish(rng, main, 'banner', { wall: true, gap: 0.1, y: 0.9 }); lv.furnish(rng, main, 'banner', { wall: true, gap: 0.1, y: 0.9 }); lv.furnish(rng, main, 'rack', { wall: true, gap: 0.3 });
    const bd = lv.furnish(rng, main, 'signpost', { wall: true, gap: 0.4, inter: { kind: 'board', label: 'Read Notice Board' } });
  } else if (t === 'church') {
    for (let z = main.z0 + 4; z < main.z1 - 1; z += 2) for (const dx of [-5.5, 5.5]) lv.addProp('bench', cx + dx, lv.cx(z), { solid: 0.6, sc: 1.3 });
    for (let z = main.z0; z <= main.z1; z++) lv.floorMat[z * W + lv.tile(cx)] = 2;
    lv.addProp('pedestalEmpty', cx, lv.cx(main.z0) + 0.2, { solid: 0.5, sc: 1.2 });
    for (const dx of [-2.2, 2.2]) lv.addProp('candle', cx + dx, lv.cx(main.z0) + 0.3, { light: 12, lv: 0.6 });
    for (const dx of [-5, 5]) lv.addProp('banner', cx + dx, lv.cx(main.z0) - 1.1, { y: 1.5, sc: 1.4 });
    for (let z = main.z0 + 3; z < main.z1; z += 4) for (const dx of [-10.8, 10.8]) lv.addProp('torch', cx + dx, lv.cx(z), { y: 1.6, light: 11, lv: 0.55 });
    spot('keeper', cx, lv.cx(main.z0 + 1) + 0.6, main); spot('acolyte', cx - 4, lv.cx(main.z0 + 2), main);
  } else if (t === 'castle') {
    for (let z = main.z0; z <= main.z1; z++) lv.floorMat[z * W + lv.tile(cx)] = 2;
    lv.addProp('throne', cx - 1.5, lv.cx(main.z0) - 0.3, { solid: 0.6 }); lv.addProp('throne', cx + 1.5, lv.cx(main.z0) - 0.3, { solid: 0.6 });
    spot('king', cx - 1.5, lv.cx(main.z0) + 0.9, main); spot('queen', cx + 1.5, lv.cx(main.z0) + 0.9, main); spot('steward', cx + 4.5, lv.cx(main.z0 + 1), main);
    for (let z = main.z0 + 1; z <= main.z1; z += 3) for (const s of [-1, 1]) { lv.addProp('banner', cx + s * 13.2, lv.cx(z), { y: 1.6, sc: 1.5 }); lv.addProp('candle', cx + s * 4, lv.cx(z), { light: 11, lv: 0.6, solid: 0.3 }); spot('guard', cx + s * 6.5, lv.cx(z), main); }
    for (let i = 0; i < 7; i++) lv.taken.add((main.z0) * W + main.x0 + i + 2);
  } else if (t === 'barn') {
    for (let i = 0; i < 5; i++) lv.furnish(rng, main, 'hay', { solid: 0.8 }); for (let i = 0; i < 3; i++) lv.furnish(rng, main, 'sack', { wall: true }); lv.furnish(rng, main, 'crate', { wall: true, solid: 0.6 });
  } else { // homes
    const p = lv.furnish(rng, main, 'table', { center: true, solid: 0.7 }); if (p) lv.addProp('chair', p[1] - 1.1, p[3]);
    lv.furnish(rng, main, 'shelf', { wall: true, gap: 0.3 }); lv.furnish(rng, main, 'barrel', { wall: true, solid: 0.5 });
  }
  torchRow(main, t === 'castle' ? 0 : t === 'church' ? 0 : 2);
  // other rooms
  for (const r of lv.rooms) {
    if (r === main) continue;
    if (r.use === 'corridor') { lv.lights.push({ x: lv.cx(r.x0 + 2), z: lv.cx(r.z0), r: 9, v: 0.4 }, { x: lv.cx(r.x1 - 2), z: lv.cx(r.z0), r: 9, v: 0.4 }); continue; }
    const u = r.use;
    if (u === 'bedroom' || u === 'guest' || u === 'royal' || u === 'barracks') {
      const nb = u === 'barracks' ? 3 : 1;
      for (let i = 0; i < nb; i++) lv.furnish(rng, r, 'bed', { wall: true, gap: 0.5, solid: 0.7, inter: { kind: 'bed', guest: u === 'guest', label: 'Sleep' } });
      lv.furnish(rng, r, u === 'royal' ? 'shelf' : 'crate', { wall: true, gap: 0.4, solid: 0.5 }); lv.furnish(rng, r, 'candle', { wall: true, light: 8, lv: 0.5 });
      if (u === 'royal') lv.furnish(rng, r, 'banner', { wall: true, gap: 0.1, y: 0.8 });
    } else if (u === 'kitchen') {
      lv.furnish(rng, r, 'cauldron', { wall: true, solid: 0.6, light: 7, lv: 0.4 }); lv.furnish(rng, r, 'table', { solid: 0.7 }); lv.furnish(rng, r, 'barrel', { wall: true, solid: 0.5 }); lv.furnish(rng, r, 'sack', { wall: true });
      if (t === 'inn') lv.spots.push({ role: 'cook', x: lv.cx(r.x0), z: lv.cx(r.z1), room: r });
    } else if (u === 'study') { lv.furnish(rng, r, 'shelf', { wall: true, gap: 0.3 }); lv.furnish(rng, r, 'shelf', { wall: true, gap: 0.3 }); lv.furnish(rng, r, 'table', { solid: 0.7 }); lv.furnish(rng, r, 'candle', { wall: true, light: 8, lv: 0.5 }); }
    else if (u === 'armory') { lv.furnish(rng, r, 'rack', { wall: true, gap: 0.3 }); lv.furnish(rng, r, 'rack', { wall: true, gap: 0.3 }); lv.furnish(rng, r, 'crate', { wall: true, solid: 0.6 }); lv.furnish(rng, r, 'torch', { wall: true, gap: 0.12, y: 1.35, light: 8, lv: 0.5 }); }
    else { for (let i = 0; i < 2; i++) lv.furnish(rng, r, rng.pick(['crate', 'barrel', 'sack']), { wall: true, solid: 0.5 }); lv.furnish(rng, r, 'crate', { solid: 0.6 }); lv.lights.push({ x: lv.cx(r.x0), z: lv.cx(r.z0), r: 7, v: 0.25 }); }
  }
}

// ---------- Dungeons ----------
export function dungeonFloors(L) { const D = DUNGEONS[L.type], r = new RNG(L.seed ^ 0xf100); return r.int(D.floors[0], D.floors[1]); }

export function genDungeon(world, L, floor) {
  const D = DUNGEONS[L.type], floors = dungeonFloors(L), last = floor === floors - 1;
  const rng = new RNG(hash2(L.id, floor, L.seed ^ 0xd06));
  let lv;
  if (D.gen === 'rooms') lv = genRooms(rng, L, last);
  else if (D.gen === 'cave') lv = genCave(rng, L, last);
  else lv = genTower(rng, L, floor, last);
  lv.kind = 'dungeon'; lv.loc = L; lv.floor = floor; lv.floors = floors; lv.last = last; lv.dark = true; lv.fogFar = L.type === 'tower' ? 17 : 13;
  lv.name = L.name + (floors > 1 ? ' - ' + (L.type === 'tower' ? 'Floor ' : 'Depth ') + (floor + 1) : '');
  const up = L.type === 'tower';
  // exits and stairs
  const e = lv.entrance; lv.spawn = { x: lv.cx(e[0]), z: lv.cx(e[1]) + 0.95, yaw: Math.PI };
  lv.taken.add(e[1] * lv.W + e[0]);
  if (floor === 0) lv.addProp(up ? 'stairsDown' : 'stairsUp', lv.cx(e[0]), lv.cx(e[1]) - 0.9, { sc: 0.9, inter: { kind: 'exit', label: 'Leave ' + L.name } });
  else lv.addProp(up ? 'stairsDown' : 'stairsUp', lv.cx(e[0]), lv.cx(e[1]) - 0.9, { sc: 0.9, inter: { kind: 'stairs', dir: -1, label: up ? 'Descend' : 'Ascend' } });
  lv.lights.push({ x: lv.cx(e[0]), z: lv.cx(e[1]), r: 10, v: 0.5 });
  const far = lv.farthest;
  lv.taken.add(far[1] * lv.W + far[0]);
  if (!last) { lv.addProp(up ? 'stairsUp' : 'stairsDown', lv.cx(far[0]), lv.cx(far[1]), { sc: 0.9, inter: { kind: 'stairs', dir: 1, label: up ? 'Ascend' : 'Descend' } }); lv.lights.push({ x: lv.cx(far[0]), z: lv.cx(far[1]), r: 8, v: 0.4 }); }
  stockDungeon(lv, rng, L, D, last);
  lv.bakeLight(0.3);
  const mats = { mine: ['dirt', 'cavewall', 'ceil'], crypt: ['floorstone', 'cryptwall', 'ceilstone'], ruin: ['floorstone', 'ruinwall', 'ceilstone'], cave: ['dirt', 'cavewall', 'cavewall'], den: ['dirt', 'cavewall', 'cavewall'], tower: ['floorwood', 'towerwall', 'ceil'] }[L.type];
  lv.build({ floor: [mats[0], 'floorstone', 'carpet', 'dirt'], wall: mats[1], ceil: mats[2] });
  return lv;
}

function bfsFar(lv, sx, sz) {
  const W = lv.W, d = new Int16Array(W * lv.H).fill(-1), q = [sz * W + sx]; d[q[0]] = 0; let best = q[0];
  for (let h = 0; h < q.length; h++) { const k = q[h]; if (d[k] > d[best]) best = k; for (const n of [k - 1, k + 1, k - W, k + W]) if (lv.grid[n] === FLOOR && d[n] < 0) { d[n] = d[k] + 1; q.push(n); } }
  lv.dist = d; return [best % W, Math.floor(best / W)];
}

function genRooms(rng, L, last) {
  const S = 39 + L.tier * 2, lv = new Level(S, S, 3, 3.4), rooms = [];
  const n = rng.int(6, 8) + Math.floor(L.tier / 2);
  for (let t = 0; t < 300 && rooms.length < n; t++) {
    const w = rng.int(3, 6), h = rng.int(3, 6), x0 = rng.int(2, S - w - 3), z0 = rng.int(2, S - h - 3);
    if (rooms.some((r) => x0 <= r.x1 + 2 && x0 + w - 1 >= r.x0 - 2 && z0 <= r.z1 + 2 && z0 + h - 1 >= r.z0 - 2)) continue;
    rooms.push({ x0, z0, x1: x0 + w - 1, z1: z0 + h - 1 });
  }
  rooms.sort((a, b) => a.x0 + a.z0 - b.x0 - b.z0);
  const cen = (r) => [Math.floor((r.x0 + r.x1) / 2), Math.floor((r.z0 + r.z1) / 2)];
  for (const r of rooms) { carve(lv, r.x0, r.z0, r.x1, r.z1); lv.rooms.push(r); }
  const tunnel = (a, b) => { let [x, z] = cen(a); const [tx, tz] = cen(b); const hf = rng.chance(0.5); const go = (horiz) => { if (horiz) while (x !== tx) { x += Math.sign(tx - x); lv.set(x, z, FLOOR); } else while (z !== tz) { z += Math.sign(tz - z); lv.set(x, z, FLOOR); } }; go(hf); go(!hf); };
  for (let i = 1; i < rooms.length; i++) tunnel(rooms[i - 1], rooms[i]);
  for (let i = 0; i < 2; i++) { const a = rng.pick(rooms), b = rng.pick(rooms); if (a !== b) tunnel(a, b); }
  lv.entrance = cen(rooms[0]);
  // locked vaults off room walls
  for (let v = 0, t = 0; v < 2 && t < 60; t++) {
    const r = rng.pick(rooms), side = rng.int(0, 3), horiz = side < 2;
    const dx = horiz ? rng.int(r.x0, r.x1) : side === 2 ? r.x0 - 1 : r.x1 + 1, dz = horiz ? (side === 0 ? r.z0 - 1 : r.z1 + 1) : rng.int(r.z0, r.z1);
    const ox = horiz ? 0 : side === 2 ? -1 : 1, oz = horiz ? (side === 0 ? -1 : 1) : 0;
    const vx = dx + ox * 2, vz = dz + oz * 2; let ok = true;
    for (let j = -2; j <= 2 && ok; j++) for (let i = -2; i <= 2; i++) { const x = vx + i, z = vz + j; if (x < 1 || z < 1 || x >= S - 1 || z >= S - 1 || lv.at(x, z) !== WALL) { ok = false; break; } }
    if (!ok || lv.at(dx, dz) !== WALL || lv.at(dx - oz, dz - ox) !== WALL || lv.at(dx + oz, dz + ox) !== WALL) continue;
    const vr = carve(lv, vx - 1, vz - 1, vx + 1, vz + 1); vr.vault = true; lv.rooms.push(vr);
    lv.grid[dz * S + dx] = DOOR;
    const d = { kind: 'ldoor', tx: dx, tz: dz, horiz: horiz, x: lv.cx(dx), y: 1.3, z: lv.cx(dz), lock: clamp(L.tier + rng.int(-1, 1), 1, 5), id: 'door' + L.id + '_' + dx + '_' + dz };
    lv.doors.push(d); lv.inter.push(d); v++;
  }
  lv.farthest = bfsFar(lv, lv.entrance[0], lv.entrance[1]);
  if (lv.at(lv.farthest[0], lv.farthest[1]) !== FLOOR) lv.farthest = cen(rooms[rooms.length - 1]);
  lv.bossRoom = rooms.find((r) => lv.farthest[0] >= r.x0 && lv.farthest[0] <= r.x1 && lv.farthest[1] >= r.z0 && lv.farthest[1] <= r.z1) || rooms[rooms.length - 1];
  return lv;
}

function genCave(rng, L, last) {
  const S = 36 + L.tier * 3 + (L.type === 'den' ? -6 : 0);
  for (let attempt = 0; attempt < 12; attempt++) {
    const lv = new Level(S, S, 3, 3.2); let g = lv.grid;
    for (let z = 1; z < S - 1; z++) for (let x = 1; x < S - 1; x++) g[z * S + x] = rng.chance(0.54) ? FLOOR : WALL;
    for (let it = 0; it < 5; it++) {
      const n = new Uint8Array(S * S);
      for (let z = 1; z < S - 1; z++) for (let x = 1; x < S - 1; x++) { let c = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (g[(z + j) * S + x + i] === WALL) c++; n[z * S + x] = c >= 5 ? WALL : FLOOR; }
      g.set(n);
    }
    // keep the largest connected region
    const seen = new Int32Array(S * S).fill(-1); let bestId = -1, bestN = 0, id = 0;
    for (let k = 0; k < S * S; k++) if (g[k] === FLOOR && seen[k] < 0) { const q = [k]; seen[k] = id; for (let h = 0; h < q.length; h++) for (const m of [q[h] - 1, q[h] + 1, q[h] - S, q[h] + S]) if (g[m] === FLOOR && seen[m] < 0) { seen[m] = id; q.push(m); } if (q.length > bestN) { bestN = q.length; bestId = id; } id++; }
    if (bestN < S * S * 0.22) continue;
    for (let k = 0; k < S * S; k++) if (g[k] === FLOOR && seen[k] !== bestId) g[k] = WALL;
    let ent = null; for (let z = S - 2; z > 0 && !ent; z--) for (let x = 1; x < S - 1; x++) if (g[z * S + x] === FLOOR && g[(z - 1) * S + x] === FLOOR) { ent = [x, z]; break; }
    lv.entrance = ent; lv.farthest = bfsFar(lv, ent[0], ent[1]);
    lv.rooms.push({ x0: 1, z0: 1, x1: S - 2, z1: S - 2 });
    const f = lv.farthest; lv.bossRoom = { x0: Math.max(1, f[0] - 2), z0: Math.max(1, f[1] - 2), x1: Math.min(S - 2, f[0] + 2), z1: Math.min(S - 2, f[1] + 2) };
    return lv;
  }
  return genRooms(rng, L, last);
}

function genTower(rng, L, floor, last) {
  const S = 15, lv = new Level(S, S, 3, 3.6), c = 7;
  for (let z = 1; z < S - 1; z++) for (let x = 1; x < S - 1; x++) if (Math.hypot(x - c, z - c) < 6.3) lv.grid[z * S + x] = FLOOR;
  // inner partitions
  const n = rng.int(3, 6);
  for (let i = 0; i < n; i++) { const horiz = rng.chance(0.5), a = rng.int(3, 11), s = rng.int(2, 8), len = rng.int(2, 4); for (let k = 0; k < len; k++) { const x = horiz ? s + k : a, z = horiz ? a : s + k; if (Math.hypot(x - c, z - c) < 5 && !(x === c && z === c)) lv.grid[z * S + x] = WALL; } }
  const a0 = (floor % 2) * Math.PI + 0.3;
  const pt = (a) => { for (let r = 5.2; r > 0; r -= 0.4) { const x = Math.round(c + Math.cos(a) * r), z = Math.round(c + Math.sin(a) * r); if (lv.grid[z * S + x] === FLOOR) return [x, z]; } return [c, c]; };
  lv.grid[c * S + c] = FLOOR;
  lv.entrance = pt(a0); lv.farthest = pt(a0 + Math.PI);
  // ensure connectivity by carving a path through the center
  const link = (p) => { let [x, z] = p; while (x !== c || z !== c) { if (x !== c) x += Math.sign(c - x); else z += Math.sign(c - z); lv.grid[z * S + x] = FLOOR; } };
  link(lv.entrance); link(lv.farthest);
  bfsFar(lv, lv.entrance[0], lv.entrance[1]);
  for (let k = 0; k < S * S; k++) if (lv.grid[k] === FLOOR && lv.dist[k] < 0) lv.grid[k] = WALL;
  lv.rooms.push({ x0: 1, z0: 1, x1: S - 2, z1: S - 2 }); lv.bossRoom = { x0: c - 2, z0: c - 2, x1: c + 2, z1: c + 2 };
  return lv;
}

function stockDungeon(lv, rng, L, D, last) {
  const W = lv.W, save = G.save, rec = save.cleared[L.id];
  const killed = rec && dayOf() - rec.day < 7 ? (rec.k[lv.floor] || []) : [];
  if (rec && dayOf() - rec.day >= 7) delete save.cleared[L.id];
  const type = L.type, den = type === 'den' ? DEN_MOBS[L.biome] : null;
  const table = (den ? den.mobs : D.mobs).filter((m) => MONSTERS[m[0]].lvl <= 3 + L.tier * 2.2);
  const far = (min) => { for (let t = 0; t < 80; t++) { const p = lv.randomFloor(rng); if (p && lv.dist[p[1] * W + p[0]] >= min) return p; } return null; };
  // decor & light
  const deco = { mine: ['crate', 'barrel', 'rubble', 'rubble', 'sack', 'cart'], crypt: ['urn', 'bones', 'coffin', 'web', 'candle'], ruin: ['pillar', 'rubble', 'urn', 'bones', 'web'], cave: ['bones', 'crystal', 'web', 'rubble'], den: ['bones', 'bones', 'rubble', 'web'], tower: ['shelf', 'candle', 'crate', 'cauldron', 'urn'] }[type];
  const area = lv.grid.reduce((a, v) => a + (v === FLOOR ? 1 : 0), 0);
  for (let i = 0; i < area / 14; i++) { const p = lv.randomFloor(rng); if (!p) continue; const name = rng.pick(deco); const wall = lv.at(p[0] - 1, p[1]) === WALL || lv.at(p[0] + 1, p[1]) === WALL || lv.at(p[0], p[1] - 1) === WALL || lv.at(p[0], p[1] + 1) === WALL; if (!wall && (name === 'shelf' || name === 'web' || name === 'coffin')) continue; lv.taken.add(p[1] * W + p[0]); lv.addProp(name, lv.cx(p[0]) + rng.range(-0.6, 0.6), lv.cx(p[1]) + rng.range(-0.6, 0.6), { solid: name === 'pillar' || name === 'coffin' || name === 'crate' ? 0.45 : 0, light: name === 'candle' || name === 'crystal' ? 7 : 0, lv: 0.45, y: name === 'web' ? 1.2 : 0 }); }
  for (let i = 0; i < area / 22; i++) { const p = lv.randomFloor(rng); if (!p) continue; let ox = 0, oz = 0; if (lv.at(p[0] - 1, p[1]) === WALL) ox = -1.38; else if (lv.at(p[0] + 1, p[1]) === WALL) ox = 1.38; else if (lv.at(p[0], p[1] - 1) === WALL) oz = -1.38; else if (lv.at(p[0], p[1] + 1) === WALL) oz = 1.38; else continue; lv.addProp('torch', lv.cx(p[0]) + ox, lv.cx(p[1]) + oz, { y: 1.3, light: 10, lv: 0.75 }); }
  // chests
  let ci = 0;
  const chest = (p, tierAdd, lock) => { if (!p) return; lv.taken.add(p[1] * W + p[0]); lv.addProp('chest', lv.cx(p[0]), lv.cx(p[1]), { solid: 0.5, inter: { kind: 'chest', id: 'd' + L.id + '_' + lv.floor + '_' + (ci++), tier: L.tier + tierAdd, lock, respawn: 14 } }); };
  for (let i = 0; i < rng.int(1, 3); i++) chest(far(8), 0, rng.chance(0.35) ? clamp(L.tier + rng.int(-1, 0), 1, 5) : 0);
  for (const r of lv.rooms) if (r.vault) { chest([r.x0 + 1, r.z0 + 1], 1, 0); const p = lv.randomFloor(rng, r); if (p) chest(p, 1, 0); }
  // ore: a few veins in caves, many in mines - richer and deeper the further down you go
  const veins = type === 'mine' ? rng.int(8, 12) + lv.floor * 2 : type === 'cave' || type === 'den' ? rng.int(1, 4) : 0;
  for (let i = 0; i < veins; i++) {
    const p = far(type === 'mine' ? 3 : 5); if (!p) continue;
    const coal = rng.chance(type === 'mine' ? 0.28 : 0.15), tier = clamp(Math.round(L.tier - 1.4 + lv.floor * 0.7 + rng.range(-0.9, 0.7)), 0, 4);
    lv.taken.add(p[1] * W + p[0]); lv.addProp('ore', lv.cx(p[0]), lv.cx(p[1]), { solid: 0.7, inter: { kind: 'ore', id: 'dore' + L.id + '_' + lv.floor + '_' + i, tier, coal } });
  }
  // monsters
  const count = Math.min(type === 'mine' ? 9 : 20, Math.round(area / (type === 'tower' ? 18 : type === 'mine' ? 70 : 42) + L.tier * 0.8 + rng.range(0, 2)));
  for (let i = 0; i < count; i++) { const p = far(6); if (!p || !table.length) continue; const id = rng.weighted(table); if (!killed.includes(i)) lv.mobs.push({ id, x: lv.cx(p[0]), z: lv.cx(p[1]), idx: i }); }
  const fb = lv.farthest;
  if (last) {
    const bossId = den ? den.boss : D.boss[(L.seed >>> 4) % D.boss.length];
    const bp = lv.randomFloor(rng, lv.bossRoom) || fb;
    if (!killed.includes(999)) lv.mobs.push({ id: bossId, x: lv.cx(bp[0]), z: lv.cx(bp[1]), idx: 999, boss: true });
    chest(lv.randomFloor(rng, lv.bossRoom), 1, 0);
    // quest relic
    let q = null, qo = null;
    for (const qq of save.quests) { if (qq.state !== 'active') continue; const o = qq.steps ? qq.steps[qq.step] : qq; if (o && (o.kind || qq.type) === 'fetch' && o.dungeon === L.id && !o.have) { q = qq; qo = o; break; } }
    if (q) { const p = lv.randomFloor(rng, lv.bossRoom) || fb; lv.taken.add(p[1] * W + p[0]); lv.addProp('pedestal', lv.cx(p[0]), lv.cx(p[1]), { solid: 0.4, light: 8, lv: 0.6, inter: { kind: 'relic', quest: q.id, label: 'Take the ' + qo.item } }); }
  }
}
