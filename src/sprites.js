// Character, monster and item sprites (procedural pixel art).
import * as THREE from '../vendor/three.module.min.js';
import { RNG, strSeed } from './rng.js';
import { Pix, hex, sh, mix } from './art.js';
import { MONSTERS } from './data.js';

const DARK = [26, 20, 18];
const FW = 32, FH = 48;

// frame: 0/1 walk, 2 attack. back: seen from behind
function drawHuman(p, ox, L, frame, back, rng) {
  const skel = L.skel, ghost = L.ghost, mummy = L.mummy, golem = L.golem;
  let skin = hex(L.skin || '#d8a878');
  if (skel) skin = [226, 220, 200]; if (mummy) skin = [196, 180, 140]; if (golem) skin = [120, 118, 112];
  if (ghost) skin = L.dark ? [70, 60, 100] : [190, 220, 236];
  let shirt = hex(L.shirt || '#6a4a30'), pants = hex(L.pants || '#4a3a2a');
  if (L.robe) shirt = pants = hex(L.robe);
  if (L.armor) shirt = hex(L.armor);
  if (L.bare || skel || mummy || golem || ghost) { shirt = skin; if (!L.bare) pants = skin; }
  if (skel && L.robe) shirt = pants = hex(L.robe);
  const bw = Math.round(6 * (L.build || 1)), cx = ox + 16;
  const thin = skel && !L.robe ? 1 : 0;
  const S = (x, y, w, h, c) => p.box(x, y, w, h, c);
  // legs
  const robe = L.robe || L.skirt || ghost;
  const l0 = frame === 1 ? 2 : 0, l1 = frame === 0 ? 2 : 0;
  if (!ghost) {
    const lw = 4 - thin * 2;
    S(cx - bw + 1 + thin, 29, lw, 15 - l0, pants); S(cx + bw - 1 - lw - thin, 29, lw, 15 - l1, pants);
    const shoe = skel || mummy || golem || L.bare ? sh(skin, 0.8) : [50, 36, 26];
    p.rect(cx - bw + 1 + thin, 44 - l0, lw + (back ? 0 : 1), 3, shoe); p.rect(cx + bw - 1 - lw - thin - (back ? 0 : 1), 44 - l1, lw + (back ? 0 : 1), 3, shoe);
  }
  if (robe) {
    const len = ghost ? 46 : L.robe ? 44 : 38, c = L.skirt && !L.robe ? hex(L.shirt) : pants;
    for (let y = 27; y < len; y++) { const w = bw + Math.floor((y - 27) * 0.2) + (ghost && y > 38 ? -Math.floor((y - 38) * 0.6) + ((y + frame) % 3 === 0 ? 1 : 0) : 0); for (let x = -w; x < w; x++) p.set(cx + x, y, sh(ghost ? skin : c, (x < -w / 3 ? 1.1 : x > w / 3 ? 0.72 : 0.92) * (ghost ? 1 - (y - 27) * 0.02 : 1)), ghost ? 200 - (y - 27) * 7 : 255); }
  }
  // torso
  if (thin) { p.rect(cx - 1, 15, 2, 14, skin); for (let y = 16; y < 26; y += 2) p.rect(cx - bw + 1, y, bw * 2 - 2, 1, skin); p.rect(cx - bw + 1, 27, bw * 2 - 2, 2, skin); }
  else S(cx - bw, 15, bw * 2, 14, shirt);
  if (mummy) for (let y = 15; y < 46; y += 3) p.line(cx - bw - 3, y + (y % 2), cx + bw + 2, y + 2, sh(skin, 0.7));
  if (golem) { p.rect(cx - bw, 15, bw * 2, 1, sh(skin, 1.3)); for (let i = 0; i < 6; i++) p.rect(cx - bw + rng.int(0, bw * 2 - 2), rng.int(16, 28), 2, 1, sh(skin, 0.6)); }
  if (L.ragged) for (let i = 0; i < 9; i++) p.rect(cx - bw + rng.int(0, bw * 2 - 1), rng.int(18, 30), 1, 2, sh(skin, 0.8));
  if (L.armor && !back) { p.rect(cx - bw + 1, 17, bw * 2 - 2, 1, sh(shirt, 1.35)); p.rect(cx - 1, 15, 1, 13, sh(shirt, 0.7)); }
  if (L.tabard) p.rect(cx - 3, 16, 6, 14, hex(L.tabard));
  if (L.apron && !back) p.rect(cx - bw + 1, 19, bw * 2 - 2, 16, hex(L.apron));
  if (!thin && !L.robe && !golem && !mummy && !ghost) p.rect(cx - bw, 27, bw * 2, 2, L.bare ? pants : sh(shirt, 0.55));
  // arms
  const aw = 3 - thin, sw = frame === 0 ? 1 : frame === 1 ? -1 : 0;
  const armC = L.bare || thin || mummy || golem || ghost ? skin : shirt;
  S(cx - bw - aw, 16, aw, 11 + sw, armC); p.rect(cx - bw - aw, 27 + sw, aw, 2, skin);
  const wx = cx + bw + 1;
  if (frame === 2) { S(cx + bw, 9, aw, 9, armC); p.rect(cx + bw, 7, aw, 2, skin); }
  else { S(cx + bw, 16, aw, 11 - sw, armC); p.rect(cx + bw, 27 - sw, aw, 2, skin); }
  // weapon (right hand = viewer's right from front)
  const hy = frame === 2 ? 7 : 27 - sw, W = L.weapon, steel = [196, 200, 210], wood = [110, 76, 44];
  if (W === 'sword') { if (frame === 2) { p.line(wx, hy, wx - 12, hy + 14, steel, 2); } else { p.line(wx, hy, wx + 2, hy - 15, steel, 2); p.rect(wx - 2, hy - 1, 6, 1, [150, 120, 50]); } }
  if (W === 'axe' || W === 'club') { const tx = frame === 2 ? wx - 8 : wx + 1, ty = frame === 2 ? hy + 12 : hy - 14; p.line(wx, hy, tx, ty, wood, 2); if (W === 'axe') p.rect(tx - 2, ty - 2, 6, 6, steel); else p.ell(tx, ty, 3, 3, sh(wood, 0.8)); }
  if (W === 'staff') { p.line(wx, 44, wx, 6, wood, 2); p.ell(wx, 5, 2.5, 2.5, frame === 2 ? [255, 240, 160] : [120, 200, 255]); }
  if (W === 'spear') { p.line(wx + 1, 45, wx + 1, 4, wood, 1); p.tri(wx - 1, 5, wx + 3, 5, wx + 1, 0, steel); }
  if (W === 'bow') { for (let t = -10; t <= 10; t++) p.set(wx + 3 - Math.round((t * t) / 34), 22 + t, wood); p.line(wx, 12, wx, 32, [220, 220, 210]); }
  // head
  const big = L.ears ? 1 : 0, hr = 5 + big, hy0 = 9 - big;
  p.blob(cx, hy0, hr, hr + 0.5, skin, null);
  if (L.ears) { p.tri(cx - hr, hy0 - 1, cx - hr - 4, hy0 - 4, cx - hr, hy0 + 2, skin); p.tri(cx + hr, hy0 - 1, cx + hr + 4, hy0 - 4, cx + hr, hy0 + 2, skin); }
  const hair = hex(L.hair || '#3a2a1a'), hs = L.bald || skel || mummy || golem || ghost ? 0 : (L.hairStyle === undefined ? 1 : L.hairStyle);
  if (hs) {
    for (let y = hy0 - hr - 1; y <= hy0 + (back ? hr : -2); y++) for (let x = cx - hr; x <= cx + hr; x++) if (p.get(x, y) || y < hy0 - hr + 1 && Math.abs(x - cx) < hr - 1) p.set(x, y, sh(hair, x < cx ? 1.1 : 0.85));
    if (hs >= 2) { const len = hs === 2 ? 9 : 5; p.rect(cx - hr - 1, hy0 - 2, 2, len, hair); p.rect(cx + hr, hy0 - 2, 2, len, sh(hair, 0.8)); if (back) p.rect(cx - hr, hy0, hr * 2, len - 1, sh(hair, 0.9)); }
    if (hs === 3 && back) p.rect(cx - 1, hy0 + 2, 3, 9, hair);
  }
  if (!back) {
    const ey = hy0;
    if (skel) { p.rect(cx - 3, ey - 1, 2, 2, DARK); p.rect(cx + 1, ey - 1, 2, 2, DARK); p.rect(cx - 2, ey + 3, 5, 1, DARK); p.set(cx, ey + 1, DARK); if (L.robe) { p.set(cx - 2, ey, [200, 80, 255]); p.set(cx + 2, ey, [200, 80, 255]); } }
    else if (golem) { p.rect(cx - 3, ey - 1, 2, 2, [255, 180, 40]); p.rect(cx + 1, ey - 1, 2, 2, [255, 180, 40]); }
    else if (ghost) { p.rect(cx - 3, ey - 1, 2, 3, L.dark ? [255, 60, 60] : [20, 30, 60]); p.rect(cx + 1, ey - 1, 2, 3, L.dark ? [255, 60, 60] : [20, 30, 60]); p.rect(cx - 1, ey + 3, 3, 2, [20, 30, 60]); }
    else {
      p.set(cx - 2, ey, DARK); p.set(cx + 2, ey, DARK); if (!mummy) { p.set(cx - 2, ey - 1, sh(skin, 0.75)); p.set(cx + 2, ey - 1, sh(skin, 0.75)); }
      p.rect(cx - 1, ey + 3, 3, 1, sh(skin, 0.6)); p.set(cx, ey + 1, sh(skin, 0.8));
      if (L.beard) for (let y = ey + 2; y <= ey + 6; y++) for (let x = cx - 4; x <= cx + 4; x++) if ((p.get(x, y) || y > ey + 4 && Math.abs(x - cx) < 3) && !(y === ey + 3 && Math.abs(x - cx) < 2)) p.set(x, y, hair);
      if (L.tusks) { p.rect(cx - 3, ey + 2, 1, 2, [240, 236, 220]); p.rect(cx + 3, ey + 2, 1, 2, [240, 236, 220]); }
      if (L.mask) p.rect(cx - 4, ey + 1, 9, 4, [40, 34, 30]);
      if (L.female && !L.mask) p.set(cx, ey + 3, [190, 80, 80]);
    }
  }
  // headgear
  if (L.hood) { const c = sh(L.robe ? hex(L.robe) : shirt, 0.8); for (let y = hy0 - hr - 1; y <= hy0 + hr + 1; y++) for (let x = cx - hr - 1; x <= cx + hr + 1; x++) { const dx = x - cx, dy = y - hy0; if (dx * dx + dy * dy <= (hr + 1.6) * (hr + 1.6) && (back || dx * dx + (dy - 1) * (dy - 1) > (hr - 1.2) * (hr - 1.2) || dy < -3)) p.set(x, y, sh(c, dx < 0 ? 1.1 : 0.85)); } }
  if (L.helm) { for (let y = hy0 - hr - 1; y <= hy0 - 1; y++) for (let x = cx - hr; x <= cx + hr; x++) if (p.get(x, y) || y >= hy0 - hr) p.set(x, y, sh([150, 152, 162], x < cx ? 1.15 : 0.8)); if (!back) p.rect(cx, hy0 - 1, 1, 4, [150, 152, 162]); else p.rect(cx - hr, hy0 - 1, hr * 2 + 1, 4, [130, 132, 142]); }
  if (L.hat === 1) { const c = sh(pants, 0.9); p.rect(cx - hr - 2, hy0 - hr + 1, hr * 2 + 5, 2, c); p.rect(cx - hr + 1, hy0 - hr - 2, hr * 2 - 1, 3, c); }
  if (L.hat === 2) { const c = shirt; p.rect(cx - hr - 3, hy0 - hr + 1, hr * 2 + 7, 2, c); p.tri(cx - hr, hy0 - hr + 1, cx + hr, hy0 - hr + 1, cx + 2, hy0 - hr - 10, c); }
  if (L.crown) { const g = [240, 200, 60]; p.rect(cx - hr + 1, hy0 - hr - 1, hr * 2 - 1, 2, g); for (let x = cx - hr + 1; x < cx + hr; x += 2) p.set(x, hy0 - hr - 2, g); p.set(cx, hy0 - hr - 1, [230, 50, 60]); }
}

function drawQuad(p, ox, A, frame, rng) {
  const c = hex(A.col), c2 = hex(A.col2), bulk = A.bulk || 1, cx = ox + 24, eye = hex(A.eye || '#201810');
  const by = 30 - bulk * 3, rx = 11 * bulk, ry = 9 * bulk;
  const la = frame === 0 ? 2 : 0, lb = frame === 1 ? 2 : 0;
  p.box(cx - rx + 1, by + 4, 4, 46 - by - 4 - lb - 3, sh(c, 0.7)); p.box(cx + rx - 5, by + 4, 4, 46 - by - 4 - la - 3, sh(c, 0.7));
  if (A.tail) p.line(cx + rx - 2, by, cx + rx + 8, by - 8, c2, 1); else p.line(cx + rx - 3, by - 3, cx + rx + 3, by - 9 - frame, c, 2);
  p.blob(cx, by, rx, ry, c, rng, 0.15);
  p.box(cx - rx + 4, by + 6, 4, 47 - by - 6 - la, c); p.box(cx + rx - 8, by + 6, 4, 47 - by - 6 - lb, c);
  const hy = by + 4 + (frame === 2 ? 3 : 0), hr = 6.5 * Math.sqrt(bulk);
  for (const s of [-1, 1]) { const ex = cx + s * (hr - 1.5); if (A.ears === 2) p.tri(ex - 2, hy - hr + 2, ex + 2, hy - hr + 2, ex + s, hy - hr - 5, c); else if (A.ears === 3) p.tri(ex - 2, hy - hr + 2, ex + 2, hy - hr + 2, ex + s * 2, hy - hr - 8, c); else p.ell(ex, hy - hr + 1, 2.4, 2.4, sh(c, 0.85)); }
  p.blob(cx, hy, hr, hr * 0.92, sh(c, 1.08), rng, 0.1);
  const sn = A.snout === 2 ? 4 : 3;
  p.ell(cx, hy + 3, sn, sn - 0.6, c2); p.rect(cx - 1, hy + 2, 2, 2, DARK);
  p.rect(cx - 4, hy - 2, 2, 2, eye); p.rect(cx + 3, hy - 2, 2, 2, eye);
  if (A.tusks) { p.rect(cx - 5, hy + 3, 1, 3, [240, 236, 220]); p.rect(cx + 4, hy + 3, 1, 3, [240, 236, 220]); }
  if (frame === 2) { p.rect(cx - 3, hy + 5, 6, 3, [150, 30, 30]); p.set(cx - 3, hy + 5, [255, 255, 255]); p.set(cx + 2, hy + 5, [255, 255, 255]); }
}
function drawArthro(p, ox, A, frame, rng) {
  const c = hex(A.col), c2 = hex(A.col2), cx = ox + 24;
  if (A.kind === 'spider') {
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const y0 = 28 + i * 2, kx = cx + s * (14 + i * 2), ky = 16 + i * 5 - ((i + frame) % 2) * 2, fx = cx + s * (19 + i * 1.5), fy = 46 - ((i + frame) % 2) * 2;
      p.line(cx + s * 5, y0, kx, ky, c, 2); p.line(kx, ky, fx, fy, sh(c, 0.8), 1);
    }
    p.blob(cx, 22, 11, 10, c, rng, 0.15); p.blob(cx, 20, 4, 5, c2, rng); p.blob(cx, 34, 7, 6, sh(c, 1.15), rng);
    for (const [x, y] of [[-3, 33], [2, 33], [-5, 31], [4, 31]]) p.set(cx + x, y, [255, 40, 40]);
    p.rect(cx - 3, 39, 2, 3 + (frame === 2 ? 2 : 0), [230, 230, 220]); p.rect(cx + 2, 39, 2, 3 + (frame === 2 ? 2 : 0), [230, 230, 220]);
  } else {
    for (let i = 0; i < 3; i++) for (const s of [-1, 1]) p.line(cx + s * 6, 34 + i * 3, cx + s * (15 + i), 44 - ((i + frame) % 2) * 2, c2, 1);
    p.blob(cx, 36, 9, 8, c, rng, 0.15);
    for (let i = 0; i < 6; i++) { const a = i * 0.45, x = cx + Math.sin(a) * 6 - 2, y = 28 - i * 4.4 + (frame === 2 ? i * 1.2 : 0); p.blob(x, y, 3.4, 3, sh(c, 1 - i * 0.04), rng); }
    p.tri(cx + 3, frame === 2 ? 12 : 5, cx + 7, frame === 2 ? 14 : 7, cx + 2, frame === 2 ? 20 : 12, [60, 30, 20]);
    for (const s of [-1, 1]) { p.line(cx + s * 7, 38, cx + s * 15, 34, c, 2); p.blob(cx + s * 17, 33 + (frame === 2 ? 3 : 0), 4.5, 3.5, sh(c, 1.1), rng); p.rect(cx + s * 17 - 1, 35 + (frame === 2 ? 3 : 0), 4, 1, DARK); }
    p.set(cx - 2, 40, DARK); p.set(cx + 2, 40, DARK);
  }
}
function drawFlyer(p, ox, A, frame, rng) {
  const c = hex(A.col), c2 = hex(A.col2), cx = ox + 24, up = frame === 0 ? -1 : 1;
  const wing = (s, span, y0, col) => { const ty = y0 - up * 9; p.tri(cx + s * 3, y0, cx + s * span, ty, cx + s * (span - 5), y0 + 9, col); p.tri(cx + s * 3, y0, cx + s * 3, y0 + 8, cx + s * (span - 5), y0 + 9, sh(col, 0.8)); p.line(cx + s * 3, y0, cx + s * span, ty, sh(col, 0.6)); };
  if (A.kind === 'bat') { wing(-1, 22, 22, c2); wing(1, 22, 22, c2); p.blob(cx, 24, 5, 6, c, rng); p.tri(cx - 4, 19, cx - 1, 19, cx - 3, 14, c); p.tri(cx + 4, 19, cx + 1, 19, cx + 3, 14, c); p.set(cx - 2, 22, [255, 60, 40]); p.set(cx + 2, 22, [255, 60, 40]); if (frame === 2) p.rect(cx - 1, 26, 3, 2, [240, 240, 230]); }
  if (A.kind === 'harpy') { wing(-1, 23, 18, c); wing(1, 23, 18, c); p.blob(cx, 26, 6, 9, c2, rng); p.blob(cx, 13, 4.5, 5, c2, null); p.rect(cx - 5, 8, 10, 4, [90, 40, 30]); p.rect(cx - 6, 10, 2, 8, [90, 40, 30]); p.rect(cx + 4, 10, 2, 8, [90, 40, 30]); p.set(cx - 2, 13, DARK); p.set(cx + 2, 13, DARK); p.rect(cx - 1, 16, 3, 1, [150, 40, 40]); p.rect(cx - 5, 32, 10, 5, c); for (const s of [-1, 1]) { p.line(cx + s * 3, 36, cx + s * 4, 43 + (frame === 2 ? 3 : 0), [200, 170, 80], 1); p.rect(cx + s * 4 - 1, 43 + (frame === 2 ? 3 : 0), 3, 2, [200, 170, 80]); } }
  if (A.kind === 'imp') { wing(-1, 17, 22, c2); wing(1, 17, 22, c2); p.blob(cx, 30, 5.5, 7, c, rng); p.blob(cx, 19, 5, 5, c, null); p.tri(cx - 5, 16, cx - 2, 15, cx - 5, 10, [230, 220, 200]); p.tri(cx + 5, 16, cx + 2, 15, cx + 5, 10, [230, 220, 200]); p.set(cx - 2, 19, [255, 230, 60]); p.set(cx + 2, 19, [255, 230, 60]); p.rect(cx - 2, 22, 5, 1, DARK); p.line(cx - 3, 36, cx - 4, 42, c, 2); p.line(cx + 3, 36, cx + 4, 42, c, 2); p.line(cx + 4, 34, cx + 12, 38 - up * 2, c2); if (frame === 2) p.ell(cx - 10, 26, 3, 3, [255, 160, 40]); }
}
function drawWisp(p, ox, A, frame) {
  const c = hex(A.col), cx = ox + 24, cy = 24, R = 13 + frame * 2;
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) { const d = Math.hypot(x, y) / R; if (d < 1 && ((x + y) & 1 || d < 0.6)) p.set(cx + x, cy + y, mix([255, 255, 255], c, Math.min(1, d * 1.6)), Math.round(255 * (1 - d) * (d < 0.35 ? 1 : 0.8)) + 40); }
}
function drawBlob(p, ox, A, frame, rng) {
  const c = hex(A.col), c2 = hex(A.col2), cx = ox + 24;
  if (A.wurm) {
    for (let i = 0; i < 9; i++) { const y = 44 - i * 4.4, w = 9 - i * 0.25, x = cx + Math.sin(i * 0.7 + frame * 1.2) * 3; p.blob(x, y, w, 3.6, i % 2 ? c : c2, rng, 0.15); }
    const hx = cx + Math.sin(8 * 0.7 + frame * 1.2) * 3; p.ell(hx, 7, 6 + (frame === 2 ? 1 : 0), 5 + (frame === 2 ? 2 : 0), [60, 16, 20]);
    for (let i = 0; i < 8; i++) { const a = i * 0.785; p.set(hx + Math.cos(a) * 5, 7 + Math.sin(a) * 4, [240, 236, 220]); }
    for (let i = 0; i < 7; i++) p.blob(cx - 14 + i * 5, 46, 3, 2, [150, 120, 80], rng);
    return;
  }
  const top = A.arms ? 12 : 26, h = 46 - top + (frame === 1 ? -1 : 0);
  for (let y = 0; y < h; y++) { const t = y / h, w = (A.arms ? 8 : 12) + t * t * (A.arms ? 8 : 9) + Math.sin(y * 0.9 + frame) * 1.2; for (let x = -w; x <= w; x++) p.set(cx + x, 46 - h + y, sh(c, (x < -w / 3 ? 1.15 : x > w / 3 ? 0.72 : 0.94) + rng.range(-0.07, 0.07))); }
  for (let i = 0; i < 10; i++) p.rect(cx + rng.int(-9, 9), 46 - h + rng.int(3, h - 2), 2, 2, c2);
  if (A.arms) for (const s of [-1, 1]) { const ay = top + 10, ey = frame === 2 ? ay - 8 : ay + 12; p.line(cx + s * 9, ay, cx + s * 18, ey, c, 3); p.rect(cx + s * 18 - 1, ey - 1, 3, 3, c2); }
  const n = A.eyes, ey = 46 - h + 6;
  for (let i = 0; i < n; i++) { const x = cx + (i - (n - 1) / 2) * 6; p.rect(x - 1, ey, 3, 3, [240, 220, 80]); p.set(x, ey + 1, DARK); }
  if (!n) { p.ell(cx, 46 - h + 5, 4, 3, [90, 24, 34]); for (let i = -3; i <= 3; i += 2) p.set(cx + i, 46 - h + 3, [240, 236, 220]); }
  else if (frame === 2) p.rect(cx - 4, ey + 6, 9, 3, [40, 16, 20]);
}

function sheetTexture(p) { const t = p.texture(); t._pix = p; return t; }
const sheetCache = new Map();
// Returns { tex, frames, fw (uv width of a frame), aspect, back: bool }
export function humanSheet(look, key) {
  let s = sheetCache.get(key); if (s) { s.used = performance.now(); return s; }
  const p = new Pix(FW * 5, FH);
  for (let f = 0; f < 5; f++) { const q = new Pix(FW, FH); drawHuman(q, 0, look, f < 2 ? f : f === 4 ? 2 : f - 2, f === 2 || f === 3, new RNG(strSeed(key) + 7)); q.outline(); q.blit(p, f * FW, 0); }
  s = { tex: sheetTexture(p), frames: 5, aspect: FW / FH, back: true, used: performance.now(), pix: p };
  sheetCache.set(key, s);
  if (sheetCache.size > 160) { // evict stale citizen sheets
    const old = [...sheetCache.entries()].filter((e) => e[0][0] === 'c').sort((a, b) => a[1].used - b[1].used).slice(0, 40);
    for (const [k, v] of old) { v.tex.dispose(); sheetCache.delete(k); }
  }
  return s;
}
export function monsterSheet(id) {
  const key = 'm:' + id; let s = sheetCache.get(key); if (s) return s;
  const M = MONSTERS[id], [tpl, A] = M.art;
  if (tpl === 'human') { s = humanSheet(A, key); return s; }
  const p = new Pix(48 * 3, 48);
  for (let f = 0; f < 3; f++) {
    const q = new Pix(48, 48), rng = new RNG(strSeed(id) + 3);
    if (tpl === 'quad') drawQuad(q, 0, A, f, rng); else if (tpl === 'arthro') drawArthro(q, 0, A, f, rng);
    else if (tpl === 'flyer') drawFlyer(q, 0, A, f, rng); else if (tpl === 'wisp') drawWisp(q, 0, A, f); else drawBlob(q, 0, A, f, rng);
    if (tpl !== 'wisp') q.outline(); q.blit(p, f * 48, 0);
  }
  s = { tex: sheetTexture(p), frames: 3, aspect: 1, back: false, pix: p };
  sheetCache.set(key, s); return s;
}
// Portrait canvas (head & shoulders) from a human look
export function portrait(look, key, scale = 4) {
  const q = new Pix(FW, FH); drawHuman(q, 0, look, 2, false, new RNG(strSeed(key) + 7)); q.outline();
  const o = new Pix(24, 24);
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) { const s = (y * FW + x + 4) * 4; if (q.d[s + 3]) o.set(x, y, [q.d[s], q.d[s + 1], q.d[s + 2]], q.d[s + 3]); }
  return o.canvas(scale);
}
export function sheetFrameCanvas(sheet, frame, scale = 3) {
  const fw = sheet.pix.w / sheet.frames, o = new Pix(fw, sheet.pix.h);
  for (let y = 0; y < o.h; y++) for (let x = 0; x < fw; x++) { const s = (y * sheet.pix.w + x + frame * fw) * 4; if (sheet.pix.d[s + 3]) o.set(x, y, [sheet.pix.d[s], sheet.pix.d[s + 1], sheet.pix.d[s + 2]], sheet.pix.d[s + 3]); }
  return o.canvas(scale);
}

// ---------- Item art (icons at S=1 → 16px; first-person weapons at S=4 → 64px) ----------
export function drawItem(p, kind, colHex, S = 1) {
  const c = hex(colHex || '#b8c0cc'), hi = sh(c, 1.25), lo = sh(c, 0.7), wood = [120, 84, 48], gold = [226, 186, 70];
  const L = (x0, y0, x1, y1, col, th = 1) => p.line(x0 * S, y0 * S, x1 * S, y1 * S, col, Math.max(1, Math.round(th * S)));
  const R = (x, y, w, h, col) => p.rect(Math.round(x * S), Math.round(y * S), Math.round(w * S), Math.round(h * S), col);
  const E = (x, y, rx, ry, col) => p.ell(x * S, y * S, rx * S, ry * S, col);
  const TR = (a, b, c2, d, e, f, col) => p.tri(a * S, b * S, c2 * S, d * S, e * S, f * S, col);
  const blade = (len, th) => { L(4, 12, 4 + len, 12 - len, c, th); L(4.6, 12, 4.6 + len, 12 - len, hi, th * 0.4); };
  switch (kind) {
    case 'dagger': blade(6, 1.6); L(3, 10, 6, 13, gold, 1.2); L(2, 14, 4, 12, wood, 1.4); break;
    case 'shortsword': blade(8, 1.8); L(2.5, 9.5, 6.5, 13.5, gold, 1.2); L(1.5, 14.5, 4, 12, wood, 1.5); break;
    case 'longsword': blade(10, 1.8); L(2, 9, 7, 14, gold, 1.3); L(1, 15, 4, 12, wood, 1.5); break;
    case 'claymore': blade(11, 2.6); L(1.5, 8.5, 7.5, 14.5, gold, 1.5); L(0.5, 15.5, 4, 12, wood, 1.7); break;
    case 'mace': L(2, 14, 10, 6, wood, 1.4); E(11, 5, 3, 3, c); E(10.3, 4.3, 1, 1, hi); R(13, 2, 1, 1, lo); R(8, 2, 1, 1, lo); R(13, 7, 1, 1, lo); break;
    case 'warhammer': L(1.5, 14.5, 11, 5, wood, 1.6); L(8, 2.5, 14, 8.5, c, 3.6); L(8, 2.5, 13, 7.5, hi, 1); break;
    case 'handaxe': L(2, 14, 11, 5, wood, 1.4); TR(9, 3, 14, 4, 12, 9, c); TR(9, 3, 12, 4, 11, 7, hi); break;
    case 'battleaxe': L(1, 15, 12, 4, wood, 1.6); TR(8, 2, 15, 3, 13, 10, c); TR(8, 2, 3, 6, 9, 8, c); TR(9, 2, 13, 3, 12, 7, hi); break;
    case 'spear': L(1, 15, 12, 4, wood, 1.2); TR(11, 6, 10, 4, 15, 1, c); TR(11, 6, 12.5, 5, 15, 1, hi); break;
    case 'halberd': L(1, 15, 12, 4, wood, 1.4); TR(11, 6, 10, 4, 15, 1, c); TR(8, 4, 12, 8, 6, 9, c); TR(8, 4, 10, 6, 7, 8, hi); break;
    case 'shortbow': case 'longbow': { const n = kind === 'longbow' ? 13 : 10; for (let t = 0; t <= 20; t++) { const a = t / 20 * Math.PI, x = 3 + Math.sin(a) * 6 + t / 20 * (n - 6), y = 14 - t / 20 * n; R(x, y, 1.3, 1.3, wood); } L(3, 14, 3 + n - 6, 14 - n, [230, 230, 220], 0.6); break; }
    case 'arrow': L(2, 14, 13, 3, wood, 1); TR(12, 5, 11, 2, 15, 1, c); L(2, 12, 4, 14, [230, 230, 220], 1); break;
    case 'shield': R(3, 2, 10, 7, c); TR(3, 9, 13, 9, 8, 15, c); R(3, 2, 10, 1, hi); R(7.5, 2, 1, 12, lo); R(3, 6, 10, 1, lo); break;
    case 'head': E(8, 8, 5.5, 5.5, c); R(2.5, 8, 11, 5, c); R(4, 9, 8, 2, [30, 26, 24]); R(7.5, 3, 1, 8, hi); break;
    case 'body': R(4, 3, 8, 11, c); R(1, 3, 3, 5, lo); R(12, 3, 3, 5, lo); R(6, 3, 4, 2, [30, 26, 24]); R(5, 6, 1, 7, hi); R(4, 12, 8, 1, lo); break;
    case 'arms': R(3, 3, 4, 8, c); R(9, 3, 4, 8, c); R(2, 10, 6, 4, lo); R(8, 10, 6, 4, lo); R(3, 3, 1, 7, hi); R(9, 3, 1, 7, hi); break;
    case 'legs': R(3, 2, 10, 4, c); R(3, 6, 4, 9, c); R(9, 6, 4, 9, c); R(3, 2, 10, 1, hi); R(3, 9, 4, 1, lo); R(9, 9, 4, 1, lo); break;
    case 'feet': R(3, 3, 4, 9, c); R(3, 11, 7, 3, c); R(10, 6, 3, 6, lo); R(10, 11, 5, 3, lo); R(3, 3, 1, 8, hi); break;
    case 'belt': R(1, 6, 14, 4, [110, 74, 40]); R(6, 5, 4, 6, gold); R(7, 6.5, 2, 3, [110, 74, 40]); break;
    case 'ring': E(8, 9, 4.5, 4.5, gold); E(8, 9, 2.6, 2.6, [0, 0, 0]); p.ell(8 * S, 9 * S, 2.6 * S, 2.6 * S, [0, 0, 0], 0); E(8, 4, 2, 2, c); break;
    case 'amulet': for (let t = 0; t <= 16; t++) { const a = t / 16 * Math.PI; R(8 - Math.cos(a) * 5, 3 + Math.sin(a) * 6, 1, 1, gold); } E(8, 11, 2.6, 3, c); R(7.4, 10, 1, 1, [255, 255, 255]); break;
    case 'potion': R(6.5, 2, 3, 4, [200, 214, 224]); R(6, 1.5, 4, 1.5, wood); E(8, 10.5, 4.6, 4.6, c); R(5.5, 9, 1.5, 2, hi); break;
    case 'mushroom': R(7, 8, 2.4, 6, [226, 214, 190]); E(8, 7, 5.5, 3.4, c); R(5.5, 5.5, 1.4, 1.4, [255, 255, 255]); R(9.5, 6.5, 1, 1, [255, 255, 255]); break;
    case 'berry': E(6, 10, 3, 3, c); E(10.5, 9, 3, 3, lo); E(8.5, 12, 2.6, 2.6, hi); L(8, 6, 10, 2, [60, 120, 50], 1); break;
    case 'root': L(4, 3, 9, 9, c, 2.2); L(9, 9, 12, 14, lo, 1.4); L(6, 6, 3, 11, lo, 1); L(4, 3, 3, 1, [60, 120, 50], 1); break;
    case 'flower': L(8, 15, 8, 7, [60, 130, 50], 1); for (let i = 0; i < 5; i++) E(8 + Math.cos(i * 1.257) * 3, 5.5 + Math.sin(i * 1.257) * 3, 2, 2, c); E(8, 5.5, 1.5, 1.5, [250, 226, 90]); break;
    case 'leaf': TR(3, 13, 8, 2, 13, 8, c); TR(3, 13, 12, 9, 8, 13, lo); L(3, 13, 11, 5, hi, 0.6); break;
    case 'pelt': R(3, 3, 10, 10, c); R(1.5, 2, 3, 3, c); R(11.5, 2, 3, 3, c); R(1.5, 11, 3, 3, c); R(11.5, 11, 3, 3, c); R(5, 5, 6, 6, hi); break;
    case 'part': E(8, 9, 4.5, 4, c); E(6.5, 7.5, 1.5, 1.2, hi); L(11, 6, 13, 3, lo, 1.2); break;
    case 'meat': E(7, 9, 5, 4, c); E(6, 8, 2, 1.4, hi); L(11, 6, 14, 3, [236, 230, 214], 1.6); break;
    case 'lockpick': L(2, 13, 12, 3, c, 1); L(12, 3, 14, 4, c, 1); E(3, 12.5, 1.8, 1.8, lo); break;
    case 'hammer': L(2, 14, 10, 6, wood, 1.5); L(8, 3, 13, 8, [130, 130, 140], 3.2); break;
    case 'pickaxe': L(2, 14, 11, 5, wood, 1.5); for (let t = 0; t <= 12; t++) { const a = -2.6 + t / 12 * 2; R(9.5 + Math.cos(a) * 6, 8.5 + Math.sin(a) * 6, 1.6, 1.6, [130, 130, 140]); } break;
    case 'mortar': E(8, 11, 5.5, 4, [150, 146, 140]); R(2.5, 7, 11, 3, [170, 166, 160]); L(9, 8, 13, 2, wood, 1.6); break;
    case 'torch': L(5, 14, 9, 6, wood, 1.8); E(10.5, 4.5, 2.8, 3.4, [250, 130, 30]); E(10.5, 5.2, 1.4, 2, [255, 226, 100]); break;
    case 'bread': E(8, 9, 6, 3.6, [196, 140, 70]); L(5, 8, 6.5, 10, [230, 190, 120], 1); L(8, 7.5, 9.5, 9.5, [230, 190, 120], 1); break;
    case 'gem': TR(3, 6, 13, 6, 8, 14, [90, 200, 230]); R(5, 3, 6, 3, [150, 230, 250]); TR(3, 6, 5, 3, 5, 6, [120, 215, 240]); TR(13, 6, 11, 3, 11, 6, [60, 160, 200]); break;
    case 'parcel': R(3, 5, 10, 9, [176, 140, 90]); R(7.4, 5, 1.2, 9, [150, 40, 40]); R(3, 9, 10, 1.2, [150, 40, 40]); E(8, 9.5, 1.5, 1.5, [190, 50, 50]); break;
    case 'chalice': R(4.5, 2, 7, 5, gold); E(8, 7, 3.5, 2, gold); R(7.4, 8, 1.2, 4, gold); R(5, 12, 6, 1.6, gold); R(5.2, 2, 1, 4, [255, 240, 160]); E(8, 4, 1, 1, [220, 50, 60]); break;
    case 'ingot': TR(2, 11, 5, 6, 5, 11, lo); R(5, 6, 8, 5, c); TR(13, 6, 15, 11, 13, 11, lo); R(2, 11, 13, 1.6, lo); R(5, 6, 8, 1, hi); break;
    case 'ore': E(8, 10, 5.5, 4.5, [110, 104, 98]); E(5, 8, 3, 3, [120, 114, 108]); R(6, 8, 2, 2, c); R(9, 10, 2, 2, c); R(4, 11, 1.5, 1.5, hi); break;
    case 'tome': R(3, 2, 10, 12, c); R(3, 2, 2, 12, lo); R(12, 3, 1, 10, [236, 230, 214]); E(8.5, 7.5, 2, 2, gold); break;
    case 'gold': E(6, 11, 3.5, 2, gold); E(10, 10, 3.5, 2, [200, 160, 50]); E(8, 7.5, 3.5, 2, [246, 216, 110]); break;
    default: R(4, 4, 8, 8, c);
  }
}
const iconCache = new Map();
export function itemIcon(kind, col) {
  const k = kind + '|' + col; let u = iconCache.get(k); if (u) return u;
  const p = new Pix(16, 16); drawItem(p, kind, col, 1); p.outline();
  u = p.canvas().toDataURL(); iconCache.set(k, u); return u;
}
const fpCache = new Map();
export function weaponCanvas(kind, col) {
  const k = kind + '|' + col; let c = fpCache.get(k); if (c) return c;
  const p = new Pix(64, 64); drawItem(p, kind, col, 4); p.outline();
  c = p.canvas(); fpCache.set(k, c); return c;
}
