// Item construction, naming, loot generation.
import { WEAPONS, SHIELDS, ARMOR_SLOTS, METALS, HIDES, TIER_COL, HIDE_COL, TIER_DMG, TIER_VAL, EFFECTS, INGREDIENTS, MISC, SPELLS, ABILITIES, SKILLS, ORES, PATTERNS, TREATISES, SMITH_REQ } from './data.js';
import { G } from './state.js';
import { rnd, clamp } from './rng.js';

const QUAL = ['', 'Fine ', 'Superior ', 'Masterwork '];
const WICON = { dagger: 'dagger', shortsword: 'shortsword', longsword: 'longsword', claymore: 'claymore', mace: 'mace', warhammer: 'warhammer', handaxe: 'handaxe', battleaxe: 'battleaxe', spear: 'spear', halberd: 'halberd', shortbow: 'shortbow', longbow: 'longbow' };

export function mkWeapon(kind, tier = 0, q = 0) {
  const W = WEAPONS[kind];
  return { type: 'weapon', kind, tier, q, name: QUAL[q] + (W.bow ? ['Ash', 'Yew', 'Horn', 'Duskwood', 'Starwood'][tier] : METALS[tier]) + ' ' + W.name, slot: 'rhand', hands: W.hands, skill: W.skill,
    dmg: Math.round(W.dmg * TIER_DMG[tier] * (1 + q * 0.1) * 10) / 10, speed: W.speed, reach: W.reach, weight: W.weight, val: Math.round(W.val * TIER_VAL[tier] * (1 + q * 0.3)),
    cond: 100, icon: WICON[kind], col: W.bow ? ['#b89060', '#a87840', '#d8d0b0', '#5a4a6a', '#a8d8e8'][tier] : TIER_COL[tier], bow: !!W.bow };
}
export function mkShield(kind, tier = 0, q = 0) {
  const S = SHIELDS[kind];
  return { type: 'shield', kind, tier, q, name: QUAL[q] + METALS[tier] + ' ' + S.name, slot: 'lhand', skill: 'shields', block: S.block, ar: Math.round(S.ar * TIER_DMG[tier] * (1 + q * 0.1)), weight: S.weight, val: Math.round(S.val * TIER_VAL[tier] * (1 + q * 0.3)), cond: 100, icon: 'shield', col: TIER_COL[tier] };
}
export function mkArmor(cls, slot, tier = 0, q = 0) {
  const A = ARMOR_SLOTS[slot], heavy = cls === 'heavy';
  return { type: 'armor', cls, tier, q, name: QUAL[q] + (heavy ? METALS[tier] + ' ' + A.heavy : HIDES[tier] + ' ' + A.light), slot, skill: cls,
    ar: Math.round(A.ar * TIER_DMG[tier] * (heavy ? 1.45 : 1) * (1 + q * 0.1)), weight: Math.round(A.w * (heavy ? 1 : 0.4) * 10) / 10, val: Math.round(A.val * TIER_VAL[tier] * (heavy ? 1.3 : 1) * (1 + q * 0.3)), cond: 100, icon: slot, col: heavy ? TIER_COL[tier] : HIDE_COL[tier] };
}
const ENCH = [
  ...ABILITIES.map((a) => ({ stat: 'abil:' + a.id, name: a.name, min: 1, max: 2, w: 3, val: 180 })),
  { stat: 'hp', name: 'Vitality', min: 10, max: 40, w: 4, val: 6 }, { stat: 'mp', name: 'the Magus', min: 10, max: 40, w: 4, val: 6 },
  { stat: 'st', name: 'Endurance', min: 15, max: 50, w: 3, val: 4 }, { stat: 'carry', name: 'the Ox', min: 15, max: 50, w: 3, val: 4 },
  { stat: 'ar', name: 'Warding', min: 4, max: 14, w: 3, val: 16 }, { stat: 'resist', name: 'Null', min: 8, max: 25, w: 2, val: 10 },
  { stat: 'regen', name: 'Renewal', min: 2, max: 6, w: 1.5, val: 60 },
  ...SKILLS.map((s) => ({ stat: 'skill:' + s.id, name: s.name, min: 4, max: 12, w: 0.6, val: 22 })),
];
export function enchLabel(e) {
  const [k, id] = e.stat.split(':');
  if (k === 'abil') return '+' + e.amt + ' ' + ABILITIES.find((a) => a.id === id).name;
  if (k === 'skill') return '+' + e.amt + ' ' + SKILLS.find((s) => s.id === id).name;
  return { hp: '+' + e.amt + ' Health', mp: '+' + e.amt + ' Mana', st: '+' + e.amt + ' Stamina', carry: '+' + e.amt + ' lb carry weight', ar: '+' + e.amt + ' Armor', resist: e.amt + '% magic resistance', regen: 'Regenerate ' + (e.amt / 10).toFixed(1) + ' health/s' }[k];
}
function rollEnch(rng, power) {
  const E = rng.weighted(ENCH.map((e) => [e, e.w]));
  const amt = Math.max(E.min, Math.round(E.min + (E.max - E.min) * clamp(power * (0.5 + rng.next() * 0.6), 0, 1)));
  return { stat: E.stat, amt, _n: E.name, _v: E.val * amt };
}
export function enchant(item, rng, power) {
  const e = rollEnch(rng, power);
  item.ench = [{ stat: e.stat, amt: e.amt }]; item.name += ' of ' + e._n; item.val += Math.round(e._v * 1.5); return item;
}
export function mkJewel(slot, rng, power) {
  const metal = rng.pick(['Copper', 'Silver', 'Gold', 'Jade', 'Onyx', 'Moonstone']);
  const it = { type: 'jewel', slot: slot === 'ring' ? 'ring' : slot, name: metal + ' ' + { ring: 'Ring', amulet: 'Amulet', belt: 'Belt' }[slot], weight: slot === 'belt' ? 1 : 0.1, val: 30, icon: slot, col: { Copper: '#c87840', Silver: '#d0d8e0', Gold: '#e8c040', Jade: '#58b878', Onyx: '#4a4458', Moonstone: '#a8c8f0' }[metal] };
  if (slot === 'belt') it.name = rng.pick(['Leather', 'Studded', 'Braided', 'Silk']) + ' Belt';
  enchant(it, rng, power);
  if (power > 0.55 && rng.chance(0.35)) { const e = rollEnch(rng, power * 0.7); if (e.stat !== it.ench[0].stat) { it.ench.push({ stat: e.stat, amt: e.amt }); it.val += Math.round(e._v); } }
  return it;
}
const PCOL = { heal: '#e04848', mana: '#4878e8', stam: '#58c858', regen: '#e888a8', might: '#e89038', swift: '#e8e058', stone: '#a8a8a8', night: '#8858d8', feather: '#d8f0f8', cure: '#78d8c8', resist: '#c878e8', water: '#58b8d8' };
const pmag = (fx, mag) => { const E = EFFECTS[fx]; return E.flat ? 1 : Math.max(E.int ? 1 : 0.1, E.int ? Math.round(mag) : Math.round(mag * 10) / 10); };
// A potion has a main effect and, when brewed from ingredients sharing several effects, extra ones: extras = [[fx, mag], ...]. dm scales durations.
export function mkPotion(fx, mag, qty = 1, extras = [], dm = 1) {
  const E = EFFECTS[fx], m = pmag(fx, mag), more = extras.map(([f, g]) => [f, pmag(f, g)]);
  let val = 18 + (E.flat ? 20 : (m / E.base) * 22) + (E.dur ? 12 * dm : 0); for (const [f, g] of more) val += 10 + (EFFECTS[f].flat ? 14 : (g / EFFECTS[f].base) * 16);
  const it = { type: 'potion', fx, mag: m, name: 'Potion of ' + E.name + (more.length ? ' & ' + EFFECTS[more[0][0]].name.replace('Restore ', '').replace('Fortify ', '') + (more.length > 1 ? ' +' + (more.length - 1) : '') : ''), weight: 0.4, val: Math.round(val), stack: true, qty, icon: 'potion',
    sk: 'p:' + fx + ':' + m + more.map(([f, g]) => '+' + f + ':' + g).join('') + (dm !== 1 ? '*' + dm : ''), col: PCOL[fx] };
  if (more.length) it.more = more; if (dm !== 1) it.dm = dm;
  return it;
}
// how many of an ingredient's effects the player can draw out
export function knownFx(id) { const sk = G.player ? G.player.S('alchemy') : 20; return INGREDIENTS[id].fx.slice(0, 1 + (sk >= 30 ? 1 : 0) + (sk >= 55 ? 1 : 0)); }
export function mkBlueprint(key) {
  const [k, id] = [key.slice(0, 3), key.slice(4)];
  if (k === 'met') { const t = +id; return { type: 'blueprint', bp: key, name: 'Treatise: ' + TREATISES[t], weight: 1, val: [0, 320, 850, 2100, 5000][t], icon: 'scroll', col: TIER_COL[t], desc: 'Teaches the working of ' + METALS[t].toLowerCase() + ' and ' + HIDES[t].toLowerCase() + ' gear. Needs Smithing ' + Math.max(20, SMITH_REQ[t] - 10) + ' to follow. Read to learn.' }; }
  return { type: 'blueprint', bp: key, name: 'Blueprint: ' + PATTERNS[id], weight: 0.3, val: 55 + (id.length * 7) % 60, icon: 'scroll', col: '#3a4a8a', desc: 'The pattern for forging a ' + PATTERNS[id].toLowerCase() + ' in any metal you know how to work. Read to learn.' };
}
export function randomBlueprint(rng, tier = 1) { if (rng.chance(0.14 + tier * 0.04)) return mkBlueprint('met:' + clamp(Math.round(tier - 0.3 + rng.range(-0.8, 0.8)), 1, 4)); return mkBlueprint('pat:' + rng.pick(Object.keys(PATTERNS))); }
export function mkIng(id, qty = 1) { const I = INGREDIENTS[id]; return { type: 'ingredient', id, name: I.name, weight: I.w, val: I.val, stack: true, qty, icon: I.icon, col: I.col, sk: 'i:' + id, food: I.food }; }
export function mkMisc(id, qty = 1) { const I = MISC[id]; const it = Object.assign({ id, qty, col: '#b8c0cc' }, I); if (I.stack) it.sk = 'm:' + id; else delete it.qty; return it; }
export function mkIngot(tier, qty = 1) { return { type: 'mat', mat: 'ingot', tier, name: METALS[tier] + ' Ingot', weight: 1, val: Math.round(9 * TIER_VAL[tier]), stack: true, qty, icon: 'ingot', col: TIER_COL[tier], sk: 'ingot:' + tier }; }
export function mkOre(tier, qty = 1) { return { type: 'mat', mat: 'ore', tier, name: ORES[tier], weight: 1.5, val: Math.round(3 * TIER_VAL[tier]), stack: true, qty, icon: 'ore', col: TIER_COL[tier], sk: 'ore:' + tier }; }
export function mkTome(id) { const S = SPELLS[id]; return { type: 'tome', spell: id, name: 'Tome: ' + S.name, weight: 1, val: S.val, icon: 'tome', col: { destruction: '#a83828', illusion: '#6848a8', alteration: '#388868' }[S.school] }; }

export function itemWeight(it) { return it.weight * (it.qty || 1); }
export function randomWeapon(rng, tier) { return mkWeapon(rng.pick(Object.keys(WEAPONS)), tier); }
export function randomArmor(rng, tier) { return mkArmor(rng.chance(0.5) ? 'light' : 'heavy', rng.pick(Object.keys(ARMOR_SLOTS)), tier); }
// A random piece of gear around `tier` (0..4), sometimes enchanted
export function randomGear(rng, tier, magic = 0.12) {
  const t = clamp(Math.round(tier + rng.range(-1.1, 0.6)), 0, 4), r = rng.next();
  let it = r < 0.45 ? randomWeapon(rng, t) : r < 0.85 ? randomArmor(rng, t) : mkShield(rng.pick(Object.keys(SHIELDS)), t);
  if (rng.chance(0.15)) { const q = rng.int(1, 2); it = it.type === 'weapon' ? mkWeapon(it.kind, t, q) : it.type === 'shield' ? mkShield(it.kind, t, q) : mkArmor(it.cls, it.slot, t, q); }
  if (rng.chance(magic)) enchant(it, rng, 0.25 + t * 0.18);
  it.cond = rng.int(45, 100);
  return it;
}
export function randomPotion(rng, power = 1) { const fx = rng.weighted([['heal', 5], ['mana', 3], ['stam', 3], ['regen', 1], ['might', 1], ['swift', 1], ['stone', 1], ['night', 1], ['feather', 0.7], ['cure', 1.5]]); return mkPotion(fx, EFFECTS[fx].base * power); }
export function randomTome(rng, maxLvl = 100) { const ids = Object.keys(SPELLS).filter((s) => SPELLS[s].lvl <= maxLvl); return mkTome(rng.pick(ids)); }

// Resolve a monster/chest loot entry into items. Returns {items:[], gold}
export function rollLoot(entries, rng, tier) {
  const out = { items: [], gold: 0 };
  for (const [key, ch, mn = 1, mx = 1] of entries) {
    if (!rng.chance(ch)) continue;
    const n = rng.int(mn, mx);
    if (key === 'gold') out.gold += n;
    else if (key === 'gear') out.items.push(randomGear(rng, tier, 0.2));
    else if (key === 'jewel') out.items.push(mkJewel(rng.pick(['ring', 'ring', 'amulet', 'belt']), rng, 0.3 + tier * 0.15));
    else if (key === 'potion') out.items.push(randomPotion(rng, 1 + tier * 0.15));
    else if (key === 'tome') out.items.push(randomTome(rng, 30 + tier * 20));
    else if (key === 'ore') out.items.push(mkOre(clamp(tier - 1, 0, 4), n));
    else if (key === 'blueprint') out.items.push(randomBlueprint(rng, tier));
    else if (INGREDIENTS[key]) out.items.push(mkIng(key, n));
    else if (MISC[key]) out.items.push(mkMisc(key, n));
  }
  return out;
}
export function chestLoot(rng, tier, goldMult = 1) {
  const out = { items: [], gold: Math.round(rng.int(8, 30) * (1 + tier * 0.8) * goldMult) };
  const n = rng.int(1, 3);
  for (let i = 0; i < n; i++) {
    const r = rng.next();
    if (r < 0.3) out.items.push(randomGear(rng, tier - 0.3, 0.2 + tier * 0.04));
    else if (r < 0.55) out.items.push(randomPotion(rng, 1 + tier * 0.15));
    else if (r < 0.66) out.items.push(mkJewel(rng.pick(['ring', 'ring', 'amulet', 'belt']), rng, 0.25 + tier * 0.15));
    else if (r < 0.74) out.items.push(mkMisc('gem', 1));
    else if (r < 0.82) out.items.push(mkMisc('lockpick', rng.int(1, 3)));
    else if (r < 0.87) out.items.push(mkIngot(clamp(Math.round(tier - 1 + rng.range(-0.5, 0.5)), 0, 4), rng.int(1, 3)));
    else if (r < 0.92) out.items.push(randomBlueprint(rng, tier));
    else if (r < 0.95) out.items.push(randomTome(rng, 30 + tier * 18));
    else out.items.push(mkMisc('arrow', rng.int(8, 20)));
  }
  return out;
}

// Human-readable stat lines for an item
export function describe(it) {
  const L = [];
  if (it.type === 'weapon') { L.push('Damage ' + it.dmg + (it.hands === 2 ? '  (two-handed)' : '')); L.push((it.bow ? 'Draw ' : 'Speed ') + it.speed.toFixed(2) + (it.bow ? '' : '   Reach ' + it.reach.toFixed(1) + 'm')); L.push('Skill: ' + SKILLS.find((s) => s.id === it.skill).name); }
  if (it.type === 'armor') { L.push('Armor ' + it.ar); L.push(it.cls === 'heavy' ? 'Heavy Armor' : 'Light Armor'); }
  if (it.type === 'shield') { L.push('Blocks ' + Math.round(it.block * 100) + '%   Armor ' + it.ar); }
  if (it.type === 'potion') for (const [f, m] of [[it.fx, it.mag], ...(it.more || [])]) { const E = EFFECTS[f]; L.push((E.flat ? E.name : E.name + ': ' + m + E.unit) + (E.dur ? ' for ' + Math.round(E.dur * (it.dm || 1)) + 's' : '')); }
  if (it.type === 'ingredient') { const I = INGREDIENTS[it.id]; if (I.fx.length) { const kn = knownFx(it.id); L.push('Effects: ' + I.fx.map((f, i) => (i < kn.length ? EFFECTS[f].name : '???')).join(', ')); if (kn.length < I.fx.length) L.push('(More Alchemy skill reveals hidden effects)'); } if (I.food) L.push('Edible'); }
  if (it.type === 'tome') { const S = SPELLS[it.spell]; L.push(S.desc); L.push(SKILLS.find((s) => s.id === S.school).name + ' ' + S.lvl + ' required. Read to learn.'); }
  if (it.desc) L.push(it.desc);
  if (it.ench) for (const e of it.ench) L.push('* ' + enchLabel(e));
  if (it.cond !== undefined) L.push('Condition ' + Math.round(it.cond) + '%');
  L.push('Weight ' + (Math.round(it.weight * 10) / 10) + ' lb   Value ' + it.val + 'g');
  return L;
}
