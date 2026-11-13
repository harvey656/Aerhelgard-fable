// Menus and task windows: main menu, character creation, saving, crafting, lock-picking, resting.
import { ABILITIES, SKILLS, ABIL_START, ABIL_POINTS, ABIL_CREATE_MAX, SKILL_START, SKILL_POINTS, SKILL_CREATE_MAX, PERK_STEP, WEAPONS, SHIELDS, ARMOR_SLOTS, METALS, HIDES, SMITH_REQ, INGREDIENTS, EFFECTS, ORES, PATTERNS, TREATISES } from './data.js';
import { G, dayOf, hourOf } from './state.js';
import { UI, h, $ } from './ui.js';
import { Pix } from './art.js';
import { humanSheet, sheetFrameCanvas, itemIcon } from './sprites.js';
import { RNG, rnd, clamp, strSeed } from './rng.js';
import * as I from './items.js';
import { personName } from './names.js';

const SKINS = ['#f4d4b4', '#f0c8a0', '#e0b088', '#c89068', '#a87048', '#7a5030', '#5a3a22'];
const HAIRS = ['#1a1a1a', '#2a1a10', '#4a3018', '#6a4a20', '#a87830', '#d8b858', '#8a3a18', '#b0b0b0', '#e8e8e8'];
const TUNICS = ['#3a4a6a', '#6a2a2a', '#3a5a38', '#5a4a30', '#5a3a6a', '#2a5a5a', '#8a7a48', '#3a3a3a', '#8a4a20'];
const HAIRSTYLES = ['Bald', 'Short', 'Long', 'Tail', 'Shoulder', 'Cropped'];

function titleArt() {
  const w = 320, hh = 180, p = new Pix(w, hh), r = new RNG(7);
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const t = Math.floor(y / hh * 12) / 12; p.set(x, y, [20 + t * 150, 14 + t * 60, 50 + t * 30]); }
  for (let i = 0; i < 90; i++) p.set(r.int(0, w), r.int(0, 80), [255, 240, 220]);
  p.ell(236, 62, 15, 15, [255, 226, 170]); p.ell(236, 62, 12, 12, [255, 244, 210]);
  const ridge = (base, amp, col, seed, f) => { for (let x = 0; x < w; x++) { const y = base + Math.sin(x * f + seed) * amp + Math.sin(x * f * 2.7 + seed * 3) * amp * 0.45 + Math.sin(x * f * 7.1 + seed) * amp * 0.15; for (let yy = Math.floor(y); yy < hh; yy++) p.set(x, yy, col); } };
  ridge(104, 26, [70, 40, 70], 1.3, 0.024); ridge(124, 16, [46, 28, 52], 4.1, 0.04); ridge(144, 9, [26, 18, 34], 2.2, 0.07);
  // a castle silhouette
  const C = [16, 12, 22]; p.rect(60, 104, 44, 40, C); for (const x of [56, 78, 100]) { p.rect(x, 90 + (x === 78 ? -12 : 0), 9, 54, C); p.tri(x - 2, 90 + (x === 78 ? -12 : 0), x + 11, 90 + (x === 78 ? -12 : 0), x + 4, 78 + (x === 78 ? -12 : 0), C); }
  p.rect(81, 92, 2, 3, [255, 200, 90]); p.rect(70, 116, 2, 3, [255, 200, 90]); p.rect(92, 122, 2, 3, [255, 200, 90]);
  for (let x = 0; x < w; x += 3) { const hgt = r.int(4, 14); for (let k = 0; k < hgt; k++) p.rect(x - k / 3, 180 - 14 - hgt + k + 10, 1 + k * 0.6, 1, [12, 16, 14]); }
  const c = p.canvas(); c.className = 'title-art'; return c;
}

UI.mainMenu = function () {
  G.mode = 'menu'; UI.close(true); $('hud').classList.add('hidden');
  const m = $('menu'); m.innerHTML = ''; m.classList.remove('hidden');
  const saves = G.fn.listSaves();
  m.append(titleArt(), h('div', { class: 'mainmenu' }, h('h1', {}, 'Aerhelgard'), h('p', {}, 'A realm of kingdoms, rivers and open sea, born anew from every seed'),
    h('button', { onclick: () => UI.create() }, 'New Game'),
    h('button', { disabled: saves.length ? null : '', onclick: () => UI.saves('load', true) }, 'Load Game'),
    h('button', { onclick: () => UI.help(true) }, 'Controls'),
    h('div', { class: 'note', style: 'margin-top:18px' }, 'Click the view to capture the mouse · Esc opens the menu')));
};

// ----- character creation -----
UI.create = function () {
  const r0 = new RNG((Math.random() * 1e9) | 0);
  const st = { name: '', female: 0, skin: 2, hair: 2, hairStyle: 1, beard: 0, tunic: 0, abil: {}, skills: {}, seed: String(r0.int(100000, 999999)), size: 48 };
  for (const a of ABILITIES) st.abil[a.id] = ABIL_START; for (const s of SKILLS) st.skills[s.id] = SKILL_START;
  const look = () => ({ skin: SKINS[st.skin], hair: HAIRS[st.hair], hairStyle: st.hairStyle, bald: st.hairStyle === 0 ? 1 : 0, beard: st.female ? 0 : st.beard, shirt: TUNICS[st.tunic], pants: '#4a3a2a', female: st.female, skirt: 0, build: st.female ? 0.95 : 1.05 });
  const aLeft = () => ABIL_POINTS - ABILITIES.reduce((n, a) => n + st.abil[a.id] - ABIL_START, 0), sLeft = () => SKILL_POINTS - SKILLS.reduce((n, s) => n + st.skills[s.id] - SKILL_START, 0);
  const body = h('div', {});
  const pm = (get, dec, inc) => h('span', { class: 'pm' }, h('button', { onclick: (e) => { dec(e.shiftKey ? 5 : 1); draw(); } }, '-'), h('b', { style: 'font-weight:normal;min-width:28px;text-align:center;display:inline-block' }, String(get())), h('button', { onclick: (e) => { inc(e.shiftKey ? 5 : 1); draw(); } }, '+'));
  const sw = (list, key) => h('div', {}, list.map((c, i) => h('span', { class: 'swatch' + (st[key] === i ? ' on' : ''), style: 'background:' + c, onclick: () => { st[key] = i; draw(); } })));
  let nameEl, seedEl;
  const draw = () => {
    const keepName = nameEl ? nameEl.value : st.name, keepSeed = seedEl ? seedEl.value : st.seed; st.name = keepName; st.seed = keepSeed;
    body.innerHTML = '';
    const L = look(), sheet = humanSheet(L, 'new' + JSON.stringify(L));
    const places = (km) => Math.round(878 * (km / 48) ** 2), kings = (km) => Math.max(1, Math.round(4 * (km / 48) ** 2));
    const sizeLbl = h('b', { style: 'font-weight:normal;color:#6a1a10' }, `${st.size} km across - about ${places(st.size)} places, ${kings(st.size)} kingdom${kings(st.size) > 1 ? 's' : ''}`);
    const sizeEl = h('input', { type: 'range', min: 12, max: 72, step: 6, value: st.size, style: 'width:100%', oninput: (e) => { st.size = +e.target.value; sizeLbl.textContent = `${st.size} km across - about ${places(st.size)} places, ${kings(st.size)} kingdom${kings(st.size) > 1 ? 's' : ''}`; } });
    nameEl = h('input', { type: 'text', maxlength: 24, value: st.name, placeholder: 'Your name' }); seedEl = h('input', { type: 'text', maxlength: 12, value: st.seed, style: 'width:140px' });
    const id = h('div', { class: 'col parch', style: 'width:300px;padding:10px' },
      h('h3', {}, 'Identity'), h('div', { class: 'row' }, nameEl), h('button', { style: 'align-self:flex-start', onclick: () => { nameEl.value = personName(new RNG((Math.random() * 1e9) | 0), st.female); } }, 'Random name'),
      h('div', { class: 'row' }, h('div', { class: 'face', style: 'width:128px;height:192px;background:#3a4a5a' }, sheetFrameCanvas(sheet, 0, 4)), h('div', { class: 'col' }, h('button', { onclick: () => { st.female = st.female ? 0 : 1; draw(); } }, st.female ? 'Female' : 'Male'), h('button', { onclick: () => { st.hairStyle = (st.hairStyle + 1) % 6; draw(); } }, 'Hair: ' + HAIRSTYLES[st.hairStyle]), st.female ? null : h('button', { onclick: () => { st.beard = st.beard ? 0 : 1; draw(); } }, st.beard ? 'Bearded' : 'Shaven'))),
      'Skin', sw(SKINS, 'skin'), 'Hair', sw(HAIRS, 'hair'), 'Tunic', sw(TUNICS, 'tunic'),
      h('div', { class: 'row', style: 'margin-top:6px' }, 'World seed', seedEl),
      h('div', { style: 'margin-top:4px' }, 'World size: ', sizeLbl), sizeEl, h('div', { class: 'note', style: 'white-space:normal' }, 'The same seed and size always create the same world. Larger worlds take longer to cross and hold more kingdoms.'));
    const ab = h('div', { class: 'col parch', style: 'width:290px;padding:10px' }, h('h3', {}, 'Abilities'), h('div', {}, 'Points left: ' + aLeft()));
    for (const a of ABILITIES) { const row = h('div', { class: 'kv' }, a.name, pm(() => st.abil[a.id], (n) => { st.abil[a.id] = Math.max(ABIL_START, st.abil[a.id] - n); }, (n) => { st.abil[a.id] = Math.min(ABIL_CREATE_MAX, st.abil[a.id] + Math.min(n, aLeft())); })); UI.tip(row, () => `<h4>${a.name}</h4>${a.desc}`); ab.append(row); }
    ab.append(h('div', { class: 'note', style: 'margin-top:8px;white-space:normal' }, 'Health ' + (30 + st.abil.wel * 10 + 5) + ' · Mana ' + (10 + st.abil.int * 10 + st.abil.wil * 3) + ' · Stamina ' + (50 + st.abil.wel * 8 + st.abil.wil * 6) + ' · Carry ' + st.abil.pow * 25 + ' lb'),
      h('div', { class: 'note', style: 'white-space:normal;margin-top:8px' }, 'Your starting gear follows your best skills: the weapon you favor, armor light or heavy, a bow, picks, a spell tome...'),
      h('div', { style: 'flex:1' }),
      h('button', { onclick: () => { for (const a of ABILITIES) st.abil[a.id] = ABIL_START; for (const s of SKILLS) st.skills[s.id] = SKILL_START; const r = new RNG((Math.random() * 1e9) | 0); while (aLeft() > 0) { const a = r.pick(ABILITIES).id; if (st.abil[a] < ABIL_CREATE_MAX) st.abil[a]++; } const fav = r.shuffle(SKILLS.map((s) => s.id)).slice(0, 6); while (sLeft() > 0) { const s = r.pick(fav); if (st.skills[s] < SKILL_CREATE_MAX) st.skills[s] += Math.min(5, sLeft()); } draw(); } }, 'Randomize stats'),
      h('button', { style: 'font-size:26px;padding:6px', onclick: () => { if (aLeft() > 0 || sLeft() > 0) { if (!body.dataset.warn) { body.dataset.warn = 1; G.fn.sfx('deny'); warn.textContent = 'You still have points to spend. Click again to begin anyway.'; return; } } const name = nameEl.value.trim() || personName(new RNG((Math.random() * 1e9) | 0), st.female); G.fn.newGame({ name, look: look(), abil: st.abil, skills: st.skills, size: st.size, seed: /^\d+$/.test(seedEl.value) ? +seedEl.value : strSeed(seedEl.value || 'aerhelgard') }); } }, 'Begin your journey'));
    const warn = h('div', { class: 'note', style: 'color:#a00' }); ab.append(warn);
    const sk = h('div', { class: 'col parch', style: 'flex:1;padding:10px;min-width:330px' }, h('h3', {}, 'Skills'), h('div', {}, 'Points left: ' + sLeft() + '   (Shift-click: 5)'));
    const list = h('div', { class: 'list' });
    for (const s of SKILLS) { const row = h('div', { class: 'kv', style: 'padding:1px 0' }, h('span', {}, s.name, st.skills[s.id] >= PERK_STEP ? h('span', { style: 'color:#6a1a10' }, ' ' + '✦'.repeat(Math.floor(st.skills[s.id] / PERK_STEP))) : null), pm(() => st.skills[s.id], (n) => { st.skills[s.id] = Math.max(SKILL_START, st.skills[s.id] - n); }, (n) => { st.skills[s.id] = Math.min(SKILL_CREATE_MAX, st.skills[s.id] + Math.min(n, sLeft())); })); UI.tip(row, () => `<h4>${s.name}</h4>${s.desc}<div class="cmp">` + s.perks.map((p, i) => `${(i + 1) * PERK_STEP}: <span style="color:#f0d890">${p[0]}</span> - ${p[1]}`).join('<br>') + '</div>'); list.append(row); }
    sk.append(list, h('div', { class: 'note' }, 'Each skill starts at ' + SKILL_START + ' and grows as you use it. A perk (✦) unlocks every ' + PERK_STEP + ' levels.'));
    body.append(id, ab, sk);
  };
  draw();
  UI.window('Create your character', body, { name: 'create', cls: 'create', root: 'menu', onClose: () => { if (G.mode === 'menu') UI.mainMenu(); } });
  $('menu').prepend(titleArt());
};

// ----- pause / saves / help / death -----
UI.pause = function () {
  const body = h('div', {}, h('div', { class: 'col', style: 'width:300px' },
    h('button', { onclick: () => UI.close() }, 'Resume'), h('button', { onclick: () => UI.saves('save') }, 'Save Game'), h('button', { onclick: () => UI.saves('load') }, 'Load Game'), h('button', { onclick: () => UI.options() }, 'Options'), h('button', { onclick: () => UI.help() }, 'Controls'),
    h('button', { onclick: () => { UI.close(true); G.fn.quitToMenu(); } }, 'Quit to Main Menu'), h('div', { class: 'note' }, 'F5 quick-saves, F9 quick-loads.')));
  UI.window('Aerhelgard', body, { name: 'pause' });
};
UI.options = function () {
  const o = G.opts, body = h('div', {});
  const draw = () => { body.innerHTML = ''; body.append(h('div', { class: 'col', style: 'width:420px' },
    h('div', { class: 'kv' }, 'Pixel size (retro look)', h('span', { class: 'pm' }, h('button', { onclick: () => { o.pixel = Math.max(1, o.pixel - 1); G.fn.resize(); draw(); } }, '-'), String(o.pixel), h('button', { onclick: () => { o.pixel = Math.min(6, o.pixel + 1); G.fn.resize(); draw(); } }, '+'))),
    h('div', { class: 'kv' }, 'Shadows', h('button', { style: 'min-width:150px', onclick: () => { o.shadows = (o.shadows + 1) % 3; draw(); } }, ['Off', 'On', 'High (longer range)'][o.shadows])),
    h('div', { class: 'kv' }, 'Flowing clouds', h('button', { style: 'min-width:150px', onclick: () => { o.clouds = !o.clouds; draw(); } }, o.clouds ? 'On' : 'Off')),
    h('div', { class: 'kv' }, 'View distance', h('button', { style: 'min-width:150px', onclick: () => { const v = [5, 7, 10, 13]; o.view = v[(v.indexOf(o.view) + 1) % v.length]; G.fn.applyGfx(); draw(); } }, { 5: 'Near', 7: 'Normal', 10: 'Far', 13: 'Very far' }[o.view] || 'Normal')),
    h('div', { class: 'note', style: 'white-space:normal' }, 'Shadows and long view distances cost the most performance.'),
    h('div', { class: 'kv' }, 'Mouse sensitivity', h('span', { class: 'pm' }, h('button', { onclick: () => { o.sens = Math.max(0.2, +(o.sens - 0.1).toFixed(1)); draw(); } }, '-'), o.sens.toFixed(1), h('button', { onclick: () => { o.sens = Math.min(3, +(o.sens + 0.1).toFixed(1)); draw(); } }, '+'))),
    h('div', { class: 'kv' }, 'Sound volume', h('span', { class: 'pm' }, h('button', { onclick: () => { o.vol = Math.max(0, +(o.vol - 0.1).toFixed(1)); draw(); } }, '-'), Math.round(o.vol * 100) + '%', h('button', { onclick: () => { o.vol = Math.min(1, +(o.vol + 0.1).toFixed(1)); G.fn.sfx('coin'); draw(); } }, '+'))),
    h('div', { class: 'kv' }, 'Invert mouse Y', h('button', { onclick: () => { o.invert = !o.invert; draw(); } }, o.invert ? 'Yes' : 'No')),
    h('button', { onclick: () => { G.fn.saveOpts(); UI.pause(); } }, 'Back'))); };
  draw(); UI.window('Options', body, { name: 'options', onClose: () => G.fn.saveOpts() });
};
UI.saves = function (mode, fromMenu) {
  const body = h('div', {}), col = h('div', { class: 'col', style: 'width:560px' });
  const slots = ['auto', 'quick', '1', '2', '3', '4', '5'], metas = Object.fromEntries(G.fn.listSaves().map((m) => [m.slot, m]));
  for (const s of slots) {
    const m = metas[s]; if (mode === 'save' && (s === 'auto' || s === 'quick')) continue; if (mode === 'load' && !m) continue;
    const label = (s === 'auto' ? 'Autosave' : s === 'quick' ? 'Quicksave' : 'Slot ' + s) + (m ? ` - ${m.name}, level ${m.level}, ${m.where}, day ${m.day}  (${new Date(m.at).toLocaleString()})` : ' - empty');
    col.append(h('div', { class: 'row' }, h('button', { style: 'flex:1;text-align:left', onclick: () => { if (mode === 'save') { G.fn.saveGame(s); UI.close(); } else { UI.close(true); G.fn.loadGame(s); } } }, label), m && mode === 'load' ? h('button', { onclick: () => { G.fn.deleteSave(s); UI.saves(mode, fromMenu); } }, 'Del') : null));
  }
  if (!col.children.length) col.append(h('div', {}, 'No saved games.'));
  col.append(h('button', { onclick: () => (fromMenu ? UI.mainMenu() : UI.pause()) }, 'Back'));
  body.append(col); UI.window(mode === 'save' ? 'Save Game' : 'Load Game', body, { name: 'saves', root: fromMenu ? 'menu' : 'win', onClose: () => { if (fromMenu && G.mode === 'menu' && !G.loading) UI.mainMenu(); } });
  if (fromMenu) $('menu').prepend(titleArt());
};
UI.help = function (fromMenu) {
  const keys = [['W A S D', 'Move'], ['Mouse / Arrow keys', 'Look / turn'], ['Shift', 'Sprint'], ['Space', 'Jump'], ['X', 'Sneak (toggle)'], ['Left mouse', 'Attack · hold to draw a bow'], ['Right mouse', 'Block with shield · off-hand attack'], ['Q', 'Cast readied spell'], ['E', 'Interact · talk · take all'], ['Tab or I', 'Inventory'], ['C', 'Character sheet & perks'], ['M', 'World map & fast travel'], ['J', 'Journal'], ['B', 'Spellbook'], ['R', 'Rest / wait'], ['1 - 4', 'Use quick-slot item'], ['F5 / F9', 'Quick-save / quick-load'], ['Esc', 'Menu · close window']];
  const body = h('div', {}, h('div', { class: 'col' }, h('div', { class: 'parch', style: 'padding:8px 14px;width:520px' }, keys.map(([k, v]) => h('div', { class: 'kv' }, v, h('b', {}, k)))),
    h('div', { class: 'note', style: 'width:520px;white-space:normal' }, 'Skills rise by doing: swing a short sword to train Short Blades, wear armor and get hit to train it, pick locks, brew, forge, haggle. Sleep at an inn to heal and learn faster. Ask citizens for directions, rumors and work.'),
    h('button', { onclick: () => (fromMenu ? UI.mainMenu() : UI.close()) }, fromMenu ? 'Back' : 'Close')));
  UI.window('Controls', body, { name: 'help', root: fromMenu ? 'menu' : 'win', onClose: () => { if (fromMenu && G.mode === 'menu') UI.mainMenu(); } });
  if (fromMenu) $('menu').prepend(titleArt());
};
UI.death = function (cause) {
  const has = G.fn.listSaves().length;
  const body = h('div', {}, h('div', { class: 'col', style: 'width:420px;text-align:center' }, h('div', { style: 'font-size:24px;white-space:normal' }, 'You were slain by ' + cause + ' on day ' + (dayOf() + 1) + ' of your journey.'), h('button', { disabled: has ? null : '', onclick: () => UI.saves('load') }, 'Load Game'), h('button', { onclick: () => { UI.close(true); G.fn.quitToMenu(); } }, 'Main Menu')));
  UI.window('You have died', body, { name: 'death', noClose: true });
};

// ----- rest -----
UI.rest = function (bed) {
  if (G.ents.some((e) => e.hostile && !e.dead && e.alert)) return G.fn.msg('You cannot rest with enemies about.', 'bad');
  const P = G.player, inTown = !G.space && G.world.locAt(P.pos.x, P.pos.z, 0);
  const note = bed ? 'A proper bed: you will wake healed and Well Rested (skills improve 15% faster for a day).' : G.space && G.space.kind === 'building' ? 'You may wait here, but only a bed gives real rest. Rent a room at an inn.' : inTown ? 'You can pass the time here, but the street is no place to sleep. Find an inn.' : 'Camping in the wild restores some health and mana, but something may find you.';
  const go = (hrs) => { UI.close(true); G.fn.rest(hrs, bed); };
  const hr = hourOf(), toMorning = Math.ceil(((30 - hr) % 24) || 24);
  const body = h('div', {}, h('div', { class: 'col', style: 'width:440px' }, h('div', { style: 'white-space:normal' }, note), h('div', { class: 'row' }, [1, 4, 8].map((n) => h('button', { onclick: () => go(n) }, n + (n > 1 ? ' hours' : ' hour'))), h('button', { onclick: () => go(toMorning) }, 'Until 6:00'))));
  UI.window(bed ? 'Sleep' : 'Rest', body, { name: 'rest' });
};

// ----- lock-picking minigame -----
UI.lockpick = function (lock, onOpen) {
  const P = G.player;
  if (!P.count('m:lockpick')) return G.fn.msg('It is locked (level ' + lock + '). You have no lockpicks.', 'bad');
  const cv = h('canvas', { width: 420, height: 60, style: 'image-rendering:pixelated;border:2px solid #000' }), g = cv.getContext('2d');
  const need = lock + 1; let done = 0, pos = 0, dir = 1, zone = 0, raf = 0, last = performance.now(), alive = true;
  const width = clamp((0.11 + P.S('lockpick') / 330 + (P.A('gui') - 4) * 0.012) * (1 + P.perk('pickZone')) / (1 + lock * 0.22), 0.05, 0.6), speed = 0.75 + lock * 0.22;
  const newZone = () => { zone = rnd.range(0.05, 0.95 - width); }; newZone();
  const info = h('div', {});
  const tick = (t) => { if (!alive) return; const dt = Math.min(0.05, (t - last) / 1000); last = t; pos += dir * speed * dt; if (pos > 1) { pos = 1; dir = -1; } if (pos < 0) { pos = 0; dir = 1; }
    g.fillStyle = '#14100c'; g.fillRect(0, 0, 420, 60); g.fillStyle = '#2a6a30'; g.fillRect(10 + zone * 400, 14, width * 400, 32); g.fillStyle = '#f0d890'; g.fillRect(10 + pos * 400 - 2, 6, 4, 48);
    for (let i = 0; i < need; i++) { g.fillStyle = i < done ? '#f0d890' : '#4a4030'; g.fillRect(12 + i * 14, 2, 10, 4); }
    info.textContent = `Tumblers ${done}/${need} · picks ${P.count('m:lockpick')} · press Space or click when the pick is in the green`; raf = requestAnimationFrame(tick); };
  const attempt = () => {
    if (!alive) return;
    if (pos >= zone && pos <= zone + width) { done++; G.fn.sfx('pick'); P.gainXP('lockpick', 2 + lock); if (done >= need) { alive = false; P.gainXP('lockpick', 5 + lock * 5); G.fn.msg('The lock clicks open.', 'good'); UI.pickTry = null; UI.close(true); G.fn.grabPointer(); onOpen(); return; } newZone(); }
    else { G.fn.sfx('deny'); P.gainXP('lockpick', 0.8); if (rnd.chance(0.6 * (1 - P.perk('pickSturdy')))) { P.consume('m:lockpick', 1); G.fn.msg('Your pick snaps.', 'bad'); if (!P.count('m:lockpick')) { alive = false; UI.pickTry = null; UI.close(); return; } } if (done > 0) done--; newZone(); }
  };
  cv.addEventListener('mousedown', attempt); UI.pickTry = attempt;
  UI.window('Lock (level ' + lock + ')', h('div', {}, h('div', { class: 'col' }, cv, info)), { name: 'pick', onClose: () => { alive = false; cancelAnimationFrame(raf); UI.pickTry = null; } });
  raf = requestAnimationFrame(tick);
};

// ----- smithing -----
// Forging needs: a hammer and tongs, an anvil (a smithy), the item's pattern, and the treatise for its metal.
function recipes() {
  const out = [];
  for (let t = 0; t < 5; t++) {
    for (const k in WEAPONS) out.push({ pat: k, name: I.mkWeapon(k, t).name, tier: t, ing: WEAPONS[k].ingots, lea: WEAPONS[k].bow ? 1 : 0, make: (q) => I.mkWeapon(k, t, q) });
    for (const k in SHIELDS) out.push({ pat: k, name: I.mkShield(k, t).name, tier: t, ing: SHIELDS[k].ingots, lea: 0, make: (q) => I.mkShield(k, t, q) });
    for (const sl in ARMOR_SLOTS) { out.push({ pat: 'heavy:' + sl, name: I.mkArmor('heavy', sl, t).name, tier: t, ing: ARMOR_SLOTS[sl].ingots, lea: 0, make: (q) => I.mkArmor('heavy', sl, t, q) }); out.push({ pat: 'light:' + sl, name: I.mkArmor('light', sl, t).name, tier: t, ing: t > 0 ? 1 : 0, lea: ARMOR_SLOTS[sl].ingots, make: (q) => I.mkArmor('light', sl, t, q) }); }
  }
  return out;
}
const knowsMetal = (t) => t === 0 || !!G.save.bp['met:' + t];
UI.forge = function () {
  const P = G.player, body = h('div', {}); let tab = 0, tier = 0;
  const ingots = (t) => P.count('ingot:' + t), lea = () => P.count('m:leather'), has = (id) => !!P.has((i) => i.id === id);
  const draw = () => {
    body.innerHTML = ''; const S = P.S('smithing'), tools = has('hammer') && has('tongs'), bp = G.save.bp;
    const tabs = h('div', { class: 'tabs' }, ['Forge', 'Smelt', 'Temper', 'Repair', 'Knowledge'].map((n, i) => h('button', { class: tab === i ? 'on' : '', onclick: () => { tab = i; draw(); } }, n)));
    const list = h('div', { class: 'list parch', style: 'width:660px;height:48vh' });
    if (!tools && tab < 3) list.append(h('div', { style: 'padding:8px;color:#a00;white-space:normal' }, 'You need both a Smith\'s Hammer and Smith\'s Tongs to work at the anvil.' + (has('hammer') ? '' : ' You have no hammer.') + (has('tongs') ? '' : ' You have no tongs.') + ' Smiths sell them.'));
    if (tab === 0) {
      list.append(h('div', { class: 'tabs', style: 'margin-bottom:4px' }, METALS.map((m, t) => h('button', { class: (tier === t ? 'on' : ''), style: knowsMetal(t) ? '' : 'opacity:.5', onclick: () => { tier = t; draw(); } }, m + ' / ' + HIDES[t]))));
      if (!knowsMetal(tier)) list.append(h('div', { style: 'padding:8px;color:#a00;white-space:normal' }, 'You do not know how to work ' + METALS[tier].toLowerCase() + '. Study the Treatise: ' + TREATISES[tier] + (tier < 4 ? ' - the best smiths sell copies, and they turn up in old hoards.' : ' - no smith will sell it. It must be found.')));
      else if (S < SMITH_REQ[tier]) list.append(h('div', { style: 'padding:8px;color:#a00' }, 'Requires Smithing ' + SMITH_REQ[tier] + '.'));
      const rs = recipes().filter((x) => x.tier === tier), known = rs.filter((r) => bp['pat:' + r.pat]), unknown = rs.filter((r) => !bp['pat:' + r.pat]);
      for (const r of known) {
        const ok = tools && knowsMetal(tier) && S >= SMITH_REQ[tier] && ingots(tier) >= r.ing && lea() >= r.lea;
        list.append(h('div', { class: 'item' + (ok ? '' : ' dim'), onclick: () => { if (!ok) return G.fn.sfx('deny'); const save = r.ing > 1 && rnd.chance(P.perk('forgeSave')); if (r.ing) P.consume('ingot:' + tier, save ? r.ing - 1 : r.ing); if (r.lea) P.consume('m:leather', r.lea); const it = r.make(Math.min(3, P.perk('forgeQ'))); P.addItem(it); P.gainXP('smithing', 6 + (r.ing + r.lea) * 3 + tier * 6); G.fn.msg('You forge a ' + it.name + '.' + (save ? ' (An ingot saved.)' : ''), 'good'); G.fn.sfx('forge'); draw(); } },
          h('span', { class: 'n' }, r.name), h('span', { class: 'q', style: 'width:250px' }, (r.ing ? r.ing + ' ' + METALS[tier] + ' ingot' + (r.ing > 1 ? 's' : '') : '') + (r.ing && r.lea ? ', ' : '') + (r.lea ? r.lea + ' leather' : ''))));
      }
      if (unknown.length) list.append(h('div', { class: 'note', style: 'padding:6px 4px;white-space:normal' }, 'Patterns you have not learned: ' + [...new Set(unknown.map((r) => PATTERNS[r.pat]))].join(', ') + '. Find or buy their blueprints.'));
    } else if (tab === 1) {
      list.append(h('div', { class: 'note', style: 'padding:4px;white-space:normal' }, 'Two lumps of ore make one ingot. Anything finer than iron also burns a lump of coal. Coal on hand: ' + P.count('m:coal') + '.'));
      let any = false;
      for (let t = 0; t < 5; t++) { const n = P.count('ore:' + t); if (!n) continue; any = true; const ok = has('tongs') && n >= 2 && (t === 0 || P.count('m:coal') >= 1) && knowsMetal(t);
        list.append(h('div', { class: 'item' + (ok ? '' : ' dim'), onclick: () => { if (!ok) return G.fn.sfx('deny'); P.consume('ore:' + t, 2); if (t > 0) P.consume('m:coal', 1); P.addItem(I.mkIngot(t, 1)); P.gainXP('smithing', 3 + t * 3); G.fn.sfx('forge'); draw(); } }, h('img', { src: itemIcon('ore', I.mkOre(t).col) }), h('span', { class: 'n' }, 'Smelt 2 ' + ORES[t] + (t ? ' + 1 Coal' : '') + ' into 1 ' + METALS[t] + ' Ingot'), h('span', { class: 'q', style: 'width:200px' }, knowsMetal(t) ? 'have ' + n : 'needs ' + TREATISES[t]))); }
      if (!any) list.append(h('div', { style: 'padding:8px;white-space:normal' }, 'You carry no ore. Dig it with a pickaxe from veins in mines, caves and on mountainsides. The deeper the mine, the finer the metal.'));
      const pelts = P.count('i:pelt'); if (pelts) list.append(h('div', { class: 'item', onclick: () => { P.consume('i:pelt', 1); P.addItem(I.mkMisc('leather', 1)); P.gainXP('smithing', 2); draw(); } }, h('span', { class: 'n' }, 'Cure a Beast Pelt into Leather'), h('span', { class: 'q' }, 'have ' + pelts)));
    } else if (tab === 2) {
      const c = P.inv.filter((i) => (i.type === 'weapon' || i.type === 'armor' || i.type === 'shield') && (i.q || 0) < 3);
      if (!c.length) list.append(h('div', { style: 'padding:8px' }, 'Nothing to temper.'));
      for (const it of c) { const q = (it.q || 0) + 1, need = SMITH_REQ[it.tier] + q * 12, mat = it.cls === 'light' ? 'm:leather' : 'ingot:' + it.tier, ok = tools && knowsMetal(it.tier) && S >= need && P.count(mat) >= 1;
        list.append(h('div', { class: 'item' + (ok ? '' : ' dim'), onclick: () => { if (!ok) return G.fn.sfx('deny'); P.consume(mat, 1); const n = it.type === 'weapon' ? I.mkWeapon(it.kind, it.tier, q) : it.type === 'shield' ? I.mkShield(it.kind, it.tier, q) : I.mkArmor(it.cls, it.slot, it.tier, q); const suffix = it.ench ? it.name.slice(it.name.indexOf(' of ')) : ''; Object.assign(it, { name: n.name + suffix, dmg: n.dmg, ar: n.ar, q, val: n.val + (it.ench ? Math.round(it.val * 0.3) : 0), cond: 100 }); P.gainXP('smithing', 8 + it.tier * 5 + q * 4); G.fn.msg('Tempered: ' + it.name, 'good'); G.fn.sfx('forge'); draw(); } }, h('img', { src: itemIcon(it.icon, it.col) }), h('span', { class: 'n' }, it.name + ' → ' + ['', 'Fine', 'Superior', 'Masterwork'][q]), h('span', { class: 'q', style: 'width:250px' }, (knowsMetal(it.tier) ? 'Smithing ' + need : TREATISES[it.tier]) + ', 1 ' + (it.cls === 'light' ? 'leather' : METALS[it.tier] + ' ingot')))); }
    } else if (tab === 3) repairList(list, draw, true);
    else {
      list.append(h('div', { style: 'padding:6px;white-space:normal' }, h('b', { style: 'font-weight:normal;color:#6a1a10' }, 'Metals you can work: '), METALS.filter((m, t) => knowsMetal(t)).join(', ') + '.'), h('div', { style: 'padding:6px;white-space:normal' }, h('b', { style: 'font-weight:normal;color:#6a1a10' }, 'Patterns you know: '), Object.keys(PATTERNS).filter((k) => bp['pat:' + k]).map((k) => PATTERNS[k]).join(', ') || 'none'),
        h('div', { style: 'padding:6px;white-space:normal' }, h('b', { style: 'font-weight:normal;color:#6a1a10' }, 'Still to learn: '), (Object.keys(PATTERNS).filter((k) => !bp['pat:' + k]).map((k) => PATTERNS[k]).concat(TREATISES.filter((t, i) => t && !knowsMetal(i)).map((t) => 'Treatise: ' + t))).join(', ') || 'nothing - you have mastered the craft'),
        h('div', { class: 'note', style: 'padding:6px;white-space:normal' }, 'Blueprints and treatises are read from your inventory. Smiths sell a few patterns and the treatise for the best metal they work themselves; the rest come from chests, mines and the hoards of dungeon masters.'));
    }
    body.append(h('div', { class: 'col' }, tabs, list, h('div', { class: 'note' }, 'Smithing ' + S + ' · ingots: ' + (METALS.map((m, t) => ingots(t) ? m + ' ' + ingots(t) : null).filter(Boolean).join(', ') || 'none') + ' · leather ' + lea() + ' · coal ' + P.count('m:coal'))));
  };
  draw(); UI.window('Forge & Anvil', body, { name: 'forge' });
};
function repairList(list, draw, anvil) {
  const P = G.player, S = P.S('smithing'), cap = Math.min(100, Math.round((45 + S * 0.6) * (1 + P.perk('repairAmt'))) - (anvil ? 0 : 20));
  const worn = P.inv.filter((i) => i.cond !== undefined && i.cond < cap);
  list.append(h('div', { class: 'note', style: 'padding:4px;white-space:normal' }, (anvil ? 'At an anvil' : 'In the field, with only a hammer,') + ' you can restore gear to ' + cap + '% condition.' + (anvil ? '' : ' A proper anvil allows better work.')));
  if (!P.has((i) => i.id === 'hammer')) { list.append(h('div', { style: 'padding:8px;color:#a00' }, 'You need a Smith\'s Hammer.')); return; }
  if (!worn.length) list.append(h('div', { style: 'padding:8px' }, 'Nothing you can improve.'));
  for (const it of worn) list.append(h('div', { class: 'item', onclick: () => { P.gainXP('smithing', 1.5 + (cap - it.cond) * 0.08); it.cond = cap; G.fn.sfx('forge'); draw(); } }, h('img', { src: itemIcon(it.icon, it.col) }), h('span', { class: 'n' }, it.name), h('span', { class: 'q' }, Math.round(it.cond) + '% → ' + cap + '%')));
}
UI.repair = function () { const body = h('div', {}), list = h('div', { class: 'list parch', style: 'width:560px;height:44vh' }); const draw = () => { list.innerHTML = ''; repairList(list, draw, false); }; draw(); body.append(list); UI.window('Field Repairs', body, { name: 'repair' }); };

// ----- alchemy -----
// Brew from two to four ingredients. Every effect that at least two of them share (and that you know how to draw out) goes into the potion.
UI.alchemy = function (station) {
  const P = G.player, body = h('div', {}); let pick = [];
  const has = (id) => station || !!P.has((i) => i.id === id);
  if (!has('mortar')) return G.fn.msg('You need a Mortar & Pestle to brew.', 'bad');
  const draw = () => {
    body.innerHTML = ''; pick = pick.filter((id) => P.count('i:' + id) > 0);
    const max = has('retort') ? 4 : 3, S = P.S('alchemy');
    const list = h('div', { class: 'list parch', style: 'width:560px;height:48vh' });
    const ings = P.inv.filter((i) => i.type === 'ingredient' && INGREDIENTS[i.id].fx.length).sort((a, b) => a.name.localeCompare(b.name));
    if (!ings.length) list.append(h('div', { style: 'padding:8px;white-space:normal' }, 'You carry no alchemical ingredients. Every biome has its own plants and fungi - a sickle is needed for most - and many monsters yield useful parts.'));
    const cnt = {}; for (const id of pick) for (const f of I.knownFx(id)) cnt[f] = (cnt[f] || 0) + 1;
    for (const it of ings) {
      const kn = I.knownFx(it.id), all = INGREDIENTS[it.id].fx, match = pick.length && !pick.includes(it.id) && kn.some((f) => cnt[f]);
      list.append(h('div', { class: 'item' + (pick.includes(it.id) ? ' sel' : ''), onclick: () => { if (pick.includes(it.id)) pick = pick.filter((x) => x !== it.id); else if (pick.length < max) pick.push(it.id); else G.fn.sfx('deny'); draw(); } }, h('img', { src: itemIcon(it.icon, it.col) }), h('span', { class: 'n', style: match ? 'color:#1a5a1a' : '' }, it.name + ' (' + it.qty + ')'),
        h('span', { class: 'q', style: 'width:280px' }, all.map((f, i) => (i < kn.length ? EFFECTS[f].name.replace('Restore ', '').replace('Fortify ', '') : '???')).join(', '))));
    }
    const shared = Object.keys(cnt).filter((f) => cnt[f] >= 2).sort((a, b) => cnt[b] - cnt[a]);
    const mag = (f, k) => EFFECTS[f].base * (0.55 + S / 75) * (1 + (P.A('int') - 4) * 0.05) * (1 + P.perk('brewMag')) * (has('alembic') ? 1.25 : 1) * (cnt[f] >= 3 ? 1.25 : 1) * (k ? 0.8 : 1);
    const make = (n) => I.mkPotion(shared[0], mag(shared[0], 0), n, shared.slice(1).map((f, k) => [f, mag(f, k + 1)]), has('calcinator') ? 1.4 : 1);
    const tools = [['mortar', 'Mortar & Pestle'], ['alembic', 'Alembic (+25% strength)'], ['calcinator', 'Calcinator (+40% duration)'], ['retort', 'Retort (4th ingredient, bonus potion)']];
    const res = h('div', { class: 'parch', style: 'padding:8px 10px;width:300px;white-space:normal;overflow-y:auto' },
      h('div', {}, 'Mixture (' + pick.length + '/' + max + '): ' + (pick.map((id) => INGREDIENTS[id].name).join(' + ') || '-')),
      h('div', { style: 'margin:8px 0' }, pick.length < 2 ? 'Choose ingredients that share an effect. Names turn green when they match your mixture.' : shared.length ? h('span', {}, 'Result: ', h('b', { style: 'font-weight:normal;color:#6a1a10' }, make(1).name), h('br'), I.describe(make(1)).slice(0, shared.length).join('; ')) : 'These share no effect you know how to draw out - the brew would be worthless.'),
      h('button', { disabled: shared.length ? null : '', onclick: () => { for (const id of pick) P.consume('i:' + id, 1); const n = 1 + (rnd.chance(P.perk('brewDouble')) ? 1 : 0) + (has('retort') && rnd.chance(0.25) ? 1 : 0), it = make(n); P.addItem(it); P.gainXP('alchemy', 5 + shared.length * 4 + pick.length * 2); G.fn.msg('You brew ' + (n > 1 ? n + ' ' : 'a ') + it.name + '.', 'good'); G.fn.sfx('drink'); draw(); } }, 'Brew'),
      h('div', { class: 'note', style: 'margin-top:10px' }, 'Alchemy ' + S + ' - you can draw out ' + (S >= 55 ? 'all three effects' : S >= 30 ? 'two effects (three at 55)' : 'one effect (two at 30)') + ' of each ingredient.'),
      h('div', { class: 'note', style: 'margin-top:8px' }, station ? 'A full apothecary\'s bench: every tool is to hand.' : 'Your kit:'), station ? null : tools.map(([id, label]) => h('div', { class: 'note', style: has(id) ? 'opacity:1;color:#1a5a1a' : '' }, (has(id) ? '✔ ' : '· ') + label)));
    body.append(list, res);
  };
  draw(); UI.window(station ? 'Alchemy Bench' : 'Alchemy', body, { name: 'alchemy' });
};
