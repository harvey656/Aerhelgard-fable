// HUD and in-game windows, drawn with DOM in an early-90s CRPG style.
import { ABILITIES, SKILLS, SKILL_BY_ID, EQUIP_SLOTS, SPELLS, PERK_STEP, MONTHS, LOC_TYPES, BIOMES, EFFECTS, BUILDINGS } from './data.js';
import { G, hourOf, dayOf } from './state.js';
import { Pix, sh } from './art.js';
import { itemIcon, portrait } from './sprites.js';
import { describe, itemWeight } from './items.js';
import { hash01, clamp } from './rng.js';
import * as Q from './quests.js';
import * as F from './factions.js';
import { guildOf, realmName } from './settlement.js';
import { conversation, shopStock, buyPrice, sellPrice, wants } from './dialog.js';
import { WORLD, HALF } from './world.js';
import { getLayout } from './settlement.js';

export const $ = (id) => document.getElementById(id);
export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) { const v = attrs[k]; if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'style') e.style.cssText = v; else if (v !== false && v != null) e.setAttribute(k, v); }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
export const UI = { open: null, msgs: [], onClose: null };
G.ui = UI;

UI.init = function () {
  const stone = new Pix(48, 48), parch = new Pix(64, 64);
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) stone.set(x, y, sh([64, 58, 52], 0.8 + hash01(x >> 1, y >> 1, 5) * 0.3 + hash01(x, y, 9) * 0.12));
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) parch.set(x, y, sh([216, 196, 152], 0.92 + hash01(x >> 2, y >> 2, 3) * 0.08 + hash01(x, y, 4) * 0.07));
  document.documentElement.style.setProperty('--tex-stone', `url(${stone.canvas().toDataURL()})`);
  document.documentElement.style.setProperty('--tex-parch', `url(${parch.canvas().toDataURL()})`);
  const btns = $('btns');
  for (const [label, key, fn] of [['Items', 'Tab', () => UI.inventory()], ['Char', 'C', () => UI.character()], ['Map', 'M', () => UI.map()], ['Log', 'J', () => UI.journal()], ['Spells', 'B', () => UI.spellbook()], ['Rest', 'R', () => UI.rest()], ['Menu', 'Esc', () => UI.pause()], ['Help', 'F1', () => UI.help()]])
    btns.append(h('button', { title: key, onclick: (e) => { e.target.blur(); fn(); } }, label));
  document.addEventListener('mousemove', (e) => { const t = $('tooltip'); if (!t.classList.contains('hidden')) { t.style.left = Math.min(innerWidth - t.offsetWidth - 8, e.clientX + 16) + 'px'; t.style.top = Math.min(innerHeight - t.offsetHeight - 8, e.clientY + 14) + 'px'; } });
};
UI.tip = function (el, fn) { el.addEventListener('mouseenter', () => { const t = $('tooltip'); t.innerHTML = fn(); t.classList.remove('hidden'); }); el.addEventListener('mouseleave', () => $('tooltip').classList.add('hidden')); };
UI.hideTip = () => $('tooltip').classList.add('hidden');

// ----- messages -----
UI.msg = function (text, cls) {
  const el = h('div', { class: cls || '' }, text); $('msgs').append(el); UI.msgs.push({ el, t: 7 });
  while (UI.msgs.length > 7) UI.msgs.shift().el.remove();
};
let bannerT = 0, flashT = 0, flashDur = 1, enemy = null, enemyT = 0;
UI.banner = function (text) { const b = $('banner'); b.textContent = text; b.style.opacity = 1; bannerT = 3.2; };
UI.flash = function (col, dur) { const f = $('flash'); f.style.background = col; f.style.opacity = 0.45; flashT = flashDur = dur; };
UI.showEnemy = function (e) { enemy = e; enemyT = 4; };

// ----- HUD -----
let hudT = 0;
UI.setPortrait = function () { const p = $('portrait'); p.innerHTML = ''; p.append(portrait(G.player.look, 'player' + JSON.stringify(G.player.look), 4)); $('pname').textContent = G.player.name; };
UI.hud = function (dt, target) {
  const P = G.player;
  for (const m of UI.msgs) { m.t -= dt; if (m.t < 1) m.el.style.opacity = Math.max(0, m.t); }
  while (UI.msgs.length && UI.msgs[0].t <= 0) UI.msgs.shift().el.remove();
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').style.opacity = 0; }
  if (flashT > 0) { flashT -= dt; $('flash').style.opacity = Math.max(0, 0.45 * flashT / flashDur); }
  if (enemyT > 0 && enemy) { enemyT -= dt; $('enemy').style.opacity = enemy.dead || enemyT <= 0 ? 0 : 1; $('enemyName').textContent = enemy.name + (enemy.def.boss ? ' ☠' : ''); $('enemyBar').style.width = clamp(enemy.hp / enemy.maxHp * 100, 0, 100) + '%'; }
  // prompt
  $('prompt').innerHTML = target && !UI.open ? UI.promptFor(target) : '';
  hudT -= dt; if (hudT > 0) return; hudT = 0.12;
  const bar = (id, v, m) => { $(id + 'Bar').style.width = clamp(v / m * 100, 0, 100) + '%'; $(id + 'Txt').textContent = Math.ceil(v) + '/' + m; };
  bar('hp', P.hp, P.maxHp()); bar('mp', P.mp, P.maxMp()); bar('st', P.st, P.maxSt());
  $('pname').textContent = P.name + '  Lv ' + P.level + (P.abilPoints ? ' ✦' : '');
  // location + time
  const hr = hourOf(), d = dayOf(), W = G.world;
  let where;
  if (G.space) where = G.space.name; else { const L = W.locAt(P.pos.x, P.pos.z, 20); where = L ? L.name : BIOMES[W.biomeAt(P.pos.x, P.pos.z)].name + ' wilds'; }
  $('where').textContent = `${where}  ·  ${String(Math.floor(hr)).padStart(2, '0')}:${String(Math.floor(hr % 1 * 60)).padStart(2, '0')}, ${d % 30 + 1} ${MONTHS[Math.floor(d / 30) % 8]}  ·  ${P.gold}g`;
  // buffs
  const enc = P.carried() / Math.max(1, P.carryMax());
  $('buffs').innerHTML = P.buffs.map((b) => `${esc(b.name)} ${Math.ceil(b.t)}s`).concat(P.poison > 0 ? ['<span style="color:#9f6">Poisoned</span>'] : [], enc > 1 ? ['<span style="color:#f88">Over-encumbered</span>'] : [], P.sneak ? ['Sneaking'] : [], G.time < P.restedUntil ? ['Well Rested'] : []).join('<br>');
  // quest tracker
  const q = G.save.quests.find((x) => x.id === G.save.tracked && x.state === 'active');
  $('tracker').innerHTML = q ? `<b>${esc(q.title)}</b><br>${esc(Q.progressText(q))}` : '';
  UI.compass();
  // quick slots
  const qs = $('quick'); qs.innerHTML = '';
  P.quick.forEach((sk, i) => { const it = sk && P.inv.find((o) => o.sk === sk); const d2 = h('div', {}, h('span', {}, String(i + 1))); if (it) d2.append(h('img', { src: itemIcon(it.icon, it.col) }), h('em', {}, String(it.qty))); qs.append(d2); });
};
UI.compass = function () {
  const c = $('compass'), g = c.getContext('2d'), P = G.player, w = c.width, hh = c.height;
  g.fillStyle = '#14100c'; g.fillRect(0, 0, w, hh); g.font = '20px VT323'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const heading = ((-P.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); // 0 = north, clockwise
  const put = (ang, text, col, y = hh / 2 + 1) => { let d = ang - heading; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; if (Math.abs(d) < 1.15) { g.fillStyle = col; g.fillText(text, w / 2 + d / 1.15 * (w / 2), y); } };
  for (let i = 0; i < 16; i++) put(i * Math.PI / 8, i % 2 ? '·' : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][i / 2], i % 4 === 0 ? '#f0d890' : '#a89870');
  const toAng = (x, z) => Math.atan2(x - P.pos.x, -(z - P.pos.z));
  if (!G.space) {
    const S = G.save, q = S.quests.find((x) => x.id === S.tracked && x.state === 'active'), t = q && Q.questTarget(q);
    if (t) put(toAng(t.x, t.z), '◆', '#8cf');
    if (S.marker) { put(toAng(S.marker.x, S.marker.z), '▼', '#fc4'); if (Math.hypot(S.marker.x - P.pos.x, S.marker.z - P.pos.z) < 6) S.marker = null; }
    if (P.perk('forageSense')) { const out = []; G.terrain.interactables(P.pos.x, P.pos.z, out); for (const o of out) if (o.kind === 'forage' && Math.hypot(o.x - P.pos.x, o.z - P.pos.z) < 45) put(toAng(o.x, o.z), '✿', '#7d6', hh / 2 + 3); }
  }
  for (const e of G.ents) if (e.hostile && e.alert && !e.dead) put(toAng(e.x, e.z), '▲', '#f44');
  g.fillStyle = '#f0d890'; g.fillRect(w / 2, 0, 1, 4); g.fillRect(w / 2, hh - 4, 1, 4);
};
UI.promptFor = function (t) {
  const k = '<small>[E]</small> ';
  switch (t.kind) {
    case 'npc': return k + 'Talk to ' + esc(t.name);
    case 'door': if (t.b.home && !(G.save.homes[t.loc.id] || {}).owned) return k + 'Read the notice<br><small>House for sale</small>'; return k + (t.b.type === 'dungeon' ? 'Enter ' : 'Enter ') + esc(t.b.name) + (t.b.type !== 'dungeon' && BUILDINGS[t.b.type].sign ? '<br><small>' + BUILDINGS[t.b.type].name + '</small>' : t.b.type === 'dungeon' ? '<br><small>' + LOC_TYPES[t.b.dtype].name + ' · danger ' + '☠'.repeat(t.loc.tier) + '</small>' : '');
    case 'forage': return k + 'Gather';
    case 'chest': return k + 'Open chest' + (t.lock && !(G.save.containers[t.id] || {}).unlocked ? '<br><small>Locked (level ' + t.lock + ')</small>' : '');
    case 'ldoor': return k + 'Open door<br><small>Locked (level ' + t.lock + ')</small>';
    case 'loot': return k + 'Search ' + esc(t.from === 'arrow' ? 'arrow' : 'remains of ' + t.from);
    case 'ore': return k + 'Mine ore vein';
    case 'shrine': return k + 'Pray at the wayshrine';
    case 'stones': return k + 'Touch the standing stone';
    case 'bed': return k + 'Sleep';
    default: return k + esc(t.label || 'Use');
  }
};

// ----- window manager -----
UI.window = function (title, body, opts = {}) {
  UI.close(true);
  const w = h('div', { class: 'window panel ' + (opts.cls || '') }, h('div', { class: 'title' }, h('span', {}, title), opts.noClose ? null : h('button', { onclick: () => UI.close() }, 'X')), body);
  body.classList.add('body');
  const root = $(opts.root || 'win'); root.innerHTML = ''; root.append(w); root.classList.remove('hidden');
  UI.open = opts.name || title; UI.onClose = opts.onClose || null; UI.root = root; UI.modal = !!opts.noClose;
  G.fn.releasePointer(); UI.hideTip();
  return w;
};
UI.close = function (silent) {
  if (!UI.open) return;
  const cb = UI.onClose; UI.open = null; UI.onClose = null; UI.modal = false; UI.root.classList.add('hidden'); UI.root.innerHTML = ''; UI.hideTip();
  if (cb) cb();
  if (!silent && G.mode === 'play') G.fn.grabPointer();
};

function itemTip(it, extra) {
  const P = G.player; let s = `<h4>${esc(it.name)}${it.qty > 1 ? ' ×' + it.qty : ''}</h4>` + describe(it).map(esc).join('<br>');
  if (it.slot && !P.isEquipped(it)) {
    const cur = P.equip[it.slot === 'ring' ? 'ring1' : it.slot];
    if (cur && cur !== it) { const dl = []; if (it.dmg !== undefined && cur.dmg !== undefined) dl.push('Damage ' + fmtD(it.dmg - cur.dmg)); if (it.ar !== undefined && cur.ar !== undefined) dl.push('Armor ' + fmtD(it.ar - cur.ar)); dl.push('Weight ' + fmtD(it.weight - cur.weight)); s += `<div class="cmp">vs ${esc(cur.name)}:<br>${dl.join('  ')}</div>`; }
  }
  if (extra) s += `<div class="hint">${extra}</div>`;
  return s;
}
const fmtD = (v) => (v > 0 ? '+' : '') + Math.round(v * 10) / 10;
function itemRow(it, right, onclick, cls = '') {
  const P = G.player, r = h('div', { class: 'item ' + cls + (P.isEquipped(it) ? ' eq' : '') + (it.ench ? ' magic' : '') }, h('img', { src: itemIcon(it.icon, it.col) }), h('span', { class: 'n' }, it.name + (it.qty > 1 ? ' (' + it.qty + ')' : '')), h('span', { class: 'q' }, right));
  r.addEventListener('click', onclick); return r;
}
const CATS = [['All', () => true], ['Weapons', (i) => i.type === 'weapon' || i.type === 'ammo' || i.type === 'shield'], ['Armor', (i) => i.type === 'armor' || i.type === 'jewel'], ['Potions', (i) => i.type === 'potion' || i.type === 'food'], ['Ingredients', (i) => i.type === 'ingredient'], ['Misc', (i) => ['tool', 'mat', 'tome', 'quest', 'torch', 'blueprint'].includes(i.type)]];
const sortInv = (a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type.localeCompare(b.type));

// ----- inventory -----
let invCat = 0, invSel = null;
UI.inventory = function () {
  const P = G.player;
  const body = h('div', {});
  const draw = () => {
    body.innerHTML = '';
    const doll = h('div', { class: 'doll' });
    const order = [null, 'head', 'amulet', 'rhand', 'body', 'lhand', 'arms', 'belt', 'ring1', 'legs', 'feet', 'ring2'];
    for (const s of order) {
      if (!s) { doll.append(h('div', {})); continue; }
      const it = P.equip[s], label = EQUIP_SLOTS.find((e) => e[0] === s)[1];
      const el = h('div', { class: 'slot', onclick: () => { if (it) { P.unequip(s); UI.hideTip(); draw(); } } }, it ? h('img', { src: itemIcon(it.icon, it.col), style: s === 'lhand' && it.hands === 2 ? 'opacity:.35' : '' }) : h('span', {}, label));
      if (it) UI.tip(el, () => itemTip(it, 'Click to unequip')); doll.append(el);
    }
    const cw = P.carried(), cm = P.carryMax();
    const stats = h('div', { class: 'parch', style: 'padding:6px 10px' },
      h('div', { class: 'kv' }, 'Armor rating', h('b', {}, String(P.armor()))), h('div', { class: 'kv' }, 'Carried', h('b', { style: cw > cm ? 'color:#a00' : '' }, cw.toFixed(1) + ' / ' + cm + ' lb')), h('div', { class: 'kv' }, 'Gold', h('b', {}, String(P.gold))),
      h('div', { class: 'note', style: 'margin-top:6px' }, 'Click an item to select · double-click to use or equip · hover and press 1-4 to set a quick slot'));
    const tabs = h('div', { class: 'tabs' }, CATS.map((c, i) => h('button', { class: i === invCat ? 'on' : '', onclick: () => { invCat = i; draw(); } }, c[0])));
    const list = h('div', { class: 'list parch', style: 'width:520px;height:46vh' });
    const items = P.inv.filter(CATS[invCat][1]).sort(sortInv);
    if (!items.length) list.append(h('div', { class: 'note', style: 'padding:8px' }, 'Nothing here.'));
    for (const it of items) {
      const r = itemRow(it, itemWeight(it).toFixed(1) + ' lb  ' + it.val + 'g', () => { invSel = it; draw(); }, invSel === it ? 'sel' : '');
      r.addEventListener('dblclick', () => { P.useItem(it); UI.hideTip(); if (UI.open === 'inv') draw(); });
      r.addEventListener('mouseenter', () => { UI.hover = it; }); r.addEventListener('mouseleave', () => { UI.hover = null; });
      UI.tip(r, () => itemTip(it)); list.append(r);
    }
    const it = P.inv.includes(invSel) ? invSel : null;
    const act = h('div', { class: 'row', style: 'min-height:34px;flex-wrap:wrap' });
    if (it) {
      const verb = it.type === 'potion' ? 'Drink' : it.type === 'food' || (it.type === 'ingredient' && it.food) ? 'Eat' : it.type === 'tome' || it.type === 'blueprint' ? 'Read' : it.slot ? (P.isEquipped(it) ? 'Unequip' : 'Equip') : it.id === 'hammer' || it.id === 'mortar' ? 'Use' : null;
      act.append(h('span', { style: 'color:#f0d890' }, it.name));
      if (verb) act.append(h('button', { onclick: () => { P.useItem(it); if (UI.open === 'inv') draw(); } }, verb));
      if (it.type === 'weapon' && it.hands === 1) act.append(h('button', { onclick: () => { P.equipOffhand(it); draw(); } }, 'Off-hand'));
      if (it.type !== 'quest') { act.append(h('button', { onclick: () => { G.fn.dropItem(it, 1); draw(); } }, 'Drop')); if (it.qty > 1) act.append(h('button', { onclick: () => { G.fn.dropItem(it, it.qty); draw(); } }, 'Drop all')); }
    } else act.append(h('span', { class: 'note' }, 'No item selected.'));
    body.append(h('div', { class: 'col', style: 'width:230px' }, doll, stats), h('div', { class: 'col' }, tabs, list, act));
  };
  draw(); UI.redraw = draw;
  UI.window('Inventory', body, { name: 'inv', onClose: () => { UI.hover = null; } });
};

// ----- character sheet -----
UI.character = function () {
  const P = G.player, body = h('div', {});
  const draw = () => {
    body.innerHTML = '';
    const face = h('div', { class: 'face' }, portrait(P.look, 'player' + JSON.stringify(P.look), 5));
    const ab = h('div', { class: 'parch', style: 'padding:6px 10px' }, h('div', { style: 'margin-bottom:4px' }, P.abilPoints ? 'Ability points to spend: ' + P.abilPoints : 'Abilities'));
    for (const a of ABILITIES) { const r = h('div', { class: 'kv' }, a.name, h('span', {}, h('b', {}, String(P.A(a.id))), P.abilPoints ? h('button', { style: 'margin-left:6px;padding:0 6px', onclick: () => { P.abil[a.id]++; P.abilPoints--; P.clampVitals(); draw(); } }, '+') : null)); UI.tip(r, () => `<h4>${a.name}</h4>${a.desc}`); ab.append(r); }
    const w = P.weapon(), der = h('div', { class: 'parch', style: 'padding:6px 10px' },
      ...[['Level', P.level + '  (' + P.ups + '/8 skill-ups)'], ['Health', Math.ceil(P.hp) + ' / ' + P.maxHp()], ['Mana', Math.ceil(P.mp) + ' / ' + P.maxMp()], ['Stamina', Math.ceil(P.st) + ' / ' + P.maxSt()], ['Armor', P.armor()], ['Carry weight', P.carried().toFixed(0) + ' / ' + P.carryMax() + ' lb'], ['Weapon', w ? w.name : 'Fists'], ['Guild standing', Q.rankName() + ' (' + G.save.rep + ')'], ['Foes slain', P.kills]].map(([k, v]) => h('div', { class: 'kv' }, k, h('b', {}, String(v)))));
    const sk = h('div', { class: 'list parch', style: 'width:460px;height:58vh' });
    for (const s of SKILLS) {
      const v = P.skills[s.id], bonus = P.bonus('skill:' + s.id);
      const r = h('div', { class: 'sk' }, h('span', {}, s.name), h('span', { style: bonus ? 'color:#1a3a8a' : '' }, String(v.lvl + bonus)), h('div', { class: 'bar' }, h('i', { style: 'width:' + clamp(v.xp / P.xpNeed(v.lvl) * 100, 0, 100) + '%' })));
      UI.tip(r, () => `<h4>${s.name} ${v.lvl}</h4>${s.desc}<br>Governed by ${ABILITIES.find((a) => a.id === s.abil).name}<div class="cmp">` + s.perks.map((p, i) => `<div style="opacity:${v.lvl >= (i + 1) * PERK_STEP ? 1 : 0.5}">${(i + 1) * PERK_STEP}: <span style="color:#f0d890">${p[0]}</span> - ${p[1]}</div>`).join('') + '</div>');
      sk.append(r);
    }
    body.append(h('div', { class: 'col', style: 'width:300px' }, h('div', { class: 'row' }, face, h('div', {}, h('div', { style: 'font-size:26px;color:#f0d890' }, P.name), h('div', { class: 'note' }, 'Day ' + (dayOf() + 1) + ' of your journey'))), ab, der), h('div', { class: 'col' }, h('div', { class: 'note' }, 'Skills improve through use. Every ' + PERK_STEP + ' levels unlocks a perk - hover to see them.'), sk));
  };
  draw(); UI.window('Character', body, { name: 'char' });
};

// ----- journal -----
UI.journal = function () {
  const S = G.save, body = h('div', {}), list = h('div', { class: 'list parch', style: 'width:320px;height:58vh' }), det = h('div', { class: 'parch', style: 'width:500px;padding:10px 14px;white-space:pre-wrap;overflow-y:auto;height:58vh;line-height:1.05' });
  let sel = S.quests.find((q) => q.id === S.tracked && q.state === 'active') || S.quests.filter((q) => q.state === 'active')[0], selF = null;
  const draw = () => {
    list.innerHTML = ''; const act = S.quests.filter((q) => q.state === 'active'), done = S.quests.filter((q) => q.state === 'done');
    const row = (q, dim) => h('div', { class: 'item' + (dim ? ' dim' : '') + (q === sel && !selF ? ' sel' : ''), onclick: () => { sel = q; selF = null; if (!dim) S.tracked = q.id; draw(); } }, (S.tracked === q.id && !dim ? '◆ ' : '') + q.title);
    const mains = act.filter((q) => q.main), sides = act.filter((q) => !q.main);
    list.append(h('div', { class: 'note' }, 'Main missions (' + mains.length + ')')); for (const q of mains) list.append(row(q));
    list.append(h('div', { class: 'note', style: 'margin-top:8px' }, 'Contracts & errands (' + sides.length + ')')); for (const q of sides) list.append(row(q));
    const facs = F.knownFactions();
    if (facs.length) { list.append(h('div', { class: 'note', style: 'margin-top:8px' }, 'Factions')); for (const f of facs) { const d = F.factionDef(f); list.append(h('div', { class: 'item' + (selF === f ? ' sel' : ''), onclick: () => { selF = f; draw(); } }, h('span', { class: 'n' }, d.name), h('span', { class: 'q', style: 'width:auto' }, d.ranks[F.rankOf(f)]))); } }
    if (done.length) list.append(h('div', { class: 'note', style: 'margin-top:8px' }, 'Completed (' + done.length + ')'));
    for (const q of done.slice(-14).reverse()) list.append(row(q, true));
    det.innerHTML = '';
    if (selF) { const d = F.factionDef(selF); det.append(h('h3', {}, d.name), '\n' + F.summary(selF)); }
    else if (sel) {
      const t = sel.state === 'active' && Q.questTarget(sel);
      det.append(h('h3', {}, sel.title), '\n' + (sel.main ? '[' + F.factionDef(sel.faction).name + ' - main mission ' + (sel.idx + 1) + ']\n\n' : '') + sel.desc + '\n\nGiven by ' + sel.giver.name + ' of ' + G.world.locs[sel.giver.loc].name + '.\nReward: ' + sel.gold + ' gold' + (sel.main ? '\nNo time limit.' : '') + (sel.steps && sel.state === 'active' ? '' : '\n\n» ' + Q.progressText(sel)) + (t && !G.space ? '\n\nNext: ' + t.name + ', ' + Q.whereText(G.player.pos, t) + ' of here.' : ''));
      if (!sel.main && sel.state === 'active') det.append('\n\n', h('button', { onclick: () => { if (det.dataset.sure !== String(sel.id)) { det.dataset.sure = sel.id; G.fn.msg('Click again to abandon "' + sel.title + '".' + (sel.faction ? ' It will cost you standing with the ' + F.factionDef(sel.faction).name + '.' : '')); return; } Q.abandon(sel); sel = null; draw(); } }, 'Abandon'));
      if (sel.steps && sel.state === 'active') det.append('\n\n' + sel.steps.map((o, i) => (i < sel.step ? '✔ ' : i === sel.step ? '» ' : '· ') + (i <= sel.step ? Q.progressText(Object.assign({}, sel, { step: i })).replace(/^\(\d+\/\d+\) /, '') : '...')).join('\n'));
    } else det.append('No quests yet.\n\nKingdoms, guilds and churches each have a long story of main missions - speak with a castle steward, a guildmaster or a priest. Guild boards, the crown and ordinary folk offer shorter work, which also raises your standing.');
  };
  draw(); body.append(list, det); UI.window('Journal', body, { name: 'journal' });
};

// ----- spellbook -----
UI.spellbook = function () {
  const P = G.player, body = h('div', {}), list = h('div', { class: 'list parch', style: 'width:560px;height:50vh' });
  const draw = () => {
    list.innerHTML = '';
    if (!P.spells.length) list.append(h('div', { style: 'padding:10px;white-space:pre-wrap' }, 'You know no spells.\n\nArcanists in towns and cities sell spell tomes. Read a tome from your inventory to learn it, then press Q to cast your readied spell.'));
    for (const id of P.spells) { const S = SPELLS[id]; const r = h('div', { class: 'item' + (P.spell === id ? ' sel' : ''), onclick: () => { P.spell = id; draw(); } }, h('span', { class: 'n' }, (P.spell === id ? '◆ ' : '') + S.name + ' - ' + S.desc), h('span', { class: 'q' }, SKILL_BY_ID[S.school].name.slice(0, 5) + '  ' + P.spellCost(id) + ' mp')); list.append(r); }
  };
  draw(); body.append(h('div', { class: 'col' }, h('div', { class: 'note' }, 'Click a spell to ready it. Q casts.'), list)); UI.window('Spellbook', body, { name: 'spells' });
};

// ----- loot / containers -----
UI.loot = function (title, loot, onDone) {
  const P = G.player, body = h('div', {}), list = h('div', { class: 'list parch', style: 'width:460px;height:36vh' });
  const takeGold = () => { if (loot.gold) { P.gold += loot.gold; G.fn.msg('You take ' + loot.gold + ' gold.'); loot.gold = 0; G.fn.sfx('coin'); } };
  const draw = () => {
    list.innerHTML = '';
    if (loot.gold) list.append(h('div', { class: 'item', onclick: () => { takeGold(); draw(); } }, h('img', { src: itemIcon('gold', '#e8c040') }), h('span', { class: 'n' }, loot.gold + ' gold')));
    for (const it of loot.items) { const r = itemRow(it, itemWeight(it).toFixed(1) + ' lb', () => { loot.items.splice(loot.items.indexOf(it), 1); P.addItem(it); G.fn.sfx('pick'); UI.hideTip(); draw(); }); UI.tip(r, () => itemTip(it)); list.append(r); }
    if (!loot.gold && !loot.items.length) list.append(h('div', { class: 'note', style: 'padding:8px' }, 'Empty.'));
  };
  UI.takeAll = () => { takeGold(); for (const it of loot.items) P.addItem(it); if (loot.items.length) G.fn.sfx('pick'); loot.items.length = 0; UI.close(); };
  draw(); body.append(h('div', { class: 'col' }, list, h('div', { class: 'row' }, h('button', { onclick: UI.takeAll }, 'Take all [E]'), h('button', { onclick: () => UI.close() }, 'Close'))));
  UI.window(title, body, { name: 'loot', onClose: () => { UI.takeAll = null; if (onDone) onDone(); } });
};

// ----- dialogue -----
UI.talk = function (npc) {
  const conv = conversation(npc); G.talking = npc;
  const say = h('div', { class: 'say parch' }, conv.greeting), topics = h('div', { class: 'topics' });
  const show = (list, sub) => {
    topics.innerHTML = '';
    for (const t of list) topics.append(h('button', { onclick: () => { const r = t.run(); if (r === undefined) return; if (typeof r === 'string') { say.textContent = r; if (sub) show(conversation(npc).topics); else show(conversation(npc).topics); } else { say.textContent = r.text; show(r.topics, true); } } }, t.label));
    topics.append(h('button', { onclick: () => (sub ? show(conversation(npc).topics) : UI.close()) }, sub ? 'Back' : 'Farewell'));
  };
  show(conv.topics);
  const body = h('div', {}, h('div', { class: 'col', style: 'flex:1' }, h('div', { class: 'row', style: 'align-items:flex-start' }, h('div', { class: 'face' }, portrait(npc.c.look, 'c' + npc.c.id, 5)), h('div', { class: 'col', style: 'flex:1' }, say))), topics);
  UI.window(conv.title, body, { name: 'talk', cls: 'dlg', onClose: () => { G.talking = null; } });
};
UI.openQuestBoard = function (npc, L, royal) {
  const body = h('div', {}), list = h('div', { class: 'list parch', style: 'width:640px;height:52vh;white-space:normal' });
  const fid = royal ? 'k:' + L.id : guildOf(L), fdef = F.factionDef(fid);
  const draw = () => {
    list.innerHTML = '';
    const offers = Q.offersFor(L, npc.c, royal ? 3 : 5, royal ? ['bounty', 'fetch'] : ['delivery', 'fetch', 'bounty', 'slay', 'gather', 'supply']);
    if (royal) for (const o of offers) { o.gold = Math.round(o.gold * 1.8 * (F.hasPriv(fid, 'commission') ? 1.25 : 1)); o.title = 'Royal ' + o.title; }
    for (const o of offers) o.faction = fid;
    if (!offers.length) list.append(h('div', { style: 'padding:10px' }, 'There is no more work for now. New contracts are posted every few days.'));
    for (const o of offers) list.append(h('div', { style: 'padding:6px 8px;border-bottom:1px solid #8a7048' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('b', { style: 'font-weight:normal;font-size:23px;color:#6a1a10' }, o.title), h('span', {}, o.gold + ' gold')), h('div', { style: 'white-space:normal;line-height:1.05;margin:3px 0 5px' }, o.desc), h('button', { onclick: () => { Q.accept(o); draw(); } }, 'Accept')));
  };
  draw(); body.append(h('div', { class: 'col' }, h('div', { class: 'note' }, fdef.name + ' - your rank: ' + fdef.ranks[F.rankOf(fid)] + '. Each contract raises your standing here; main missions come from the ' + (royal ? 'steward and the king' : 'guildmaster') + '.'), list));
  UI.window(royal ? 'Royal Commissions' : fdef.name + ' Contracts', body, { name: 'board', onClose: () => { G.talking = null; } });
};

// ----- trade -----
UI.openTrade = function (npc, b, L, custom) {
  const P = G.player, c = npc.c, shop = custom ? custom.shop : shopStock(L, b), kind = custom ? custom.kind : b.type, disc = custom ? custom.disc : 1, body = h('div', {});
  const draw = () => {
    body.innerHTML = '';
    const left = h('div', { class: 'list parch', style: 'width:430px;height:52vh' }), right = h('div', { class: 'list parch', style: 'width:430px;height:52vh' });
    for (const it of shop.items.slice().sort(sortInv)) {
      const p = Math.max(1, Math.ceil(buyPrice(it, c) * disc)), r = itemRow(it, p + 'g', (e) => { const n = e.shiftKey ? Math.min(it.qty || 1, Math.floor(P.gold / p)) : 1; if (P.gold < p || n < 1) { G.fn.msg('You cannot afford that.', 'bad'); G.fn.sfx('deny'); return; } P.gold -= p * n; shop.gold += p * n; const one = Object.assign({}, it, it.stack ? { qty: n } : {}); if (it.stack && it.qty > n) it.qty -= n; else shop.items.splice(shop.items.indexOf(it), 1); P.addItem(one); P.gainXP('persuasion', 0.4 + p * n * 0.02); G.fn.sfx('coin'); UI.hideTip(); draw(); }, P.gold < p ? 'dim' : '');
      UI.tip(r, () => itemTip(it, 'Click to buy · Shift-click buys the stack')); left.append(r);
    }
    for (const it of P.inv.filter((i) => wants(kind, i)).sort(sortInv)) {
      const p = sellPrice(it, c), r = itemRow(it, p + 'g', (e) => { const n = e.shiftKey ? (it.qty || 1) : 1, tot = Math.min(p * n, shop.gold); if (shop.gold < p) { G.fn.msg(c.name.split(' ')[0] + ' cannot afford that.', 'bad'); return; } const sold = Object.assign({}, it, it.stack ? { qty: n } : {}); P.removeItem(it, n); P.gold += tot; shop.gold -= tot; const ex = sold.stack && shop.items.find((o) => o.sk === sold.sk); if (ex) ex.qty += n; else shop.items.push(sold); P.gainXP('persuasion', 0.4 + tot * 0.02); G.fn.sfx('coin'); UI.hideTip(); draw(); });
      UI.tip(r, () => itemTip(it, 'Click to sell · Shift-click sells the stack')); right.append(r);
    }
    body.append(h('div', { class: 'col' }, h('div', {}, (custom ? custom.title + ' (member prices)' : b.name) + ' - ' + shop.gold + ' gold'), left), h('div', { class: 'col' }, h('div', {}, 'Your goods - ' + P.gold + ' gold   (' + P.carried().toFixed(0) + '/' + P.carryMax() + ' lb)'), right));
  };
  draw(); UI.window('Trading with ' + c.name, body, { name: 'trade', onClose: () => { G.talking = null; } });
};

// ----- strongbox: storage shared between a faction's halls -----
UI.stash = function (title, box) {
  const P = G.player, body = h('div', {});
  const draw = () => {
    body.innerHTML = '';
    const left = h('div', { class: 'list parch', style: 'width:420px;height:52vh' }), right = h('div', { class: 'list parch', style: 'width:420px;height:52vh' });
    for (const it of box.slice().sort(sortInv)) { const r = itemRow(it, itemWeight(it).toFixed(1) + ' lb', () => { box.splice(box.indexOf(it), 1); P.addItem(it); G.fn.sfx('pick'); UI.hideTip(); draw(); }); UI.tip(r, () => itemTip(it, 'Click to take')); left.append(r); }
    if (!box.length) left.append(h('div', { class: 'note', style: 'padding:8px' }, 'Empty. Click an item on the right to store it.'));
    for (const it of P.inv.filter((i) => i.type !== 'quest').sort(sortInv)) { const r = itemRow(it, itemWeight(it).toFixed(1) + ' lb', () => { const whole = Object.assign({}, it); P.removeItem(it, it.qty || 1); const ex = whole.stack && box.find((o) => o.sk === whole.sk); if (ex) ex.qty += whole.qty; else box.push(whole); G.fn.sfx('pick'); UI.hideTip(); draw(); }); UI.tip(r, () => itemTip(it, 'Click to store')); right.append(r); }
    body.append(h('div', { class: 'col' }, h('div', {}, 'In the strongbox (' + box.length + ')'), left), h('div', { class: 'col' }, h('div', {}, 'Carried: ' + P.carried().toFixed(0) + '/' + P.carryMax() + ' lb'), right));
  };
  draw(); UI.window(title, body, { name: 'stash', onClose: () => { G.talking = null; } });
};

// ----- world map -----
let mapBase = null, mapZoom = 0, mapCx = 0, mapCz = 0;
const PIN = { farm: '#c8b060', village: '#e0c070', town: '#f0d890', city: '#fff0b0', castle: '#ffffff', mine: '#e8a040', crypt: '#b8b8c8', cave: '#a08060', den: '#c06040', ruin: '#d0a060', tower: '#a090d0' };
UI.map = function () {
  const W = G.world, P = G.player, S = G.save;
  if (!mapBase || mapBase.seed !== W.seed || mapBase.size !== W.size) { const n = 384, c = document.createElement('canvas'); c.width = c.height = n; c.getContext('2d').putImageData(new ImageData(W.mapImage(n), n, n), 0, 0); mapBase = c; mapBase.seed = W.seed; mapBase.size = W.size; mapZoom = 0; }
  const sz = Math.min(innerHeight - 190, innerWidth - 380, 760), cv = h('canvas', { width: sz, height: sz }), g = cv.getContext('2d');
  const info = h('div', { class: 'parch', style: 'width:270px;padding:8px 10px;white-space:pre-wrap;height:' + sz + 'px;overflow-y:auto' });
  const here = G.outPos || P.pos;
  if (!mapZoom) { mapZoom = sz / Math.min(9000, WORLD); } mapCx = here.x; mapCz = here.z;
  const fog = document.createElement('canvas'); const EG = W.eg; fog.width = fog.height = EG; const fg = fog.getContext('2d'), fd = fg.createImageData(EG, EG);
  for (let i = 0; i < EG * EG; i++) { fd.data[i * 4] = 196; fd.data[i * 4 + 1] = 176; fd.data[i * 4 + 2] = 134; fd.data[i * 4 + 3] = S.explored[i] ? 0 : 232; } fg.putImageData(fd, 0, 0);
  let sel = null, pins = [];
  const sx = (x) => (x - mapCx) * mapZoom + sz / 2, sy = (z) => (z - mapCz) * mapZoom + sz / 2;
  const draw = () => {
    g.imageSmoothingEnabled = false; g.fillStyle = '#c4b086'; g.fillRect(0, 0, sz, sz);
    g.drawImage(mapBase, sx(-HALF), sy(-HALF), WORLD * mapZoom, WORLD * mapZoom);
    g.strokeStyle = 'rgba(90,60,30,.7)'; g.lineWidth = Math.max(1, mapZoom * 8);
    for (const r of W.roads) { g.beginPath(); r.pts.forEach((p, i) => (i ? g.lineTo(sx(p[0]), sy(p[1])) : g.moveTo(sx(p[0]), sy(p[1])))); g.stroke(); }
    g.strokeStyle = 'rgba(52,96,128,.95)';
    for (const r of W.rivers) { g.lineWidth = Math.max(1.5, mapZoom * 14); g.beginPath(); for (let i = 0; i < r.pts.length; i += 2) { const p = r.pts[i]; if (i) g.lineTo(sx(p[0]), sy(p[1])); else g.moveTo(sx(p[0]), sy(p[1])); } const e = r.pts[r.pts.length - 1]; g.lineTo(sx(e[0]), sy(e[1])); g.stroke(); }
    if (mapZoom > 0.06) { g.fillStyle = '#5a3a1a'; for (const b of W.bridges) g.fillRect(sx(b.x) - 3, sy(b.z) - 3, 6, 6); }
    g.drawImage(fog, sx(-HALF), sy(-HALF), WORLD * mapZoom, WORLD * mapZoom);
    pins = []; g.font = '18px VT323'; g.textAlign = 'center';
    for (const L of W.locs) {
      const disc = S.discovered[L.id], known = S.known[L.id]; if (!disc && !known) continue;
      const x = sx(L.x), y = sy(L.z); if (x < -20 || y < -20 || x > sz + 20 || y > sz + 20) continue;
      const r = L.civ ? { farm: 3, village: 4, town: 5, city: 7, castle: 8 }[L.type] : 4;
      if (mapZoom > 0.25 && L.civ && disc) { // town plan
        const lay = getLayout(W, L);
        for (const b of lay.buildings) { g.fillStyle = b.type === 'house' || b.type === 'barn' || b.type === 'farmhouse' ? '#6a5038' : b.type === 'castle' ? '#888' : '#b03020'; g.fillRect(sx(b.x - b.w / 2), sy(b.z - b.d / 2), b.w * mapZoom, b.d * mapZoom); if (mapZoom > 1.7 && (BUILDINGS[b.type].sign || b.type === 'castle')) { g.fillStyle = '#000'; g.font = '16px VT323'; g.fillText(b.name, sx(b.x), sy(b.z - b.d / 2) - 3); } }
        g.fillStyle = '#555'; for (const w of lay.walls) g.fillRect(sx(w.x0), sy(w.z0), (w.x1 - w.x0) * mapZoom, (w.z1 - w.z0) * mapZoom);
      } else {
        g.fillStyle = disc ? PIN[L.type] : 'rgba(0,0,0,0)'; g.strokeStyle = '#1a1008'; g.lineWidth = 2;
        if (L.civ) { g.fillRect(x - r, y - r, r * 2, r * 2); g.strokeRect(x - r, y - r, r * 2, r * 2); } else { g.beginPath(); g.moveTo(x, y - r - 1); g.lineTo(x + r + 1, y + r); g.lineTo(x - r - 1, y + r); g.closePath(); g.fill(); g.stroke(); }
        if (!disc) { g.fillStyle = '#1a1008'; g.fillText('?', x, y + 5); }
      }
      if (mapZoom > 0.035 || L.type === 'castle' || L.type === 'city' || L === sel) { g.fillStyle = '#1a1008'; g.fillText(L.name, x, y - r - 4); }
      if (L.home && disc) { g.fillStyle = (S.homes[L.id] || {}).owned ? '#1a7a2a' : '#7a5a1a'; g.font = '22px VT323'; g.fillText('⌂', x + r + 8, y + 6); g.font = '18px VT323'; }
      pins.push([x, y, L]);
    }
    const q = S.quests.find((x) => x.id === S.tracked && x.state === 'active'), t = q && Q.questTarget(q);
    if (t) { g.fillStyle = '#28c'; g.font = '26px VT323'; g.fillText('◆', sx(t.x), sy(t.z) + 26); }
    if (S.marker) { g.fillStyle = '#c80'; g.fillText('▼', sx(S.marker.x), sy(S.marker.z)); }
    // player arrow
    g.save(); g.translate(sx(here.x), sy(here.z)); g.rotate(-P.yaw); g.fillStyle = '#d02010'; g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill(); g.stroke(); g.restore();
    // scale bar
    const km = mapZoom * 1000; const unit = km > 300 ? 100 : km > 60 ? 1000 : 5000; g.fillStyle = '#1a1008'; g.fillRect(12, sz - 16, unit * mapZoom, 3); g.textAlign = 'left'; g.font = '18px VT323'; g.fillText(unit >= 1000 ? unit / 1000 + ' km' : unit + ' m', 12, sz - 20);
    info.innerHTML = '';
    if (sel) {
      const disc = S.discovered[sel.id], d = Math.hypot(sel.x - here.x, sel.z - here.z);
      info.append(h('h3', {}, sel.name), `\n${LOC_TYPES[sel.type].name}${sel.civ ? '' : '  ' + '☠'.repeat(sel.tier)}\n${BIOMES[sel.biome].name}\n${Q.whereText(here, sel)}\n${disc ? (sel.civ ? sel.count + ' buildings' : 'Visited') : 'Not yet visited'}\n\n`);
      if (sel.home && disc) info.append(((S.homes[sel.id] || {}).owned ? 'You own a house here: ' + S.homes[sel.id].name : 'A house is for sale here.') + '\n\n');
      if (sel.civ) {
        const big = sel.type === 'town' || sel.type === 'city' || sel.type === 'castle', bar = (o, defs) => Object.keys(o).sort((x, y) => o[y] - o[x]).filter((k) => o[k] >= 1).map((k) => '  ' + defs(k).name.replace('Circle of the ', '').replace('Church of the ', '').replace('Temple of the ', '').replace(' of the Mother', '') + ' ' + Math.round(o[k])).join('\n');
        info.append(realmName(W, sel) + '\n' + (disc ? (big ? '\nGuild influence:\n' + bar(F.influenceAt(sel, 'guild'), F.factionDef) + '\n' : '') + '\nFaith:\n' + bar(F.influenceAt(sel, 'church'), F.factionDef) + '\n\n' : '\n'));
      }
      if (disc) { const hrs = d / 1000 / 5; info.append(h('button', { onclick: () => G.fn.fastTravel(sel) }, 'Travel here'), `\n\nThe journey on foot takes about ${hrs < 1 ? Math.round(hrs * 60) + ' minutes' : hrs.toFixed(1) + ' hours'}.`); }
      else info.append('You must find your own way to a place before you can travel there swiftly.');
    } else info.append(h('h3', {}, 'Aerhelgard'), `\n${Object.keys(S.discovered).length} of ${W.locs.length} places discovered.\n\nDrag to pan, scroll to zoom. Zoom in on a visited settlement to see its streets and shops.\n\nClick a place for details. You can travel swiftly to any place you have already visited.\n\n■ settlement  ▲ dungeon\n⌂ house for sale (green: yours)\n? heard of, not yet seen\n◆ tracked quest`);
  };
  let drag = null;
  cv.addEventListener('mousedown', (e) => { drag = [e.clientX, e.clientY, mapCx, mapCz, false]; });
  cv.addEventListener('mousemove', (e) => { if (drag) { if (Math.abs(e.clientX - drag[0]) + Math.abs(e.clientY - drag[1]) > 4) drag[4] = true; mapCx = drag[2] - (e.clientX - drag[0]) / mapZoom; mapCz = drag[3] - (e.clientY - drag[1]) / mapZoom; draw(); } });
  cv.addEventListener('mouseup', (e) => { if (drag && !drag[4]) { const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top; sel = null; let bd = 16; for (const [x, y, L] of pins) { const d = Math.hypot(x - mx, y - my); if (d < bd) { bd = d; sel = L; } } draw(); } drag = null; });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); mapZoom = clamp(mapZoom * (e.deltaY < 0 ? 1.3 : 1 / 1.3), sz / WORLD, 3); draw(); }, { passive: false });
  draw();
  UI.window('Map of Aerhelgard', h('div', {}, h('div', { class: 'mapwrap parch' }, cv), info), { name: 'map' });
};
