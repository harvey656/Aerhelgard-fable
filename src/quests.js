// Quest generation, tracking and completion.
import { RNG, hash2, rnd, clamp } from './rng.js';
import { BIOMES, MONSTERS, INGREDIENTS, FORAGE, DUNGEONS, DEN_MOBS, LOC_TYPES } from './data.js';
import { G, dayOf } from './state.js';
import { getLayout, citizensOf } from './settlement.js';
import { mkMisc } from './items.js';
import { dungeonFloors } from './interior.js';

export const RANKS = [[0, 'Novice'], [3, 'Associate'], [7, 'Journeyman'], [12, 'Veteran'], [20, 'Champion'], [35, 'Legend']];
export function rankName() { let n = RANKS[0][1]; for (const [k, t] of RANKS) if (G.save.rep >= k) n = t; return n; }
export const plural = (n) => (/f$/.test(n) ? n.slice(0, -1) + 'ves' : /(ch|s|x)$/.test(n) ? n + 'es' : /[^aeiou]y$/.test(n) ? n.slice(0, -1) + 'ies' : n + 's');
export function dirName(dx, dz) { const a = Math.atan2(dx, -dz), i = Math.round(a / (Math.PI / 4)); return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][(i + 8) % 8]; }
export function distText(d) { return d < 1000 ? 'about ' + Math.max(10, Math.round(d / 10) * 10) + ' paces' : (d / 1000).toFixed(1) + ' km'; }
export function whereText(from, to) { return distText(Math.hypot(to.x - from.x, to.z - from.z)) + ' to the ' + dirName(to.x - from.x, to.z - from.z); }

const RELICS = ['Chalice', 'Signet Ring', 'Reliquary', 'Idol', 'Crown', 'Grimoire', 'Sceptre', 'Family Sword', 'Urn of Ashes', 'Star Chart', 'Golden Mask'];
const ADJ = ['Lost', 'Silver', 'Ancestral', 'Stolen', 'Gilded', 'Sacred', 'Old', 'Jeweled'];

// Deterministic quest offer for a giver. kind may be forced.
export function makeOffer(L, giver, seed, kinds) {
  const W = G.world, rng = new RNG(seed), type = rng.pick(kinds);
  const mult = (1 + Math.min(1, G.save.rep * 0.04)) * (1 + G.player.perk('questGold'));
  const q = { key: giver.id + ':' + seed, type, giver: { id: giver.id, name: giver.name, loc: L.id }, state: 'offer' };
  if (type === 'delivery') {
    const locs = W.locs.filter((l) => l.civ && l !== L).map((l) => [Math.hypot(l.x - L.x, l.z - L.z), l]).filter((e) => e[0] < 10000).sort((a, b) => a[0] - b[0]).slice(0, 5);
    if (!locs.length) return null;
    const [d, T] = rng.pick(locs), lay = getLayout(W, T), b = rng.pick(lay.buildings.filter((x) => x.type !== 'barn' && x.type !== 'castle')), c = citizensOf(T, b)[0];
    Object.assign(q, { title: 'Parcel for ' + c.name, target: { id: c.id, name: c.name, loc: T.id, b: b.i, bname: b.name }, tloc: T.id, gold: Math.round((35 + d / 60) * mult),
      desc: `Carry a sealed parcel to ${c.name} at ${b.name} in ${T.name}, ${whereText(L, T)} of ${L.name}. The recipient will pay you on delivery.` });
  } else if (type === 'fetch' || type === 'bounty') {
    const ds = W.nearest(L.x, L.z, (l) => !l.civ, 4); const D = rng.pick(ds);
    if (!D || Math.hypot(D.x - L.x, D.z - L.z) > 12000) return null;
    if (type === 'fetch') { const item = rng.pick(ADJ) + ' ' + rng.pick(RELICS); Object.assign(q, { title: 'The ' + item, dungeon: D.id, tloc: D.id, item, gold: Math.round((70 + D.tier * 55) * mult), desc: `Recover the ${item} from ${D.name}, a ${LOC_TYPES[D.type].name.toLowerCase()} ${whereText(L, D)} of ${L.name}. It rests in the deepest chamber. Bring it back to ${giver.name}.` }); }
    else { const den = D.type === 'den' ? DEN_MOBS[D.biome] : null, bid = den ? den.boss : DUNGEONS[D.type].boss[(D.seed >>> 4) % DUNGEONS[D.type].boss.length]; Object.assign(q, { title: 'Bounty: ' + MONSTERS[bid].name, dungeon: D.id, tloc: D.id, boss: bid, gold: Math.round((90 + D.tier * 75) * mult), desc: `A ${MONSTERS[bid].name} lairs in ${D.name}, ${whereText(L, D)} of ${L.name}. Slay it and report to ${giver.name}.` }); }
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
export function hasJob(c) { return c.seed % 7 === 0 && !['king', 'queen', 'guard', 'Guildmaster'].includes(c.role); }

export function accept(q) {
  const S = G.save; q.id = ++S.qid; q.state = 'active'; q.day = dayOf(); S.taken[q.key] = 1; S.quests.push(q); S.tracked = q.id;
  if (q.type === 'delivery') { const p = mkMisc('parcel'); p.name = 'Parcel for ' + q.target.name; p.quest = q.id; G.player.addItem(p); }
  if (q.tloc !== undefined) S.known[q.tloc] = 1;
  homebound();
  G.fn.msg('Quest accepted: ' + q.title, 'quest'); G.fn.sfx('quest');
}
export function progressText(q) {
  const P = G.player;
  if (q.state === 'done') return 'Completed.';
  if (q.type === 'delivery') return 'Deliver the parcel to ' + q.target.name + ' in ' + G.world.locs[q.target.loc].name + '.';
  if (q.type === 'fetch') return q.have ? 'Return the ' + q.item + ' to ' + q.giver.name + '.' : 'Find the ' + q.item + ' in ' + G.world.locs[q.dungeon].name + '.';
  if (q.type === 'bounty') return q.killed ? 'Report to ' + q.giver.name + '.' : 'Slay the ' + MONSTERS[q.boss].name + ' in ' + G.world.locs[q.dungeon].name + '.';
  if (q.type === 'slay') return q.count >= q.need ? 'Report to ' + q.giver.name + '.' : plural(MONSTERS[q.monster].name) + ' slain: ' + q.count + '/' + q.need;
  return q.label + ': ' + Math.min(q.need, countFor(q)) + '/' + q.need + (countFor(q) >= q.need ? ' - return to ' + q.giver.name : '');
}
function countFor(q) { const P = G.player; if (q.sk) return P.count(q.sk); let n = 0; for (const it of P.inv) if (it.sk && it.sk.startsWith(q.skPrefix)) n += it.qty || 1; return n; }
export function ready(q) {
  if (q.type === 'fetch') return !!q.have; if (q.type === 'bounty') return !!q.killed; if (q.type === 'slay') return q.count >= q.need;
  if (q.type === 'gather' || q.type === 'supply') return countFor(q) >= q.need; return false;
}
// where the player should head next for this quest
export function questTarget(q) {
  const W = G.world;
  if (q.type === 'delivery') return W.locs[q.target.loc];
  if ((q.type === 'fetch' && !q.have) || (q.type === 'bounty' && !q.killed)) return W.locs[q.dungeon];
  if (q.type === 'slay' && q.count < q.need) return null;
  return W.locs[q.giver.loc];
}
export function complete(q, bonus = 1) {
  const P = G.player, S = G.save;
  if (q.type === 'gather') P.consume(q.sk, q.need);
  if (q.type === 'supply') { let n = q.need; for (const it of P.inv.slice()) if (n > 0 && it.sk && it.sk.startsWith(q.skPrefix)) { const k = Math.min(n, it.qty || 1); P.removeItem(it, k); n -= k; } }
  if (q.type === 'fetch' || q.type === 'delivery') { const it = P.inv.find((i) => i.quest === q.id); if (it) P.removeItem(it); }
  const gold = Math.round(q.gold * bonus);
  P.gold += gold; q.state = 'done'; S.rep++; if (S.tracked === q.id) S.tracked = (S.quests.find((x) => x.state === 'active') || {}).id || 0;
  P.gainXP('persuasion', 6); homebound();
  G.fn.msg('Quest completed: ' + q.title + '  (+' + gold + ' gold)', 'quest'); G.fn.banner('Quest Completed'); G.fn.sfx('quest');
  const before = rankName(); if (RANKS.some((r) => r[0] === S.rep)) G.fn.msg('Your standing with the guilds rises: ' + before + '.', 'perk');
  return gold;
}
export function onKill(m) {
  for (const q of G.save.quests) {
    if (q.state !== 'active') continue;
    if (q.type === 'slay' && q.monster === m.id && q.count < q.need) { q.count++; G.fn.msg(q.title + ': ' + q.count + '/' + q.need, 'quest'); }
    if (q.type === 'bounty' && m.def.boss && G.space && G.space.loc.id === q.dungeon && m.id === q.boss) { q.killed = true; G.fn.msg('Bounty fulfilled. Return to ' + q.giver.name + '.', 'quest'); }
  }
}
export function activeFor(citizenId) { return G.save.quests.filter((q) => q.state === 'active' && q.giver.id === citizenId); }
export function deliveriesFor(citizenId) { return G.save.quests.filter((q) => q.state === 'active' && q.type === 'delivery' && q.target.id === citizenId); }
// People involved in active quests stay where they can be found
export function homebound() { const s = G.homebound = new Set(); for (const q of G.save.quests) if (q.state === 'active') { s.add(q.giver.id); if (q.target) s.add(q.target.id); } }
