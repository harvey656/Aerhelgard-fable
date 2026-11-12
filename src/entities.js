// Living things: citizens, monsters, projectiles, loot bags, and the systems that spawn them.
import * as THREE from '../vendor/three.module.min.js';
import { MONSTERS, BIOMES } from './data.js';
import { rnd, clamp, hash2, RNG } from './rng.js';
import { G, hourOf, isNight, dayOf } from './state.js';
import { humanSheet, monsterSheet } from './sprites.js';
import { getLayout, citizensOf, guardCitizen, whereabouts } from './settlement.js';
import { rollLoot } from './items.js';
import { tintC } from './sky.js';
import { PROPS, T, Pix } from './art.js';
import { CHUNK, ckey } from './world.js';

const quadGeo = () => { const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0); return g; };
const WHITE = new THREE.Color(1, 1, 1), RED = new THREE.Color(1, 0.25, 0.2);

class Ent {
  constructor(sheet, h, x, z) {
    this.sheet = sheet; this.h = h; this.x = x; this.z = z; this.y = 0; this.rad = 0.4; this.fx = 0; this.fz = 1; this.anim = 0; this.frame = -1; this.flashT = 0; this.fly = 0;
    this.mat = new THREE.MeshBasicMaterial({ map: sheet.tex, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(quadGeo(), this.mat);
    const vis = sheet.frames === 5 ? 1 : 1.2; // beast cells have padding
    this.mesh.scale.set(h * vis * sheet.aspect, h * vis, 1);
    this.setFrame(0); G.entGroup.add(this.mesh);
  }
  setFrame(f) {
    if (f === this.frame) return; this.frame = f;
    const uv = this.mesh.geometry.attributes.uv, n = this.sheet.frames, u0 = f / n + 0.002, u1 = (f + 1) / n - 0.002;
    uv.setXY(0, u0, 1); uv.setXY(1, u1, 1); uv.setXY(2, u0, 0); uv.setXY(3, u1, 0); uv.needsUpdate = true;
  }
  place(cam) {
    this.mesh.position.set(this.x, this.y + this.fly, this.z);
    this.mesh.rotation.y = Math.atan2(cam.position.x - this.x, cam.position.z - this.z);
    let l = 1;
    if (G.space) { const lv = G.space; l = clamp(lv.light[lv.tile(this.z) * lv.W + lv.tile(this.x)] + 0.25, 0.4, 1.1); this.mat.color.setScalar(l); } else this.mat.color.copy(tintC);
    if (this.flashT > 0) this.mat.color.lerp(RED, 0.7);
  }
  // choose walking frame; humans show their back when walking away from the camera
  walkFrame(cam, moving, attack) {
    const away = this.sheet.back && ((cam.position.x - this.x) * this.fx + (cam.position.z - this.z) * this.fz) < 0;
    if (attack) return this.setFrame(this.sheet.frames === 5 ? 4 : 2);
    const step = moving ? Math.floor(this.anim * 5) % 2 : 0;
    this.setFrame((away && moving ? 2 : 0) + step);
  }
  moveToward(tx, tz, sp, dt) {
    const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz); if (d < 0.05) return true;
    this.fx = dx / d; this.fz = dz / d;
    const s = Math.min(d, sp * dt), p = G.phys.collide(this.x + this.fx * s, this.z + this.fz * s, this.rad);
    const moved = Math.hypot(p[0] - this.x, p[1] - this.z);
    this.x = p[0]; this.z = p[1]; this.anim += dt * Math.max(0.6, sp / 3);
    this.stuck = moved < s * 0.3 ? (this.stuck || 0) + dt : 0;
    return d < 0.3;
  }
  remove() { this.gone = true; G.entGroup.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }
}

export class NPC extends Ent {
  constructor(c, x, z, opts = {}) {
    super(humanSheet(c.look, 'c' + c.id), 1.62 + (c.seed % 20) / 100 + (c.female ? -0.05 : 0.04), x, z);
    this.kind = 'npc'; this.c = c; this.name = c.name; this.ax = x; this.az = z; this.room = opts.room; this.range = opts.range === undefined ? 12 : opts.range; this.wait = rnd.range(0, 4); this.tx = x; this.tz = z; this.outdoor = !!opts.outdoor;
  }
  update(dt, cam) {
    const P = G.player, d = Math.hypot(P.pos.x - this.x, P.pos.z - this.z);
    let moving = false;
    if (d < 2.6 || G.talking === this) { this.fx = (P.pos.x - this.x) / (d || 1); this.fz = (P.pos.z - this.z) / (d || 1); }
    else if (this.range > 0) {
      if (this.wait > 0) this.wait -= dt;
      else {
        moving = true;
        if (this.moveToward(this.tx, this.tz, 1.3, dt) || this.stuck > 0.6) {
          this.wait = rnd.range(1.5, 7); this.stuck = 0;
          if (this.room) { const lv = G.space, r = this.room; this.tx = lv.cx(rnd.int(r.x0, r.x1)) + rnd.range(-0.6, 0.6); this.tz = lv.cx(rnd.int(r.z0, r.z1)) + rnd.range(-0.6, 0.6); }
          else { const a = rnd.range(0, 6.283), r = rnd.range(2, this.range); this.tx = this.ax + Math.cos(a) * r; this.tz = this.az + Math.sin(a) * r; }
        }
      }
    }
    this.y = G.phys.groundAt(this.x, this.z);
    this.walkFrame(cam, moving, false); this.place(cam);
  }
}

export class Monster extends Ent {
  constructor(id, x, z, opts = {}) {
    const def = MONSTERS[id];
    super(monsterSheet(id), def.h, x, z);
    this.kind = 'monster'; this.id = id; this.def = def; this.name = def.name; this.hostile = true;
    const m = opts.mult || 1;
    this.lvl = Math.round(def.lvl * m); this.maxHp = this.hp = Math.round(def.hp * m); this.dmg = def.dmg * (0.7 + 0.3 * m); this.ar = def.ar; this.speed = def.speed;
    this.rad = clamp(def.h * 0.28, 0.3, 0.9); this.fly = def.fly || 0; this.tier = opts.tier || 1;
    this.hx = x; this.hz = z; this.tx = x; this.tz = z; this.wait = rnd.range(0, 3); this.cd = rnd.range(0.3, 1); this.atk = 0; this.alert = false; this.idx = opts.idx; this.camp = opts.camp; this.wild = opts.wild;
    this.stun = 0; this.fear = 0; this.calm = 0; this.bleed = 0; this.burn = 0; this.slow = 0;
    if (def.ghost) { this.mat.transparent = true; this.mat.opacity = 0.72; this.mat.alphaTest = 0.2; }
    if (id === 'wisp') { this.mat.transparent = true; this.mat.alphaTest = 0.08; this.mat.depthWrite = false; }
  }
  hurt(d, o = {}) {
    if (this.dead) return 0;
    if (o.magic) d *= this.def.magic ? 0.6 : 1; else { d *= 100 / (100 + this.ar * 4 * (1 - (o.pierce || 0))); if (this.def.ghost) d *= 0.6; }
    d = Math.max(1, d); this.hp -= d; this.flashT = 0.15; this.calm = 0;
    if (!this.alert) { this.alert = true; this.rally(); }
    G.fn.showEnemy(this);
    if (this.hp <= 0) this.die();
    return d;
  }
  rally() { for (const e of G.ents) if (e.hostile && !e.dead && !e.alert && Math.hypot(e.x - this.x, e.z - this.z) < 12) e.alert = true; }
  die() {
    this.dead = true; this.deadT = 0; G.player.kills++;
    G.fn.sfx('die'); G.fn.onKill(this);
    const loot = rollLoot(this.def.loot, rnd, this.tier);
    if (loot.items.length || loot.gold) spawnLoot(this.x, this.z, loot, this.name);
  }
  update(dt, cam) {
    const P = G.player, ph = G.phys;
    if (this.dead) { this.deadT += dt; this.mesh.scale.y = Math.max(0.01, this.h * (1 - this.deadT * 2.5)); this.place(cam); if (this.deadT > 0.4) this.remove(); return; }
    if (this.flashT > 0) this.flashT -= dt;
    if (this.bleed > 0) { this.bleed -= dt; this.hp -= 2.5 * dt; } if (this.burn > 0) { this.burn -= dt; this.hp -= 4 * dt; this.flashT = 0.05; }
    if (this.def.regen && this.hp < this.maxHp) this.hp += this.def.regen * dt;
    if (this.hp <= 0) return this.die();
    if (this.slow > 0) this.slow -= dt;
    const dx = P.pos.x - this.x, dz = P.pos.z - this.z, d = Math.hypot(dx, dz);
    let moving = false, attacking = this.atk > 0;
    const sp = this.speed * (this.slow > 0 ? 0.5 : 1);
    if (this.stun > 0) { this.stun -= dt; this.atk = 0; }
    else if (this.fear > 0) { this.fear -= dt; moving = true; this.moveToward(this.x - dx / (d || 1) * 6, this.z - dz / (d || 1) * 6, sp, dt); }
    else {
      if (this.calm > 0) this.calm -= dt;
      // perception
      if (!this.alert && this.calm <= 0) {
        let R = (ph.outdoor ? 24 : 15) * (P.sneak ? 0.5 - (P.A('gui') - 4) * 0.02 : 1) * (1 - P.perk('stealth')) * (P.hasBuff('veil') ? 0.12 : 1) * (ph.outdoor && isNight() ? 0.75 : 1);
        if (this.def.boss) R *= 1.2;
        if (d < R && (ph.outdoor || ph.los(this.x, this.z, P.pos.x, P.pos.z))) { this.alert = true; this.rally(); if (d < 14) G.fn.sfx('growl'); }
      } else if (this.alert && (d > (ph.outdoor ? 70 : 60) || (P.hasBuff('veil') && d > 4))) this.alert = false;
      if (this.alert && P.hp > 0) {
        const R = this.def.ranged, reach = 1.25 + this.rad + (this.def.h > 2 ? 0.5 : 0);
        const los = ph.outdoor || ph.los(this.x, this.z, P.pos.x, P.pos.z);
        if (this.atk > 0) { // wind-up in progress
          this.atk -= dt; this.fx = dx / (d || 1); this.fz = dz / (d || 1);
          if (this.atk <= 0) {
            if (this.ranged) { G.fn.shoot({ owner: this, dmg: R.dmg * (0.7 + 0.3 * this.lvl / this.def.lvl), speed: R.arrow ? 26 : 17, kind: R.arrow ? 'arrow' : 'spell', col: R.col, magic: !R.arrow }); this.cd = R.cd * rnd.range(0.85, 1.2); }
            else { if (d < reach + 0.7 && Math.abs(P.pos.y - this.y) < 2.5) P.damage(this.dmg * rnd.range(0.8, 1.2), { src: this, poison: this.def.poison, magic: this.def.ghost }); this.cd = rnd.range(0.9, 1.5); }
          }
        } else if (R && d < R.range && d > 3.5 && los) {
          this.fx = dx / d; this.fz = dz / d; this.cd -= dt;
          if (this.cd <= 0) { this.atk = 0.4; this.ranged = true; }
        } else if (d < reach) {
          this.cd -= dt; this.fx = dx / (d || 1); this.fz = dz / (d || 1);
          if (this.cd <= 0) { this.atk = 0.38; this.ranged = false; }
        } else {
          moving = true; let tx = P.pos.x, tz = P.pos.z;
          if (!ph.outdoor && !los) { const s = ph.step(this.x, this.z); if (s) { tx = s[0]; tz = s[1]; } else moving = false; }
          if (moving) this.moveToward(tx, tz, sp, dt);
        }
      } else { // wander near home
        if (this.wait > 0) this.wait -= dt;
        else { moving = true; if (this.moveToward(this.tx, this.tz, sp * 0.35, dt) || this.stuck > 0.5) { this.stuck = 0; this.wait = rnd.range(1, 6); const a = rnd.range(0, 6.283), r = rnd.range(1, ph.outdoor ? 14 : 5); this.tx = this.hx + Math.cos(a) * r; this.tz = this.hz + Math.sin(a) * r; } }
      }
    }
    // keep monsters from stacking
    for (const e of G.ents) if (e !== this && e.kind === 'monster' && !e.dead) { const ex = this.x - e.x, ez = this.z - e.z, dd = ex * ex + ez * ez, rr = this.rad + e.rad; if (dd < rr * rr && dd > 1e-4) { const l = Math.sqrt(dd), push = (rr - l) * 0.5; this.x += ex / l * push; this.z += ez / l * push; } }
    let gy = ph.groundAt(this.x, this.z); if (ph.outdoor && gy < -0.6) gy = -0.6;
    this.y = gy;
    if (this.fly) this.mesh.position.y += Math.sin(performance.now() * 0.004 + this.hx) * 0.1;
    if (this.def.art[0] === 'wisp' || this.fly) { this.anim += dt * 1.2; moving = true; }
    this.walkFrame(cam, moving, attacking); this.place(cam);
  }
}

// ----- loot bags -----
export function spawnLoot(x, z, loot, from) {
  const y = G.phys.groundAt(x, z), r = PROPS.lootbag;
  const g = quadGeo(); const uv = g.attributes.uv; uv.setXY(0, r.u0, r.v1); uv.setXY(1, r.u1, r.v1); uv.setXY(2, r.u0, r.v0); uv.setXY(3, r.u1, r.v0);
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: T.props, alphaTest: 0.5, side: THREE.DoubleSide }));
  mesh.scale.set(0.6, 0.6, 1); mesh.position.set(x, Math.max(y, G.phys.outdoor ? -0.3 : 0), z); G.entGroup.add(mesh);
  const bag = { kind: 'loot', x, y: mesh.position.y + 0.3, z, loot, from, mesh, t: 0 };
  G.bags.push(bag); return bag;
}
export function removeBag(bag) { G.entGroup.remove(bag.mesh); bag.mesh.geometry.dispose(); bag.mesh.material.dispose(); G.bags.splice(G.bags.indexOf(bag), 1); }

// ----- projectiles -----
const projTex = {};
function projSprite(kind, col) {
  const k = kind + (col || '');
  if (!projTex[k]) {
    const p = new Pix(8, 8);
    if (kind === 'arrow') { p.rect(1, 3, 6, 2, [150, 110, 60]); p.rect(6, 2, 2, 4, [220, 220, 230]); }
    else { const c = [parseInt(col.slice(1, 3), 16), parseInt(col.slice(3, 5), 16), parseInt(col.slice(5, 7), 16)]; p.ell(3.5, 3.5, 3.6, 3.6, c); p.ell(3.5, 3.5, 1.8, 1.8, [255, 255, 255]); }
    projTex[k] = p.texture();
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: projTex[k], fog: true })); return s;
}
export function shoot(o) {
  const P = G.player, cam = G.camera; let x, y, z, dx, dy, dz;
  if (o.owner === P) {
    const v = new THREE.Vector3(); cam.getWorldDirection(v); dx = v.x; dy = v.y; dz = v.z;
    x = cam.position.x + dx * 0.5; y = cam.position.y - 0.15 + dy * 0.5; z = cam.position.z + dz * 0.5;
  } else {
    const e = o.owner; x = e.x; y = e.y + e.fly + e.h * 0.65; z = e.z;
    const tx = P.pos.x + rnd.range(-0.35, 0.35), ty = P.pos.y + 1.2, tz = P.pos.z + rnd.range(-0.35, 0.35), d = Math.hypot(tx - x, ty - y, tz - z) || 1;
    dx = (tx - x) / d; dy = (ty - y) / d + (o.kind === 'arrow' ? d * 0.006 : 0); dz = (tz - z) / d;
  }
  const s = projSprite(o.kind, o.col || '#ffffff'); const sz = o.kind === 'arrow' ? 0.35 : o.area ? 0.8 : 0.5; s.scale.set(sz, sz, 1); s.position.set(x, y, z); G.entGroup.add(s);
  G.projs.push(Object.assign({ x, y, z, vx: dx * o.speed, vy: dy * o.speed, vz: dz * o.speed, life: 4, mesh: s }, o));
}
function projHit(p, target) {
  const P = G.player;
  const hitMon = (e, mult = 1) => { const d = e.hurt(p.dmg * mult, { magic: p.magic, pierce: p.pierce, src: P }); if (p.slow) e.slow = p.slow; if (p.burn) e.burn = 4; if (p.skill) P.gainXP(p.skill, 3 + e.lvl * 0.5); if (p.crit) G.fn.msg('Critical hit! ' + Math.round(d) + ' damage.'); };
  if (p.owner === P) {
    if (p.area) { for (const e of G.ents) if (e.hostile && !e.dead && Math.hypot(e.x - p.x, e.z - p.z) < p.area) hitMon(e, e === target ? 1 : 0.7); G.fn.flash('#f80', 0.15); G.fn.sfx('boom'); }
    else if (target) { hitMon(target); G.fn.sfx('hit'); }
    if (p.kind === 'arrow' && !target && rnd.chance(0.5)) spawnLoot(p.x, p.z, { items: [{ type: 'ammo', id: 'arrow', name: 'Arrow', weight: 0.1, val: 1, stack: true, qty: 1, icon: 'arrow', sk: 'm:arrow', col: '#b8c0cc' }], gold: 0 }, 'arrow');
  } else if (target === P) P.damage(p.dmg, { src: p.owner, magic: p.magic, proj: true });
  G.entGroup.remove(p.mesh); p.mesh.material.dispose(); p.dead = true;
}
function updateProjs(dt) {
  const P = G.player, ph = G.phys;
  for (const p of G.projs) {
    const steps = 2;
    for (let s = 0; s < steps && !p.dead; s++) {
      const h = dt / steps;
      if (p.kind === 'arrow') p.vy -= 6 * h;
      p.x += p.vx * h; p.y += p.vy * h; p.z += p.vz * h; p.life -= h;
      const gy = ph.groundAt(p.x, p.z);
      if (p.life <= 0 || p.y < gy || (!ph.outdoor && (p.y > ph.wallH || ph.solidAt(p.x, p.z))) || (ph.outdoor && p.y < gy + 12 && ph.blocked(p.x, p.z, 0.05))) { projHit(p, null); break; }
      if (p.owner === P) { for (const e of G.ents) if (e.hostile && !e.dead && Math.hypot(e.x - p.x, e.z - p.z) < e.rad + 0.35 && p.y > e.y + e.fly - 0.3 && p.y < e.y + e.fly + e.h * 1.15 + 0.45) { projHit(p, e); break; } }
      else if (Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < 0.5 && p.y > P.pos.y && p.y < P.pos.y + 1.9) projHit(p, P);
    }
    if (!p.dead) p.mesh.position.set(p.x, p.y, p.z);
  }
  if (G.projs.some((p) => p.dead)) G.projs = G.projs.filter((p) => !p.dead);
}
// nearest hostile close to the crosshair
export function aimEnemy(range) {
  const cam = G.camera, v = new THREE.Vector3(); cam.getWorldDirection(v); let best = null, bd = 0.995;
  for (const e of G.ents) {
    if (!e.hostile || e.dead) continue;
    const dx = e.x - cam.position.x, dy = e.y + e.fly + e.h * 0.5 - cam.position.y, dz = e.z - cam.position.z, d = Math.hypot(dx, dy, dz);
    if (d > range) continue;
    const dot = (dx * v.x + dy * v.y + dz * v.z) / d, need = Math.cos(Math.atan2(e.rad + e.h * 0.5, d) + 0.06);
    if (dot > need && (!best || d < best.d)) { if (G.phys.outdoor || G.phys.los(cam.position.x, cam.position.z, e.x, e.z)) best = { e, d }; }
  }
  return best ? best.e : null;
}
let boltLine = null, boltT = 0;
export function bolt(e) {
  const cam = G.camera, v = new THREE.Vector3(); cam.getWorldDirection(v);
  const a = cam.position.clone().addScaledVector(v, 0.6); a.y -= 0.25;
  const b = e ? new THREE.Vector3(e.x, e.y + e.fly + e.h * 0.5, e.z) : cam.position.clone().addScaledVector(v, 30);
  const pts = []; for (let i = 0; i <= 8; i++) { const p = a.clone().lerp(b, i / 8); if (i > 0 && i < 8) { p.x += rnd.range(-0.3, 0.3); p.y += rnd.range(-0.3, 0.3); p.z += rnd.range(-0.3, 0.3); } pts.push(p); }
  if (boltLine) G.entGroup.remove(boltLine);
  boltLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xeeeaff, fog: false })); G.entGroup.add(boltLine); boltT = 0.12;
  G.fn.flash('#ccf', 0.12); G.fn.sfx('boom');
}

// ----- population -----
let popT = 0, wildT = 0;
export function clearEnts() {
  for (const e of G.ents) if (!e.gone) e.remove();
  for (const b of G.bags.slice()) removeBag(b);
  for (const p of G.projs) { G.entGroup.remove(p.mesh); }
  G.ents = []; G.projs = []; G.bags = []; popT = 0; wildT = 2;
}
function populateTown(dt) {
  popT -= dt; if (popT > 0) return; popT = 1;
  const P = G.player, W = G.world, L = W.locAt(P.pos.x, P.pos.z, 90), hour = hourOf();
  const active = new Map();
  for (const e of G.ents) if (e.kind === 'npc') active.set(e.c.id, e);
  // retire those far away or whose routine took them indoors
  for (const e of active.values()) { const d = Math.hypot(e.x - P.pos.x, e.z - P.pos.z); if (d > 110 || (d > 30 && whereabouts(e.c, hour) !== 'out')) { e.remove(); active.delete(e.c.id); } }
  if (!L || !L.civ) return;
  const lay = getLayout(W, L), cx = Math.floor(P.pos.x / CHUNK), cz = Math.floor(P.pos.z / CHUNK);
  const cand = [];
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const part = lay.byChunk.get(ckey(cx + i, cz + j)); if (part) for (const b of part.b) { const d = Math.hypot(b.door.x - P.pos.x, b.door.z - P.pos.z); if (d < 85) cand.push([d, b]); } }
  cand.sort((a, b) => a[0] - b[0]);
  let n = active.size;
  for (const [d, b] of cand) {
    if (n >= 30) break;
    for (const c of citizensOf(L, b)) {
      if (active.has(c.id) || whereabouts(c, hour) !== 'out' || n >= 30) continue;
      if (d < 12 && G.popInit) continue; // don't pop in right beside the player
      const a = (c.seed % 628) / 100, r = 2 + (c.seed % 9);
      let x = b.door.x + b.door.nx * 2.5 + Math.cos(a) * r, z = b.door.z + b.door.nz * 2.5 + Math.sin(a) * r;
      [x, z] = G.phys.collide(x, z, 0.5);
      const e = new NPC(c, x, z, { range: 14, outdoor: true }); G.ents.push(e); active.set(c.id, e); n++;
    }
  }
  lay.guards.forEach((g, i) => { const c = guardCitizen(L, i); if (!active.has(c.id) && Math.hypot(g.x - P.pos.x, g.z - P.pos.z) < 95) { const e = new NPC(c, g.x, g.z, { range: L.type === 'castle' ? 0 : 20, outdoor: true }); G.ents.push(e); } });
  G.popInit = true;
}
const PACK = { wolf: 3, goblin: 3, bandit: 2, jackal: 3, rat: 3, icewolf: 2, leech: 2, bat: 3 };
function spawnWild(dt) {
  wildT -= dt; if (wildT > 0) return; wildT = 3;
  const P = G.player, W = G.world, T = G.terrain;
  // bandit camps registered by freshly built chunks
  while (T.pendingCamps.length) {
    const p = T.pendingCamps.pop(), rec = G.save.poi[p.id];
    if (rec && dayOf() - rec < 6) continue;
    if (G.ents.some((e) => e.camp === p.id)) continue;
    const n = 2 + (p.seed % 2);
    for (let i = 0; i < n; i++) G.ents.push(new Monster(i === 0 && p.seed % 4 === 0 ? 'banditarcher' : 'bandit', p.x + Math.cos(i * 2.1) * 3.5, p.z + Math.sin(i * 2.1) * 3.5, { camp: p.id, tier: 1, mult: 1 + Math.min(1, P.level * 0.06) }));
  }
  for (const e of G.ents) if (e.kind === 'monster' && !e.dead && Math.hypot(e.x - P.pos.x, e.z - P.pos.z) > 240) e.remove();
  if (W.locAt(P.pos.x, P.pos.z, 160)) return;
  const wild = G.ents.filter((e) => e.wild && !e.gone).length;
  const night = isNight();
  if (wild >= 5 || !rnd.chance(night ? 0.34 : 0.2)) return;
  const a = rnd.range(0, 6.283), d = rnd.range(95, 140), x = P.pos.x + Math.cos(a) * d, z = P.pos.z + Math.sin(a) * d;
  const y = T.groundAt(x, z); if (y < -0.3 || W.locAt(x, z, 120)) return;
  const b = BIOMES[W.biomeAt(x, z)], table = (night ? b.night : b.wild).filter((m) => MONSTERS[m[0]].lvl <= P.level * 1.3 + 2.5);
  if (!table.length) return;
  const id = rnd.weighted(table), n = PACK[id] ? rnd.int(1, PACK[id]) : 1;
  for (let i = 0; i < n; i++) G.ents.push(new Monster(id, x + rnd.range(-4, 4), z + rnd.range(-4, 4), { wild: true, tier: 1 + Math.floor(P.level / 6), mult: 1 + Math.min(0.8, P.level * 0.03) }));
}

export function updateEntities(dt) {
  const cam = G.camera;
  if (!G.space) { populateTown(dt); spawnWild(dt); } else if (G.space.kind === 'dungeon') G.space.updateFlow(G.player.pos.x, G.player.pos.z);
  for (const e of G.ents) if (!e.gone) e.update(dt, cam);
  if (G.ents.some((e) => e.gone)) G.ents = G.ents.filter((e) => !e.gone);
  for (const b of G.bags) { b.mesh.rotation.y = Math.atan2(cam.position.x - b.x, cam.position.z - b.z); if (!G.space) b.mesh.material.color.copy(tintC); b.t += dt; }
  for (const b of G.bags.slice()) if (b.t > 600) removeBag(b);
  updateProjs(dt);
  if (boltLine) { boltT -= dt; if (boltT <= 0) { G.entGroup.remove(boltLine); boltLine.geometry.dispose(); boltLine = null; } }
}
