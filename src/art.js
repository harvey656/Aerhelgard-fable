// Procedural pixel art: tiling textures and sprite atlases, all generated at load.
import * as THREE from '../vendor/three.module.min.js';
import { RNG, hash01, clamp } from './rng.js';

export function hex(c) { if (Array.isArray(c)) return c; const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export const sh = (c, f) => [clamp(c[0] * f, 0, 255), clamp(c[1] * f, 0, 255), clamp(c[2] * f, 0, 255)];
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// A tiny software canvas for crisp pixel drawing
export class Pix {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  set(x, y, c, a = 255) {
    x |= 0; y |= 0; if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const o = (y * this.w + x) * 4; this.d[o] = c[0]; this.d[o + 1] = c[1]; this.d[o + 2] = c[2]; this.d[o + 3] = a;
  }
  get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0; return this.d[(y * this.w + x) * 4 + 3]; }
  clear(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.d[(y * this.w + x) * 4 + 3] = 0; }
  rect(x, y, w, h, c, a) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a); }
  // shaded rect: lit from the left
  box(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, sh(c, i < w * 0.3 ? 1.15 : i >= w * 0.75 ? 0.75 : 1)); }
  ell(cx, cy, rx, ry, c, a) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry; if (dx * dx + dy * dy <= 1) this.set(x, y, c, a);
    }
  }
  // shaded, dithered blob (light from top-left)
  blob(cx, cy, rx, ry, c, rng, tex = 0.12) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry, d = dx * dx + dy * dy; if (d > 1) continue;
      const l = 1 - (dx * 0.5 + dy * 0.6) * 0.38 + (rng ? (rng.next() - 0.5) * tex * 2 : 0);
      this.set(x, y, sh(c, Math.round(l * 5) / 5));
    }
  }
  line(x0, y0, x1, y1, c, th = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 1.5;
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
      if (th <= 1) this.set(Math.round(x), Math.round(y), c); else this.rect(Math.round(x - th / 2), Math.round(y - th / 2), th, th, c);
    }
  }
  tri(x0, y0, x1, y1, x2, y2, c) {
    const minx = Math.floor(Math.min(x0, x1, x2)), maxx = Math.ceil(Math.max(x0, x1, x2)), miny = Math.floor(Math.min(y0, y1, y2)), maxy = Math.ceil(Math.max(y0, y1, y2));
    const e = (ax, ay, bx, by, px, py) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      const a = e(x0, y0, x1, y1, x, y), b = e(x1, y1, x2, y2, x, y), d = e(x2, y2, x0, y0, x, y);
      if ((a >= 0 && b >= 0 && d >= 0) || (a <= 0 && b <= 0 && d <= 0)) this.set(x, y, c);
    }
  }
  outline(c = [20, 16, 14]) {
    const src = this.d.slice(), w = this.w, h = this.h, A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[(y * w + x) * 4 + 3]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!A(x, y) && (A(x - 1, y) > 128 || A(x + 1, y) > 128 || A(x, y - 1) > 128 || A(x, y + 1) > 128)) this.set(x, y, c);
    return this;
  }
  blit(dst, ox, oy) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const o = (y * this.w + x) * 4; if (this.d[o + 3]) dst.set(ox + x, oy + y, [this.d[o], this.d[o + 1], this.d[o + 2]], this.d[o + 3]);
    }
  }
  canvas(scale = 1) {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    c.getContext('2d').putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    if (scale === 1) return c;
    const s = document.createElement('canvas'); s.width = this.w * scale; s.height = this.h * scale;
    const g = s.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, s.width, s.height); return s;
  }
  texture(repeat = false) {
    const t = new THREE.CanvasTexture(this.canvas());
    t.magFilter = THREE.NearestFilter; t.minFilter = repeat ? THREE.NearestMipmapLinearFilter : THREE.NearestFilter; t.generateMipmaps = repeat;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
}

// ---------- Tiling textures ----------
function tex(size, fn) {
  const p = new Pix(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) p.set(x, y, fn(x, y, hash01(x, y, size * 7 + 1)));
  return p.texture(true);
}
function bricks(base, mortar, bw, bh, seed, vary = 0.16) {
  return (x, y, r) => {
    const row = Math.floor(y / bh), xx = (x + (row % 2) * (bw >> 1)) % 32, col = Math.floor(xx / bw);
    if (y % bh === 0 || xx % bw === 0) return sh(mortar, 0.9 + r * 0.2);
    const v = 1 - vary + hash01(col, row, seed) * vary * 2;
    return sh(base, v * (0.93 + r * 0.14) * (y % bh === 1 ? 1.1 : y % bh === bh - 1 ? 0.85 : 1));
  };
}
function planks(base, pw, seed, horiz) {
  return (x, y, r) => {
    const u = horiz ? y : x, v = horiz ? x : y, pl = Math.floor(u / pw);
    if (u % pw === 0) return sh(base, 0.55);
    const grain = hash01(pl, Math.floor(v / 3), seed) * 0.12;
    return sh(base, 0.85 + hash01(pl, 0, seed) * 0.22 + grain - (r < 0.06 ? 0.2 : 0));
  };
}

export const T = {};
export function makeTextures() {
  T.ground = tex(32, (x, y, r) => { const v = 200 + r * 55 - (hash01(x >> 1, y >> 1, 3) < 0.12 ? 40 : 0); return [v, v, v]; });
  T.plaster = tex(32, (x, y, r) => {
    if (x < 2 || x >= 30 || y < 2 || y >= 30 || Math.abs(x - y) < 2 && (x > 2)) return sh([74, 50, 30], 0.85 + r * 0.3);
    return sh([214, 200, 168], 0.9 + r * 0.14);
  });
  T.stone = tex(32, bricks([132, 130, 128], [70, 68, 66], 8, 4, 11));
  T.wood = tex(32, planks([112, 78, 46], 8, 5));
  T.sandstone = tex(32, bricks([204, 172, 118], [150, 120, 80], 16, 16, 21, 0.08));
  T.thatch = tex(32, (x, y, r) => sh([170, 140, 66], 0.7 + hash01(x, y >> 2, 9) * 0.4 + (y % 8 === 0 ? -0.25 : 0)));
  T.shingle = tex(32, (x, y, r) => { const row = y >> 3, xx = (x + (row % 2) * 4) % 8; return sh([132, 62, 40], (xx === 0 ? 0.6 : 1) * (y % 8 === 7 ? 0.6 : 0.85 + hash01((x + (row % 2) * 4) >> 3, row, 4) * 0.3)); });
  T.slate = tex(32, (x, y, r) => { const row = y >> 3, xx = (x + (row % 2) * 4) % 8; return sh([84, 92, 112], (xx === 0 ? 0.6 : 1) * (y % 8 === 7 ? 0.6 : 0.85 + hash01((x + (row % 2) * 4) >> 3, row, 6) * 0.3)); });
  T.flat = tex(32, (x, y, r) => sh([196, 170, 124], 0.9 + r * 0.12));
  T.rock = tex(32, (x, y, r) => sh([104, 98, 92], 0.7 + hash01(x >> 2, y >> 2, 8) * 0.3 + r * 0.22));
  T.door = (() => { const p = new Pix(16, 32); for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) { let c = sh([96, 62, 34], 0.85 + hash01(x >> 2, y, 3) * 0.25); if (x % 4 === 0) c = sh(c, 0.6); if (y === 6 || y === 7 || y === 24 || y === 25) c = [58, 58, 64]; if (x === 0 || x === 15 || y === 0) c = [44, 30, 18]; p.set(x, y, c); } p.rect(11, 15, 2, 3, [200, 170, 60]); return p.texture(); })();
  T.dark = (() => { const p = new Pix(16, 32); for (let y = 0; y < 32; y++) for (let x = 0; x < 16; x++) { const e = Math.min(x, 15 - x, y); p.set(x, y, e < 2 ? [60, 56, 52] : [8 + e, 6 + e, 8 + e]); } return p.texture(); })();
  const win = (pane) => { const p = new Pix(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const fr = x < 2 || x > 13 || y < 2 || y > 13 || x === 7 || x === 8 || y === 7 || y === 8; p.set(x, y, fr ? [62, 42, 26] : sh(pane, 0.85 + hash01(x, y, 2) * 0.3)); } return p.texture(); };
  T.window = win([52, 70, 96]); T.windowLit = win([250, 200, 96]);
  // interiors
  T.floorwood = tex(32, planks([124, 88, 52], 8, 31, true));
  T.floorstone = tex(32, bricks([118, 114, 108], [66, 62, 58], 16, 16, 41, 0.12));
  T.dirt = tex(32, (x, y, r) => sh([92, 74, 54], 0.75 + hash01(x >> 1, y >> 1, 12) * 0.2 + r * 0.2));
  T.cavewall = tex(32, (x, y, r) => sh([96, 86, 76], 0.55 + hash01(x >> 2, y >> 1, 13) * 0.35 + r * 0.25 + Math.sin((x + y * 0.6) * 0.5) * 0.08));
  T.cryptwall = tex(32, bricks([104, 108, 104], [44, 46, 44], 16, 8, 51, 0.2));
  T.ruinwall = tex(32, (x, y, r) => { const c = bricks([186, 152, 100], [120, 92, 58], 16, 16, 61, 0.1)(x, y, r); return (x > 5 && x < 11 && y > 4 && y < 12 && hash01(x, y, 99) < 0.35) ? sh(c, 0.6) : c; });
  T.towerwall = tex(32, bricks([112, 104, 128], [52, 46, 66], 8, 8, 71, 0.14));
  T.plasterin = tex(32, (x, y, r) => (y > 25 ? planks([92, 62, 36], 8, 77)(x, y, r) : y === 25 ? [50, 34, 20] : sh([206, 192, 160], 0.9 + r * 0.14)));
  T.woodwall = tex(32, planks([104, 72, 42], 8, 81));
  T.ceil = tex(32, (x, y, r) => (x % 16 < 3 ? sh([62, 42, 26], 0.9 + r * 0.2) : sh([128, 98, 62], 0.8 + hash01(x, y >> 2, 5) * 0.2)));
  T.ceilstone = tex(32, (x, y, r) => sh([70, 68, 66], 0.7 + hash01(x >> 2, y >> 2, 15) * 0.3 + r * 0.2));
  T.carpet = tex(32, (x, y, r) => { const e = Math.min(x, 31 - x, y, 31 - y); return e < 2 ? [190, 150, 50] : (x + y) % 8 === 0 || (x - y + 32) % 8 === 0 ? sh([122, 26, 34], 1.25) : sh([122, 26, 34], 0.9 + r * 0.2); });
  T.crate = tex(32, (x, y, r) => { const e = Math.min(x, 31 - x, y, 31 - y); return e < 3 || Math.abs(x - y) < 2 ? sh([84, 56, 30], 0.9 + r * 0.2) : planks([142, 104, 60], 8, 91)(x, y, r); });
  T.altar = tex(32, (x, y, r) => sh([190, 186, 176], 0.85 + r * 0.15 - (y < 3 ? 0.2 : 0)));
  T.water = tex(32, (x, y, r) => { const v = 0.8 + Math.sin((x + Math.sin(y * 0.4) * 3) * 0.6) * 0.1 + r * 0.1; return sh([70, 110, 120], v); });
  return T;
}

// ---------- Atlases ----------
const CELLPX = 64;
export const FLORA = {}, PROPS = {};
function buildAtlas(defs, cols, reg) {
  const rows = Math.ceil(defs.length / cols);
  const atlas = new Pix(cols * CELLPX, rows * CELLPX);
  defs.forEach(([name, w, h, fn], k) => {
    const p = new Pix(CELLPX, CELLPX), rng = new RNG(k * 977 + 13);
    fn(p, rng); p.outline();
    const cx = k % cols, cy = Math.floor(k / cols);
    p.blit(atlas, cx * CELLPX, cy * CELLPX);
    // uv rect with half-texel inset; v flipped (canvas y down)
    reg[name] = { u0: (cx * CELLPX + 0.5) / atlas.w, u1: ((cx + 1) * CELLPX - 0.5) / atlas.w, v1: 1 - (cy * CELLPX + 0.5) / atlas.h, v0: 1 - ((cy + 1) * CELLPX - 0.5) / atlas.h, w, h, cx, cy };
  });
  const t = atlas.texture(); t._pix = atlas; return t;
}
const G1 = [52, 110, 44], G2 = [38, 84, 40], BARK = [84, 58, 36];
function tree(p, r, leaf, trunkH, crownR, n, bark = BARK) {
  p.box(30, 63 - trunkH, 5, trunkH, bark);
  for (let i = 0; i < n; i++) { const a = r.range(0, 6.28), d = r.range(0, crownR * 0.6); p.blob(32 + Math.cos(a) * d, 63 - trunkH - crownR * 0.5 + Math.sin(a) * d * 0.7, crownR * r.range(0.45, 0.7), crownR * r.range(0.4, 0.6), sh(leaf, r.range(0.85, 1.15)), r, 0.2); }
}
function pine(p, r, leaf, snow) {
  p.box(30, 50, 4, 14, BARK);
  for (let k = 0; k < 5; k++) { const y = 50 - k * 10, w = 20 - k * 3.4; for (let j = 0; j < 14; j++) for (let x = -w; x <= w; x++) if (Math.abs(x) <= w * (j / 14)) p.set(32 + x, y - 14 + j + 4, snow && j < 5 && r.chance(0.8) ? [230, 236, 244] : sh(leaf, (x < 0 ? 1.1 : 0.8) + r.range(-0.12, 0.12))); }
}
function flower(p, r, col, n = 5) { for (let i = 0; i < n; i++) { const x = 20 + r.int(0, 24), h = r.int(10, 22); p.line(x, 63, x + r.int(-2, 2), 63 - h, [50, 110, 40]); p.ell(x, 62 - h, 2.4, 2.4, hex(col)); p.set(x, 62 - h, [250, 230, 90]); } }
function shroom(p, r, col) { for (let i = 0; i < 4; i++) { const x = 18 + i * 9 + r.int(-2, 2), h = r.int(5, 12); p.rect(x - 1, 63 - h, 3, h, [226, 214, 190]); p.blob(x, 62 - h, 5, 3, hex(col), r); p.set(x - 2, 62 - h, [255, 255, 255]); } }
function rock(p, r, c, big) { const n = big ? 4 : 2; for (let i = 0; i < n; i++) p.blob(32 + r.range(-12, 12), 56 - r.range(0, big ? 14 : 4), r.range(9, 15), r.range(6, 11), sh(c, r.range(0.85, 1.1)), r, 0.25); }

const FLORA_DEFS = [
  ['oak', 9, 10, (p, r) => tree(p, r, G1, 22, 26, 9)],
  ['oak2', 8, 9, (p, r) => tree(p, r, [70, 120, 40], 18, 24, 8)],
  ['pine', 6, 11, (p, r) => pine(p, r, [30, 78, 48])],
  ['birch', 5, 9, (p, r) => tree(p, r, [110, 150, 50], 30, 18, 7, [214, 210, 196])],
  ['deadtree', 6, 8, (p, r) => { p.box(30, 26, 4, 38, [70, 56, 46]); for (let i = 0; i < 6; i++) { const y = 28 + i * 5, s = i % 2 ? 1 : -1; p.line(32, y, 32 + s * r.int(8, 18), y - r.int(6, 14), [70, 56, 46], 2); } }],
  ['bush', 3, 2.2, (p, r) => { for (let i = 0; i < 6; i++) p.blob(32 + r.range(-14, 14), 52 - r.range(0, 8), r.range(7, 11), r.range(6, 9), sh(G2, r.range(0.9, 1.2)), r, 0.2); }],
  ['cactus', 2.6, 4.4, (p, r) => { const c = [72, 128, 62]; p.box(28, 14, 8, 50, c); p.box(14, 28, 6, 16, c); p.box(14, 40, 16, 5, c); p.box(44, 20, 6, 18, c); p.box(36, 34, 12, 5, c); for (let i = 0; i < 40; i++) { const x = r.int(14, 50), y = r.int(14, 62); if (p.get(x, y)) p.set(x, y, [200, 220, 160]); } }],
  ['palm', 7, 10, (p, r) => { for (let y = 0; y < 44; y++) p.box(30 + Math.round(Math.sin(y / 14) * 3), 63 - y, 4, 1, y % 5 ? [128, 98, 60] : [90, 66, 40]); for (let i = 0; i < 7; i++) { const a = -2.9 + i * 0.45; for (let t = 0; t < 22; t++) { const x = 34 + Math.cos(a) * t, y = 20 + Math.sin(a) * t * 0.6 + t * t * 0.028; p.rect(x, y, 2, 3, sh([62, 128, 52], 0.85 + (i % 2) * 0.25)); } } }],
  ['shrub', 2.4, 1.6, (p, r) => { for (let i = 0; i < 14; i++) p.line(32, 63, 32 + r.int(-20, 20), 63 - r.int(8, 24), sh([150, 128, 76], r.range(0.8, 1.1))); }],
  ['rock1', 3.4, 2.6, (p, r) => rock(p, r, [120, 116, 110], true)],
  ['rock2', 2, 1.2, (p, r) => rock(p, r, [130, 124, 112], false)],
  ['sandrock', 3.6, 3, (p, r) => rock(p, r, [186, 144, 96], true)],
  ['willow', 9, 9, (p, r) => { p.box(29, 30, 6, 34, [58, 50, 40]); for (let i = 0; i < 8; i++) p.blob(32 + r.range(-16, 16), 22 + r.range(-8, 6), r.range(9, 13), r.range(7, 9), sh([62, 92, 54], r.range(0.85, 1.1)), r, 0.2); for (let i = 0; i < 22; i++) { const x = r.int(8, 56), y0 = r.int(22, 30); p.line(x, y0, x + r.int(-1, 1), y0 + r.int(10, 26), sh([70, 104, 58], r.range(0.8, 1.1))); } }],
  ['reeds', 2, 2.4, (p, r) => { for (let i = 0; i < 12; i++) { const x = r.int(14, 50), h = r.int(18, 44); p.line(x, 63, x + r.int(-3, 3), 63 - h, sh([96, 118, 60], r.range(0.8, 1.2))); if (r.chance(0.4)) p.rect(x - 1, 63 - h, 2, 6, [92, 60, 34]); } }],
  ['grass', 1.6, 1, (p, r) => { for (let i = 0; i < 16; i++) p.line(32 + r.int(-18, 18), 63, 32 + r.int(-24, 24), 63 - r.int(8, 26), sh([84, 132, 52], r.range(0.8, 1.2))); }],
  ['snowpine', 6, 11, (p, r) => pine(p, r, [36, 72, 60], true)],
  ['mushroom', 1.1, 0.8, (p, r) => shroom(p, r, '#c8402c')],
  ['mushroomB', 1.1, 0.8, (p, r) => shroom(p, r, '#88c8f0')],
  ['mushroomG', 1.1, 0.8, (p, r) => shroom(p, r, '#7a9a48')],
  ['berrybush', 2.4, 1.9, (p, r) => { for (let i = 0; i < 6; i++) p.blob(32 + r.range(-14, 14), 50 - r.range(0, 8), r.range(7, 11), r.range(6, 9), sh(G1, r.range(0.9, 1.2)), r, 0.2); for (let i = 0; i < 16; i++) p.rect(r.int(16, 48), r.int(36, 56), 2, 2, [86, 40, 120]); }],
  ['herb', 1.2, 1, (p, r) => { for (let i = 0; i < 9; i++) { const x = 32 + r.int(-12, 12), h = r.int(10, 24); p.line(32, 63, x, 63 - h, [60, 126, 70]); p.ell(x, 63 - h, 3, 1.6, [84, 160, 90]); } }],
  ['flowerW', 1.2, 1, (p, r) => flower(p, r, '#f4f0e0')],
  ['flowerB', 1.2, 1, (p, r) => flower(p, r, '#5878e0')],
  ['flowerP', 1.2, 1, (p, r) => flower(p, r, '#f0a8d8')],
  ['wheat', 1.3, 1.3, (p, r) => { for (let i = 0; i < 12; i++) { const x = r.int(14, 50), h = r.int(24, 44); p.line(x, 63, x, 63 - h, [196, 164, 72]); p.rect(x - 1, 63 - h - 5, 3, 7, [228, 190, 80]); } }],
  ['cactusfruit', 1.8, 1.8, (p, r) => { p.blob(32, 46, 11, 17, [78, 134, 66], r); p.blob(17, 50, 7, 10, [70, 124, 60], r); p.blob(46, 48, 7, 11, [70, 124, 60], r); for (const [x, y] of [[32, 27], [16, 39], [47, 36], [38, 31]]) p.ell(x, y, 3, 3, [224, 72, 120]); }],
  ['thorn', 1.5, 1.2, (p, r) => { for (let i = 0; i < 12; i++) { const x = 32 + r.int(-22, 22), y = 63 - r.int(10, 30); p.line(32, 63, x, y, [150, 96, 44]); p.rect(x, y, 2, 2, [232, 160, 50]); } }],
  ['moss', 1.4, 0.6, (p, r) => { for (let i = 0; i < 7; i++) p.blob(32 + r.range(-18, 18), 58 - r.range(0, 5), r.range(5, 9), r.range(3, 5), sh([84, 126, 106], r.range(0.85, 1.15)), r, 0.25); }],
  ['fern', 1.5, 1.1, (p, r) => { for (let i = 0; i < 7; i++) { const a = -2.6 + i * 0.36, len = r.int(20, 30); for (let t = 0; t < len; t++) { const x = 32 + Math.cos(a) * t, y = 62 + Math.sin(a) * t * 0.9; p.rect(x, y, 1, 1, [70, 150, 110]); if (t % 3 === 0) { p.rect(x - 2, y - 1, 5, 1, [110, 200, 160]); } } } }],
  ['mushroomY', 1.1, 0.8, (p, r) => shroom(p, r, '#e0a830')],
  ['mushroomP', 1.1, 0.8, (p, r) => shroom(p, r, '#8848b8')],
  ['berryR', 2.4, 1.9, (p, r) => { for (let i = 0; i < 6; i++) p.blob(32 + r.range(-14, 14), 50 - r.range(0, 8), r.range(7, 11), r.range(6, 9), sh([44, 96, 52], r.range(0.9, 1.2)), r, 0.2); for (let i = 0; i < 16; i++) p.rect(r.int(16, 48), r.int(36, 56), 2, 2, [190, 40, 56]); }],
  ['flowerY', 1.2, 1, (p, r) => flower(p, r, '#f0c830')],
  ['flowerR', 1.2, 1, (p, r) => flower(p, r, '#e04838')],
  ['flowerV', 1.2, 1, (p, r) => flower(p, r, '#9860d8')],
  ['herbB', 1.2, 1, (p, r) => { for (let i = 0; i < 9; i++) { const x = 32 + r.int(-12, 12), h = r.int(10, 24); p.line(32, 63, x, 63 - h, [90, 140, 130]); p.ell(x, 63 - h, 3, 1.6, [130, 180, 170]); } }],
  ['herbR', 1.2, 1, (p, r) => { for (let i = 0; i < 9; i++) { const x = 32 + r.int(-12, 12), h = r.int(10, 26); p.line(32, 63, x, 63 - h, [120, 60, 50]); p.ell(x, 63 - h, 3, 1.8, [190, 60, 60]); } }],
  ['lily', 1.4, 1, (p, r) => { p.blob(32, 58, 22, 5, [50, 100, 60], r); flower(p, r, '#e8f0a0', 3); }],
];
const WOODC = [124, 88, 50], STONEC = [128, 126, 122], IRONC = [70, 70, 78];
function signProp(icon) {
  return (p, r) => {
    p.box(8, 6, 3, 58, [70, 48, 28]); p.box(8, 8, 44, 3, [70, 48, 28]);
    p.box(22, 14, 28, 26, [150, 112, 62]); p.rect(22, 14, 28, 1, [80, 54, 30]); p.rect(22, 39, 28, 1, [80, 54, 30]);
    p.rect(30, 11, 1, 3, [40, 40, 40]); p.rect(42, 11, 1, 3, [40, 40, 40]);
    const cx = 36, cy = 27, D = [40, 28, 20];
    if (icon === 'anvil') { p.rect(cx - 8, cy - 4, 16, 4, IRONC); p.rect(cx - 3, cy, 6, 4, IRONC); p.rect(cx - 6, cy + 4, 12, 3, IRONC); p.rect(cx - 11, cy - 3, 4, 2, IRONC); }
    if (icon === 'mug') { p.rect(cx - 6, cy - 6, 10, 13, [200, 150, 60]); p.rect(cx - 6, cy - 8, 10, 3, [245, 245, 235]); p.rect(cx + 4, cy - 3, 4, 2, D); p.rect(cx + 6, cy - 3, 2, 8, D); p.rect(cx + 4, cy + 3, 4, 2, D); }
    if (icon === 'coin') { p.ell(cx, cy, 8, 8, [232, 190, 60]); p.ell(cx, cy, 5, 5, [190, 140, 40]); p.rect(cx - 1, cy - 4, 2, 8, [250, 226, 120]); }
    if (icon === 'flask') { p.rect(cx - 2, cy - 9, 4, 7, [200, 220, 230]); p.ell(cx, cy + 3, 7, 7, [70, 190, 90]); p.rect(cx - 3, cy - 10, 6, 2, D); }
    if (icon === 'star') { for (let i = 0; i < 5; i++) { const a = i * 1.2566 - 1.57; p.tri(cx, cy, cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, cx + Math.cos(a + 0.63) * 4, cy + Math.sin(a + 0.63) * 4, [120, 150, 250]); p.tri(cx, cy, cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, cx + Math.cos(a - 0.63) * 4, cy + Math.sin(a - 0.63) * 4, [170, 190, 255]); } }
    if (icon === 'shield') { p.rect(cx - 7, cy - 8, 14, 9, [150, 40, 40]); p.tri(cx - 7, cy + 1, cx + 7, cy + 1, cx, cy + 10, [150, 40, 40]); p.rect(cx - 1, cy - 8, 2, 16, [230, 200, 80]); p.rect(cx - 7, cy - 3, 14, 2, [230, 200, 80]); }
    if (icon === 'cross') { p.rect(cx - 2, cy - 9, 4, 19, [240, 230, 200]); p.rect(cx - 7, cy - 4, 14, 4, [240, 230, 200]); }
  };
}
function chest(open) { return (p, r) => { p.box(14, 38, 36, 24, WOODC); p.rect(14, 38, 36, 2, IRONC); p.rect(14, 60, 36, 2, IRONC); p.rect(18, 38, 3, 24, IRONC); p.rect(43, 38, 3, 24, IRONC); if (open) { p.box(14, 20, 36, 14, sh(WOODC, 0.7)); p.rect(16, 34, 32, 4, [20, 14, 10]); p.rect(22, 35, 20, 2, [240, 200, 70]); } else { p.box(14, 28, 36, 10, sh(WOODC, 1.15)); p.rect(14, 28, 36, 2, IRONC); p.rect(30, 36, 5, 7, [220, 180, 60]); } }; }
const PROP_DEFS = [
  ['well', 2.6, 2.8, (p, r) => { p.box(14, 40, 36, 22, STONEC); for (let i = 0; i < 20; i++) p.rect(r.int(14, 48), r.int(40, 60), 3, 1, sh(STONEC, 0.7)); p.box(15, 10, 3, 30, WOODC); p.box(46, 10, 3, 30, WOODC); p.tri(10, 14, 54, 14, 32, 2, [120, 60, 40]); p.rect(31, 14, 1, 16, [60, 50, 40]); p.rect(28, 30, 7, 6, WOODC); }],
  ['hay', 2.2, 1.6, (p, r) => { p.blob(32, 46, 22, 17, [206, 170, 70], r, 0.3); for (let i = 0; i < 20; i++) p.line(r.int(12, 52), r.int(34, 60), r.int(12, 52), r.int(34, 60), [170, 136, 50]); }],
  ['lamp', 1.2, 3.6, (p, r) => { p.box(30, 16, 3, 48, IRONC); p.rect(26, 60, 11, 4, IRONC); p.rect(26, 4, 11, 12, [60, 60, 66]); p.rect(28, 6, 7, 8, [96, 110, 130]); }],
  ['lampLit', 1.2, 3.6, (p, r) => { p.box(30, 16, 3, 48, IRONC); p.rect(26, 60, 11, 4, IRONC); p.rect(26, 4, 11, 12, [60, 60, 66]); p.rect(28, 6, 7, 8, [255, 220, 110]); p.rect(30, 8, 3, 4, [255, 250, 220]); }],
  ['stall', 3.2, 2.8, (p, r) => { p.box(8, 20, 3, 44, WOODC); p.box(53, 20, 3, 44, WOODC); for (let x = 4; x < 60; x++) p.rect(x, 10 + (x % 8 < 4 ? 0 : 0), 1, 12, (x >> 3) % 2 ? [190, 50, 44] : [236, 226, 200]); p.box(8, 40, 48, 6, sh(WOODC, 1.1)); for (let i = 0; i < 7; i++) p.ell(14 + i * 6, 37, 2.5, 2.5, r.pick([[200, 60, 40], [220, 180, 60], [90, 150, 60]])); }],
  ['tomb', 1.2, 1.5, (p, r) => { p.box(20, 22, 24, 42, STONEC); p.ell(32, 22, 12, 10, STONEC); p.rect(31, 24, 2, 14, [70, 70, 70]); p.rect(26, 28, 12, 2, [70, 70, 70]); }],
  ['bones', 1.4, 0.7, (p, r) => { const B = [226, 218, 196]; for (let i = 0; i < 6; i++) p.line(r.int(10, 54), r.int(48, 62), r.int(10, 54), r.int(48, 62), B, 2); p.ell(30, 50, 6, 5, B); p.rect(27, 49, 2, 2, [30, 26, 24]); p.rect(31, 49, 2, 2, [30, 26, 24]); }],
  ['rockprop', 4, 3.4, (p, r) => rock(p, r, [100, 96, 92], true)],
  ['pillar', 1.3, 4, (p, r) => { const S = [196, 164, 112]; const top = r.int(4, 22); p.box(24, top, 16, 60 - top, S); for (let y = top; y < 60; y += 2) p.rect(27, y, 1, 1, sh(S, 0.7)), p.rect(33, y, 1, 1, sh(S, 0.7)); p.box(20, 58, 24, 6, sh(S, 0.9)); for (let x = 24; x < 40; x++) if (r.chance(0.5)) p.clear(x, top), p.clear(x, top + 1); }],
  ['rubble', 2.4, 1, (p, r) => { for (let i = 0; i < 7; i++) p.box(r.int(6, 46), r.int(46, 56), r.int(6, 12), r.int(5, 8), sh([170, 150, 120], r.range(0.7, 1.1))); }],
  ['barrel', 1, 1.25, (p, r) => { for (let y = 12; y < 64; y++) { const w = 15 + Math.round(Math.sin((y - 12) / 52 * Math.PI) * 5); for (let x = -w; x <= w; x++) p.set(32 + x, y, sh(WOODC, (x < -w / 2 ? 1.15 : x > w / 2 ? 0.7 : 0.95) * (Math.abs(x) % 6 === 0 ? 0.7 : 1))); } for (const y of [18, 19, 44, 45]) for (let x = 13; x < 52; x++) if (p.get(x, y)) p.set(x, y, IRONC); }],
  ['crate', 1.1, 1.1, (p, r) => { p.box(10, 20, 44, 44, [142, 104, 60]); for (let k = 0; k < 3; k++) { p.rect(10 + k, 20 + k, 44 - 2 * k, 1, [84, 56, 30]); p.rect(10 + k, 63 - k, 44 - 2 * k, 1, [84, 56, 30]); p.rect(10 + k, 20, 1, 44, [84, 56, 30]); p.rect(53 - k, 20, 1, 44, [84, 56, 30]); } p.line(12, 22, 52, 62, [84, 56, 30], 2); }],
  ['chest', 1.2, 1.1, chest(false)],
  ['chestOpen', 1.2, 1.1, chest(true)],
  ['torch', 0.7, 1.1, (p, r) => { p.box(30, 30, 4, 26, [90, 60, 34]); p.rect(27, 28, 10, 4, IRONC); p.blob(32, 18, 7, 11, [250, 130, 30], r); p.blob(32, 21, 4, 7, [255, 226, 100], r); }],
  ['candle', 0.6, 1.5, (p, r) => { p.box(30, 30, 3, 34, [150, 120, 50]); p.rect(24, 60, 15, 4, [150, 120, 50]); p.rect(24, 28, 15, 3, [150, 120, 50]); for (const x of [25, 31, 37]) { p.rect(x, 20, 2, 8, [236, 230, 210]); p.ell(x + 0.5, 16, 1.6, 3, [255, 200, 80]); } }],
  ['urn', 0.8, 1.1, (p, r) => { p.blob(32, 44, 14, 18, [150, 90, 60], r); p.rect(26, 22, 12, 6, [130, 76, 50]); p.rect(22, 20, 20, 3, [160, 100, 66]); for (let x = 20; x < 44; x += 4) p.rect(x, 42, 2, 3, [60, 40, 30]); }],
  ['anvil', 1.3, 1, (p, r) => { p.box(8, 22, 48, 12, IRONC); p.tri(8, 22, 0, 26, 8, 30, IRONC); p.box(22, 34, 20, 12, sh(IRONC, 0.8)); p.box(14, 46, 36, 8, IRONC); p.box(18, 54, 28, 10, [96, 70, 44]); }],
  ['forge', 2.4, 2.4, (p, r) => { p.box(6, 30, 52, 34, [96, 90, 86]); for (let i = 0; i < 26; i++) p.rect(r.int(6, 54), r.int(30, 62), 4, 1, [60, 56, 54]); p.rect(16, 40, 32, 18, [24, 16, 12]); for (let i = 0; i < 26; i++) p.rect(r.int(17, 46), r.int(48, 57), 2, 2, r.pick([[255, 120, 20], [255, 200, 60], [220, 60, 10]])); p.box(22, 2, 20, 28, [80, 76, 72]); }],
  ['table', 2, 1, (p, r) => { p.box(4, 30, 56, 6, sh(WOODC, 1.1)); p.box(8, 36, 4, 28, WOODC); p.box(52, 36, 4, 28, WOODC); p.rect(20, 24, 6, 6, [200, 190, 170]); p.rect(36, 22, 4, 8, [150, 110, 50]); }],
  ['chair', 0.8, 1.2, (p, r) => { p.box(18, 10, 4, 54, WOODC); p.box(42, 10, 4, 30, WOODC); p.box(18, 12, 28, 5, WOODC); p.box(18, 24, 28, 4, WOODC); p.box(16, 38, 32, 5, sh(WOODC, 1.15)); p.box(42, 43, 4, 21, WOODC); }],
  ['bed', 2.2, 1.1, (p, r) => { p.box(2, 24, 5, 40, WOODC); p.box(57, 36, 5, 28, WOODC); p.box(6, 42, 52, 12, [150, 40, 44]); p.box(6, 38, 16, 8, [232, 226, 210]); p.rect(6, 54, 52, 4, sh(WOODC, 0.8)); for (let x = 24; x < 58; x += 6) p.rect(x, 42, 1, 12, [120, 30, 34]); }],
  ['shelf', 1.8, 2.2, (p, r) => { p.box(6, 2, 52, 62, sh(WOODC, 0.7)); for (const y of [4, 24, 44]) { p.rect(9, y, 46, 17, [34, 24, 16]); for (let x = 11; x < 52; x += r.int(4, 7)) { const h = r.int(7, 14); p.rect(x, y + 17 - h, 3, h, r.pick([[150, 40, 40], [50, 80, 140], [60, 120, 70], [190, 160, 80], [120, 90, 60]])); } } }],
  ['bench', 2, 0.7, (p, r) => { p.box(2, 36, 60, 7, sh(WOODC, 1.1)); p.box(6, 43, 5, 21, WOODC); p.box(53, 43, 5, 21, WOODC); }],
  ['throne', 1.5, 2.4, (p, r) => { const Gd = [214, 172, 60]; p.box(16, 4, 32, 60, Gd); p.rect(20, 8, 24, 32, [130, 24, 36]); p.box(12, 38, 40, 8, Gd); p.rect(16, 40, 32, 5, [150, 30, 44]); p.box(12, 28, 5, 12, Gd); p.box(47, 28, 5, 12, Gd); p.tri(16, 4, 24, 4, 20, -2, Gd); p.tri(40, 4, 48, 4, 44, -2, Gd); p.ell(32, 5, 3, 3, [220, 50, 60]); }],
  ['counter', 2.4, 1.1, (p, r) => { p.box(2, 24, 60, 6, sh(WOODC, 1.2)); p.box(4, 30, 56, 34, sh(WOODC, 0.85)); for (let x = 4; x < 60; x += 14) p.rect(x, 30, 1, 34, [70, 48, 28]); }],
  ['coffin', 1, 2, (p, r) => { for (let y = 2; y < 64; y++) { const w = y < 16 ? 8 + y * 0.5 : 16 - (y - 16) * 0.12; for (let x = -w; x <= w; x++) p.set(32 + x, y, sh([92, 66, 44], x < -w / 2 ? 1.1 : x > w / 2 ? 0.7 : 0.9)); } p.rect(31, 10, 2, 16, [200, 170, 70]); p.rect(26, 14, 12, 2, [200, 170, 70]); }],
  ['sack', 0.9, 0.9, (p, r) => { p.blob(32, 46, 16, 17, [176, 150, 104], r, 0.2); p.rect(27, 24, 10, 6, [150, 126, 86]); p.rect(26, 29, 12, 2, [90, 60, 40]); }],
  ['cauldron', 1.3, 1.2, (p, r) => { p.blob(32, 42, 20, 17, [50, 50, 56], r); p.rect(12, 26, 40, 4, [70, 70, 78]); p.ell(32, 28, 16, 3, [80, 200, 100]); p.rect(16, 58, 4, 6, IRONC); p.rect(44, 58, 4, 6, IRONC); p.ell(26, 20, 2, 2, [120, 230, 140]); p.ell(36, 16, 1.5, 1.5, [120, 230, 140]); }],
  ['pedestal', 1, 1.5, (p, r) => { p.box(22, 30, 20, 30, STONEC); p.box(18, 26, 28, 5, sh(STONEC, 1.1)); p.box(18, 58, 28, 6, sh(STONEC, 0.9)); const Gd = [240, 200, 70]; p.rect(27, 10, 10, 8, Gd); p.rect(31, 18, 2, 5, Gd); p.rect(27, 23, 10, 3, Gd); p.rect(26, 8, 12, 2, [255, 236, 140]); }],
  ['pedestalEmpty', 1, 1.5, (p, r) => { p.box(22, 30, 20, 30, STONEC); p.box(18, 26, 28, 5, sh(STONEC, 1.1)); p.box(18, 58, 28, 6, sh(STONEC, 0.9)); }],
  ['stairsUp', 2, 2.4, (p, r) => { for (let i = 0; i < 8; i++) p.box(4 + i * 3, 56 - i * 7, 56 - i * 6, 8, sh(STONEC, 0.7 + i * 0.06)); p.tri(32, 2, 24, 12, 40, 12, [240, 220, 120]); }],
  ['stairsDown', 2, 1.6, (p, r) => { p.box(2, 24, 60, 40, sh(STONEC, 0.9)); for (let i = 0; i < 6; i++) p.rect(8 + i * 3, 30 + i * 5, 48 - i * 6, 5, sh([60, 58, 56], 1 - i * 0.15)); p.tri(32, 62, 24, 52, 40, 52, [240, 220, 120]); }],
  ['shrine', 1.6, 2.6, (p, r) => { p.box(22, 14, 20, 50, STONEC); p.tri(18, 14, 46, 14, 32, 0, sh(STONEC, 1.1)); p.box(16, 56, 32, 8, sh(STONEC, 0.85)); p.rect(26, 24, 12, 16, [40, 44, 60]); p.ell(32, 32, 3, 5, [140, 210, 255]); p.set(32, 31, [255, 255, 255]); }],
  ['campfire', 1.4, 1, (p, r) => { for (let i = 0; i < 9; i++) p.blob(12 + i * 5, 58 - Math.abs(4 - i) * 0.5, 4, 3, [110, 106, 100], r); p.line(18, 56, 46, 48, [80, 54, 30], 3); p.line(46, 56, 18, 48, [80, 54, 30], 3); p.blob(32, 38, 8, 13, [250, 120, 30], r); p.blob(32, 42, 4, 8, [255, 226, 100], r); }],
  ['cart', 2.8, 1.8, (p, r) => { p.box(6, 22, 46, 20, WOODC); for (let x = 6; x < 52; x += 8) p.rect(x, 22, 1, 20, [70, 48, 28]); p.line(52, 40, 63, 52, WOODC, 2); p.ell(18, 50, 12, 12, [70, 48, 28]); p.ell(18, 50, 9, 9, [0, 0, 0], 0); p.ell(18, 50, 9, 9, [124, 88, 50]); p.ell(18, 50, 3, 3, IRONC); p.blob(26, 18, 12, 6, [176, 150, 104], r); }],
  ['ore', 1.8, 1.4, (p, r) => { rock(p, r, [96, 92, 90], true); for (let i = 0; i < 16; i++) p.rect(r.int(16, 46), r.int(40, 60), 3, 2, r.pick([[190, 120, 70], [214, 150, 90], [150, 90, 60]])); }],
  ['stone', 1.4, 3, (p, r) => { for (let y = 4; y < 64; y++) { const w = 9 + Math.sin(y * 0.2) * 2 + (y > 50 ? 2 : 0); for (let x = -w; x <= w; x++) p.set(32 + x, y, sh([116, 118, 112], (x < -w / 3 ? 1.12 : x > w / 3 ? 0.72 : 0.92) + r.range(-0.06, 0.06))); } for (let i = 0; i < 5; i++) { const y = 14 + i * 9; p.line(28, y, 36, y + 3, [120, 220, 255]); p.line(36, y + 3, 30, y + 6, [120, 220, 255]); } }],
  ['tent', 3, 2.2, (p, r) => { p.tri(32, 6, 2, 63, 62, 63, [150, 124, 84]); p.tri(32, 6, 22, 63, 42, 63, [30, 22, 16]); p.line(32, 6, 2, 63, [100, 80, 52]); p.line(32, 6, 62, 63, [100, 80, 52]); p.line(32, 0, 32, 8, [70, 48, 28], 2); }],
  ['lootbag', 0.6, 0.5, (p, r) => { p.blob(32, 48, 15, 14, [150, 110, 60], r, 0.2); p.rect(27, 30, 10, 5, [130, 94, 50]); p.rect(26, 34, 12, 2, [220, 190, 80]); }],
  ['banner', 0.9, 2.2, (p, r) => { p.rect(14, 2, 36, 3, [90, 64, 36]); for (let y = 5; y < 56; y++) for (let x = 18; x < 46; x++) if (y < 48 || Math.abs(x - 32) > (y - 48) * 1.6) p.set(x, y, x < 22 || x > 41 ? [214, 172, 60] : [130, 24, 36]); p.ell(32, 24, 5, 5, [214, 172, 60]); }],
  ['rack', 1.6, 1.8, (p, r) => { p.box(6, 8, 4, 56, WOODC); p.box(54, 8, 4, 56, WOODC); p.box(6, 16, 52, 3, WOODC); p.box(6, 46, 52, 3, WOODC); for (let i = 0; i < 4; i++) { const x = 16 + i * 10; p.rect(x, 4, 2, 44, [190, 196, 206]); p.rect(x - 2, 44, 6, 2, [120, 90, 40]); p.rect(x, 46, 2, 10, [80, 54, 30]); } }],
  ['web', 2, 2, (p, r) => { const W = [220, 220, 226]; for (let i = 0; i < 8; i++) { const a = i * 0.785; p.line(32, 32, 32 + Math.cos(a) * 30, 32 + Math.sin(a) * 30, W); } for (let k = 1; k < 4; k++) for (let i = 0; i < 8; i++) { const a = i * 0.785, b = a + 0.785; p.line(32 + Math.cos(a) * k * 9, 32 + Math.sin(a) * k * 9, 32 + Math.cos(b) * k * 9, 32 + Math.sin(b) * k * 9, W); } }],
  ['crystal', 1, 1.2, (p, r) => { for (const [x, h, w] of [[22, 30, 6], [32, 46, 8], [43, 26, 6]]) { p.tri(x - w, 63, x + w, 63, x, 63 - h, [110, 200, 230]); p.tri(x - w, 63, x, 63, x, 63 - h, [180, 240, 255]); } }],
  ['signpost', 1.2, 2.2, (p, r) => { p.box(30, 16, 4, 48, WOODC); p.box(10, 8, 44, 12, sh(WOODC, 1.15)); p.tri(54, 8, 54, 20, 62, 14, sh(WOODC, 1.15)); for (let x = 14; x < 50; x += 3) p.rect(x, 13, 2, 2, [50, 34, 20]); }],
  ['signAnvil', 1.6, 1.6, signProp('anvil')], ['signMug', 1.6, 1.6, signProp('mug')], ['signCoin', 1.6, 1.6, signProp('coin')], ['signFlask', 1.6, 1.6, signProp('flask')],
  ['signStar', 1.6, 1.6, signProp('star')], ['signShield', 1.6, 1.6, signProp('shield')], ['signCross', 1.6, 1.6, signProp('cross')],
];

export function makeAtlases() {
  T.flora = buildAtlas(FLORA_DEFS, 8, FLORA);
  T.props = buildAtlas(PROP_DEFS, 8, PROPS);
}
// A canvas of one atlas cell (for UI use)
export function atlasCell(atlasTex, reg, name, scale = 1) {
  const r = reg[name], src = atlasTex._pix, p = new Pix(CELLPX, CELLPX);
  for (let y = 0; y < CELLPX; y++) for (let x = 0; x < CELLPX; x++) { const o = ((r.cy * CELLPX + y) * src.w + r.cx * CELLPX + x) * 4; p.set(x, y, [src.d[o], src.d[o + 1], src.d[o + 2]], src.d[o + 3]); }
  return p.canvas(scale);
}
