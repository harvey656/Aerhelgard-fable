// Deterministic random + noise helpers. Everything in the world derives from these.

export function hash2(x, y, seed = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return h >>> 0;
}
export function hash01(x, y, seed = 0) { return hash2(x, y, seed) / 4294967296; }

export function strSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export class RNG {
  constructor(seed) { this.s = (seed >>> 0) || 1; }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
  // weighted pick: entries [[value, weight], ...]
  weighted(entries) {
    let tot = 0;
    for (const e of entries) tot += e[1];
    let r = this.next() * tot;
    for (const e of entries) { r -= e[1]; if (r <= 0) return e[0]; }
    return entries[entries.length - 1][0];
  }
}

// Non-deterministic rng for moment-to-moment gameplay (combat rolls etc.)
export const rnd = {
  next: () => Math.random(),
  range: (a, b) => a + (b - a) * Math.random(),
  int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
  chance: (p) => Math.random() < p,
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  weighted(entries) {
    let tot = 0;
    for (const e of entries) tot += e[1];
    let r = Math.random() * tot;
    for (const e of entries) { r -= e[1]; if (r <= 0) return e[0]; }
    return entries[entries.length - 1][0];
  },
};

// 2D gradient noise, output roughly [-1, 1]
export function makeNoise(seed) {
  const GX = [1, -1, 1, -1, 1, -1, 0, 0], GY = [1, 1, -1, -1, 0, 0, 1, -1];
  function g(ix, iy, fx, fy) {
    const h = hash2(ix, iy, seed) & 7;
    return GX[h] * fx + GY[h] * fy;
  }
  function n2(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const a = g(ix, iy, fx, fy), b = g(ix + 1, iy, fx - 1, fy);
    const c = g(ix, iy + 1, fx, fy - 1), d = g(ix + 1, iy + 1, fx - 1, fy - 1);
    return (a + (b - a) * u + (c - a + (a - b - c + d) * u) * v) * 1.5;
  }
  function fbm(x, y, oct = 4) {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { s += a * n2(x * f + i * 17.1, y * f - i * 9.7); a *= 0.5; f *= 2.03; }
    return s;
  }
  function ridged(x, y, oct = 4) {
    let s = 0, a = 0.5, f = 1, w = 1;
    for (let i = 0; i < oct; i++) {
      let n = 1 - Math.abs(n2(x * f + i * 31.3, y * f + i * 13.9));
      n *= n; s += n * a * w; w = Math.min(1, n * 1.6); a *= 0.5; f *= 2.07;
    }
    return s; // ~[0,1]
  }
  return { n2, fbm, ridged };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
