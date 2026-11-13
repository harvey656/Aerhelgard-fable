// Quest generation, tracking and completion. Side contracts are a single objective;
// main faction missions (q.main) are a chain of objectives in q.steps.
import { RNG, hash2, rnd, clamp } from './rng.js';
import { BIOMES, MONSTERS, INGREDIENTS, FORAGE, DUNGEONS, DEN_MOBS, LOC_TYPES } from './data.js';
import { G, dayOf } from './state.js';
import { getLayout, citizensOf } from './settlement.js';
import { mkMisc } from './items.js';

export const RANKS = [[0, 'Novice'], [3, 'Associate'], [7, 'Journeyman'], [12, 'Veteran'], [20, 'Champion'], [35, 'Legend']];
export function rankName() { let n = RANKS[0][1]; for (const [k, t] of RANKS) if (G.save.rep >= k) n = t; return n; }
export const plural = (n) => (/f$/.test(n) ? n.slice(0, -1) + 'ves' : /(ch|s|x)$/.test(n) ? n + 'es' : /[^aeiou]y$/.test(n) ? n.slice(0, -1) + 'ies' : n + 's');
export function dirName(dx, dz) { const a = Math.atan2(dx, -dz), i = Math.round(a / (Math.PI / 4)); return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][(i + 8) % 8]; }
export function distText(d) { return d < 1000 ? 'about ' + Math.max(10, Math.round(d / 10) * 10) + ' paces' : (d / 1000).toFixed(1) + ' km'; }
export function whereText(from, to) { return distText(Math.hypot(to.x - from.x, to.z - from.z)) + ' to the ' + dirName(to.x - from.x, to.z - from.z); }
export function bossOf(D) { const den = D.type === 'den' ? DEN_MOBS[D.biome] : null; return den ? den.boss : DUNGEONS[D.type].boss[(D.seed >>> 4) % DUNGEONS[D.type].boss.length]; }

const RELICS = ['Chalice', 'Signet Ring', 'Reliquary', 'Idol', 'Crown', 'Grimoire', 'Sceptre', 'Family Sword', 'Urn of Ashes', 'Star Chart', 'Golden Mask'];
const ADJ = ['Lost', 'Silver', 'Ancestral', 'Stolen', 'Gilded', 'Sacred', 'Old', 'Jeweled'];

// The objective currently being worked on: the quest itself for side contracts, the current step for main missions.
export function cur(q) { return q.steps ? q.steps[q.step] || null : q; }
const kindOf = (q, o) => o.kind || q.type;

// Deterministic side-contract offer for a giver.
export function makeOffer(L, giver, seed, kinds) {
  const W = G.world, rng = new RNG(seed), type = rng.pick(kinds);
  const mult = (1 + Math.min(1, G.save.rep * 0.04)) * (1 + G.player.perk('questGold'));
  const q = { key: giver.id + ':' + seed, type, giver: { id: giver.id, name: giver.name, loc: L.id }, state: 'offer' };
  if (type === 'delivery') {
    const locs = W.locs.filter((l) => l.civ && l !== L).map((l) => [Math.hypot(l.x - L.x, l.z - L.z), l]).filter((e) => e[0] < 10000).sort((a, b) => a[0] - b[0]).slice(0, 6);
    if (!locs.length) return null;
    const [d, T] = rng.pick(locs), lay = getLayout(W, T), b = rng.pick(lay.buildings.filter((x) => x.type !== 'barn' && x.type !== 'castle')), c = citizensOf(T, b)[0];
    Object.assign(q, { title: 'Parcel for ' + c.name, target: { id: c.id, name: c.name, loc: T.id, b: b.i, bname: b.name }, tloc: T.id, gold: Math.round((35 + d / 60) * mult),
      desc: `Carry a sealed parcel to ${c.name} at ${b.name} in ${T.name}, ${whereText(L, T)} of ${L.name}. The recipient will pay you on delivery.` });
  } else if (type === 'fetch' || type === 'bounty') {
    const ds = W.nearest(L.x, L.z, (l) => !l.civ, 4); const D = rng.pick(ds);
    if (!D || Math.hypot(D.x - L.x, D.z - L.z) > 12000) return null;
    if (type === 'fetch') { const item = rng.pick(ADJ) + ' ' + rng.pick(RELICS); Object.assign(q, { title: 'The ' + item, dungeon: D.id, tloc: D.id, item, gold: Math.round((70 + D.tier * 55) * mult), desc: `Recover the ${item} from ${D.name}, a ${LOC_TYPES[D.type].name.toLowerCase()} ${whereText(L, D)} of ${L.name}. It rests in the deepest chamber. Bring it back to ${giver.name}.` }); }
    else { const bid = bossOf(D); Object.assign(q, { title: 'Bounty: ' + MONSTERS[bid].name, dungeon: D.id, tloc: D.id, boss: bid, gold: Math.round((90 + D.tier * 75) * mult), desc: `A ${MONSTERS[bid].name} lairs in ${D.name}, ${whereText(L, D)} of ${L.name}. Slay it and report to ${giver.name}.` }); }
  } else if (type === 'slay') {
    const table = BIOMES[L.biome].wild.filter((m) => MONSTERS[m[0]].lvl <= G.player.level * 1.3 + 2.5); if (!table.length) return null;
    const m = rng.weighted(table), need = rng.int(3, 6);
    Object.assign(q, { title: 'Cull the ' + plural(MONSTERS[m].name), monster: m, need, count: 0, gold: Math.round(need * (12 + MONSTERS[m].lvl * 7) * mult), desc: `${plural(MONSTERS[m].name)} have been troubling the roads around ${L.name}. Kill ${need} of them in the wilds and return to ${giver.name}.` });
  } else if (type === 'gather') {
    const f = rng.pick(FORAGE[BIOMES[L.biome].id]), need = rng.int(4, 8);
    Object.assign(q, { title: 'Gather ' + INGREDIENTS[f[0]].name, sk: 'i:' + f[0], need, label: INGREDIENTS[f[0]].name, gold: Math.round((18 + need * (6 + INGREDIENTS[f[0]].val)) * mult), desc: `${giver.name} needs ${need} ${INGREDIENTS[f[0]].name}. It grows wild in the ${BIOMES[L.biome].name.toLowerCase()} nearby.` });
  } else {
    const opt = rng.pick([['p:heal', 'Potion of Restore Health', 2, 90, 'Any strength will not do - bring ordinary healing draughts.'], ['ingot:0', 'Iron Ingot', 3, 70, 'Smelt them from ore or buy them, I care not.'], ['i:pelt', 'Beast Pelt', 4, 80, 'Wolves and boars carry fine ones.'], ['m:arrow', 'Arrow', 30, 60, 'The watch is running short.']]);
    Object.assign(q, { type: 'supply', title: 'Supply: ' + opt[2] + ' ' + opt[1] + 's', skPrefix: opt[0], need: opt[2], label: opt[1], gold: Math.round(opt[3] * mult), desc: `${giver.name} will pay well for ${opt[2]} ${opt[1]}s. ${opt[4]}` });
  }
  return q;
}
export function offersFor(L, giver, n, kinds, epochDays = 3) {
  const ep = Math.floor(dayOf() / epochDays), out = [];
  for (let i = 0; i < n; i++) {
    const seed = hash2(ep, i, hash2(L.id, giver.b, giver.n + 7));
    if (G.save.taken[giver.id + ':' + seed]) continue;
    const q = makeOffer(L, giver, seed, kinds); if (q && !out.some((o) => o.title === q.title || (o.type === q.type && o.dungeon !== undefined && o.dungeon === q.dungeon))) out.push(q);
  }
  return out;
}
export function hasJob(c) { return c.seed % 7 === 0 && !['king', 'queen', 'guard', 'Guildmaster', 'steward', 'Priest'].includes(c.role); }

// Called when an objective becomes the current one: hand over parcels, mark the map.
function enterStep(q) {
  const o = cur(q), S = G.save; if (!o) { homebound(); return; }
  if (kindOf(q, o) === 'delivery') { const p = mkMisc('parcel'); p.name = o.itemName || 'Parcel for ' + o.target.name; p.quest = q.id; p.step = q.steps ? q.step : 0; G.player.addItem(p); }
  const t = questTarget(q); if (t && !S.discovered[t.id]) S.known[t.id] = 1;
  homebound();
}
export function accept(q) {
  const S = G.save; q.id = ++S.qid; q.state = 'active'; q.day = dayOf(); if (q.key) S.taken[q.key] = 1; S.quests.push(q); S.tracked = q.id;
  enterStep(q);
  G.fn.msg((q.main ? 'Main mission accepted: ' : 'Quest accepted: ') + q.title, 'quest'); G.fn.sfx('quest');
}
function countFor(o) { const P = G.player; if (o.sk) return P.count(o.sk); let n = 0; for (const it of P.inv) if (it.sk && it.sk.startsWith(o.skPrefix)) n += it.qty || 1; return n; }
function takeFor(o) { const P = G.player; if (o.sk) return P.consume(o.sk, o.need); let n = o.need; for (const it of P.inv.slice()) if (n > 0 && it.sk && it.sk.startsWith(o.skPrefix)) { const k = Math.min(n, it.qty || 1); P.removeItem(it, k); n -= k; } }
function objText(q, o) {
  const W = G.world, k = kindOf(q, o), at = (t) => t.name + ' in ' + W.locs[t.loc].name;
  if (k === 'talk') return 'Speak with ' + at(o.target) + '.';
  if (k === 'delivery') return 'Deliver ' + (o.itemName ? 'the ' + o.itemName : 'the parcel') + ' to ' + at(o.target) + '.';
  if (k === 'fetch') return o.have ? 'Return the ' + o.item + ' to ' + q.giver.name + '.' : 'Find the ' + o.item + ' in ' + W.locs[o.dungeon].name + '.';
  if (k === 'bounty') return o.killed ? 'Report to ' + q.giver.name + '.' : 'Slay ' + (o.bossName || 'the ' + MONSTERS[o.boss].name) + ' in ' + W.locs[o.dungeon].name + '.';
  if (k === 'slay') return o.count >= o.need ? 'Report to ' + q.giver.name + '.' : plural(MONSTERS[o.monster].name) + ' slain: ' + o.count + '/' + o.need;
  const have = countFor(o), to = o.target ? at(o.target) : q.giver.name;
  return o.label + ': ' + Math.min(o.need, have) + '/' + o.need + (have >= o.need || o.target ? ' - bring to ' + to : '');
}
export function progressText(q) {
  if (q.state === 'done') return 'Completed.';
  const o = cur(q); if (!o) return 'Report to ' + q.giver.name + ' in ' + G.world.locs[q.giver.loc].name + '.';
  return (q.steps ? '(' + (q.step + 1) + '/' + q.steps.length + ') ' : '') + objText(q, o);
}
function objDone(q, o) { const k = kindOf(q, o); if (k === 'fetch') return !!o.have; if (k === 'bounty') return !!o.killed; if (k === 'slay') return o.count >= o.need; return false; }
export function ready(q) {
  if (q.steps) return q.step >= q.steps.length;
  if (q.type === 'gather' || q.type === 'supply') return countFor(q) >= q.need;
  return objDone(q, q);
}
// Main missions move on by themselves once the current objective is satisfied.
export function advance(q) {
  if (!q.steps || q.state !== 'active') return;
  let moved = false;
  while (q.step < q.steps.length && objDone(q, q.steps[q.step])) { q.step++; moved = true; enterStep(q); }
  if (moved) { G.fn.msg(q.title + ': ' + progressText(q), 'quest'); G.fn.sfx('quest'); }
}
function nextStep(q) { q.step++; enterStep(q); advance(q); G.fn.sfx('quest'); }
// where the player should head next for this quest
export function questTarget(q) {
  const W = G.world, o = cur(q);
  if (!o) return W.locs[q.giver.loc];
  const k = kindOf(q, o);
  if (k === 'talk' || k === 'delivery') return W.locs[o.target.loc];
  if ((k === 'fetch' && !o.have) || (k === 'bounty' && !o.killed)) return W.locs[o.dungeon];
  if (k === 'slay' && o.count < o.need) return null;
  if ((k === 'gather' || k === 'supply')) { if (countFor(o) < o.need) return null; return o.target ? W.locs[o.target.loc] : W.locs[q.giver.loc]; }
  return W.locs[q.giver.loc];
}
export function complete(q, bonus = 1) {
  const P = G.player, S = G.save;
  if (!q.steps && (q.type === 'gather' || q.type === 'supply')) takeFor(q);
  for (const it of P.inv.filter((i) => i.quest === q.id)) P.removeItem(it, it.qty || 1);
  const gold = Math.round(q.gold * bonus);
  P.gold += gold; q.state = 'done'; S.rep++; if (S.tracked === q.id) S.tracked = (S.quests.find((x) => x.state === 'active') || {}).id || 0;
  P.gainXP('persuasion', q.main ? 10 : 6); homebound();
  G.fn.msg((q.main ? 'Main mission completed: ' : 'Quest completed: ') + q.title + '  (+' + gold + ' gold)', 'quest'); G.fn.banner(q.main ? 'Mission Completed' : 'Quest Completed'); G.fn.sfx('quest');
  if (RANKS.some((r) => r[0] === S.rep)) G.fn.msg('Word of your deeds spreads: you are known as a ' + rankName() + '.', 'perk');
  if (q.faction) G.fn.factionCredit(q);
  return gold;
}
export function onKill(m) {
  for (const q of G.save.quests) {
    if (q.state !== 'active') continue; const o = cur(q); if (!o) continue; const k = kindOf(q, o);
    if (k === 'slay' && o.monster === m.id && o.count < o.need) { o.count++; G.fn.msg(q.title + ': ' + o.count + '/' + o.need, 'quest'); }
    if (k === 'bounty' && m.def.boss && G.space && G.space.loc.id === o.dungeon && m.id === o.boss) { o.killed = true; if (!q.steps) G.fn.msg('Bounty fulfilled. Return to ' + q.giver.name + '.', 'quest'); }
    advance(q);
  }
}
// Picking up a quest relic from its pedestal
export function takeRelic(qid) {
  const q = G.save.quests.find((x) => x.id === qid), o = q && cur(q); if (!o || kindOf(q, o) !== 'fetch') return;
  o.have = true; const it = mkMisc('relic'); it.name = o.item; it.quest = q.id; G.player.addItem(it);
  G.fn.msg('You take the ' + o.item + '.' + (q.steps ? '' : ' Return it to ' + q.giver.name + '.'), 'quest'); G.fn.sfx('quest'); advance(q);
}
// The dungeon objective (fetch or bounty) active for a location, if any
export function dungeonObjectives(locId) { const out = []; for (const q of G.save.quests) { if (q.state !== 'active') continue; const o = cur(q); if (o && o.dungeon === locId) out.push({ q, o, kind: kindOf(q, o) }); } return out; }

// Conversation topics a citizen offers because of active quests.
export function talkTopics(c, disposition) {
  const out = [], P = G.player;
  for (const q of G.save.quests) {
    if (q.state !== 'active') continue; const o = cur(q);
    if (o && o.target && o.target.id === c.id) {
      const k = kindOf(q, o);
      if (k === 'talk') out.push({ label: '» ' + (o.topic || q.title), run: () => { nextStep(q); return o.say || 'I see. Thank you for telling me.'; } });
      else if (k === 'delivery') out.push({ label: '» Deliver ' + (o.itemName ? 'the ' + o.itemName : 'the parcel'), run: () => {
        if (!q.steps) { complete(q, 1); return `For me? At last! Here is your payment, ${q.gold} gold, as agreed. My thanks.`; }
        const it = P.inv.find((i) => i.quest === q.id && i.type === 'quest' && i.id === 'parcel'); if (it) P.removeItem(it); nextStep(q); return o.say || 'I have been expecting this. My thanks.'; } });
      else if (k === 'gather' || k === 'supply') out.push({ label: '» I have the ' + plural(o.label), run: () => { if (countFor(o) < o.need) return 'I need ' + o.need + ' of them. You have ' + countFor(o) + '.'; takeFor(o); nextStep(q); return o.say || 'This is exactly what was needed. Bless you.'; } });
    }
    if (q.giver.id === c.id) {
      if (o && q.steps && !o.target && (kindOf(q, o) === 'gather' || kindOf(q, o) === 'supply')) out.push({ label: '» I have the ' + plural(o.label), run: () => { if (countFor(o) < o.need) return 'I need ' + o.need + ' of them. You have ' + countFor(o) + '.'; takeFor(o); nextStep(q); return o.say || 'Good. That is the first part done.'; } });
      else out.push({ label: '» About "' + q.title + '"', run: () => { if (ready(q)) { const g = complete(q, !q.main && disposition > 65 ? 1.1 : 1); return (q.doneText || 'Well done! I knew you had it in you.') + ` (${g} gold)`; } return 'Not finished yet? ' + progressText(q); } });
    }
  }
  return out;
}
// People involved in active quests stay where they can be found
export function homebound() { const s = G.homebound = new Set(); for (const q of G.save.quests) if (q.state === 'active') { s.add(q.giver.id); const o = cur(q); if (o && o.target) s.add(o.target.id); } }
