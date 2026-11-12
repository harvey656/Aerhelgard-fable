// Aerhelgard - entry point: boot, main loop, input, interaction, transitions, saving.
import * as THREE from '../vendor/three.module.min.js';
import { G, hourOf, dayOf, isNight } from './state.js';
import { DAY_LEN, SKILLS, EFFECTS, BUILDINGS, LOC_TYPES } from './data.js';
import { RNG, rnd, hash2, clamp } from './rng.js';
import { makeTextures, makeAtlases, PROPS } from './art.js';
import { makeMaterials } from './mats.js';
import { World, HALF, WORLD } from './world.js';
import { Terrain } from './terrain.js';
import { initSky, updateSky, interiorFog, setSkyVisible } from './sky.js';
import { Player, EYE } from './player.js';
import { getLayout, clearLayouts, clearCitizens, citizensOf, whereabouts } from './settlement.js';
import { genBuilding, genDungeon } from './interior.js';
import { NPC, Monster, updateEntities, clearEnts, shoot, aimEnemy, bolt, spawnLoot, removeBag } from './entities.js';
import * as I from './items.js';
import * as Q from './quests.js';
import { UI, $ } from './ui.js';
import './ui2.js';
import { sfx, audio } from './audio.js';
import { weaponCanvas } from './sprites.js';

const TIME_SCALE = 86400 / DAY_LEN, SAVE_KEY = 'aerhelgard.save.', META_KEY = 'aerhelgard.meta';
let renderer, scene, camera, fx, fxg, locked = false, hadLock = false, tickT = 0, target = null, last = 0;
const mouse = { l: false, r: false }, input = { fwd: 0, strafe: 0, turn: 0, sprint: false, jump: false, attack: false, block: false };
G.opts = Object.assign({ pixel: 0, sens: 1, vol: 0.6, invert: false }, JSON.parse(localStorage.getItem('aerhelgard.opts') || '{}'));
G.bags = []; G.projs = [];

// ---------- boot ----------
async function boot() {
  try { await Promise.all([document.fonts.load('20px VT323'), document.fonts.load('40px "Pirata One"')]); } catch { /* fonts optional */ }
  makeTextures(); makeAtlases(); makeMaterials();
  renderer = G.renderer = new THREE.WebGLRenderer({ canvas: $('view'), antialias: false, powerPreference: 'high-performance' });
  scene = G.scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x000000, 10, 300);
  camera = G.camera = new THREE.PerspectiveCamera(66, 1, 0.08, 3000); camera.rotation.order = 'YXZ';
  G.entGroup = new THREE.Group(); scene.add(G.entGroup);
  initSky(scene);
  fx = $('fx'); fxg = fx.getContext('2d');
  UI.init(); audio.vol = G.opts.vol;
  resize(); addEventListener('resize', resize);
  bindInput();
  const q = new URLSearchParams(location.search);
  if (q.has('dev')) devStart(q); else UI.mainMenu();
  requestAnimationFrame(loop);
}
function resize() {
  const o = G.opts, vh = innerHeight - 96;
  if (!o.pixel) o.pixel = Math.max(2, Math.round(innerHeight / 330));
  const w = Math.ceil(innerWidth / o.pixel), hh = Math.ceil(vh / o.pixel);
  renderer.setSize(w, hh, false); fx.width = w; fx.height = hh;
  camera.aspect = innerWidth / vh; camera.updateProjectionMatrix();
}
G.fn.resize = resize;
G.fn.saveOpts = () => { audio.vol = G.opts.vol; localStorage.setItem('aerhelgard.opts', JSON.stringify(G.opts)); };
G.fn.msg = (t, c) => UI.msg(t, c); G.fn.banner = (t) => UI.banner(t); G.fn.flash = (c, d) => UI.flash(c, d); G.fn.sfx = sfx; G.fn.showEnemy = (e) => UI.showEnemy(e);
G.fn.shoot = shoot; G.fn.aimEnemy = aimEnemy; G.fn.bolt = bolt;
G.fn.openRepair = () => UI.repair(); G.fn.openAlchemy = () => UI.alchemy();
G.fn.grabPointer = () => { if (G.mode === 'play' && !UI.open) { try { const p = $('view').requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* not available */ } } };
G.fn.releasePointer = () => { if (document.pointerLockElement) document.exitPointerLock(); };

// ---------- input ----------
function bindInput() {
  const view = $('view');
  view.addEventListener('mousedown', (e) => { if (G.mode !== 'play' || UI.open) return; if (!locked) { G.fn.grabPointer(); if (!hadLock) return; } if (e.button === 0) mouse.l = true; if (e.button === 2) mouse.r = true; });
  addEventListener('mouseup', (e) => { if (e.button === 0) mouse.l = false; if (e.button === 2) mouse.r = false; });
  addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === view; if (locked) hadLock = true; else { mouse.l = mouse.r = false; if (G.mode === 'play' && !UI.open && hadLock) UI.pause(); } });
  addEventListener('mousemove', (e) => { if (!locked || G.mode !== 'play' || UI.open) return; const P = G.player, s = 0.0022 * G.opts.sens; P.yaw -= e.movementX * s; P.pitch = clamp(P.pitch - e.movementY * s * (G.opts.invert ? -1 : 1), -1.45, 1.45); });
  addEventListener('blur', () => { G.keys = {}; mouse.l = mouse.r = false; });
  addEventListener('keyup', (e) => { G.keys[e.code] = false; });
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') { if (e.code === 'Escape') e.target.blur(); return; }
    if (['Tab', 'F1', 'F5', 'F9', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    G.keys[e.code] = true;
    if (G.mode !== 'play') { if (e.code === 'Escape' && UI.open && !UI.modal) UI.close(); return; }
    const P = G.player, toggle = (name, fn) => { if (UI.open === name) UI.close(); else if (!UI.modal) fn(); };
    if (UI.open) {
      if (e.code === 'Escape' && !UI.modal) return UI.close();
      if (UI.open === 'loot' && (e.code === 'KeyE' || e.code === 'KeyR') && UI.takeAll) return UI.takeAll();
      if (UI.open === 'pick' && (e.code === 'Space' || e.code === 'KeyE') && UI.pickTry) return UI.pickTry();
      if (UI.open === 'inv' && /^Digit[1-4]$/.test(e.code) && UI.hover && UI.hover.sk && ['potion', 'food', 'ingredient'].includes(UI.hover.type)) { P.quick[+e.code[5] - 1] = UI.hover.sk; G.fn.msg(UI.hover.name + ' set to quick slot ' + e.code[5] + '.'); return; }
    }
    switch (e.code) {
      case 'Escape': if (!UI.open) UI.pause(); break;
      case 'Tab': case 'KeyI': toggle('inv', () => UI.inventory()); break;
      case 'KeyC': toggle('char', () => UI.character()); break;
      case 'KeyM': toggle('map', () => UI.map()); break;
      case 'KeyJ': toggle('journal', () => UI.journal()); break;
      case 'KeyB': toggle('spells', () => UI.spellbook()); break;
      case 'F1': toggle('help', () => UI.help()); break;
      case 'KeyR': if (!UI.open) UI.rest(); break;
      case 'KeyE': if (!UI.open) interact(); break;
      case 'KeyQ': if (!UI.open) P.cast(); break;
      case 'KeyX': if (!UI.open) { P.sneak = !P.sneak; G.fn.msg(P.sneak ? 'You move quietly.' : 'You stand tall.'); } break;
      case 'F5': if (!UI.modal) saveGame('quick'); break;
      case 'F9': if (localStorage.getItem(SAVE_KEY + 'quick')) { UI.close(true); loadGame('quick'); } break;
      default: if (!UI.open && /^Digit[1-4]$/.test(e.code)) { const sk = P.quick[+e.code[5] - 1], it = sk && P.inv.find((o) => o.sk === sk); if (it) P.useItem(it); }
    }
  });
}
function readInput() {
  const k = G.keys;
  input.fwd = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0); input.strafe = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
  input.turn = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0); input.sprint = !!(k.ShiftLeft || k.ShiftRight); input.jump = !!k.Space;
  input.attack = mouse.l || !!k.KeyF; input.block = mouse.r || !!k.KeyG;
}

// ---------- new game / world ----------
function setLoading(text) { $('loadText').textContent = text; $('loading').classList.remove('hidden'); return new Promise((r) => setTimeout(r, 30)); }
function buildWorld(seed) {
  if (G.terrain) G.terrain.dispose();
  if (G.space) { scene.remove(G.space.group); G.space.dispose(); G.space = null; }
  clearEnts(); clearLayouts(); clearCitizens();
  G.world = new World(seed); G.terrain = new Terrain(scene, G.world); G.terrain.outdoor = true; G.phys = G.terrain; G.outPos = null; G.popInit = false;
  setSkyVisible(true);
}
function freshSave(seed) { return { seed, discovered: {}, known: {}, harvested: {}, containers: {}, poi: {}, quests: [], qid: 0, taken: {}, npc: {}, shops: {}, cleared: {}, explored: new Uint8Array(192 * 192), rep: 0, tracked: 0, marker: null, room: null, lore: {} }; }

G.fn.newGame = async function (cfg) {
  G.loading = true; UI.close(true); $('menu').classList.add('hidden');
  await setLoading('Shaping the realm of Aerhelgard...');
  G.save = freshSave(cfg.seed >>> 0); G.time = 8 * 3600;
  buildWorld(G.save.seed);
  const P = G.player = new Player(cfg), W = G.world, L = W.start;
  startingKit(P);
  P.pos.set(L.x + 5, 0, L.z + 6); P.yaw = 0.6;
  await setLoading('Raising ' + L.name + '...');
  G.terrain.loadAround(P.pos.x, P.pos.z);
  [P.pos.x, P.pos.z] = G.terrain.collide(P.pos.x, P.pos.z, 0.5); P.pos.y = G.terrain.groundAt(P.pos.x, P.pos.z);
  beginPlay();
  UI.msg('You arrive in ' + L.name + ' with little more than the clothes on your back.', 'quest');
  UI.msg('Speak with the townsfolk (E) to learn of shops, work and nearby places. F1 shows the controls.');
  UI.banner(L.name);
  saveGame('auto', true);
};
function startingKit(P) {
  const s = (id) => P.skills[id].lvl, add = (it) => P.addItem(it), eq = (it) => { add(it); P.equipItem(it); };
  const wk = [['short', 'shortsword'], ['long', 'longsword'], ['blunt', 'mace'], ['axes', 'handaxe'], ['polearms', 'spear'], ['archery', 'shortbow']].sort((a, b) => s(b[0]) - s(a[0]));
  eq(I.mkWeapon(wk[0][1], 0));
  if (wk[0][0] === 'archery') { add(I.mkMisc('arrow', 50)); add(I.mkWeapon('dagger', 0)); } else if (s('archery') >= 30) { add(I.mkWeapon('shortbow', 0)); add(I.mkMisc('arrow', 30)); }
  if (s('heavy') > s('light')) { eq(I.mkArmor('heavy', 'body', 0)); if (s('heavy') >= 35) eq(I.mkArmor('heavy', 'head', 0)); } else { eq(I.mkArmor('light', 'body', 0)); eq(I.mkArmor('light', 'feet', 0)); if (s('light') >= 35) eq(I.mkArmor('light', 'legs', 0)); }
  if (s('shields') >= 30 && wk[0][0] !== 'archery') eq(I.mkShield('buckler', 0));
  if (s('lockpick') > 20) add(I.mkMisc('lockpick', 2 + Math.floor((s('lockpick') - 20) / 5)));
  if (s('alchemy') >= 30) { add(I.mkMisc('mortar')); add(I.mkIng('redcap', 3)); add(I.mkIng('blackberry', 3)); add(I.mkIng('bluebell', 2)); add(I.mkIng('moonpetal', 2)); }
  if (s('smithing') >= 30) { add(I.mkMisc('hammer')); add(I.mkIngot(0, 4)); }
  if (s('foraging') >= 30) add(I.mkMisc('pickaxe'));
  const magic = [['destruction', 'firebolt'], ['illusion', 'glimmer'], ['alteration', 'mend']].sort((a, b) => s(b[0]) - s(a[0]));
  for (const [sch, sp] of magic) if (s(sch) >= 30) { P.spells.push(sp); if (!P.spell) P.spell = sp; }
  if (s(magic[0][0]) >= 45) { const extra = { destruction: 'frostshard', illusion: 'dread', alteration: 'stoneskin' }[magic[0][0]]; P.spells.push(extra); }
  add(I.mkPotion('heal', EFFECTS.heal.base, 2)); add(I.mkMisc('bread', 3)); add(I.mkMisc('torch', 2));
  P.gold = 60 + (s('persuasion') - 20) * 3;
  P.quick[0] = 'p:heal:' + EFFECTS.heal.base;
  P.hp = P.maxHp(); P.mp = P.maxMp(); P.st = P.maxSt();
}
function beginPlay() {
  G.mode = 'play'; G.loading = false; G.keys = {}; mouse.l = mouse.r = false;
  $('menu').classList.add('hidden'); $('loading').classList.add('hidden'); $('hud').classList.remove('hidden'); $('msgs').innerHTML = ''; UI.msgs.length = 0;
  UI.setPortrait(); updateSky(1, scene, camera, true); tickT = 0;
}
G.fn.quitToMenu = function () { G.mode = 'menu'; G.fn.releasePointer(); UI.mainMenu(); };
G.fn.onDeath = function (cause) { if (G.mode !== 'play') return; G.mode = 'dead'; G.fn.releasePointer(); UI.flash('#600', 2); setTimeout(() => UI.death(cause), 900); };

function devStart(q) {
  const skills = {}; for (const s of SKILLS) skills[s.id] = 30;
  G.fn.newGame({ name: 'Tester', seed: +q.get('dev') || 1, abil: { wel: 6, pow: 6, int: 5, wil: 5, gui: 4 }, skills }).then(() => {
    const P = G.player; P.gold = 500;
    if (q.has('h')) G.time = +q.get('h') * 3600;
    window.G = G; window.dev = { enterLevel, leaveLevel, interact, I, Q, UI, Monster, travel: (t) => G.fn.fastTravel(G.world.locs.find((l) => l.type === t), true) };
  });
}

// ---------- spaces ----------
function populateBuilding(lv) {
  const L = lv.loc, b = lv.b, cs = citizensOf(L, b), hour = hourOf(), used = new Set(), W = G.world;
  const take = (role) => cs.find((c) => !used.has(c) && c.role === role);
  for (const s of lv.spots) {
    let c = null;
    if (s.role === 'keeper') c = cs[0]; else if (s.role === 'member') c = take('adventurer'); else if (s.role === 'patron') continue; else c = take(s.role);
    if (!c || used.has(c)) continue; used.add(c);
    G.ents.push(new NPC(c, s.x, s.z, { room: s.room, range: ['keeper', 'guard', 'king', 'queen'].includes(s.role) ? 0 : 3 }));
  }
  for (const c of cs) {
    if (used.has(c) || whereabouts(c, hour) !== 'home') continue;
    const rooms = lv.rooms.filter((r) => r.use !== 'corridor'), room = hour < 6 || hour > 21.5 ? rooms.find((r) => r.use === 'bedroom') || rooms[0] : rooms[(c.seed >> 2) % rooms.length];
    const p = lv.randomFloor(rnd, room) || lv.randomFloor(rnd); if (!p) continue;
    G.ents.push(new NPC(c, lv.cx(p[0]), lv.cx(p[1]), { room, range: 3 }));
  }
  if (b.type === 'inn') { // evening patrons drawn from the townsfolk
    const lay = getLayout(W, L), spots = lv.spots.filter((s) => s.role === 'patron'), r = new RNG(hash2(L.id, b.i, dayOf()));
    for (let i = 0, n = 0; i < 60 && n < spots.length; i++) { const bb = r.pick(lay.buildings), c = r.pick(citizensOf(L, bb)); if (bb !== b && !used.has(c) && whereabouts(c, hour) === 'inn') { used.add(c); const s = spots[n++]; G.ents.push(new NPC(c, s.x, s.z, { room: s.room, range: 0 })); } }
  }
}
function enterLevel(lv, fromOutside) {
  const P = G.player;
  clearEnts();
  if (G.space) { scene.remove(G.space.group); G.space.dispose(); }
  else if (fromOutside) G.outPos = { x: P.pos.x, y: P.pos.y, z: P.pos.z };
  G.space = lv; G.phys = lv; G.terrain.group.visible = false; setSkyVisible(false); scene.add(lv.group);
  P.pos.set(lv.spawn.x, 0, lv.spawn.z); P.yaw = lv.spawn.yaw; P.pitch = 0; P.vy = 0; P.grounded = true;
  if (lv.kind === 'building') populateBuilding(lv);
  else for (const m of lv.mobs) G.ents.push(new Monster(m.id, m.x, m.z, { idx: m.idx, tier: lv.loc.tier, mult: (0.75 + lv.loc.tier * 0.25) * (m.boss ? 1.15 : 1) }));
  sfx('door'); UI.banner(lv.name);
}
function leaveLevel() {
  const P = G.player, lv = G.space; if (!lv) return;
  clearEnts(); scene.remove(lv.group); lv.dispose();
  G.space = null; G.phys = G.terrain; G.terrain.group.visible = true; setSkyVisible(true); G.popInit = false;
  const b = lv.b || getLayout(G.world, lv.loc).buildings[0], d = b.door;
  P.pos.set(d.x + d.nx * 1.3, 0, d.z + d.nz * 1.3); P.yaw = Math.atan2(-d.nx, -d.nz); P.pitch = 0; G.outPos = null;
  G.terrain.loadAround(P.pos.x, P.pos.z); P.pos.y = G.terrain.groundAt(P.pos.x, P.pos.z); P.grounded = true; P.vy = 0;
  updateSky(1, scene, camera, true); sfx('door');
}
function enterBuilding(t) {
  if (t.b.type === 'dungeon') { discover(t.loc); enterLevel(genDungeon(G.world, t.loc, 0), true); G.fn.msg('You enter ' + t.loc.name + '. ' + ['It seems quiet enough.', 'You sense some danger here.', 'This place is dangerous.', 'Death waits within for the unprepared.', 'Every instinct tells you to turn back.'][t.loc.tier - 1]); }
  else enterLevel(genBuilding(G.world, t.loc, t.b), true);
  saveGame('auto', true);
}
G.fn.onKill = function (m) {
  Q.onKill(m);
  const lv = G.space;
  if (lv && lv.kind === 'dungeon' && m.idx !== undefined) { const S = G.save, rec = S.cleared[lv.loc.id] || (S.cleared[lv.loc.id] = { day: dayOf(), k: {} }); (rec.k[lv.floor] || (rec.k[lv.floor] = [])).push(m.idx); if (m.def.boss) { G.fn.banner(m.name + ' is slain!'); } }
  if (m.camp && !G.ents.some((e) => e !== m && e.camp === m.camp && !e.dead)) { G.save.poi[m.camp] = dayOf(); G.fn.msg('The camp is cleared.', 'good'); }
};

// ---------- interaction ----------
const fwdV = new THREE.Vector3();
function lookTarget(reach = 3.4) {
  const P = G.player, list = []; G.phys.interactables(P.pos.x, P.pos.z, list);
  for (const e of G.ents) if (e.kind === 'npc') list.push(e); for (const b of G.bags) list.push(b);
  camera.getWorldDirection(fwdV); let best = null, bs = -1;
  for (const o of list) {
    const oy = o.kind === 'npc' ? o.y + o.h * 0.6 : o.y;
    const dx = o.x - camera.position.x, dy = oy - camera.position.y, dz = o.z - camera.position.z, d = Math.hypot(dx, dy, dz);
    if (d > reach + (o.kind === 'door' ? 0.6 : 0)) continue;
    const dot = (dx * fwdV.x + dy * fwdV.y + dz * fwdV.z) / (d || 1);
    if (dot < (d < 1.5 ? 0.45 : o.kind === 'forage' || o.kind === 'loot' ? 0.8 : 0.87)) continue;
    const sc = dot - d * 0.03; if (sc > bs) { bs = sc; best = o; }
  }
  return best;
}
G.fn.lookTarget = lookTarget;
function chunkOfObj(o) { return G.terrain.chunkAt(o.x, o.z); }
function openChest(t) {
  const S = G.save, P = G.player; let rec = S.containers[t.id];
  if (rec && t.respawn && dayOf() - rec.day >= t.respawn) rec = null;
  if (!rec) { const loot = I.chestLoot(new RNG(hash2(dayOf(), 7, hash2(t.id.length, t.tier, t.x * 13 + t.z * 7))), t.tier, 1 + P.perk('chestGold')); rec = S.containers[t.id] = { day: dayOf(), items: loot.items, gold: loot.gold, unlocked: !t.lock }; }
  const show = () => {
    rec.unlocked = true; sfx('door');
    if (G.space && t.prop) { t.prop[0] = 'chestOpen'; G.space.rebuildProps(); } else if (!G.space) { const c = chunkOfObj(t); if (c) G.terrain.setProp(c, t.x, t.z, 'chest', 'chestOpen'); }
    UI.loot('Chest', rec);
  };
  if (!rec.unlocked) UI.lockpick(t.lock, show); else show();
}
function interact() {
  const t = lookTarget(), P = G.player, S = G.save; if (!t) return;
  switch (t.kind) {
    case 'npc': sfx('pick'); UI.talk(t); break;
    case 'loot': UI.loot(t.from === 'arrow' ? 'Arrow' : t.from, t.loot, () => { if (!t.loot.items.length && !t.loot.gold && G.bags.includes(t)) removeBag(t); }); break;
    case 'door': {
      const h2 = hourOf(), home = t.b.type === 'house' || t.b.type === 'farmhouse';
      if (home && (h2 >= 22 || h2 < 6)) { const lock = 1 + (hash2(t.loc.id, t.b.i, 5) % 3); G.fn.msg('The door is locked for the night.'); UI.lockpick(lock, () => enterBuilding(t)); } else enterBuilding(t);
      break; }
    case 'exit': if (G.space.kind === 'dungeon') G.fn.msg('You return to the open air.'); leaveLevel(); saveGame('auto', true); break;
    case 'stairs': enterLevel(genDungeon(G.world, G.space.loc, G.space.floor + t.dir), false); if (t.dir < 0) { const lv = G.space, f = lv.farthest; P.pos.set(lv.cx(f[0]), 0, lv.cx(f[1]) + 1.2); [P.pos.x, P.pos.z] = lv.collide(P.pos.x, P.pos.z, 0.4); } break;
    case 'forage': {
      let n = 1; if (P.perk('forageDouble')) n = 2; if (rnd.chance(P.perk('forageExtra'))) n++; if (rnd.chance((P.S('foraging') - 20) / 160)) n++;
      const it = I.mkIng(t.ing, n); P.addItem(it); P.gainXP('foraging', 5); S.harvested[t.id] = dayOf(); G.fn.msg('You gather ' + n + ' ' + it.name + '.'); sfx('pick');
      if (rnd.chance(P.perk('forageRare'))) { const r = I.mkIng(rnd.pick(['moonpetal', 'skyblossom', 'sunthorn', 'frostcap', 'leechwort']), 1); P.addItem(r); G.fn.msg('Your trained eye also spots some ' + r.name + '.', 'good'); }
      const c = chunkOfObj(t); if (c) G.terrain.refreshFlora(c); break; }
    case 'ore': {
      if (!P.has((i) => i.id === 'pickaxe')) return G.fn.msg('You need a pickaxe to mine this vein.', 'bad');
      if (S.harvested[t.id] !== undefined && dayOf() - S.harvested[t.id] < 5) return G.fn.msg('This vein is spent for now.');
      const n = 1 + (rnd.chance(0.3 + P.S('foraging') / 200) ? 1 : 0) + (P.perk('forageDouble') ? 1 : 0), it = I.mkOre(t.tier, n); P.addItem(it); S.harvested[t.id] = dayOf(); P.gainXP('foraging', 6 + t.tier * 2); P.st = Math.max(0, P.st - 12); sfx('forge'); G.fn.msg('You mine ' + n + ' ' + it.name + '.'); if (rnd.chance(0.06)) { P.addItem(I.mkMisc('gem', 1)); G.fn.msg('A gemstone glints in the rubble!', 'good'); } break; }
    case 'shrine': {
      if (S.poi['s' + t.poi.id] === dayOf()) return G.fn.msg('The shrine is silent. Return another day.');
      S.poi['s' + t.poi.id] = dayOf(); const fx2 = ['regen', 'swift', 'stone', 'feather'][t.poi.seed % 4], E = EFFECTS[fx2];
      P.addBuff(fx2, E.base * 1.2, 600, 'Blessing: ' + E.name); P.hp = Math.min(P.maxHp(), P.hp + P.maxHp() * 0.35); P.poison = 0; UI.flash('#cdf', 0.6); sfx('heal'); G.fn.msg('A calm warmth settles over you. (' + E.name + ', 10 minutes)', 'good'); break; }
    case 'stones': {
      if (S.lore[t.poi.id]) return G.fn.msg('The stones have told you all they know.');
      S.lore[t.poi.id] = 1; const sk = SKILLS[t.poi.seed % SKILLS.length]; UI.flash('#8df', 0.6); sfx('level'); G.fn.msg('Ancient knowledge of ' + sk.name + ' floods your mind.', 'perk'); P.gainXP(sk.id, 70 + P.skills[sk.id].lvl); break; }
    case 'chest': openChest(t); break;
    case 'ldoor': UI.lockpick(t.lock, () => { G.space.openDoor(t); sfx('door'); }); break;
    case 'relic': { const q = S.quests.find((x) => x.id === t.quest); if (q) { q.have = true; const it = I.mkMisc('relic'); it.name = q.item; it.quest = q.id; P.addItem(it); G.fn.msg('You take the ' + q.item + '. Return it to ' + q.giver.name + '.', 'quest'); sfx('quest'); } t.gone = true; t.prop[0] = 'pedestalEmpty'; G.space.rebuildProps(); break; }
    case 'bed': {
      const lv = G.space, key = lv.loc.id + ':' + lv.b.i;
      if (lv.b.type === 'inn') { if (t.guest && S.room && S.room.key === key && S.room.until > G.time) UI.rest(true); else G.fn.msg(t.guest ? 'Rent a room from the innkeeper first.' : 'This bed belongs to someone else.'); }
      else G.fn.msg('This bed belongs to someone else.'); break; }
    case 'forge': UI.forge(); break;
    case 'alchemy': UI.alchemy(); break;
    case 'board': UI.openQuestBoard({ c: citizensOf(G.space.loc, G.space.b)[0] }, G.space.loc, false); break;
  }
}
G.fn.interact = interact;
G.fn.spellOpen = function (power) {
  const t = lookTarget(5);
  if (!t || !t.lock || (t.kind === 'chest' && (G.save.containers[t.id] || {}).unlocked)) { G.fn.msg('There is no lock before you.'); return false; }
  if (t.lock > Math.max(1, power)) { G.fn.msg('This lock is beyond your skill in Alteration.', 'bad'); return false; }
  if (t.kind === 'ldoor') { G.space.openDoor(t); sfx('door'); } else { const lk = t.lock; t.lock = 0; openChest(t); t.lock = lk; (G.save.containers[t.id] || {}).unlocked = true; }
  G.fn.msg('The lock springs open.', 'good'); return true;
};
G.fn.dropItem = function (it, n) {
  const P = G.player, one = Object.assign({}, it, it.stack ? { qty: n } : {}); P.removeItem(it, n);
  const a = P.yaw, x = P.pos.x - Math.sin(a) * 1, z = P.pos.z - Math.cos(a) * 1;
  const near = G.bags.find((b) => b.from === 'your pack' && Math.hypot(b.x - x, b.z - z) < 1.5);
  if (near) near.loot.items.push(one); else spawnLoot(x, z, { items: [one], gold: 0 }, 'your pack');
};

// ---------- rest & travel ----------
G.fn.rest = function (hours, bed) {
  const P = G.player, wild = !G.space && !G.world.locAt(P.pos.x, P.pos.z, 30), dungeon = G.space && G.space.kind === 'dungeon', town = !G.space && !wild, house = G.space && G.space.kind === 'building';
  let slept = 0, ambush = false;
  for (let i = 0; i < hours; i++) {
    G.time += 3600; slept++;
    if (bed) { P.hp = Math.min(P.maxHp(), P.hp + P.maxHp() * 0.2); P.mp = P.maxMp(); }
    else if (wild || dungeon) { P.hp = Math.min(P.maxHp(), P.hp + P.maxHp() * (0.05 + P.A('wel') * 0.005)); P.mp = Math.min(P.maxMp(), P.mp + P.maxMp() * 0.2); if (rnd.chance(dungeon ? 0.1 : isNight() ? 0.09 : 0.05)) { ambush = true; break; } }
    else if (house) P.mp = Math.min(P.maxMp(), P.mp + P.maxMp() * 0.1);
    P.st = P.maxSt();
  }
  P.buffs = []; P.poison = bed ? 0 : Math.max(0, P.poison - slept * 4); P.clampVitals();
  if (bed && slept >= 6) { P.hp = P.maxHp(); P.restedUntil = G.time + 86400; G.fn.msg('You wake refreshed. You are Well Rested.', 'good'); }
  UI.flash('#000', 1.2);
  if (ambush) {
    G.fn.msg('You are woken by something moving nearby!', 'bad'); sfx('growl');
    if (dungeon) { const m = G.ents.filter((e) => e.hostile && !e.dead).sort((a, b) => Math.hypot(a.x - P.pos.x, a.z - P.pos.z) - Math.hypot(b.x - P.pos.x, b.z - P.pos.z))[0]; if (m) m.alert = true; }
    else { const B = G.world.biomeAt(P.pos.x, P.pos.z), tb = (isNight() ? BIOMES_[B].night : BIOMES_[B].wild).filter((m) => MON[m[0]].lvl <= P.level * 1.3 + 2.5); if (tb.length) { const id = rnd.weighted(tb), a = rnd.range(0, 6.28); for (let i = 0; i < rnd.int(1, 2); i++) { const m = new Monster(id, P.pos.x + Math.cos(a + i) * 14, P.pos.z + Math.sin(a + i) * 14, { wild: true }); m.alert = true; G.ents.push(m); } } }
  } else G.fn.msg(slept + (slept > 1 ? ' hours pass.' : ' hour passes.'));
  if (!ambush) saveGame('auto', true);
  G.fn.grabPointer();
};
import { BIOMES as BIOMES_, MONSTERS as MON } from './data.js';
G.fn.fastTravel = function (L, force) {
  const P = G.player;
  if (!L) return;
  if (!force) {
    if (G.space) return G.fn.msg('You cannot travel from indoors.', 'bad');
    if (G.ents.some((e) => e.hostile && !e.dead && e.alert)) return G.fn.msg('You cannot travel with enemies about.', 'bad');
    if (P.carried() > P.carryMax()) return G.fn.msg('You are carrying too much to travel.', 'bad');
  }
  if (G.space) { scene.remove(G.space.group); G.space.dispose(); G.space = null; G.phys = G.terrain; G.terrain.group.visible = true; setSkyVisible(true); }
  const d = Math.hypot(L.x - P.pos.x, L.z - P.pos.z);
  UI.close(true); clearEnts(); G.popInit = false;
  G.time += d / 1.39; P.buffs = [];
  const lay = getLayout(G.world, L);
  let x = L.x + 5, z = L.z + 6;
  if (L.type === 'castle') { x = L.x; z = L.z + lay.half + 14; } else if (!L.civ) { const dr = lay.buildings[0].door; x = dr.x + dr.nx * 9; z = dr.z + dr.nz * 9; }
  P.pos.set(x, 0, z); P.yaw = L.type === 'castle' ? 0 : !L.civ ? Math.atan2(lay.buildings[0].door.nx, lay.buildings[0].door.nz) : 0.6;
  G.terrain.loadAround(x, z); [P.pos.x, P.pos.z] = G.terrain.collide(x, z, 0.5); P.pos.y = G.terrain.groundAt(P.pos.x, P.pos.z); P.grounded = true; P.vy = 0;
  P.st = P.maxSt(); P.hp = Math.min(P.maxHp(), P.hp + P.maxHp() * 0.1 * d / 5000);
  updateSky(1, scene, camera, true); UI.flash('#000', 1); UI.banner(L.name);
  G.fn.msg('You travel to ' + L.name + '. ' + (d / 1.39 / 3600 < 1 ? Math.round(d / 1.39 / 60) + ' minutes' : (d / 1.39 / 3600).toFixed(1) + ' hours') + ' pass on the road.');
  G.fn.grabPointer(); saveGame('auto', true);
};
function discover(L) {
  const S = G.save; if (S.discovered[L.id]) return;
  S.discovered[L.id] = 1; delete S.known[L.id];
  UI.banner(L.name); G.fn.msg('Discovered: ' + L.name + ' (' + LOC_TYPES[L.type].name + ')', 'quest'); sfx('quest');
}
function worldTick() { // twice a second: discovery, exploration fog
  const P = G.player, W = G.world, S = G.save; if (G.space) return;
  const L = W.locAt(P.pos.x, P.pos.z, 35); if (L) discover(L);
  const cx = Math.floor((P.pos.x + HALF) / 250), cz = Math.floor((P.pos.z + HALF) / 250);
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const x = cx + i, z = cz + j; if (x >= 0 && z >= 0 && x < 192 && z < 192 && i * i + j * j < 6) S.explored[z * 192 + x] = 1; }
  if (Math.abs(P.pos.x) > HALF - 160 || Math.abs(P.pos.z) > HALF - 160) { if (!worldTick.warned) G.fn.msg('Beyond here the maps show nothing. You can go no further.'); worldTick.warned = true; } else worldTick.warned = false;
}

// ---------- save / load ----------
function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); }
function unb64(s) { const b = atob(s), u = new Uint8Array(192 * 192); for (let i = 0; i < b.length && i < u.length; i++) u[i] = b.charCodeAt(i); return u; }
function saveGame(slot, quiet) {
  if (G.mode !== 'play' || G.player.hp <= 0) return;
  const P = G.player, S = Object.assign({}, G.save, { explored: b64(G.save.explored) });
  const sp = G.space ? { kind: G.space.kind, loc: G.space.loc.id, b: G.space.b ? G.space.b.i : -1, floor: G.space.floor || 0 } : null;
  const data = { v: 1, time: G.time, player: P.toJSON(), save: S, space: sp, outPos: G.outPos };
  try {
    localStorage.setItem(SAVE_KEY + slot, JSON.stringify(data));
    const meta = JSON.parse(localStorage.getItem(META_KEY) || '{}');
    const L = G.space ? G.space.loc : G.world.locAt(P.pos.x, P.pos.z, 60);
    meta[slot] = { slot, name: P.name, level: P.level, where: L ? L.name : 'the wilds', day: dayOf() + 1, at: Date.now() };
    localStorage.setItem(META_KEY, JSON.stringify(meta));
    if (!quiet) { G.fn.msg('Game saved.', 'good'); sfx('pick'); }
  } catch (e) { G.fn.msg('Could not save: ' + e.message, 'bad'); }
}
G.fn.saveGame = saveGame;
G.fn.listSaves = () => Object.values(JSON.parse(localStorage.getItem(META_KEY) || '{}')).filter((m) => localStorage.getItem(SAVE_KEY + m.slot)).sort((a, b) => b.at - a.at);
G.fn.deleteSave = (slot) => { localStorage.removeItem(SAVE_KEY + slot); const m = JSON.parse(localStorage.getItem(META_KEY) || '{}'); delete m[slot]; localStorage.setItem(META_KEY, JSON.stringify(m)); };
async function loadGame(slot) {
  const raw = localStorage.getItem(SAVE_KEY + slot); if (!raw) return;
  G.loading = true; G.mode = 'menu'; $('menu').classList.add('hidden');
  await setLoading('Restoring your journey...');
  const d = JSON.parse(raw);
  G.save = Object.assign(freshSave(d.save.seed), d.save, { explored: unb64(d.save.explored) }); G.time = d.time;
  buildWorld(G.save.seed);
  const P = G.player = Player.fromJSON(d.player);
  if (d.space) {
    const L = G.world.locs[d.space.loc], lay = getLayout(G.world, L), pos = P.pos.clone(), yaw = P.yaw;
    G.outPos = d.outPos; const o = d.outPos || { x: L.x, z: L.z };
    G.terrain.loadAround(o.x, o.z);
    G.mode = 'play';
    enterLevel(d.space.kind === 'building' ? genBuilding(G.world, L, lay.buildings[d.space.b]) : genDungeon(G.world, L, d.space.floor), false);
    P.pos.copy(pos); P.yaw = yaw; if (G.space.solidAt(P.pos.x, P.pos.z)) P.pos.set(G.space.spawn.x, 0, G.space.spawn.z);
  } else { G.terrain.loadAround(P.pos.x, P.pos.z); P.pos.y = Math.max(P.pos.y, G.terrain.groundAt(P.pos.x, P.pos.z)); }
  beginPlay(); G.fn.msg('Game loaded.', 'good');
}
G.fn.loadGame = loadGame;

// ---------- first-person hands ----------
function drawHands(dt) {
  const P = G.player, w = fx.width, hh = fx.height; fxg.clearRect(0, 0, w, hh); fxg.imageSmoothingEnabled = false;
  if (G.mode !== 'play') return;
  const s = hh / 150, bobX = Math.sin(P.bob * 0.5) * 3 * s, bobY = Math.abs(Math.cos(P.bob * 0.5)) * 3 * s;
  const rh = P.equip.rhand, lh = P.equip.lhand, sw = P.swing;
  const draw = (cv, x, y, rot, size, flip) => { fxg.save(); fxg.translate(Math.round(x), Math.round(y)); fxg.rotate(rot); if (flip) fxg.scale(-1, 1); fxg.drawImage(cv, -size * 0.25, -size * 0.75, size, size); fxg.restore(); };
  const size = 64 * s;
  // right hand
  let t = sw && sw.hand === 'rhand' ? sw.t / sw.dur : 0;
  if (rh && rh.type === 'weapon') {
    if (rh.bow) { const need = 1 / (rh.speed * (1 + P.perk('bowSpeed'))), f = clamp(P.draw / need, 0, 1); draw(weaponCanvas(rh.icon, rh.col), w * 0.56 + bobX - f * 6 * s, hh * 1.02 + bobY - f * 10 * s, -0.5, size * 1.2, false); if (f > 0) { fxg.fillStyle = f >= 1 ? '#f0d890' : '#a89870'; fxg.fillRect(Math.round(w / 2 - 12 * s), Math.round(hh / 2 + 10 * s), Math.round(24 * s * f), Math.max(1, Math.round(s))); } }
    else { const a = t ? Math.sin(t * Math.PI) : 0; draw(weaponCanvas(rh.icon, rh.col), w * 0.8 + bobX - a * w * 0.3, hh * 1.04 + bobY - a * hh * 0.12 + (t > 0.5 ? (t - 0.5) * hh * 0.2 : 0), 0.25 - t * 2.2, size, true); }
  } else if (!rh) { const a = t ? Math.sin(t * Math.PI) : 0; fxg.fillStyle = P.look.skin; const fw = 14 * s, x = w * 0.72 + bobX - a * w * 0.18, y = hh - 16 * s + bobY - a * hh * 0.22; fxg.fillRect(Math.round(x), Math.round(y), Math.round(fw), Math.round(40 * s)); fxg.fillStyle = 'rgba(0,0,0,.25)'; fxg.fillRect(Math.round(x + fw * 0.7), Math.round(y), Math.round(fw * 0.3), Math.round(40 * s)); }
  // left hand
  if (lh && lh !== rh) {
    t = sw && sw.hand === 'lhand' ? sw.t / sw.dur : 0; const a = t ? Math.sin(t * Math.PI) : 0;
    if (lh.type === 'shield') draw(weaponCanvas('shield', lh.col), w * (P.blocking ? 0.36 : 0.16) + bobX, hh * (P.blocking ? 1.0 : 1.2) + bobY, P.blocking ? 0.1 : -0.15, size * 1.1, false);
    else if (lh.type === 'torch') draw(weaponCanvas('torch', lh.col), w * 0.14 + bobX, hh * 1.06 + bobY + Math.sin(performance.now() * 0.01) * s, -0.25, size, false);
    else draw(weaponCanvas(lh.icon, lh.col), w * 0.2 + bobX + a * w * 0.3, hh * 1.04 + bobY - a * hh * 0.12, -0.25 + t * 2.2, size, false);
  }
  if (sw && sw.hand === 'cast') { const k = 1 - sw.t / sw.dur; fxg.globalAlpha = k * 0.8; fxg.fillStyle = sw.col; const r = (10 + (1 - k) * 26) * s; fxg.beginPath(); fxg.arc(w * 0.5, hh * 0.86, r, 0, 6.3); fxg.fill(); fxg.globalAlpha = 1; }
}

// ---------- main loop ----------
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
  if (G.mode !== 'play' && G.mode !== 'dead') return;
  const P = G.player, paused = !!UI.open || G.mode === 'dead';
  if (!paused) {
    G.time += dt * TIME_SCALE;
    readInput(); P.update(dt, input);
    if (G.mode === 'play') updateEntities(dt);
    tickT -= dt; if (tickT <= 0) { tickT = 0.5; worldTick(); }
  }
  const eye = (P.sneak ? 1.15 : EYE) + Math.sin(P.bob) * 0.035 - (P.hurtT > 0 ? P.hurtT * 0.15 : 0);
  let cy = P.pos.y + eye; if (!G.space) cy = Math.max(cy, G.terrain.groundAt(P.pos.x, P.pos.z) + 0.3);
  camera.position.set(P.pos.x, cy, P.pos.z); camera.rotation.set(P.pitch, P.yaw, P.hurtT > 0 ? P.hurtT * 0.1 : 0);
  if (G.space) interiorFog(scene, G.space);
  else { G.terrain.update(P.pos.x, P.pos.z, 4, isNight()); updateSky(dt, scene, camera, false); }
  target = paused ? null : lookTarget();
  UI.hud(dt, target);
  drawHands(dt);
  renderer.render(scene, camera);
}
boot();
