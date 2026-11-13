// Conversations with citizens, shop stock and prices.
import { RNG, hash2, rnd, clamp } from './rng.js';
import { EFFECTS } from './data.js';
import { BIOMES, BUILDINGS, LOC_TYPES, SKILLS, SKILL_BY_ID, SPELLS, WEAPONS, SHIELDS, ARMOR_SLOTS, INGREDIENTS, FORAGE, MONSTERS, SKILL_CAP, PATTERNS } from './data.js';
import { G, dayOf, hourOf, isNight } from './state.js';
import { getLayout, citizensOf } from './settlement.js';
import * as Q from './quests.js';
import * as F from './factions.js';
import { faithOf, guildOf, realmName, HOME_PRICE } from './settlement.js';
import * as I from './items.js';

const npcRec = (c) => (G.save.npc[c.id] || (G.save.npc[c.id] = { d: 38 + (c.seed % 30) }));
export const disp = (c) => npcRec(c).d;
const SIZE = { farm: 0, village: 0, town: 1, city: 2, castle: 3 };
const ROLE_TEXT = { quartermaster: 'quartermaster of this hall. Stores, strongboxes and bunks are my business', cleric: 'sworn to the faith, and to the keeping of this temple', Smith: 'the smith here. If it is made of metal, I can make it or mend it', Innkeeper: 'keeper of this inn. A bed, a meal, a mug - that is my trade', Trader: 'a trader. I buy and sell a bit of everything', Apothecary: 'an apothecary. Potions, herbs and remedies', Arcanist: 'a student of the arcane. I deal in tomes and charms', Guildmaster: 'master of this guild hall. We find work for capable hands', Priest: 'a servant of the shrine. I tend the wounded and the weary',
  king: 'your sovereign. These lands and their people are mine to protect', queen: 'the queen. Speak, and be brief', steward: 'steward of this castle. I keep the keys and the ledgers', guard: 'of the watch. Keep the peace and we shall have no quarrel', noble: 'of an old family. One of the few with any manners left', servant: 'in service to the crown',
  server: 'I serve the tables here', cook: 'the cook. Mind the pots', acolyte: 'an acolyte of the shrine', apprentice: 'apprenticed here, learning the trade', adventurer: 'a sworn member of the guild. I have seen my share of dark holes', farmhand: 'a hand on this farm' };

export function buyPrice(it, c) { const P = G.player, mr = memberRate(c); return Math.max(1, Math.ceil(it.val * clamp(1.65 - mr - P.S('persuasion') / 260 - P.perk('barter') - (disp(c) - 50) / 400 - (P.A('gui') - 4) * 0.012, 1.05, 2) * (it.cond !== undefined ? 0.5 + it.cond / 200 : 1))); }
function memberRate(c) { const L = G.world.locs[c.loc]; return L && L.civ && guildOf(L) === 'scale' && F.hasPriv('scale', 'prices') ? 0.1 : 0; }
export function sellPrice(it, c) { const P = G.player; return Math.max(it.val > 0 ? 1 : 0, Math.floor(it.val * clamp(0.32 + memberRate(c) / 2 + P.S('persuasion') / 300 + P.perk('barter') + (disp(c) - 50) / 500 + (P.A('gui') - 4) * 0.012, 0.1, 0.9) * (it.cond !== undefined ? 0.4 + it.cond / 166 : 1))); }
export function wants(type, it) {
  if (it.type === 'quest') return false;
  if (type === 'trader') return true;
  if (type === 'smithy') return ['weapon', 'armor', 'shield', 'ammo'].includes(it.type) || it.mat || it.type === 'blueprint' || ['hammer', 'pickaxe', 'tongs', 'leather', 'coal'].includes(it.id);
  if (type === 'alchemist') return it.type === 'potion' || it.type === 'ingredient' || ['mortar', 'alembic', 'calcinator', 'retort', 'sickle'].includes(it.id);
  if (type === 'arcanist') return it.type === 'tome' || it.type === 'jewel' || it.type === 'potion' || it.id === 'gem' || !!it.ench;
  if (type === 'inn') return it.type === 'food' || (it.type === 'ingredient' && it.food);
  return false;
}
export function shopStock(L, b) {
  const key = L.id + ':' + b.i, ep = Math.floor(dayOf() / 3);
  let s = G.save.shops[key];
  if (s && s.ep === ep) return s;
  const rng = new RNG(hash2(L.id, b.i, ep ^ 0x5709)), sz = SIZE[L.type], items = [], add = (it) => { const ex = it.stack && items.find((o) => o.sk === it.sk); if (ex) ex.qty += it.qty; else items.push(it); };
  const t = b.type, tier = () => clamp(sz + rng.weighted([[-1, 3], [0, 5], [1, 2]]), 0, 4);
  if (t === 'smithy') {
    const base = clamp(sz + (rng.chance(0.3) ? 1 : 0), 0, 4); // "the tier the smith is"
    for (let i = 0; i < 7 + sz * 2; i++) add(I.mkWeapon(rng.pick(Object.keys(WEAPONS)), rng.chance(0.7) ? base : Math.max(0, base - 1)));
    for (let i = 0; i < 6 + sz * 2; i++) add(I.mkArmor(rng.chance(0.6) ? 'heavy' : 'light', rng.pick(Object.keys(ARMOR_SLOTS)), rng.chance(0.7) ? base : Math.max(0, base - 1)));
    for (let i = 0; i < 2; i++) add(I.mkShield(rng.pick(Object.keys(SHIELDS)), base));
    add(I.mkMisc('hammer')); add(I.mkMisc('tongs')); add(I.mkMisc('pickaxe')); add(I.mkMisc('arrow', rng.int(30, 80)));
    // raw materials: iron is common, steel scarce, anything better must be mined
    add(I.mkIngot(0, rng.int(3, 8))); add(I.mkOre(0, rng.int(2, 6))); add(I.mkMisc('coal', rng.int(3, 9))); if (sz >= 2 && rng.chance(0.6)) add(I.mkIngot(1, rng.int(1, 3)));
    add(I.mkMisc('leather', rng.int(2, 6)));
    // blueprints: a few patterns, and the treatise for the best metal this smith works (never starmetal)
    const pats = rng.shuffle(Object.keys(PATTERNS)); for (let i = 0; i < 2 + sz; i++) add(I.mkBlueprint('pat:' + pats[i]));
    if (base >= 1) add(I.mkBlueprint('met:' + Math.min(3, base))); if (base >= 2 && rng.chance(0.5)) add(I.mkBlueprint('met:' + (Math.min(3, base) - 1)));
  } else if (t === 'trader') {
    add(I.mkMisc('lockpick', rng.int(3, 9))); add(I.mkMisc('torch', rng.int(3, 8))); add(I.mkMisc('bread', rng.int(3, 8))); add(I.mkMisc('cheese', rng.int(1, 5))); add(I.mkMisc('arrow', rng.int(20, 60))); add(I.mkMisc('leather', rng.int(2, 6)));
    add(I.mkMisc('sickle')); add(I.mkMisc('knife')); if (rng.chance(0.7)) add(I.mkMisc('mortar')); if (rng.chance(0.7)) add(I.mkMisc('pickaxe')); if (rng.chance(0.5)) add(I.mkMisc('hammer')); if (rng.chance(0.25)) add(I.mkBlueprint('pat:' + rng.pick(Object.keys(PATTERNS))));
    for (let i = 0; i < 4 + sz; i++) add(I.randomGear(rng, Math.max(0, sz - 0.5), 0.1));
    for (let i = 0; i < 2; i++) add(I.randomPotion(rng)); if (rng.chance(0.4 + sz * 0.15)) add(I.mkJewel(rng.pick(['ring', 'amulet', 'belt']), rng, 0.2 + sz * 0.15));
    add(I.mkWeapon('shortbow', 0));
  } else if (t === 'alchemist') {
    for (let i = 0; i < 8 + sz * 2; i++) add(I.randomPotion(rng, 1 + sz * 0.15));
    add(I.mkPotion('heal', 28, 3)); add(I.mkPotion('cure', 1, 2)); add(I.mkMisc('mortar')); add(I.mkMisc('sickle')); if (sz >= 1) add(I.mkMisc('alembic')); if (sz >= 2) add(I.mkMisc('calcinator')); if (sz >= 2 && rng.chance(0.6)) add(I.mkMisc('retort'));
    const ids = Object.keys(INGREDIENTS).filter((k) => INGREDIENTS[k].fx.length); for (let i = 0; i < 8; i++) add(I.mkIng(rng.pick(ids), rng.int(1, 4)));
  } else if (t === 'arcanist') {
    const ids = Object.keys(SPELLS).filter((s) => SPELLS[s].lvl <= 30 + sz * 25); rng.shuffle(ids); for (const id of ids.slice(0, 5 + sz * 2)) add(I.mkTome(id));
    if (!items.some((i) => i.spell === 'firebolt')) add(I.mkTome('firebolt')); if (!items.some((i) => i.spell === 'mend')) add(I.mkTome('mend'));
    add(I.mkPotion('mana', 26, 4)); for (let i = 0; i < 2 + sz; i++) add(I.mkJewel(rng.pick(['ring', 'ring', 'amulet', 'belt']), rng, 0.25 + sz * 0.18));
  } else if (t === 'inn') { add(I.mkMisc('bread', 8)); add(I.mkMisc('cheese', 6)); add(I.mkMisc('ale', 12)); add(I.mkIng('meat', 4)); }
  s = G.save.shops[key] = { ep, items, gold: rng.int(250, 500) * (1 + sz) };
  return s;
}

function mark(L) { if (!G.save.discovered[L.id]) G.save.known[L.id] = 1; }
function here() { return G.outPos || G.player.pos; }
function findService(L, type) {
  const lay = getLayout(G.world, L), p = here(); let best = null, bd = 1e9;
  for (const b of lay.buildings) if (b.type === type) { const d = Math.hypot(b.door.x - p.x, b.door.z - p.z); if (d < bd) { bd = d; best = b; } }
  return best;
}
function rumor(c, L) {
  const W = G.world, r = new RNG(hash2(c.seed, dayOf(), npcRec(c).r = (npcRec(c).r || 0) + 1)), k = r.int(0, 6);
  if (k <= 1) { const D = r.pick(W.nearest(L.x, L.z, (l) => !l.civ, 3)); mark(D); const danger = ['Folk say it is not so bad a place', 'A careful soul might come back from it', 'It has swallowed seasoned blades', 'Few who enter are seen again', 'Only a fool or a hero would go there'][D.tier - 1]; return `There is a ${LOC_TYPES[D.type].name.toLowerCase()} called ${D.name}, ${Q.whereText(L, D)} of here. ${danger}. I have marked it on your map.`; }
  if (k === 2) { const T = r.pick(W.nearest(L.x, L.z, (l) => l.civ && l !== L, 3)); mark(T); return `Travellers came through from ${T.name} of late - a ${LOC_TYPES[T.type].name.toLowerCase()} ${Q.whereText(L, T)}. The road is ${r.pick(['quiet', 'crawling with bandits', 'muddy but passable', 'watched by wolves at night'])}, they say.`; }
  if (k === 3) { const m = MONSTERS[r.weighted(BIOMES[L.biome].wild)]; return `Mind yourself beyond the last houses. ${Q.plural(m.name)} have been seen in the ${BIOMES[L.biome].name.toLowerCase()}, bolder than ever${isNight() ? ', and worse things walk after dark' : ''}.`; }
  if (k === 4) { const f = r.pick(FORAGE[BIOMES[L.biome].id]); const I2 = INGREDIENTS[f[0]]; return `If you have an eye for herbs, ${I2.name} grows wild around here. The apothecaries pay for it - they say it is good for ${I2.fx.map((x) => ({ heal: 'wounds', mana: 'the mind', stam: 'tired legs', regen: 'mending', might: 'strength', swift: 'quick feet', stone: 'toughening the skin', night: 'seeing in the dark', feather: 'a heavy pack', cure: 'poison' }[x])).join(' and ')}.`; }
  if (k === 5) { const C = W.nearest(L.x, L.z, (l) => l.type === 'castle', 1)[0]; if (C) { const k2 = citizensOf(C, getLayout(W, C).buildings.find((b) => b.type === 'castle'))[0]; mark(C); return `King ${k2.name.split(' ')[0]} holds court at ${C.name}, ${Q.whereText(L, C)}. They say the crown pays handsomely for dangerous work.`; } }
  return r.pick(['Stone circles in the wilds whisper old lore to those who touch them. My grandmother swore by it.', 'Wayside shrines will bless a traveller once a day. Costs nothing but a moment.', 'Sleep in a proper inn bed and you learn quicker the next day. That is no rumor, that is plain sense.', 'A torch in the off hand is worth more than a shield when you cannot see the thing biting you.', 'Locked chest? The trader sells picks. Mind your fingers.', 'Ore veins show copper-bright in mines, caves and on the mountainsides. Bring a pickaxe - the good metals are never sold, only dug.', 'A smith is only as good as the patterns he knows. Blueprints turn up in old chests, and smiths sell a few.', 'You will want a sickle for herbs and a knife for pelts. Bare hands only get you berries.']);
}

// Build the conversation for an NPC entity. Returns { greeting, topics: [{label, run}] } ; run returns text, or nothing if it opened a window.
export function conversation(npc) {
  const c = npc.c, W = G.world, L = W.locs[c.loc], P = G.player, S = G.save, rec = npcRec(c), d = rec.d;
  const lay = getLayout(W, L), b = c.b >= 0 ? lay.buildings[c.b] : null, role = c.role, first = c.name.split(' ')[0];
  const keeper = b && BUILDINGS[b.type].keeper === role;
  const topics = [], T = (label, run) => topics.push({ label, run });
  const greet = d < 25 ? rnd.pick(['What do you want?', 'Make it quick.']) : d > 70 ? rnd.pick(['Ah, my friend! What can I do for you?', 'Always a pleasure. How can I help?']) : rnd.pick(['Greetings, traveller.', 'Yes?', 'Good ' + (hourOf() < 12 ? 'morning' : hourOf() < 18 ? 'day' : 'evening') + ' to you.', 'Well met.']);
  // quest hand-ins come first
  for (const t of Q.talkTopics(c, d)) T(t.label, t.run);
  const fid = F.leads(c, L);
  if (fid) T({ kingdom: '» Service to the crown', guild: '» Guild business', church: '» The work of the faith' }[F.factionDef(fid).type], () => F.business(fid, c, L));
  if (c.role === 'Priest') T('Have you tasks for the faithful?', () => { const o = Q.offersFor(L, c, 1, ['gather', 'delivery', 'supply'], 2)[0]; if (!o) return 'Not today. Come again in a day or two.'; o.faction = faithOf(L); return { text: o.desc + `\n\nThe faith can spare ${o.gold} gold, and will remember your service.`, topics: [{ label: 'I will do it', run: () => { Q.accept(o); return 'Go with our blessing.'; } }, { label: 'Not now', run: () => 'As you wish.' }] }; });
  if (keeper && ['smithy', 'trader', 'alchemist', 'arcanist', 'inn'].includes(b.type)) T('Trade', () => { G.ui.openTrade(npc, b, L); });
  if (role === 'Innkeeper') T('Rent a room (10 gold)', () => { if (S.room && S.room.key === L.id + ':' + b.i && S.room.until > G.time) return 'Your room is still paid for. Any of the guest beds, off the back hall.'; if (P.gold < 10) return 'Ten gold for the night. Come back when you have it.'; P.gold -= 10; S.room = { key: L.id + ':' + b.i, until: G.time + 86400 }; G.fn.sfx('coin'); return 'Ten gold - done. Take any guest bed off the back hall. A proper night\'s sleep mends wounds and sharpens the wits.'; });
  if (role === 'Smith') T('Repair my gear', () => { let cost = 0; const worn = P.inv.filter((it) => it.cond !== undefined && it.cond < 100); for (const it of worn) cost += Math.ceil(it.val * (100 - it.cond) / 100 * 0.35) + 1; if (!worn.length) return 'Your gear is in fine shape. Nothing for me to do.'; if (P.gold < cost) return `To put all of that right would be ${cost} gold. You are short.`; P.gold -= cost; for (const it of worn) it.cond = 100; G.fn.sfx('forge'); return `There. Good as new - ${cost} gold. You may also use my forge and anvil to smelt, forge and temper your own work.`; });
  if (role === 'Priest' || role === 'acolyte') T('I need healing', () => { const hurt = P.hp < P.maxHp() || P.poison > 0; if (!hurt) return 'You are whole and hale. Go with the blessing of the shrine.'; const cost = role === 'Priest' && !F.hasPriv(faithOf(L), 'heal') ? Math.min(P.gold, 5 + P.level * 2) : 0; if (role !== 'Priest') return 'I am not yet permitted to lay on hands. Speak with the priest.'; P.gold -= cost; P.hp = P.maxHp(); P.poison = 0; G.fn.flash('#fff', 0.5); G.fn.sfx('heal'); return `Be still... there. Your wounds are closed${cost ? ', and the shrine thanks you for your offering of ' + cost + ' gold' : ''}.`; });
  if (role === 'Guildmaster' || role === 'king') T(role === 'king' ? 'I seek work worthy of the crown' : 'Do you have work for me?', () => { G.ui.openQuestBoard(npc, L, role === 'king'); });
  if (role === 'adventurer') { const sk = SKILLS[c.seed % SKILLS.length], mfid = guildOf(L), master = F.hasPriv(mfid, 'train'); T('Train ' + sk.name, () => { const s = P.skills[sk.id], cost = Math.round(s.lvl * 9 * (master ? 0.7 : 1)); rec.t = rec.t || {}; if (s.lvl >= Math.min(SKILL_CAP, master ? 90 : 75)) return 'There is nothing more I can teach you of ' + sk.name + (master ? '.' : '. A higher rank in the guild would open the advanced lessons.'); if ((rec.t[P.level] || 0) >= (master ? 5 : 3)) return 'You have learned all you can from me for now. Come back when you are more seasoned.'; if (P.gold < cost) return `A lesson in ${sk.name} costs ${cost} gold.`; P.gold -= cost; rec.t[P.level] = (rec.t[P.level] || 0) + 1; P.gainXP(sk.id, P.xpNeed(s.lvl) - s.xp + 0.01); return `Watch closely... good. Again. Better. (${cost} gold${master ? ', member\'s rate' : ''})`; }); }
  if (Q.hasJob(c)) T('» You look like you need help', () => { const o = Q.offersFor(L, c, 1, ['delivery', 'gather', 'supply', 'slay'], 5)[0]; if (!o) return 'You have done enough for me for now. Perhaps in a few days.'; return { text: o.desc + `\n\nI can pay ${o.gold} gold.`, topics: [{ label: 'I will do it', run: () => { Q.accept(o); return 'Thank you. I will be waiting.'; } }, { label: 'Not now', run: () => 'As you wish.' }] }; });
  // ----- faction membership: officers grant what your rank has earned -----
  const mf = F.memberOf(c, L, b), officer = mf && (fid === mf || role === 'quartermaster' || (role === 'acolyte' || role === 'cleric'));
  if (mf) {
    const def = F.factionDef(mf), rk = F.rankOf(mf), has = (k) => F.hasPriv(mf, k);
    if (officer && role !== 'acolyte' && role !== 'cleric') {
      if (has('store') && (role === 'quartermaster' || role === 'steward' || role === 'Priest')) T('» ' + ({ kingdom: 'The royal armoury', guild: 'Guild stores', church: 'Temple stores' }[def.type]), () => { G.ui.openTrade(npc, b, L, { shop: F.factionStock(mf), kind: def.type === 'church' ? 'alchemist' : 'trader', disc: def.type === 'church' ? 0.6 : 0.82, title: def.name }); });
      if (has('stash') && (role === 'quartermaster' || role === 'steward')) T('» My strongbox', () => { G.ui.stash(def.name + ' Strongbox', S.stash[mf] || (S.stash[mf] = [])); });
      if ((has('stipend') || has('stipend2')) && (role === 'Guildmaster' || role === 'steward' || role === 'Priest')) T('» Collect my pay', () => { const d = F.stipendDue(mf); if (d.gold <= 0) return 'You have drawn today\'s already. Come back tomorrow.'; F.collectStipend(mf); G.fn.sfx('coin'); return `${d.days} day${d.days > 1 ? 's' : ''} at ${d.rate} gold: ${d.gold} gold, counted and signed for.`; });
      if (mf === 'blades' && has('repair')) T('» See to my gear', () => { const worn = P.inv.filter((it) => it.cond !== undefined && it.cond < 100); if (!worn.length) return 'Nothing wrong with any of it. You look after your kit - good.'; for (const it of worn) it.cond = 100; G.fn.sfx('forge'); return 'Leave it with the armourer... there. No charge for a Blade.'; });
      if (mf === 'lantern' && has('whispers')) T('» What have you heard?', () => { if (rec.wd === dayOf()) return 'Nothing new since this morning. Patience.'; const near = W.nearest(here().x, here().z, (l) => !S.discovered[l.id] && !S.known[l.id], 3); if (!near.length) return 'You have already found everything we know of.'; rec.wd = dayOf(); for (const l of near) S.known[l.id] = 1; return 'Three things, then: ' + near.map((l) => `${l.name}, a ${LOC_TYPES[l.type].name.toLowerCase()} ${Q.whereText(here(), l)}`).join('; ') + '. They are on your map.'; });
      if (def.type === 'church' && role === 'Priest' && has('bless')) T('» Give me your blessing', () => { if (S.blessDay === dayOf()) return 'You carry today\'s blessing already. Return tomorrow.'; const great = has('relic'); return { text: 'Kneel. What do you ask of the ' + def.name.replace(/^.* of the /, '') + '?', topics: [['regen', 'Mending'], ['stone', 'Protection'], ['swift', 'Swiftness'], ['resist', 'Warding'], ['might', 'Strength']].map(([fx, label]) => ({ label, run: () => { const E = EFFECTS[fx]; S.blessDay = dayOf(); P.addBuff(fx, E.base * (great ? 2.4 : 1.2) * (fx === 'might' ? 1 : 1), great ? 3600 : 1200, 'Blessing: ' + E.name); G.fn.flash('#fff', 0.5); G.fn.sfx('heal'); return 'It is given. Go, and be worthy of it.'; } })) }; });
    }
    T('Tell me about the ' + def.name, () => {
      F.fstate(mf).met = 1; const lead = F.leadership(mf), seat = F.seatOf(mf), next = F.privileges(mf).find((p) => p[0] > rk);
      if (seat && !S.discovered[seat.id]) S.known[seat.id] = 1;
      return def.ideal + (lead.length ? ` We answer to ${lead[0].name}, ${lead[0].title}${seat && seat !== L ? ', at ' + seat.name + ' - ' + Q.whereText(here(), seat) : ', here'}.` : '') + ` You stand with us as ${def.ranks[rk]}.` + (next ? ` Reach ${def.ranks[next[0]]} and you will have "${next[2]}": ${next[3]}` : ' There is no privilege we have that is not already yours.');
    });
  }
  T('Current location', () => L.civ ? `This is ${L.name}, a ${LOC_TYPES[L.type].name.toLowerCase()} of ${lay.buildings.length} buildings in the ${BIOMES[L.biome].name.toLowerCase()}.${b && b.name ? ' You stand ' + (G.space ? 'in ' : 'near ') + b.name + '.' : ''} ${' It lies in the ' + realmName(W, L) + (L.type === 'town' || L.type === 'city' || L.type === 'castle' ? ', the ' + F.factionDef(guildOf(L)).name + ' keeps the guild hall' : '') + ', and most folk here follow the ' + F.factionDef(faithOf(L)).name + '.'} ${{ farm: 'Not much to see but honest work.', village: 'Small, but we look after our own.', town: 'You will find most of what a traveller needs here.', city: 'Mind your purse in the crowds.', castle: 'The king himself keeps his court in the great castle at its heart.' }[L.type]}` : 'A grim place.');
  T('What\'s new around here?', () => { if (d < 22) return 'I have nothing to say to you.'; return rumor(c, L); });
  T('Where can I find work?', () => {
    if (Q.hasJob(c)) return 'As it happens, I could use a hand myself. Ask me about it.';
    const g = findService(L, 'guild'); if (g) { S.marker = { x: g.door.x, z: g.door.z, label: g.name }; return `The ${g.name} always has contracts - ${Q.whereText(here(), g.door)}. I have pointed it out for you.`; }
    for (const bb of lay.buildings) for (const cc of citizensOf(L, bb)) if (Q.hasJob(cc)) { S.marker = { x: bb.door.x, z: bb.door.z, label: bb.name }; return `${cc.name} was asking after a capable hand. Try ${bb.name}, ${Q.whereText(here(), bb.door)}.`; }
    const T2 = W.nearest(L.x, L.z, (l) => l.type === 'town' || l.type === 'city' || l.type === 'castle', 1)[0]; mark(T2); return `Not much work here. The guild hall in ${T2.name} would be your best hope - ${Q.whereText(L, T2)}.`;
  });
  T('Nearest city or castle?', () => {
    const C = W.nearest(L.x, L.z, (l) => l.type === 'city' && l !== L, 1)[0], K = W.nearest(L.x, L.z, (l) => l.type === 'castle' && l !== L, 1)[0]; let s = '';
    if (C) { mark(C); s += `The nearest city is ${C.name}, ${Q.whereText(L, C)}. `; } if (K) { mark(K); s += `The nearest castle is ${K.name}, ${Q.whereText(L, K)}. `; }
    return s + 'I have marked them on your map.';
  });
  T('Who are you?', () => `I am ${c.name}, ${F.titleOf(c, L, b) ? F.titleOf(c, L, b) + '. I am ' : ''}${ROLE_TEXT[role] || 'a ' + role + ' by trade'}.${role === 'Guildmaster' ? ' This hall belongs to the ' + F.factionDef(guildOf(L)).name + '.' : role === 'Priest' || role === 'acolyte' ? ' We follow the ' + F.factionDef(faithOf(L)).name + '.' : ''}${b && c.b >= 0 && !keeper && b.type !== 'castle' ? ' I live at ' + b.name + '.' : ''}${d > 65 ? ' And a friend of yours, I should hope.' : ''}`);
  if (L.civ) T('Where can I find...', () => ({ text: 'What are you looking for?', topics: [['home', 'A house to buy'], ['inn', 'An inn'], ['smithy', 'A smithy'], ['trader', 'A general trader'], ['alchemist', 'An apothecary'], ['arcanist', 'An arcanist'], ['church', 'A church'], ['guild', 'The guild hall'], ['castle', 'The castle']].filter((e) => e[0] !== 'castle' || L.type === 'castle').map(([t, label]) => ({ label, run: () => { if (t === 'home') { const own = Object.keys(S.homes).filter((k) => S.homes[k].owned).length; if (lay.home) { S.marker = { x: lay.home.door.x, z: lay.home.door.z, label: lay.home.name }; return (S.homes[L.id] || {}).owned ? 'You already own the finest house in ' + L.name + '! It is ' + Q.whereText(here(), lay.home.door) + '.' : `There is a good house standing empty, ${Q.whereText(here(), lay.home.door)}. ${HOME_PRICE[L.type]} gold, I hear - read the notice on the door.`; } const o = W.nearest(L.x, L.z, (l) => l.home && l !== L, 1)[0]; mark(o); return `Nothing for sale in ${L.name}. Houses rarely come up - there are only ${W.homes.length} to be had in all the land${own ? ', and you hold ' + own : ''}. The nearest is in ${o.name}, ${Q.whereText(L, o)}.`; } const s = findService(L, t); if (!s) { const o = W.nearest(L.x, L.z, (l) => l.civ && l !== L && getLayout(W, l).buildings.some((x) => x.type === t), 1)[0]; if (o) { mark(o); return `Not in ${L.name}, I am afraid. ${o.name} has one - ${Q.whereText(L, o)}.`; } return 'I know of none.'; } S.marker = { x: s.door.x, z: s.door.z, label: s.name }; return `${s.name}? It is ${Q.whereText(here(), s.door)}. Look for the sign - I have pointed the way for you.`; } })) }));
  T('Flatter (Persuasion)', () => {
    if ((rec.pd || -1) === dayOf() && (rec.pn || 0) >= 3) return 'Enough of that for one day.';
    if (rec.pd !== dayOf()) { rec.pd = dayOf(); rec.pn = 0; } rec.pn++;
    const ch = clamp(0.35 + P.S('persuasion') / 140 + (P.A('gui') - 4) * 0.03 - d / 400, 0.1, 0.95);
    if (rnd.chance(ch)) { rec.d = Math.min(100, d + Math.round(rnd.range(4, 9) * (1 + P.perk('charm')))); P.gainXP('persuasion', 5); return rnd.pick(['Ha! You have a way with words.', 'Well now, that is kind of you to say.', 'Flatterer. Go on, then.']) + ` (Disposition ${rec.d})`; }
    rec.d = Math.max(0, d - 4); P.gainXP('persuasion', 1.5); return rnd.pick(['Save your honey for the bees.', 'Do I look like a fool to you?', 'Hm.']) + ` (Disposition ${rec.d})`;
  });
  const title = F.titleOf(c, L, b) || (ROLE_TEXT[role] && role !== 'servant' ? role[0].toUpperCase() + role.slice(1) : '');
  return { greeting: greet, topics, title: c.name + (title ? ', ' + title : '') };
}
