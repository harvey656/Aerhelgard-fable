// The player character: stats, progression, inventory, movement and combat.
import * as THREE from '../vendor/three.module.min.js';
import { ABILITIES, SKILLS, SKILL_BY_ID, SKILL_CAP, PERK_STEP, EFFECTS, SPELLS } from './data.js';
import { clamp, rnd } from './rng.js';
import { G } from './state.js';
import { HALF } from './world.js';
import { itemWeight } from './items.js';

export const EYE = 1.68, RADIUS = 0.38;
const BUFF_STAT = { might: 'abil:pow', stone: 'ar', feather: 'carry' };

export class Player {
  constructor(cfg = {}) {
    this.name = cfg.name || 'Wanderer';
    this.look = cfg.look || { skin: '#e0b088', hair: '#4a3018', hairStyle: 1, shirt: '#3a4a6a', pants: '#4a3a2a', beard: 0, female: 0 };
    this.abil = Object.assign({ wel: 4, pow: 4, int: 4, wil: 4, gui: 4 }, cfg.abil);
    this.skills = {};
    for (const s of SKILLS) this.skills[s.id] = { lvl: (cfg.skills && cfg.skills[s.id]) || 20, xp: 0 };
    this.level = 1; this.ups = 0; this.abilPoints = 0;
    this.gold = 60; this.inv = []; this.equip = {}; this.spells = []; this.spell = null; this.buffs = []; this.poison = 0; this.quick = [null, null, null, null];
    this.pos = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.vy = 0; this.grounded = true; this.sneak = false;
    this.swing = null; this.cd = 0; this.castCd = 0; this.draw = 0; this.blocking = false; this.bob = 0; this.hurtT = 0; this.stepT = 0;
    this.kills = 0; this.restedUntil = 0; this._perk = null;
    this.hp = this.maxHp(); this.mp = this.maxMp(); this.st = this.maxSt();
  }

  // ----- derived stats -----
  bonus(stat) {
    let v = 0;
    for (const k in this.equip) { const it = this.equip[k]; if (it && it.ench && !(k === 'ring2' && it === this.equip.ring1)) for (const e of it.ench) if (e.stat === stat) v += e.amt; }
    for (const b of this.buffs) if (BUFF_STAT[b.fx] === stat) v += b.mag;
    return v;
  }
  A(id) { return this.abil[id] + Math.round(this.bonus('abil:' + id)); }
  S(id) { return this.skills[id].lvl + this.bonus('skill:' + id); }
  perk(key) {
    if (!this._perk) { this._perk = {}; for (const s of SKILLS) { const n = Math.floor(this.skills[s.id].lvl / PERK_STEP); for (let i = 0; i < Math.min(n, s.perks.length); i++) for (const k in s.perks[i][2]) this._perk[k] = (this._perk[k] || 0) + s.perks[i][2][k]; } }
    return (this._perk[key] || 0) + (G.boons ? G.boons[key] || 0 : 0);
  }
  maxHp() { return Math.round(30 + this.A('wel') * 10 + this.level * 5 + this.bonus('hp')); }
  maxMp() { return Math.round(10 + this.A('int') * 10 + this.A('wil') * 3 + this.bonus('mp')); }
  maxSt() { return Math.round(50 + this.A('wel') * 8 + this.A('wil') * 6 + this.bonus('st')); }
  carryMax() { return this.A('pow') * 25 + this.bonus('carry'); }
  isEquipped(it) { for (const k in this.equip) if (this.equip[k] === it) return k; return null; }
  carried() {
    let w = 0;
    for (const it of this.inv) {
      let iw = itemWeight(it);
      if (it.type === 'armor' && this.isEquipped(it)) { if (it.cls === 'light' && this.perk('lightWeightless')) iw = 0; if (it.cls === 'heavy' && this.perk('heavyHalf')) iw *= 0.5; }
      w += iw;
    }
    return w;
  }
  armor() {
    let ar = 0;
    for (const k in this.equip) {
      const it = this.equip[k]; if (!it || it.ar === undefined) continue;
      const sk = it.type === 'shield' ? 'shields' : it.cls;
      ar += it.ar * (0.45 + this.S(sk) / 100 * 0.9) * (it.cond <= 0 ? 0.3 : 0.7 + it.cond / 333) * (1 + (it.cls === 'light' ? this.perk('lightAR') : it.cls === 'heavy' ? this.perk('heavyAR') : 0));
    }
    return Math.round(ar + this.bonus('ar'));
  }
  hasBuff(fx) { return this.buffs.some((b) => b.fx === fx); }
  addBuff(fx, mag, dur, name) {
    this.buffs = this.buffs.filter((b) => b.fx !== fx);
    this.buffs.push({ fx, mag, t: dur, dur, name: name || (EFFECTS[fx] ? EFFECTS[fx].name : fx) });
    this.clampVitals();
  }
  clampVitals() { this.hp = Math.min(this.hp, this.maxHp()); this.mp = Math.min(this.mp, this.maxMp()); this.st = Math.min(this.st, this.maxSt()); }
  xpNeed(lvl) { return 18 + lvl * 2.1; }
  gainXP(id, amt) {
    const s = this.skills[id]; if (!s || s.lvl >= SKILL_CAP) return;
    const def = SKILL_BY_ID[id];
    s.xp += amt * (1 + 0.05 * (this.A(def.abil) - 4)) * (G.time < this.restedUntil ? 1.15 : 1);
    while (s.lvl < SKILL_CAP && s.xp >= this.xpNeed(s.lvl)) {
      s.xp -= this.xpNeed(s.lvl); s.lvl++; this._perk = null; this.ups++;
      G.fn.msg(def.name + ' increased to ' + s.lvl + '.', 'good'); G.fn.sfx('skill');
      if (s.lvl % PERK_STEP === 0) { const p = def.perks[s.lvl / PERK_STEP - 1]; if (p) { G.fn.msg('New perk: ' + p[0] + ' - ' + p[1], 'perk'); G.fn.banner('Perk unlocked: ' + p[0]); } }
      if (this.ups >= 8) { this.ups -= 8; this.level++; this.abilPoints++; this.hp = this.maxHp(); this.mp = this.maxMp(); G.fn.banner('You have reached level ' + this.level + '!'); G.fn.msg('Level ' + this.level + '! You have an ability point to spend (press C).', 'perk'); G.fn.sfx('level'); }
    }
  }

  // ----- inventory -----
  addItem(it, quiet) {
    if (it.stack) { const ex = this.inv.find((o) => o.sk === it.sk); if (ex) { ex.qty += it.qty || 1; return ex; } if (!it.qty) it.qty = 1; }
    this.inv.push(it); return it;
  }
  count(sk) { const it = this.inv.find((o) => o.sk === sk); return it ? it.qty : 0; }
  has(pred) { return this.inv.find(pred); }
  removeItem(it, qty = 1) {
    if (it.stack && it.qty > qty) { it.qty -= qty; return; }
    const slot = this.isEquipped(it); if (slot) this.unequip(slot);
    const i = this.inv.indexOf(it); if (i >= 0) this.inv.splice(i, 1);
    this.quick = this.quick.map((q) => (q === it.sk && !this.inv.find((o) => o.sk === q) ? null : q));
  }
  consume(sk, qty = 1) { const it = this.inv.find((o) => o.sk === sk); if (!it || it.qty < qty) return false; this.removeItem(it, qty); return true; }
  unequip(slot) {
    const it = this.equip[slot]; if (!it) return;
    for (const k in this.equip) if (this.equip[k] === it) this.equip[k] = null;
    this.clampVitals();
  }
  equipItem(it) {
    if (this.isEquipped(it)) { this.unequip(this.isEquipped(it)); return; }
    let slot = it.slot;
    if (slot === 'ring') slot = !this.equip.ring1 ? 'ring1' : !this.equip.ring2 ? 'ring2' : 'ring1';
    if (it.type === 'weapon') {
      if (it.hands === 2) { this.unequip('lhand'); this.unequip('rhand'); this.equip.rhand = it; this.equip.lhand = it; G.fn.sfx('equip'); return; }
      // one-handed: right hand first, left if right already has a one-hander and this is a different item
      if (this.equip.rhand && this.equip.rhand.hands === 2) this.unequip('rhand');
      slot = 'rhand';
    } else if (slot === 'lhand') { if (this.equip.lhand && this.equip.lhand.hands === 2) this.unequip('lhand'); }
    this.unequip(slot); this.equip[slot] = it; G.fn.sfx('equip');
  }
  equipOffhand(it) { if (it.type !== 'weapon' || it.hands === 2) return; if (this.equip.rhand === it) this.unequip('rhand'); if (this.equip.lhand && this.equip.lhand.hands === 2) this.unequip('lhand'); this.unequip('lhand'); this.equip.lhand = it; }
  applyEffect(fx, mag, dur) {
    const m = mag * (1 + this.perk('drinkMag'));
    if (fx === 'heal') this.hp = Math.min(this.maxHp(), this.hp + m);
    else if (fx === 'mana') this.mp = Math.min(this.maxMp(), this.mp + m);
    else if (fx === 'stam') this.st = Math.min(this.maxSt(), this.st + m);
    else if (fx === 'cure') { this.poison = 0; G.fn.msg('The poison leaves your blood.'); }
    else this.addBuff(fx, fx === 'might' ? Math.round(m) : m, dur || EFFECTS[fx].dur);
  }
  useItem(it) {
    if (it.type === 'potion') { this.applyEffect(it.fx, it.mag); G.fn.msg('You drink the ' + it.name + '.'); G.fn.sfx('drink'); this.removeItem(it, 1); }
    else if (it.type === 'food' || (it.type === 'ingredient' && it.food)) { this.hp = Math.min(this.maxHp(), this.hp + it.food * 0.6); this.st = Math.min(this.maxSt(), this.st + it.food * 2); G.fn.msg('You eat the ' + it.name + '.'); G.fn.sfx('drink'); this.removeItem(it, 1); }
    else if (it.type === 'tome') {
      const S = SPELLS[it.spell];
      if (this.spells.includes(it.spell)) return G.fn.msg('You already know ' + S.name + '.');
      if (this.S(S.school) < S.lvl) return G.fn.msg('You need ' + SKILL_BY_ID[S.school].name + ' ' + S.lvl + ' to grasp this tome.', 'bad');
      this.spells.push(it.spell); if (!this.spell) this.spell = it.spell; this.removeItem(it, 1); G.fn.msg('You have learned ' + S.name + '! (B: spellbook, Q: cast)', 'good'); G.fn.sfx('level');
    } else if (it.slot) this.equipItem(it);
    else if (it.id === 'hammer') G.fn.openRepair(); else if (it.id === 'mortar') G.fn.openAlchemy();
  }

  // ----- combat -----
  weapon(hand = 'rhand') { const it = this.equip[hand]; return it && it.type === 'weapon' ? it : null; }
  damage(amt, o = {}) {
    if (G.mode !== 'play' || this.hp <= 0) return 0;
    if (!o.magic && !o.pure && rnd.chance(this.perk('dodge'))) { G.fn.msg('You sidestep the blow.'); return 0; }
    let d = amt;
    const sh = this.equip.lhand && this.equip.lhand.type === 'shield' ? this.equip.lhand : null;
    if (this.blocking && sh && !o.pure && (!o.magic || o.proj)) {
      const cost = this.perk('blockFree') ? 0 : 6 + amt * 0.25;
      if (this.st >= cost) {
        this.st -= cost;
        let f = clamp(sh.block + this.S('shields') / 250 + this.perk('blockAmt'), 0, 0.95);
        if (o.proj && this.perk('blockProj')) f = 1;
        d *= 1 - f; this.gainXP('shields', 3 + amt * 0.25); sh.cond = Math.max(0, sh.cond - 0.4); G.fn.sfx('block');
        if (o.src && !o.proj && this.perk('blockStagger')) o.src.stun = Math.max(o.src.stun || 0, 1.2);
      }
    }
    if (o.magic) d *= 1 - clamp(this.bonus('resist') / 100 + (this.A('wil') - 4) * 0.02, 0, 0.75);
    else if (!o.pure) {
      d *= 100 / (100 + this.armor() * 2.2) * (1 - this.perk('physResist'));
      let light = 0, heavy = 0;
      for (const k of ['head', 'body', 'arms', 'legs', 'feet']) { const it = this.equip[k]; if (it) { if (it.cls === 'light') light++; else heavy++; it.cond = Math.max(0, it.cond - 0.25); } }
      if (light) this.gainXP('light', (1.2 + amt * 0.12) * light / 2.5); if (heavy) this.gainXP('heavy', (1.2 + amt * 0.12) * heavy / 2.5);
      if (o.src && !o.proj && this.perk('reflect')) o.src.hurt(amt * this.perk('reflect'), {});
    }
    d = Math.max(1, Math.round(d));
    this.hp -= d; this.hurtT = 0.35; G.fn.sfx('hurt'); G.fn.flash('#a00', 0.35);
    if (o.poison && !o.blocked) this.poison = Math.max(this.poison, o.poison * 6);
    if (this.hasBuff('veil')) this.buffs = this.buffs.filter((b) => b.fx !== 'veil');
    if (this.hp <= 0) { this.hp = 0; G.fn.onDeath(o.src ? o.src.name : (o.cause || 'misadventure')); }
    return d;
  }
  swingTime(w) { let sp = w ? w.speed : 1.5; if (w) { if (w.skill === 'short') sp *= 1 + this.perk('shortSpeed'); if (w.skill === 'axes') sp *= 1 + this.perk('axeSpeed'); } return 1 / sp; }
  startSwing(hand) {
    if (this.swing || this.cd > 0) return;
    const w = this.weapon(hand);
    if (hand === 'lhand' && (!w || w.hands === 2)) return;
    if (w && w.bow) return;
    const cost = w ? 4 + w.weight * 0.9 : 3;
    this.st = Math.max(0, this.st - cost);
    this.swing = { t: 0, dur: this.swingTime(w), hand, w, done: false };
    G.fn.sfx('swing');
  }
  meleeHit(sw) {
    const w = sw.w, sk = w ? w.skill : null;
    let reach = w ? w.reach : 1.7; if (sk === 'polearms') reach += this.perk('poleReach');
    const cleave = sk && ((sk === 'long' && this.perk('longCleave')) || (sk === 'axes' && this.perk('axeCleave')) || (sk === 'polearms' && this.perk('poleCleave')));
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const hits = [];
    for (const e of G.ents) {
      if (!e.hostile || e.dead) continue;
      const dx = e.x - this.pos.x, dz = e.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d - e.rad > reach || Math.abs(e.y - this.pos.y) > 2.5 + e.h) continue;
      const dot = d < 0.01 ? 1 : (dx * fx + dz * fz) / d;
      if (dot < (d < 1.4 ? 0.2 : 0.72)) continue;
      hits.push([d, e]);
    }
    hits.sort((a, b) => a[0] - b[0]);
    if (!hits.length) { const t = G.fn.lookTarget(reach); if (t && t.kind === 'ore') G.fn.interact(); return; }
    if (this.hasBuff('veil')) this.buffs = this.buffs.filter((b) => b.fx !== 'veil');
    for (const [, e] of cleave ? hits : hits.slice(0, 1)) {
      let dmg = w ? w.dmg * (w.cond <= 0 ? 0.5 : 0.75 + w.cond / 400) : 3 + this.A('pow') * 0.5;
      const S = sk ? this.S(sk) : 30;
      dmg *= (0.55 + S / 100 * 0.9) * (1 + (this.A('pow') - 4) * 0.07) * (this.st < 8 ? 0.6 : 1);
      let pm = 0, crit = 0.04 + this.A('gui') * 0.012, pierce = 0;
      if (sk === 'long') { pm = this.perk('longDmg'); crit += this.perk('longCrit'); } if (sk === 'blunt') { pm = this.perk('bluntDmg'); pierce = this.perk('bluntPierce'); }
      if (sk === 'axes') pm = this.perk('axeDmg'); if (sk === 'polearms') { pm = this.perk('poleDmg'); crit += this.perk('poleCrit'); }
      dmg *= 1 + pm + this.perk('allDmg');
      let note = '';
      if (!e.alert) { dmg *= 1.5 + (sk === 'short' ? this.perk('backstab') : 0); note = 'Sneak attack! '; }
      if (rnd.chance(crit)) { dmg *= 2; note += 'Critical hit! '; }
      if (e.hp < e.maxHp / 3) dmg *= 1 + (sk === 'long' ? this.perk('execute') : 0);
      const dealt = e.hurt(dmg, { pierce, src: this });
      if (note) G.fn.msg(note + Math.round(dealt) + ' damage.');
      if (sk) this.gainXP(sk, 3.5 + e.lvl * 0.5);
      if ((sk === 'short' && this.perk('shortBleed')) || (sk === 'axes' && this.perk('axeBleed'))) e.bleed = 5;
      if (sk === 'blunt' && rnd.chance(this.perk('bluntStun'))) e.stun = 1.5;
      if (w) w.cond = Math.max(0, w.cond - 0.18);
    }
    G.fn.sfx('hit');
    if (sk === 'short' && rnd.chance(this.perk('flurry'))) this.cd = -1;
  }
  releaseBow() {
    const w = this.weapon('rhand'); const need = 1 / (w.speed * (1 + this.perk('bowSpeed')));
    const f = clamp(this.draw / need, 0, 1); this.draw = 0;
    if (f < 0.3) return;
    if (!this.consume('m:arrow', 1)) return G.fn.msg('You have no arrows.', 'bad');
    const S = this.S('archery');
    let dmg = w.dmg * f * (0.55 + S / 100 * 0.9) * (1 + (this.A('gui') - 4) * 0.05) * (1 + this.perk('bowDmg') + this.perk('allDmg')) * (w.cond <= 0 ? 0.5 : 1);
    const crit = rnd.chance(0.04 + this.A('gui') * 0.012 + this.perk('bowCrit')); if (crit) dmg *= 2;
    G.fn.shoot({ owner: this, dmg, speed: 30 + 30 * f, kind: 'arrow', pierce: this.perk('bowPierce'), skill: 'archery', crit });
    w.cond = Math.max(0, w.cond - 0.15); G.fn.sfx('bow'); this.cd = 0.25;
    if (this.hasBuff('veil')) this.buffs = this.buffs.filter((b) => b.fx !== 'veil');
  }
  spellCost(id) { const S = SPELLS[id], sch = S.school; return Math.max(1, Math.round(S.cost * (1 - this.perk('cost' + sch[0].toUpperCase() + sch.slice(1)) - this.perk('costAll')) * (1 - this.S(sch) / 300))); }
  cast() {
    if (this.castCd > 0) return;
    const id = this.spell; if (!id) return G.fn.msg('You have no spell readied. Buy tomes from an Arcanist.');
    const S = SPELLS[id], cost = this.spellCost(id), sk = this.S(S.school);
    if (this.mp < cost) { G.fn.msg('Not enough mana.', 'bad'); G.fn.sfx('deny'); return; }
    const durM = 1 + this.perk('dur' + S.school[0].toUpperCase() + S.school.slice(1)), magM = (1 + sk / 150) * (1 + (this.A('int') - 4) * 0.05) * (S.school === 'alteration' ? 1 + this.perk('magAlteration') : 1);
    if (S.kind === 'open') { if (!G.fn.spellOpen(Math.floor(sk / 20))) return; }
    this.mp -= cost; this.castCd = 0.7; this.swing = { t: 0, dur: 0.45, hand: 'cast', done: true, col: S.col || '#a8c8ff' };
    G.fn.sfx('cast');
    if (S.kind === 'proj') G.fn.shoot({ owner: this, dmg: S.dmg * (0.7 + sk / 100) * (1 + (this.A('int') - 4) * 0.06) * (1 + this.perk('destDmg')), speed: 26, kind: 'spell', col: S.col, magic: true, slow: S.slow, area: S.area ? S.area * (1 + this.perk('destArea')) : 0, burn: this.perk('destBurn'), skill: 'destruction' });
    else if (S.kind === 'ray') { const e = G.fn.aimEnemy(32); G.fn.bolt(e); if (e) { e.hurt(S.dmg * (0.7 + sk / 100) * (1 + (this.A('int') - 4) * 0.06) * (1 + this.perk('destDmg')), { magic: true, src: this }); if (this.perk('destBurn')) e.burn = 4; } }
    else if (S.kind === 'buff') this.addBuff(S.fx, (S.mag || 1) * magM, S.dur * durM, S.name);
    else if (S.kind === 'heal') { this.hp = Math.min(this.maxHp(), this.hp + S.mag * magM); G.fn.flash('#4c8', 0.25); }
    else if (S.kind === 'fear' || S.kind === 'calm') { let n = 0; for (const e of G.ents) if (e.hostile && !e.dead && Math.hypot(e.x - this.pos.x, e.z - this.pos.z) < S.area && (!e.def.boss || sk > 70)) { if (S.kind === 'fear') e.fear = S.dur * durM; else { e.calm = S.dur * durM; e.alert = false; } n++; } G.fn.msg(n ? (S.kind === 'fear' ? 'Your foes recoil in terror.' : 'A hush falls over your foes.') : 'There is no one near to affect.'); }
    if (S.kind !== 'buff' || S.fx !== 'veil') { if (this.hasBuff('veil') && S.school === 'destruction') this.buffs = this.buffs.filter((b) => b.fx !== 'veil'); }
    this.gainXP(S.school, 2.5 + cost * 0.45);
  }

  // ----- per-frame -----
  update(dt, input) {
    // timers
    if (this.cd > 0) this.cd -= dt; if (this.castCd > 0) this.castCd -= dt; if (this.hurtT > 0) this.hurtT -= dt;
    for (const b of this.buffs) { b.t -= dt; if (b.fx === 'regen') this.hp = Math.min(this.maxHp(), this.hp + b.mag * dt); }
    if (this.buffs.some((b) => b.t <= 0)) { for (const b of this.buffs) if (b.t <= 0) G.fn.msg(b.name + ' fades.'); this.buffs = this.buffs.filter((b) => b.t > 0); this.clampVitals(); }
    if (this.poison > 0) { const d = Math.min(this.poison, dt * 1.5); this.poison -= d; this.hp -= d; if (this.hp <= 0) { this.hp = 0; G.fn.onDeath('poison'); return; } }
    const rg = this.bonus('regen') + this.perk('regenFlat'); if (rg) this.hp = Math.min(this.maxHp(), this.hp + rg / 10 * dt);
    this.mp = Math.min(this.maxMp(), this.mp + (0.25 + this.A('wil') * 0.11) * (1 + this.perk('manaRegen')) * dt);
    // attacks
    const bow = this.weapon('rhand') && this.weapon('rhand').bow;
    if (bow) { if (input.attack && this.cd <= 0) this.draw += dt; else if (this.draw > 0) this.releaseBow(); }
    else { this.draw = 0; if (input.attack) this.startSwing('rhand'); }
    const lh = this.equip.lhand;
    this.blocking = !!(input.block && lh && lh.type === 'shield' && !this.swing);
    if (input.block && lh && lh.type === 'weapon' && lh.hands === 1) this.startSwing('lhand');
    if (this.swing) {
      const s = this.swing; s.t += dt;
      if (!s.done && s.t >= s.dur * 0.45) { s.done = true; this.meleeHit(s); }
      if (s.t >= s.dur) { this.swing = null; if (this.cd < 0) this.cd = 0; else this.cd = 0.08; }
    }
    this.move(dt, input);
  }
  speedMult() {
    let m = 1 + this.perk('speed');
    const b = this.buffs.find((q) => q.fx === 'swift'); if (b) m *= 1 + b.mag / 100;
    const enc = this.carried() / Math.max(1, this.carryMax());
    if (enc > 1) m *= enc > 1.5 ? 0 : 0.45;
    if (this.sneak) m *= 0.5; if (this.blocking || this.draw > 0) m *= 0.55;
    return m;
  }
  move(dt, input) {
    const ph = G.phys, p = this.pos;
    this.yaw -= input.turn * dt * 2.4;
    let f = input.fwd, s = input.strafe;
    const moving = f !== 0 || s !== 0, enc = this.carried() / Math.max(1, this.carryMax());
    const run = input.sprint && moving && this.st > 1 && enc <= 1 && !this.sneak && f >= 0;
    let sp = (run ? 8.4 : 4.7) * this.speedMult();
    const gh0 = ph.groundAt(p.x, p.z);
    const wl = ph.outdoor ? ph.waterLevel(p.x, p.z) : -1e9;
    const water = gh0 < wl - 0.45 && !this.hasBuff('waterwalk');
    if (water) sp *= 0.55;
    if (run) this.st = Math.max(0, this.st - dt * 7 * (1 - this.perk('sprintCost')));
    else this.st = Math.min(this.maxSt(), this.st + dt * (moving ? 4 : 8) * (1 + (this.A('wil') - 4) * 0.06));
    if (enc > 1.5 && moving && Math.random() < dt) G.fn.msg('You are carrying too much to move.', 'bad');
    if (moving) {
      const l = Math.hypot(f, s); f /= l; s /= l;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const dx = (-sin * f + cos * s) * sp * dt, dz = (-cos * f - sin * s) * sp * dt;
      let nx = p.x + dx, nz = p.z + dz;
      if (ph.outdoor && this.grounded) { // steep slopes stop you
        const step = Math.hypot(dx, dz) + 0.25, gx = ph.groundAt(p.x + dx / (step - 0.25) * step, p.z + dz / (step - 0.25) * step);
        if ((gx - gh0) / step > 1.15) { nx = p.x; nz = p.z; }
      }
      [nx, nz] = ph.collide(nx, nz, RADIUS);
      p.x = clamp(nx, -HALF + 150, HALF - 150); p.z = clamp(nz, -HALF + 150, HALF - 150);
      this.bob += dt * sp * 1.6; this.stepT -= dt * sp;
      if (this.stepT <= 0 && this.grounded) { this.stepT = 2.6; G.fn.sfx(water ? 'splash' : 'step'); }
    }
    let gh = ph.groundAt(p.x, p.z);
    if (this.hasBuff('waterwalk') && gh < wl) gh = wl;
    if (gh < wl - 1.35) gh = wl - 1.35; // swim
    if (input.jump && this.grounded && this.st > 6 && !water) { this.vy = 6.4; this.grounded = false; this.st -= 6; }
    if (!this.grounded) {
      this.vy -= 19 * dt; p.y += this.vy * dt;
      if (p.y <= gh) { if (this.vy < -15) this.damage((-this.vy - 15) * 3.5, { pure: true, cause: 'a long fall' }); p.y = gh; this.vy = 0; this.grounded = true; G.fn.sfx('step'); }
    } else if (p.y - gh > 0.6) { this.grounded = false; this.vy = 0; }
    else p.y = gh;
  }

  toJSON() {
    const eq = {}; for (const k in this.equip) eq[k] = this.equip[k] ? this.inv.indexOf(this.equip[k]) : -1;
    return { name: this.name, look: this.look, abil: this.abil, skills: this.skills, level: this.level, ups: this.ups, abilPoints: this.abilPoints, gold: this.gold, inv: this.inv, eq, spells: this.spells, spell: this.spell, buffs: this.buffs, poison: this.poison, quick: this.quick,
      pos: [this.pos.x, this.pos.y, this.pos.z], yaw: this.yaw, hp: this.hp, mp: this.mp, st: this.st, kills: this.kills, restedUntil: this.restedUntil };
  }
  static fromJSON(d) {
    const p = new Player({ name: d.name, look: d.look, abil: d.abil });
    Object.assign(p, { skills: d.skills, level: d.level, ups: d.ups, abilPoints: d.abilPoints, gold: d.gold, inv: d.inv, spells: d.spells, spell: d.spell, buffs: d.buffs || [], poison: d.poison || 0, quick: d.quick || [null, null, null, null], yaw: d.yaw, hp: d.hp, mp: d.mp, st: d.st, kills: d.kills || 0, restedUntil: d.restedUntil || 0 });
    p.pos.set(d.pos[0], d.pos[1], d.pos[2]);
    for (const k in d.eq) p.equip[k] = d.eq[k] >= 0 ? p.inv[d.eq[k]] : null;
    return p;
  }
}
export { ABILITIES };
