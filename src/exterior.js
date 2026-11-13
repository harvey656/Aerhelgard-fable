// Exterior meshes for buildings, city walls and dungeon entrances.
import { hash01 } from './rng.js';
import { PROPS } from './art.js';
import { BUILDINGS } from './data.js';

const WALLS = ['plaster', 'stone', 'wood', 'sandstone'];
const SIGNS = { anvil: 'signAnvil', mug: 'signMug', coin: 'signCoin', flask: 'signFlask', star: 'signStar', shield: 'signShield', cross: 'signCross' };

function pyramid(B, x0, z0, x1, z1, y, h) {
  const c = [(x0 + x1) / 2, y + h, (z0 + z1) / 2], u = (x1 - x0) / 4;
  B.tri([x0, y, z1], [x1, y, z1], c, [0, 0], [u, 0], [u / 2, 1]); B.tri([x1, y, z0], [x0, y, z0], c, [0, 0], [u, 0], [u / 2, 1]);
  B.tri([x1, y, z1], [x1, y, z0], c, [0, 0], [u, 0], [u / 2, 1]); B.tri([x0, y, z0], [x0, y, z1], c, [0, 0], [u, 0], [u / 2, 1]);
}
function doorQuad(B, d, gy, w = 1.4, h = 2.3, out = 0.07) {
  const tx = -d.nz, tz = d.nx, x = d.x + d.nx * out, z = d.z + d.nz * out;
  B.quad([x - tx * w / 2, gy, z - tz * w / 2], [x + tx * w / 2, gy, z + tz * w / 2], [x + tx * w / 2, gy + h, z + tz * w / 2], [x - tx * w / 2, gy + h, z - tz * w / 2], 1, 1, 1);
}

export function addBuilding(get, bill, b, gy) {
  const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2, y0 = gy - 2, y1 = gy + b.h;
  const W = get(WALLS[b.wall]);
  if (b.type === 'dungeon') return addDungeon(get, bill, b, gy, x0, z0, x1, z1);
  if (b.roof === 'castle') {
    W.box(x0, z0, x1, z1, y0, y1); get('slate').quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], b.w / 4, b.d / 4, 0.8);
    for (const sx of [0, 1]) for (const sz of [0, 1]) { const tx = sx ? x1 : x0, tz = sz ? z1 : z0; W.box(tx - 4, tz - 4, tx + 4, tz + 4, y0, y1 + 6); pyramid(get('slate'), tx - 4.6, tz - 4.6, tx + 4.6, tz + 4.6, y1 + 6, 6); }
    W.box(b.x - 8, b.z - 7, b.x + 8, b.z + 7, y1, y1 + 9); pyramid(get('slate'), b.x - 8.8, b.z - 7.8, b.x + 8.8, b.z + 7.8, y1 + 9, 7);
    // crenellations
    for (let x = x0 + 5; x < x1 - 5; x += 3) { W.box(x, z1 - 0.6, x + 1.5, z1, y1, y1 + 1.1, 4, true); W.box(x, z0, x + 1.5, z0 + 0.6, y1, y1 + 1.1, 4, true); }
    doorQuad(get('door'), b.door, gy, 3, 4.2);
    windows(get('window'), b, gy, x0, z0, x1, z1, 1.0, 2.6, [3.5, 9]);
    return;
  }
  const flat = b.roof === 'flat';
  W.box(x0, z0, x1, z1, y0, flat ? y1 + 0.5 : y1);
  if (flat) get('flat').quad([x0, y1 + 0.1, z1], [x1, y1 + 0.1, z1], [x1, y1 + 0.1, z0], [x0, y1 + 0.1, z0], b.w / 4, b.d / 4, 0.92);
  else {
    const R = get(b.roofTex), o = 0.5, rh = Math.min(b.w, b.d) * 0.45 * (b.type === 'church' ? 1.5 : 1);
    if (b.w >= b.d) {
      const zc = b.z, u = (b.w + 2 * o) / 4, v = Math.hypot(b.d / 2 + o, rh) / 4;
      R.quad([x0 - o, y1 - 0.25, z1 + o], [x1 + o, y1 - 0.25, z1 + o], [x1 + o, y1 + rh, zc], [x0 - o, y1 + rh, zc], u, v, 1);
      R.quad([x1 + o, y1 - 0.25, z0 - o], [x0 - o, y1 - 0.25, z0 - o], [x0 - o, y1 + rh, zc], [x1 + o, y1 + rh, zc], u, v, 0.72);
      W.tri([x0, y1, z0], [x0, y1, z1], [x0, y1 + rh, zc], [0, 0], [b.d / 4, 0], [b.d / 8, rh / 4]); W.tri([x1, y1, z1], [x1, y1, z0], [x1, y1 + rh, zc], [0, 0], [b.d / 4, 0], [b.d / 8, rh / 4]);
      if (b.type !== 'barn') get('stone').box(b.x + b.w * 0.25, zc - 0.5, b.x + b.w * 0.25 + 1, zc + 0.5, y1 + rh - 1, y1 + rh + 1, 4, true);
    } else {
      const xc = b.x, u = (b.d + 2 * o) / 4, v = Math.hypot(b.w / 2 + o, rh) / 4;
      R.quad([x1 + o, y1 - 0.25, z1 + o], [x1 + o, y1 - 0.25, z0 - o], [xc, y1 + rh, z0 - o], [xc, y1 + rh, z1 + o], u, v, 1);
      R.quad([x0 - o, y1 - 0.25, z0 - o], [x0 - o, y1 - 0.25, z1 + o], [xc, y1 + rh, z1 + o], [xc, y1 + rh, z0 - o], u, v, 0.72);
      W.tri([x0, y1, z1], [x1, y1, z1], [xc, y1 + rh, z1], [0, 0], [b.w / 4, 0], [b.w / 8, rh / 4]); W.tri([x1, y1, z0], [x0, y1, z0], [xc, y1 + rh, z0], [0, 0], [b.w / 4, 0], [b.w / 8, rh / 4]);
      if (b.type !== 'barn') get('stone').box(xc - 0.5, b.z + b.d * 0.25, xc + 0.5, b.z + b.d * 0.25 + 1, y1 + rh - 1, y1 + rh + 1, 4, true);
    }
    if (b.type === 'church') { // steeple behind the entrance
      const sx = b.x - b.nx * (b.w / 2 - 2), sz = b.z - b.nz * (b.d / 2 - 2);
      get('stone').box(sx - 1.8, sz - 1.8, sx + 1.8, sz + 1.8, y1, y1 + 8); pyramid(get('slate'), sx - 2.2, sz - 2.2, sx + 2.2, sz + 2.2, y1 + 8, 5);
    }
  }
  doorQuad(get('door'), b.door, gy, b.type === 'barn' || b.type === 'church' ? 2.4 : 1.4, b.type === 'barn' || b.type === 'church' ? 3 : 2.3);
  if (b.type !== 'barn') windows(get('window'), b, gy, x0, z0, x1, z1, b.type === 'church' ? 0.9 : 1, b.type === 'church' ? 2.6 : 1.1, b.type === 'church' ? [2.2] : b.h > 5 ? [1.3, 4.1] : [1.3]);
  const sign = BUILDINGS[b.type].sign;
  if (sign) bill.add(PROPS[SIGNS[sign]], b.door.x + b.door.nx * 0.7 - b.door.nz * 1.8, gy + 0.9, b.door.z + b.door.nz * 0.7 + b.door.nx * 1.8, 1.25);
}

function windows(B, b, gy, x0, z0, x1, z1, w, h, rows) {
  const o = 0.06;
  const side = (ax, az, bx, bz, nx, nz, isFront) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.floor(len / 3.3)), dx = (bx - ax) / len, dz = (bz - az) / len;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n * len;
      const cx = ax + dx * t + nx * o, cz = az + dz * t + nz * o;
      for (const y of rows) {
        if (isFront && y < 3 && Math.hypot(cx - b.door.x, cz - b.door.z) < 2 + (b.roof === 'castle' ? 1 : 0)) continue;
        B.quad([cx - dx * w / 2, gy + y, cz - dz * w / 2], [cx + dx * w / 2, gy + y, cz + dz * w / 2], [cx + dx * w / 2, gy + y + h, cz + dz * w / 2], [cx - dx * w / 2, gy + y + h, cz - dz * w / 2], 1, 1, 1);
      }
    }
  };
  side(x0, z1, x1, z1, 0, 1, b.nz === 1); side(x1, z0, x0, z0, 0, -1, b.nz === -1);
  side(x1, z1, x1, z0, 1, 0, b.nx === 1); side(x0, z0, x0, z1, -1, 0, b.nx === -1);
}

function addDungeon(get, bill, b, gy, x0, z0, x1, z1) {
  const t = b.dtype, d = b.door, y0 = gy - 2;
  if (t === 'crypt') {
    const S = get('stone'); S.box(x0, z0, x1, z1, y0, gy + b.h, 4, true);
    S.box(x0 - 0.4, z0 - 0.4, x1 + 0.4, z1 + 0.4, gy + b.h, gy + b.h + 0.5, 4, true);
    doorQuad(get('door'), d, gy, 1.5, 2.4);
  } else if (t === 'tower') {
    const S = get('stone'); S.box(x0, z0, x1, z1, y0, gy + b.h);
    S.box(x0 - 0.7, z0 - 0.7, x1 + 0.7, z1 + 0.7, gy + b.h, gy + b.h + 2.2, 4, true);
    pyramid(get('slate'), x0 - 0.2, z0 - 0.2, x1 + 0.2, z1 + 0.2, gy + b.h + 2.2, 8);
    doorQuad(get('door'), d, gy, 1.6, 2.6);
    const Wn = get('window');
    for (let y = 6; y < b.h - 2; y += 6) for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const cx = b.x + nx * (b.w / 2 + 0.06), cz = b.z + nz * (b.d / 2 + 0.06), tx = -nz * 0.45, tz = nx * 0.45;
      Wn.quad([cx - tx, gy + y, cz - tz], [cx + tx, gy + y, cz + tz], [cx + tx, gy + y + 1.6, cz + tz], [cx - tx, gy + y + 1.6, cz - tz], 1, 1, 1);
    }
  } else if (t === 'ruin') {
    const S = get('sandstone');
    for (let i = 0; i < 4; i++) { // broken perimeter walls
      const h1 = 1.2 + hash01(b.i + i, b.x | 0, 7) * 3.2, h2 = 1 + hash01(b.i + i, b.z | 0, 9) * 2.4;
      const R = 9;
      if (i === 0) { S.box(b.x - R, b.z - R, b.x - 1, b.z - R + 0.9, y0, gy + h1, 4, true); S.box(b.x + 2, b.z - R, b.x + R, b.z - R + 0.9, y0, gy + h2, 4, true); }
      if (i === 1) { S.box(b.x - R, b.z + R - 0.9, b.x + 1, b.z + R, y0, gy + h1, 4, true); S.box(b.x + 4, b.z + R - 0.9, b.x + R, b.z + R, y0, gy + h2, 4, true); }
      if (i === 2) S.box(b.x - R, b.z - R, b.x - R + 0.9, b.z + 3, y0, gy + h1, 4, true);
      if (i === 3) S.box(b.x + R - 0.9, b.z - 4, b.x + R, b.z + R, y0, gy + h1, 4, true);
    }
    S.box(x0, z0, x1, z1, y0, gy + b.h, 4, true);
    doorQuad(get('dark'), d, gy, 1.8, 2.5);
  } else { // cave / den / mine: a rocky mound with a dark mouth
    const Rk = get('rock'), R = b.w * 0.75, H = b.h, n = 9, rings = 3;
    const pt = (k, i) => { const a = i / n * Math.PI * 2, ph = k / rings * 1.45, j = 0.82 + hash01(i % n, k, (b.x | 0) + 3) * 0.36; return [b.x + Math.cos(a) * R * Math.cos(ph) * j, gy - 1.5 + (H + 1.5) * Math.sin(ph) * (k === rings ? 1 : j), b.z + Math.sin(a) * R * Math.cos(ph) * j]; };
    for (let k = 0; k < rings; k++) for (let i = 0; i < n; i++) Rk.quad(pt(k, i), pt(k, i + 1), pt(k + 1, i + 1), pt(k + 1, i), 2, 1.5);
    const fx = d.x, fz = d.z, tx = -d.nz, tz = d.nx;
    Rk.box(Math.min(fx - tx * 2 - d.nx * 2.5, fx + tx * 2) - 0.2 * Math.abs(d.nx), Math.min(fz - tz * 2 - d.nz * 2.5, fz + tz * 2) - 0.2 * Math.abs(d.nz), Math.max(fx + tx * 2, fx - tx * 2 - d.nx * 2.5) + 0.2 * Math.abs(d.nx), Math.max(fz + tz * 2, fz - tz * 2 - d.nz * 2.5) + 0.2 * Math.abs(d.nz), y0, gy + 3.2, 4, true);
    doorQuad(get('dark'), { x: fx, z: fz, nx: d.nx, nz: d.nz }, gy, 2.2, 2.6, 0.1 + 0.2);
  }
}

export function addWall(get, w, gy) {
  const S = get('stone'); S.box(w.x0, w.z0, w.x1, w.z1, gy - 3, gy + w.h, 4, true);
  const horiz = w.x1 - w.x0 > w.z1 - w.z0;
  if (horiz) for (let x = w.x0; x < w.x1 - 1; x += 3) S.box(x, w.z0, x + 1.5, w.z1, gy + w.h, gy + w.h + 1, 4, true);
  else for (let z = w.z0; z < w.z1 - 1; z += 3) S.box(w.x0, z, w.x1, z + 1.5, gy + w.h, gy + w.h + 1, 4, true);
}
export function addTower(get, t, gy) {
  const h = t.s / 2; get('stone').box(t.x - h, t.z - h, t.x + h, t.z + h, gy - 3, gy + t.h);
  pyramid(get('slate'), t.x - h - 0.5, t.z - h - 0.5, t.x + h + 0.5, t.z + h + 0.5, gy + t.h, t.s * 0.7);
}
