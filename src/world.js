// World generation: biome regions, terrain height, locations, roads, points of interest.
import { RNG, makeNoise, hash2, hash01, clamp, lerp, sstep } from './rng.js';
import { BIOMES, B_MOUNT, B_SWAMP, B_DESERT, B_FOREST, B_PLAINS, DUNGEONS } from './data.js';
import { locName } from './names.js';

export const BCELL = 6000;
export let WORLD = 48000, HALF = 24000, BN = 8;
// World size in km (a multiple of the 6 km biome cell). Importers see the new values through live bindings.
export function setWorldSize(km) { BN = clamp(Math.round(km / 6), 2, 14); WORLD = BN * BCELL; HALF = WORLD / 2; }
export const MIN_GAP = 650; // minimum distance between the edges of two locations
const LGRID = 1500, RGRID = 400, POI_CELL = 300, VGRID = 200, BGRID = 256;

export function locRadius(type, count) {
  if (type === 'farm') return 60;
  if (type === 'village') return 46 + count * 4;
  if (LOC_DUNGEON[type]) return 26;
  const cells = count * 15 / 8 + (type === 'castle' ? 100 : 6);
  if (type === 'castle') return (Math.sqrt(cells) * 6 * 1.08 + 26) * 1.42 + 10;
  return Math.sqrt(cells * 144 / Math.PI) * 1.15 + 22;
}
const LOC_DUNGEON = { crypt: 1, cave: 1, den: 1, ruin: 1, tower: 1 };

export class World {
  constructor(seed, sizeKm = 48) {
    setWorldSize(sizeKm);
    this.seed = seed >>> 0; this.size = WORLD / 1000; this.eg = WORLD / 250; this.band = clamp(WORLD * 0.07, 1000, 3200);
    this.rivers = []; this.vgrid = new Map(); this.bridges = []; this.bgrid = new Map(); this.rvD = 0; this.rvS = 0; this.rvW = 0; this.rvNear = NaN;
    const n = makeNoise(this.seed), n2 = makeNoise(this.seed ^ 0x5bd1e995);
    this.N = n; this.N2 = n2;
    this.ba = 0; this.bb = 0; this.bt = 1;
    this.genBiomes();
    this.locs = []; this.lgrid = new Map();
    this.genLocations();
    this.genRivers();
    this.genRoads();
    this.genBridges();
  }

  genBiomes() {
    const rng = new RNG(this.seed ^ 0xb10e);
    const W = [[B_PLAINS, 28], [B_FOREST, 28], [B_DESERT, 15], [B_MOUNT, 15], [B_SWAMP, 14]];
    const sites = this.sites = [];
    for (let cz = 0; cz < BN; cz++) for (let cx = 0; cx < BN; cx++) {
      let b;
      const nb = [];
      if (cx > 0) nb.push(sites[cz * BN + cx - 1].b);
      if (cz > 0) nb.push(sites[(cz - 1) * BN + cx].b);
      if (nb.length && rng.chance(0.38)) b = rng.pick(nb); else b = rng.weighted(W);
      sites.push({ x: -HALF + (cx + 0.5 + rng.range(-0.2, 0.2)) * BCELL, z: -HALF + (cz + 0.5 + rng.range(-0.2, 0.2)) * BCELL, b });
    }
    // make sure every biome is represented a few times
    for (let b = 0; b < 5; b++) {
      let have = sites.filter((s) => s.b === b).length;
      const want = Math.max(BN > 2 ? 1 : 0, Math.floor(sites.length / 16));
      for (let guard = 0; have < want && guard < 400; guard++) { const s = rng.pick(sites); const c = sites.filter((q) => q.b === s.b).length; if (s.b !== b && c > Math.max(1, sites.length / 8)) { s.b = b; have++; } }
    }
  }

  // Sets this.ba (dominant biome), this.bb (neighbor biome), this.bt (weight of ba, 0.5..1)
  biomeAt(x, z) {
    const N = this.N2;
    const wx = x + N.n2(x / 2300, z / 2300) * 750 + N.n2(x / 310 + 40, z / 310) * 70;
    const wz = z + N.n2(x / 2300 + 91, z / 2300 - 37) * 750 + N.n2(x / 310, z / 310 + 77) * 70;
    const cx = clamp(Math.floor((wx + HALF) / BCELL), 0, BN - 1), cz = clamp(Math.floor((wz + HALF) / BCELL), 0, BN - 1);
    let d1 = 1e18, d2 = 1e18, s1 = null, s2 = null;
    for (let j = cz - 1; j <= cz + 1; j++) {
      if (j < 0 || j >= BN) continue;
      for (let i = cx - 1; i <= cx + 1; i++) {
        if (i < 0 || i >= BN) continue;
        const s = this.sites[j * BN + i];
        const d = (s.x - wx) * (s.x - wx) + (s.z - wz) * (s.z - wz);
        if (d < d1) { d2 = d1; s2 = s1; d1 = d; s1 = s; } else if (d < d2) { d2 = d; s2 = s; }
      }
    }
    this.ba = s1.b; this.bb = s2 ? s2.b : s1.b;
    const t = clamp((Math.sqrt(d2) - Math.sqrt(d1)) / 520, 0, 1);
    this.bt = 0.5 + 0.5 * t * t * (3 - 2 * t);
    return this.ba;
  }

  biomeH(b, x, z, g, d) {
    switch (b) {
      case B_FOREST: return 15 + g * 16 + d * 3.5;
      case B_DESERT: { const r = 1 - Math.abs(this.N2.n2(x / 170, z / 95)); return 9 + g * 7 + r * r * 6 + d * 0.5; }
      case B_PLAINS: return 6 + g * 4 + d * 0.9;
      case B_MOUNT: return 45 + this.N.ridged(x / 850, z / 850, 5) * 300 + g * 30 + d * 6;
      default: return -0.1 + g * 1.4 + d * 1.5;
    }
  }

  rawHeight(x, z) {
    this.biomeAt(x, z);
    const a = this.ba, b = this.bb, t = this.bt;
    const g = this.N.fbm(x / 900, z / 900, 4), d = this.N.fbm(x / 110, z / 110, 3);
    let h = this.biomeH(a, x, z, g, d);
    if (a !== b && t < 0.999) h = lerp(this.biomeH(b, x, z, g, d), h, t);
    // lakes in the lowlands
    const ln = this.N2.n2(x / 1500 + 50, z / 1500 - 20);
    if (ln > 0.4) { const ok = (q) => (q === B_FOREST || q === B_PLAINS || q === B_SWAMP ? 1 : 0), k = sstep(0.4, 0.56, ln) * (ok(a) * t + ok(b) * (1 - t)); if (k > 0) h = lerp(h, Math.min(h, -4), k); }
    // the sea surrounds the land; islands rise from the shallows
    const B = this.band, e0 = Math.min(HALF - Math.abs(x), HALF - Math.abs(z));
    if (e0 < B * 2) {
      const e = e0 + this.N2.n2(x / 1700 + 9, z / 1700 - 4) * B * 0.45 + this.N2.n2(x / 380, z / 380 + 3) * B * 0.08, f = sstep(B * 0.55, B, e);
      if (f < 1) {
        const isl = Math.max(0, this.N.n2(x / 650 + 31, z / 650 + 17) - 0.3) * 70 * sstep(B * 0.04, B * 0.22, e0) * (1 - sstep(B * 0.36, B * 0.6, e));
        h = lerp(-14 + isl + d * 1.5, Math.max(h, 0.6), f);
      }
    }
    return h;
  }

  // Nearest river at a point. Fills rvD (distance to centerline), rvS (water surface), rvW (half-width).
  riverAt(x, z) {
    const cell = this.vgrid.get(lkey(Math.floor((x + HALF) / VGRID), Math.floor((z + HALF) / VGRID)));
    if (!cell) return false;
    let best = 1e9, found = false;
    for (const s of cell) {
      const vx = s[2] - s[0], vz = s[3] - s[1], wx = x - s[0], wz = z - s[1];
      const t = clamp((wx * vx + wz * vz) / (vx * vx + vz * vz), 0, 1), dx = wx - vx * t, dz = wz - vz * t, d = Math.sqrt(dx * dx + dz * dz), w = s[6] + (s[7] - s[6]) * t;
      if (d - w < best) { best = d - w; this.rvD = d; this.rvW = w; this.rvS = s[4] + (s[5] - s[4]) * t; found = true; }
    }
    return found && best < 66;
  }
  // water surface height at a point: a river's level, else sea level
  waterLevel(x, z) { return this.riverAt(x, z) && this.rvD < this.rvW + 1.5 ? this.rvS : 0; }

  // final terrain height (locations flatten the ground around them). Leaves biome fields set.
  height(x, z) {
    let h = this.rawHeight(x, z);
    this.rvNear = NaN;
    if (this.riverAt(x, z)) { // carve the river bed and its banks
      const d = this.rvD, w = this.rvW, s = this.rvS;
      if (d < w + 6) this.rvNear = s;
      if (d < w) { const k = d / w; h = Math.min(h, s - 0.35 - 1.5 * (1 - k * k)); }
      else if (h > s) { const bank = 8 + clamp((h - s) * 1.3, 0, 55); if (d < w + bank) { const t = (d - w) / bank; h = Math.min(h, lerp(s + 0.15, h, t * t * (3 - 2 * t))); } }
      const bc = this.bgrid.get(lkey(Math.floor((x + HALF) / BGRID), Math.floor((z + HALF) / BGRID)));
      if (bc) for (const b of bc) { // raise the approaches to each bridge
        const rx = x - b.x, rz = z - b.z, au = Math.abs(rx * b.dx + rz * b.dz), av = Math.abs(-rx * b.dz + rz * b.dx);
        if (av < 6 && au > b.half - 3 && au < b.half + 16) h = lerp(h, b.y - 0.12, sstep(b.half - 3, b.half, au) * (1 - sstep(b.half + 4, b.half + 16, au)) * (1 - sstep(3.5, 6, av)));
      }
    }
    const cell = this.lgrid.get(lkey(Math.floor((x + HALF) / LGRID), Math.floor((z + HALF) / LGRID)));
    this.inLoc = null; this.locW = 0;
    if (cell) for (const L of cell) {
      const dx = x - L.x, dz = z - L.z, d = Math.sqrt(dx * dx + dz * dz), m = L.civ ? 140 : 45;
      if (d < L.r + m) {
        const w = 1 - sstep(L.r, L.r + m, d);
        h = lerp(h, L.y + clamp((h - L.y) * 0.05, -1.2, 1.2), w);
        if (w > this.locW) { this.locW = w; this.inLoc = L; }
      }
    }
    return h;
  }

  locAt(x, z, margin = 0) {
    const cell = this.lgrid.get(lkey(Math.floor((x + HALF) / LGRID), Math.floor((z + HALF) / LGRID)));
    if (cell) for (const L of cell) { const dx = x - L.x, dz = z - L.z; if (dx * dx + dz * dz < (L.r + margin) * (L.r + margin)) return L; }
    return null;
  }

  genLocations() {
    const rng = new RNG(this.seed ^ 0x10c5);
    const edge = HALF - 500, area = (WORLD / 48000) ** 2, cnt = (n, min) => Math.max(min, Math.round(n * area));
    const tryPlace = (type, count, tries, civ) => {
      let placed = 0;
      for (let t = 0; t < tries && placed < count; t++) {
        const nb = civ ? (type === 'farm' ? rng.int(2, 5) : type === 'village' ? rng.int(5, 15) : type === 'town' ? rng.int(20, 50)
          : type === 'city' ? Math.round(100 + 400 * Math.pow(rng.next(), 1.8)) : rng.int(500, 1000)) : 0;
        let ltype = type;
        const x = rng.range(-edge, edge), z = rng.range(-edge, edge);
        if (this.rawHeight(x, z) < (civ ? -0.9 : 1)) continue; // not in the sea or a lake
        const b = this.ba;
        if (civ) {
          if (!rng.chance(BIOMES[b].civ)) continue;
        } else ltype = rng.weighted(BIOMES[b].dungeons);
        const r = locRadius(ltype, nb);
        if (Math.abs(x) + r > edge || Math.abs(z) + r > edge) continue;
        let ok = true;
        for (const L of this.locs) { const dx = L.x - x, dz = L.z - z, m = L.r + r + MIN_GAP; if (dx * dx + dz * dz < m * m) { ok = false; break; } }
        if (!ok) continue;
        if (civ) { // keep settlements off mountainsides
          for (let a = 0; a < 6 && ok; a++) { if (this.biomeAt(x + Math.cos(a * 1.05) * (r + 200), z + Math.sin(a * 1.05) * (r + 200)) === B_MOUNT) ok = false; if (this.rawHeight(x + Math.cos(a * 1.05) * (r + 30), z + Math.sin(a * 1.05) * (r + 30)) < -0.9) ok = false; }
          this.biomeAt(x, z);
          if (!ok) continue;
        }
        const id = this.locs.length;
        const lr = new RNG(hash2(id, 77, this.seed));
        const L = { id, type: ltype, civ, x, z, r, count: nb, biome: b, seed: hash2(id, 1234, this.seed), name: locName(lr, ltype), tier: 0 };
        L.y = Math.max(this.rawHeight(x, z), civ ? 1.4 : 0.8);
        if (!civ) L.tier = lr.weighted([[1, 5], [2, 4.5], [3, 3.5], [4, 2.2], [5, 1.2]]);
        this.locs.push(L); placed++;
      }
    };
    tryPlace('castle', cnt(4, 1), 6000, true);
    tryPlace('city', cnt(14, 1), 8000, true);
    tryPlace('town', cnt(50, 3), 12000, true);
    tryPlace('village', cnt(130, 5), 6000 + 14000 * area, true);
    tryPlace('farm', cnt(260, 8), 8000 + 26000 * area, true);
    tryPlace('dungeon', cnt(420, 14), 10000 + 36000 * area, false);
    // unique names
    const seen = new Set();
    for (const L of this.locs) {
      const lr = new RNG(L.seed ^ 5);
      while (seen.has(L.name)) L.name = locName(lr, L.type);
      seen.add(L.name);
    }
    for (const L of this.locs) {
      const m = L.r + (L.civ ? 140 : 45);
      for (let cz = Math.floor((L.z - m + HALF) / LGRID); cz <= Math.floor((L.z + m + HALF) / LGRID); cz++)
        for (let cx = Math.floor((L.x - m + HALF) / LGRID); cx <= Math.floor((L.x + m + HALF) / LGRID); cx++) {
          const k = lkey(cx, cz); if (!this.lgrid.has(k)) this.lgrid.set(k, []); this.lgrid.get(k).push(L);
        }
    }
    // every place owes fealty to the nearest castle
    this.castles = this.locs.filter((l) => l.type === 'castle');
    for (const L of this.locs) { let bd = 1e18; for (const C of this.castles) { const d = (C.x - L.x) ** 2 + (C.z - L.z) ** 2; if (d < bd) { bd = d; L.realm = C.id; } } }
    // spread guilds and faiths evenly so even a small world has all of them
    { let gi = rng.int(0, 3), fi = rng.int(0, 2); for (const L of this.locs) if (L.civ) { if (L.type === 'town' || L.type === 'city' || L.type === 'castle') L.guild = gi++ % 4; L.faith = fi++ % 3; } }
    // starting town + make its nearest dungeons gentle
    const towns = this.locs.filter((l) => l.type === 'town');
    this.start = towns.length ? towns[rng.int(0, towns.length - 1)] : this.locs.find((l) => l.civ);
    const near = this.nearest(this.start.x, this.start.z, (l) => !l.civ, 3);
    near.forEach((l, i) => { l.tier = i < 2 ? 1 : 2; });
  }

  nearest(x, z, filter, n = 1) {
    const arr = [];
    for (const L of this.locs) { if (filter && !filter(L)) continue; arr.push([Math.hypot(L.x - x, L.z - z), L]); }
    arr.sort((a, b) => a[0] - b[0]);
    return arr.slice(0, n).map((a) => a[1]);
  }

  genRoads() {
    this.roads = []; this.rgrid = new Map();
    const civ = this.locs.filter((l) => l.civ);
    const done = new Set();
    for (const A of civ) {
      const near = this.nearest(A.x, A.z, (l) => l.civ && l !== A, A.type === 'farm' ? 1 : A.type === 'village' ? 2 : 3);
      for (const B of near) {
        const k = Math.min(A.id, B.id) + ':' + Math.max(A.id, B.id);
        const d = Math.hypot(A.x - B.x, A.z - B.z);
        if (done.has(k) || d > 11000) continue; done.add(k);
        let wet = false; for (let i = 1; i < 16 && !wet; i++) if (this.rawHeight(lerp(A.x, B.x, i / 16), lerp(A.z, B.z, i / 16)) < -1.6) wet = true;
        if (wet) continue; // no roads across lakes or the sea
        const steps = Math.max(2, Math.round(d / 180)), pts = [];
        const nx = -(B.z - A.z) / d, nz = (B.x - A.x) / d;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps, env = Math.sin(t * Math.PI);
          const off = this.N2.n2(A.id * 13.7 + t * d / 700, B.id * 7.3) * 160 * env;
          pts.push([lerp(A.x, B.x, t) + nx * off, lerp(A.z, B.z, t) + nz * off]);
        }
        this.roads.push({ a: A.id, b: B.id, pts });
        for (let i = 0; i < steps; i++) {
          const p = pts[i], q = pts[i + 1], seg = [p[0], p[1], q[0], q[1]];
          const x0 = Math.floor((Math.min(p[0], q[0]) - 12 + HALF) / RGRID), x1 = Math.floor((Math.max(p[0], q[0]) + 12 + HALF) / RGRID);
          const z0 = Math.floor((Math.min(p[1], q[1]) - 12 + HALF) / RGRID), z1 = Math.floor((Math.max(p[1], q[1]) + 12 + HALF) / RGRID);
          for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
            const key = lkey(cx, cz); if (!this.rgrid.has(key)) this.rgrid.set(key, []); this.rgrid.get(key).push(seg);
          }
        }
      }
    }
  }

  // Rivers run from the high country down to the sea (or a lake), following the low ground.
  genRivers() {
    const rng = new RNG(this.seed ^ 0x51ee), want = Math.max(2, Math.round((WORLD / 1000) ** 2 / 85)), step = 110;
    for (let tries = 0; this.rivers.length < want && tries < want * 12; tries++) {
      let x = 0, z = 0, bh = -1e9;
      for (let k = 0; k < 6; k++) { const px = rng.range(-HALF, HALF) * 0.8, pz = rng.range(-HALF, HALF) * 0.8, h = this.rawHeight(px, pz); if (h > bh && !this.locAt(px, pz, 150)) { bh = h; x = px; z = pz; } }
      if (bh < 8 || this.riverAt(x, z)) continue;
      const coast = () => (HALF - Math.abs(x) < HALF - Math.abs(z) ? [Math.sign(x) || 1, 0] : [0, Math.sign(z) || 1]);
      let [dx, dz] = coast(); const a0 = rng.range(-1, 1); [dx, dz] = [dx * Math.cos(a0) - dz * Math.sin(a0), dx * Math.sin(a0) + dz * Math.cos(a0)];
      const pts = [[x, z]]; let end = 0, ok = false;
      for (let i = 0; i < 700; i++) {
        const c = coast(); let tx = dx * 0.6 + c[0] * 0.4, tz = dz * 0.6 + c[1] * 0.4; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
        let best = null, bs = 1e9;
        for (const deg of [0, -18, 18, -40, 40, -68, 68]) {
          const a = deg * Math.PI / 180, ex = tx * Math.cos(a) - tz * Math.sin(a), ez = tx * Math.sin(a) + tz * Math.cos(a), nx = x + ex * step, nz = z + ez * step;
          if (this.locAt(nx, nz, 110)) continue;
          const sc = this.rawHeight(nx, nz) + Math.abs(deg) * 0.03; if (sc < bs) { bs = sc; best = [nx, nz, ex, ez]; }
        }
        if (!best) break;
        [x, z, dx, dz] = best; pts.push([x, z]);
        if (this.rawHeight(x, z) < -0.8) { ok = true; break; }
        if (this.riverAt(x, z) && this.rvD < 45) { ok = true; end = this.rvS; break; } // joins another river
        if (Math.abs(x) > HALF - 200 || Math.abs(z) > HALF - 200) { ok = true; break; }
      }
      if (!ok || pts.length < 8) continue;
      // smooth the course, then let the surface step down with the land
      let P = pts; for (let it = 0; it < 2; it++) { const q = [P[0]]; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } q.push(P[P.length - 1]); P = q; }
      let run = 1e9; const n = P.length, river = { pts: P, surf: [], w: [] };
      for (let i = 0; i < n; i++) { run = Math.min(run, this.rawHeight(P[i][0], P[i][1]) - 1); river.surf.push(Math.max(end, run)); river.w.push(3.5 + 7.5 * i / n); }
      river.surf[n - 1] = end;
      this.rivers.push(river);
      for (let i = 0; i < n - 1; i++) {
        const a = P[i], b = P[i + 1], seg = [a[0], a[1], b[0], b[1], river.surf[i], river.surf[i + 1], river.w[i], river.w[i + 1]], m = river.w[i + 1] + 66;
        for (let cz = Math.floor((Math.min(a[1], b[1]) - m + HALF) / VGRID); cz <= Math.floor((Math.max(a[1], b[1]) + m + HALF) / VGRID); cz++)
          for (let cx = Math.floor((Math.min(a[0], b[0]) - m + HALF) / VGRID); cx <= Math.floor((Math.max(a[0], b[0]) + m + HALF) / VGRID); cx++) { const k = lkey(cx, cz); if (!this.vgrid.has(k)) this.vgrid.set(k, []); this.vgrid.get(k).push(seg); }
      }
    }
  }
  // A bridge wherever a road crosses a river.
  genBridges() {
    for (const road of this.roads) for (let i = 0; i < road.pts.length - 1; i++) {
      const p = road.pts[i], q = road.pts[i + 1], seen = new Set();
      for (let cz = Math.floor((Math.min(p[1], q[1]) + HALF) / VGRID); cz <= Math.floor((Math.max(p[1], q[1]) + HALF) / VGRID); cz++)
        for (let cx = Math.floor((Math.min(p[0], q[0]) + HALF) / VGRID); cx <= Math.floor((Math.max(p[0], q[0]) + HALF) / VGRID); cx++) {
          const cell = this.vgrid.get(lkey(cx, cz)); if (!cell) continue;
          for (const s of cell) {
            if (seen.has(s)) continue; seen.add(s);
            const rx = q[0] - p[0], rz = q[1] - p[1], sx = s[2] - s[0], sz = s[3] - s[1], den = rx * sz - rz * sx; if (Math.abs(den) < 1e-6) continue;
            const t = ((s[0] - p[0]) * sz - (s[1] - p[1]) * sx) / den, u = ((s[0] - p[0]) * rz - (s[1] - p[1]) * rx) / den;
            if (t < 0 || t > 1 || u < 0 || u > 1) continue;
            const x = p[0] + rx * t, z = p[1] + rz * t, rl = Math.hypot(rx, rz), sl = Math.hypot(sx, sz), sin = Math.max(0.35, Math.abs(den) / (rl * sl));
            if (this.bridges.some((b) => Math.hypot(b.x - x, b.z - z) < 40)) continue;
            const w = s[6] + (s[7] - s[6]) * u, b = { x, z, dx: rx / rl, dz: rz / rl, half: Math.min(46, w / sin + 4.5), y: s[4] + (s[5] - s[4]) * u + 1.5, w };
            this.bridges.push(b);
            const m = b.half + 20;
            for (let bz = Math.floor((z - m + HALF) / BGRID); bz <= Math.floor((z + m + HALF) / BGRID); bz++) for (let bx = Math.floor((x - m + HALF) / BGRID); bx <= Math.floor((x + m + HALF) / BGRID); bx++) { const k = lkey(bx, bz); if (!this.bgrid.has(k)) this.bgrid.set(k, []); this.bgrid.get(k).push(b); }
          }
        }
    }
  }
  bridgesNear(x, z) { return this.bgrid.get(lkey(Math.floor((x + HALF) / BGRID), Math.floor((z + HALF) / BGRID))); }

  // distance to nearest road (or 99 if none close)
  roadDist(x, z) {
    const cell = this.rgrid.get(lkey(Math.floor((x + HALF) / RGRID), Math.floor((z + HALF) / RGRID)));
    if (!cell) return 99;
    let best = 99 * 99;
    for (const s of cell) {
      const vx = s[2] - s[0], vz = s[3] - s[1], wx = x - s[0], wz = z - s[1];
      const t = clamp((wx * vx + wz * vz) / (vx * vx + vz * vz), 0, 1);
      const dx = wx - vx * t, dz = wz - vz * t, d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  // Small wilderness points of interest, one possible per 512m cell.
  poiInCell(cx, cz) {
    const h = hash2(cx, cz, this.seed ^ 0x9017);
    if ((h & 255) > 170) return null;
    const x = cx * POI_CELL + 40 + ((h >>> 8) & 255) / 255 * (POI_CELL - 80);
    const z = cz * POI_CELL + 40 + ((h >>> 16) & 255) / 255 * (POI_CELL - 80);
    if (Math.abs(x) > HALF - 300 || Math.abs(z) > HALF - 300) return null;
    if (this.locAt(x, z, 120) || this.riverAt(x, z)) return null;
    const y = this.rawHeight(x, z), b = this.ba;
    if (y < 0.5) return null;
    if (Math.abs(this.rawHeight(x + 6, z) - y) > 4 || Math.abs(this.rawHeight(x, z + 6) - y) > 4) return null;
    const r = (h >>> 24) / 255;
    let type;
    if (b === B_MOUNT) type = r < 0.5 ? 'ore' : r < 0.75 ? 'stones' : r < 0.9 ? 'shrine' : 'cache';
    else if (b === B_DESERT) type = r < 0.25 ? 'ore' : r < 0.5 ? 'stones' : r < 0.7 ? 'camp' : r < 0.85 ? 'shrine' : 'cache';
    else if (b === B_SWAMP) type = r < 0.35 ? 'ring' : r < 0.6 ? 'cache' : r < 0.8 ? 'shrine' : 'stones';
    else type = r < 0.25 ? 'camp' : r < 0.45 ? 'shrine' : r < 0.62 ? 'cache' : r < 0.8 ? 'ring' : 'stones';
    return { id: cx + '_' + cz, type, x, z, y, biome: b, seed: h };
  }
  poisNear(x, z, r) {
    const out = [];
    for (let cz = Math.floor((z - r) / POI_CELL); cz <= Math.floor((z + r) / POI_CELL); cz++)
      for (let cx = Math.floor((x - r) / POI_CELL); cx <= Math.floor((x + r) / POI_CELL); cx++) {
        const p = this.poiCached(cx, cz); if (p) out.push(p);
      }
    return out;
  }
  poiCached(cx, cz) {
    if (!this._poi) this._poi = new Map();
    const k = lkey(cx, cz);
    if (!this._poi.has(k)) this._poi.set(k, this.poiInCell(cx, cz));
    return this._poi.get(k);
  }

  // Low-res overview image data for the world map
  mapImage(size) {
    const data = new Uint8ClampedArray(size * size * 4);
    const cols = BIOMES.map((b) => [parseInt(b.map.slice(1, 3), 16), parseInt(b.map.slice(3, 5), 16), parseInt(b.map.slice(5, 7), 16)]);
    const hs = new Float32Array(size * size);
    const step = WORLD / size;
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const x = -HALF + (i + 0.5) * step, z = -HALF + (j + 0.5) * step;
      const h = this.rawHeight(x, z); hs[j * size + i] = h;
      const a = cols[this.ba], b = cols[this.bb], t = this.bt, o = (j * size + i) * 4;
      let r = lerp(b[0], a[0], t), g = lerp(b[1], a[1], t), bl = lerp(b[2], a[2], t);
      if (h < -1.2) { const dp = clamp(-h / 14, 0, 1); r = 70 - dp * 26; g = 112 - dp * 30; bl = 138 - dp * 26; } else if (h < 1.6 && this.ba !== B_SWAMP) { r = 214; g = 196; bl = 140; } else if (h > 230) { r = g = bl = 235; }
      data[o] = r; data[o + 1] = g; data[o + 2] = bl; data[o + 3] = 255;
    }
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) { // relief shading + parchment grain
      const h = hs[j * size + i], hw = hs[j * size + Math.max(0, i - 1)], hn = hs[Math.max(0, j - 1) * size + i];
      const sh = clamp(1 + ((h - hw) + (h - hn)) * 0.012, 0.6, 1.35) * (0.94 + hash01(i, j, 5) * 0.12), o = (j * size + i) * 4;
      data[o] *= sh; data[o + 1] *= sh; data[o + 2] *= sh;
    }
    return data;
  }
}
function lkey(cx, cz) { return cx * 4096 + cz; }
export const isDungeon = (t) => !!DUNGEONS[t];
export const CHUNK = 64;
export const ckey = (cx, cz) => cx * 4096 + cz;
export const chunkOf = (v) => Math.floor(v / CHUNK);
