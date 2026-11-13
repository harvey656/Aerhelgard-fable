// Settlement & dungeon-entrance layouts, plus the citizens who live there. All deterministic per location.
import { RNG, hash2 } from './rng.js';
import { BUILDINGS, B_DESERT, B_SWAMP, B_FOREST, DUNGEONS, GUILDS, FAITHS } from './data.js';
import { personName, shopName } from './names.js';
import { CHUNK, ckey, chunkOf } from './world.js';
import { G } from './state.js';

export const CELL = 12;
const cache = new Map();
const JOBS = ['farmer', 'weaver', 'cooper', 'hunter', 'fisher', 'mason', 'carpenter', 'baker', 'tanner', 'miller', 'scribe', 'laborer', 'merchant', 'minstrel', 'brewer', 'shepherd', 'woodcutter', 'potter', 'tailor', 'candlemaker', 'ratcatcher', 'herbalist'];
const SKINS = ['#f0c8a0', '#e0b088', '#c89068', '#a87048', '#7a5030', '#f4d4b4', '#d8a878'];
const HAIRS = ['#2a1a10', '#4a3018', '#6a4a20', '#a87830', '#d8b858', '#8a3a18', '#1a1a1a', '#b0b0b0', '#e8e8e8'];
const CLOTH = ['#6a4a30', '#7a6a48', '#4a5a38', '#5a4a5a', '#8a3a30', '#3a4a6a', '#8a7a58', '#5a6a6a', '#9a8a48', '#4a3a2a', '#6a2a3a', '#2a5a5a'];
const RICH = ['#7a1a2a', '#2a3a8a', '#5a2a7a', '#1a6a4a', '#b8902a', '#8a2a5a'];

export function getLayout(world, L) {
  let lay = cache.get(L.id);
  if (!lay || lay.world !== world) { lay = L.civ ? genCiv(world, L) : genDungeonSite(world, L); lay.world = world; index(lay); cache.set(L.id, lay); }
  return lay;
}
export function clearLayouts() { cache.clear(); }
export function clearLayout(id) { cache.delete(id); }
// Which guild keeps the hall in this settlement, and which faith its churches follow
const GIDS = Object.keys(GUILDS), FIDS = Object.keys(FAITHS);
export function guildOf(L) { const o = G.save && G.save.guildOf && G.save.guildOf[L.id]; return o || GIDS[L.guild !== undefined ? L.guild : hash2(L.id, 31, L.seed) % GIDS.length]; }
export function faithOf(L) { return FIDS[L.faith !== undefined ? L.faith : hash2(L.id, 47, L.seed) % FIDS.length]; }
export function realmName(W, L) { const C = W.locs[L.realm]; return 'Kingdom of ' + C.name.replace(/^(Castle|Fort|Hold of) /, ''); }

function mkBuilding(lay, type, x, z, w, d, h, nx, nz, extra) {
  const b = Object.assign({ i: lay.buildings.length, type, x, z, w, d, h, nx, nz, roof: 'gable', wall: 0, name: null }, extra);
  b.door = { x: x + nx * (w / 2), z: z + nz * (d / 2), nx, nz };
  lay.buildings.push(b);
  return b;
}

function genCiv(world, L) {
  const rng = new RNG(L.seed);
  const lay = { loc: L, buildings: [], walls: [], props: [], guards: [], gates: [] };
  const biome = L.biome;
  const wallSet = biome === B_DESERT ? [3] : biome === B_SWAMP ? [2, 2, 0] : biome === B_FOREST ? [0, 2, 1] : [0, 0, 1];
  const roofSet = biome === B_DESERT ? ['flat'] : biome === B_SWAMP ? ['shingle'] : L.type === 'city' || L.type === 'castle' ? ['shingle', 'slate', 'thatch'] : ['thatch', 'thatch', 'shingle'];
  const style = (b, rich) => { b.wall = rich ? (biome === B_DESERT ? 3 : 1) : rng.pick(wallSet); b.roofTex = rich && biome !== B_DESERT ? 'slate' : rng.pick(roofSet); b.roof = b.roofTex === 'flat' ? 'flat' : 'gable'; };

  if (L.type === 'farm' || L.type === 'village') {
    const n = L.count, pts = [];
    const types = [];
    if (L.type === 'farm') { types.push('farmhouse'); for (let i = 1; i < n; i++) types.push(i === n - 1 && n > 3 ? 'house' : 'barn'); }
    else {
      types.push(rng.chance(0.6) ? 'inn' : 'trader');
      if (n >= 8 && rng.chance(0.6)) types.push(types[0] === 'inn' ? 'trader' : 'inn');
      if (rng.chance(0.4)) types.push('smithy');
      if (n >= 9 && rng.chance(0.5)) types.push('church');
      while (types.length < n) types.push('house');
    }
    for (let k = 0; k < n; k++) {
      let x, z, ok = false, tries = 0;
      const R = L.r - 12;
      while (!ok && tries++ < 200) {
        const a = rng.range(0, Math.PI * 2), d = k === 0 ? rng.range(14, 22) : rng.range(16, R);
        x = Math.cos(a) * d; z = Math.sin(a) * d; ok = true;
        for (const p of pts) if (Math.abs(p[0] - x) < 17 && Math.abs(p[1] - z) < 17) { ok = false; break; }
      }
      pts.push([x, z]);
      const t = types[k], big = t !== 'house' && t !== 'barn';
      const w = big ? rng.range(10, 12) : rng.range(7, 10), d = big ? rng.range(9, 11) : rng.range(7, 9.5);
      let nx = 0, nz = 0;
      if (Math.abs(x) > Math.abs(z)) nx = x > 0 ? -1 : 1; else nz = z > 0 ? -1 : 1;
      const b = mkBuilding(lay, t, L.x + x, L.z + z, w, d, t === 'barn' ? 4.6 : t === 'church' ? 7 : big && rng.chance(0.5) ? 5.8 : 3.4, nx, nz);
      style(b, false); if (t === 'barn') { b.wall = 2; b.roofTex = 'thatch'; b.roof = 'gable'; }
    }
    lay.props.push({ type: 'well', x: L.x, z: L.z, solid: 1.2 });
    if (L.type === 'farm') for (let i = 0; i < 4; i++) lay.props.push({ type: 'hay', x: L.x + rng.range(-30, 30), z: L.z + rng.range(-30, 30), solid: 0.9 });
  } else {
    const castle = L.type === 'castle';
    // candidate building cells
    const specials = [];
    const per = (base, per100) => Math.max(base, Math.round(L.count / 100 * per100 * rng.range(0.8, 1.2)));
    if (L.type === 'town') {
      specials.push('inn', 'trader', 'smithy', 'church', 'guild');
      if (rng.chance(0.6)) specials.push('alchemist'); if (rng.chance(0.4)) specials.push('arcanist'); if (L.count > 38) specials.push('inn');
    } else {
      const add = (t, n) => { for (let i = 0; i < n; i++) specials.push(t); };
      add('inn', per(2, 1.6)); add('trader', per(2, 1.8)); add('smithy', per(1, 1.2)); add('alchemist', per(1, 0.8)); add('arcanist', per(1, 0.5)); add('church', per(1, 0.5)); add('guild', 1);
    }
    const wide = specials.filter((s) => s === 'church' || s === 'guild' || s === 'inn').length;
    const need = L.count + wide, cz = castle ? 4 : 1;
    const cand = [], lim = Math.ceil(Math.sqrt(need * 15 / 8) / (castle ? 2 : 1.6)) + cz + 4;
    for (let j = -lim; j <= lim; j++) for (let i = -lim; i <= lim; i++) {
      if (((i % 5) + 5) % 5 === 0 || ((j % 3) + 3) % 3 === 0) continue;
      if (Math.abs(i) <= cz && Math.abs(j) <= cz) continue;
      const m = castle ? Math.max(Math.abs(i), Math.abs(j)) : Math.hypot(i, j) + (hash2(i, j, L.seed) & 255) / 255 * 1.6;
      cand.push([m, i, j]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    const cells = cand.slice(0, need), cellMap = new Map();
    cells.forEach((c, k) => cellMap.set(c[1] + ',' + c[2], k));
    // specials go near the center, in shuffled order
    const assign = new Array(cells.length).fill('house');
    const pool = rng.shuffle([...Array(Math.min(cells.length, Math.max(specials.length * 3, 24))).keys()]);
    const merged = new Set();
    rng.shuffle(specials);
    for (const s of specials) {
      const k = pool.pop(); if (k === undefined) break;
      if (merged.has(k) || assign[k] !== 'house') continue;
      assign[k] = s;
    }
    let ext = 0;
    cells.forEach((c, k) => {
      if (merged.has(k)) return;
      const [, i, j] = c, t = assign[k];
      ext = Math.max(ext, Math.abs(i), Math.abs(j));
      const nz = ((j % 3) + 3) % 3 === 1 ? -1 : 1;
      let x = i * CELL, z = j * CELL, big = t !== 'house';
      let w = big ? rng.range(9.5, 11) : rng.range(7, 10.5), d = big ? rng.range(9, 10.5) : rng.range(7, 10);
      if (t === 'church' || t === 'guild' || t === 'inn') { // try to span two cells
        const k2 = cellMap.get((i + 1) + ',' + j);
        if (k2 !== undefined && assign[k2] === 'house' && !merged.has(k2) && k2 > k) { merged.add(k2); x += CELL / 2; w = rng.range(19, 22); }
      }
      z += nz * (CELL / 2 - d / 2 - 0.4); // push toward the street it faces
      const tall = t === 'church' ? 7.5 : big ? 6 : rng.chance(L.type === 'town' ? 0.3 : 0.5) ? 6 : 3.4;
      const b = mkBuilding(lay, t, L.x + x, L.z + z, w, d, tall, 0, nz);
      style(b, big && rng.chance(0.6));
    });
    if (castle) {
      const b = mkBuilding(lay, 'castle', L.x, L.z - 4, 44, 34, 15, 0, 1, { wall: 1, roof: 'castle', roofTex: 'slate' });
      b.name = 'Castle ' + L.name.replace(/^(Castle|Fort|Hold of) /, '');
      const H = ext * CELL + CELL / 2 + 14; lay.half = H;
      const T = 3, G = 5; // wall thickness, half gate width
      for (const s of [-1, 1]) {
        lay.walls.push({ x0: -H, x1: -G, z0: s * H - T / 2, z1: s * H + T / 2 }, { x0: G, x1: H, z0: s * H - T / 2, z1: s * H + T / 2 });
        lay.walls.push({ z0: -H, z1: -G, x0: s * H - T / 2, x1: s * H + T / 2 }, { z0: G, z1: H, x0: s * H - T / 2, x1: s * H + T / 2 });
        lay.gates.push({ x: 0, z: s * H, nx: 0, nz: s }, { x: s * H, z: 0, nx: s, nz: 0 });
      }
      for (const w of lay.walls) { w.x0 += L.x; w.x1 += L.x; w.z0 += L.z; w.z1 += L.z; w.h = 9; }
      for (const g of lay.gates) { g.x += L.x; g.z += L.z; }
      lay.towers = [];
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) lay.towers.push({ x: L.x + sx * H, z: L.z + sz * H, s: 8, h: 14 });
      for (const g of lay.gates) for (const s of [-1, 1]) lay.towers.push({ x: g.x + (g.nz ? s * (G + 2.5) : 0), z: g.z + (g.nx ? s * (G + 2.5) : 0), s: 5, h: 12.5 });
      for (const g of lay.gates) for (const s of [-1, 1]) lay.guards.push({ x: g.x - g.nx * 4 + (g.nz ? s * 3 : 0), z: g.z - g.nz * 4 + (g.nx ? s * 3 : 0) });
    } else {
      lay.props.push({ type: 'well', x: L.x, z: L.z, solid: 1.2 });
      for (let k = 0; k < (L.type === 'city' ? 6 : 2); k++) lay.guards.push({ x: L.x + rng.range(-1, 1) * ext * CELL * 0.6, z: L.z + Math.round(rng.range(-ext, ext) / 3) * 3 * CELL });
    }
    // street furniture: lamps at intersections, a few market stalls on the plaza
    for (let j = -ext; j <= ext; j += 3) for (let i = -ext; i <= ext; i += 5) {
      if (castle && Math.abs(i) <= cz && Math.abs(j) <= cz) continue;
      if (!castle && Math.hypot(i, j) > ext) continue;
      lay.props.push({ type: 'lamp', x: L.x + i * CELL + 4.5, z: L.z + j * CELL + 4.5, solid: 0.25 });
    }
    if (!castle) for (let k = 0; k < 3; k++) lay.props.push({ type: 'stall', x: L.x + (k - 1) * 6.5, z: L.z + (k % 2 ? 7 : -7), solid: 1.3 });
    lay.ext = ext;
  }
  // a guild that has grown its influence here flies its banners on the square
  if (G.save && G.save.guildOf && G.save.guildOf[L.id]) for (const [dx, dz] of [[-4, -3], [4, -3], [-4, 4], [4, 4]]) lay.props.push({ type: 'banner', x: L.x + dx, z: L.z + dz, solid: 0.2 });
  // names & owners
  for (const b of lay.buildings) {
    const def = BUILDINGS[b.type];
    const cs = citizensOf(L, b);
    b.pop = cs.length;
    if (b.type === 'guild') b.name = GUILDS[guildOf(L)].hall;
    else if (b.type === 'church') b.name = FAITHS[faithOf(L)].temple;
    else if (def.keeper) b.name = shopName(new RNG(hash2(L.id, b.i, 99)), b.type, cs[0].name);
    else if (!b.name) b.name = b.type === 'barn' ? 'Barn' : cs[0].name.split(' ')[1] + ' ' + (b.type === 'farmhouse' ? 'Farmhouse' : 'Residence');
  }
  return lay;
}

function genDungeonSite(world, L) {
  const rng = new RNG(L.seed);
  const lay = { loc: L, buildings: [], walls: [], props: [], guards: [], gates: [] };
  const t = L.type;
  const a = rng.int(0, 3), nx = [0, 1, 0, -1][a], nz = [1, 0, -1, 0][a];
  const dims = { crypt: [6, 7.5, 3.6], mine: [10, 10, 4.6], cave: [11, 11, 5.5], den: [9, 9, 3.8], ruin: [7, 7, 3], tower: [10, 10, 30] }[t];
  const b = mkBuilding(lay, 'dungeon', L.x, L.z, dims[0], dims[1], dims[2], nx, nz, { dtype: t, wall: t === 'ruin' ? 3 : 1, roof: t === 'tower' ? 'cone' : t === 'cave' || t === 'den' || t === 'mine' ? 'mound' : t === 'ruin' ? 'none' : 'flat', roofTex: 'slate' });
  b.name = L.name;
  if (t === 'cave' || t === 'den' || t === 'mine') { b.door.x += nx * 1.2; b.door.z += nz * 1.2; }
  const scatter = (type, n, r0, r1, solid) => { for (let i = 0; i < n; i++) { const an = rng.range(0, 6.283), d = rng.range(r0, r1); lay.props.push({ type, x: L.x + Math.cos(an) * d, z: L.z + Math.sin(an) * d, solid }); } };
  if (t === 'crypt') scatter('tomb', 9, 7, 20, 0.4);
  if (t === 'den') scatter('bones', 7, 6, 16, 0);
  if (t === 'cave') scatter('rockprop', 5, 8, 16, 1.2);
  if (t === 'mine') { scatter('cart', 2, 8, 13, 1.2); scatter('crate', 3, 7, 14, 0.6); scatter('barrel', 2, 7, 14, 0.5); scatter('rockprop', 2, 10, 16, 1.2); }
  if (t === 'ruin') { scatter('pillar', 8, 6, 18, 0.6); scatter('rubble', 5, 5, 16, 0); }
  if (t === 'tower') scatter('rubble', 3, 8, 14, 0);
  return lay;
}

function index(lay) {
  lay.byChunk = new Map();
  const add = (x, z, kind, o) => { const k = ckey(chunkOf(x), chunkOf(z)); let c = lay.byChunk.get(k); if (!c) lay.byChunk.set(k, c = { b: [], w: [], t: [], p: [] }); c[kind].push(o); };
  for (const b of lay.buildings) add(b.x, b.z, 'b', b);
  const walls = [];
  for (const w of lay.walls) { // split long walls so each piece fits in the collider neighborhood
    const horiz = w.x1 - w.x0 > w.z1 - w.z0, len = horiz ? w.x1 - w.x0 : w.z1 - w.z0, n = Math.ceil(len / 40);
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n;
      walls.push(horiz ? { x0: w.x0 + len * a, x1: w.x0 + len * b, z0: w.z0, z1: w.z1, h: w.h } : { x0: w.x0, x1: w.x1, z0: w.z0 + len * a, z1: w.z0 + len * b, h: w.h });
    }
  }
  lay.walls = walls;
  for (const w of walls) add((w.x0 + w.x1) / 2, (w.z0 + w.z1) / 2, 'w', w);
  for (const t of lay.towers || []) add(t.x, t.z, 't', t);
  for (const p of lay.props) add(p.x, p.z, 'p', p);
}

// ---------- Citizens ----------
export function makeLook(rng, female, role, biome) {
  const rich = role === 'king' || role === 'queen' || role === 'noble' || role === 'Arcanist' || role === 'Guildmaster';
  const look = {
    skin: rng.pick(SKINS), hair: rng.pick(HAIRS), hairStyle: female ? rng.pick([2, 2, 3, 1, 4]) : rng.pick([1, 1, 1, 0, 2, 5]),
    beard: !female && rng.chance(0.4) ? 1 : 0, shirt: rng.pick(rich ? RICH : CLOTH), pants: rng.pick(CLOTH), skirt: female && rng.chance(0.75) ? 1 : 0,
    build: rng.range(0.92, 1.1), hat: rng.chance(0.14) ? 1 : 0, female: female ? 1 : 0,
  };
  if (biome === B_DESERT && rng.chance(0.6)) { look.hood = 1; look.shirt = rng.pick(['#d8c8a0', '#c8b088', '#e8e0c8', '#a88858']); }
  if (role === 'Smith') { look.apron = '#3a2a20'; look.build = 1.15; }
  if (role === 'Innkeeper' || role === 'Trader' || role === 'Apothecary') look.apron = role === 'Apothecary' ? '#3a5a3a' : '#d8d0b8';
  if (role === 'Priest' || role === 'acolyte') { look.robe = role === 'Priest' ? '#e8e0c8' : '#8a7a58'; look.hat = 0; }
  if (role === 'Arcanist') { look.robe = rng.pick(['#283a78', '#4a2a6a', '#1a4a4a']); look.hat = 2; }
  if (role === 'guard') { look.armor = '#8a8a92'; look.helm = 1; look.weapon = 'spear'; look.tabard = rng.pick(RICH); look.build = 1.1; }
  if (role === 'king' || role === 'queen') { look.crown = 1; look.robe = role === 'king' ? '#7a1a2a' : '#2a3a8a'; look.hat = 0; if (role === 'queen') look.hairStyle = 2; else look.beard = 1; }
  if (role === 'noble') look.robe = look.shirt;
  return look;
}

const ccache = new Map();
export function citizensOf(L, b) {
  const key = L.id * 4096 + b.i;
  let list = ccache.get(key);
  if (list) return list;
  const rng = new RNG(hash2(L.id, b.i, L.seed ^ 0xc171));
  list = [];
  const add = (role, female) => {
    const f = female === undefined ? rng.chance(0.5) : female;
    const c = { id: L.id + ':' + b.i + ':' + list.length, loc: L.id, b: b.i, n: list.length, name: personName(rng, f), female: f, role, seed: rng.int(1, 1e9) };
    c.look = makeLook(new RNG(c.seed), f, role, L.biome);
    list.push(c); return c;
  };
  const def = BUILDINGS[b.type];
  if (b.type === 'castle') {
    add('king', false); add('queen', true); list[1].name = list[1].name.split(' ')[0] + ' ' + list[0].name.split(' ')[1];
    add('steward'); for (let i = 0; i < 6; i++) add('guard', false); for (let i = 0; i < 5; i++) add('noble');
    for (let i = 0; i < 3; i++) add('servant');
  } else if (def.keeper) {
    add(def.keeper);
    if (b.type === 'inn') { add('server'); add('cook'); }
    else if (b.type === 'guild') { const n = rng.int(4, 6); for (let i = 0; i < n; i++) add('adventurer'); }
    else if (b.type === 'church') add('acolyte');
    else if (rng.chance(0.5)) add('apprentice');
  } else if (b.type === 'barn') add('farmhand');
  else {
    const n = b.type === 'farmhouse' ? rng.int(2, 4) : rng.weighted([[1, 3], [2, 4], [3, 2]]);
    const sur = personName(rng, false).split(' ')[1];
    for (let i = 0; i < n; i++) { const c = add(b.type === 'farmhouse' ? 'farmer' : rng.pick(JOBS)); if (i < 2) c.name = c.name.split(' ')[0] + ' ' + sur; }
  }
  ccache.set(key, list);
  return list;
}
export function clearCitizens() { ccache.clear(); }
export function citizenById(world, id) {
  const [l, b, n] = id.split(':').map(Number);
  const L = world.locs[l], lay = getLayout(world, L);
  if (b < 0) return guardCitizen(L, n);
  return citizensOf(L, lay.buildings[b])[n];
}
export function guardCitizen(L, n) {
  const rng = new RNG(hash2(L.id, n, 0x60a2d));
  const f = rng.chance(0.25);
  const c = { id: L.id + ':-1:' + n, loc: L.id, b: -1, n, name: personName(rng, f), female: f, role: 'guard', seed: rng.int(1, 1e9) };
  c.look = makeLook(new RNG(c.seed), f, 'guard', L.biome);
  return c;
}
// Where a citizen is at a given hour: 'home' (inside own building), 'out' (on the streets), 'inn'
export function whereabouts(c, hour) {
  const r = c.role;
  if (r === 'guard' && c.b < 0) return 'out';
  if (G.homebound && G.homebound.has(c.id) && r !== 'farmhand') return 'home';
  if (BUILDINGS_KEEPERS.has(r) || r === 'king' || r === 'queen' || r === 'steward' || r === 'guard' || r === 'server' || r === 'cook' || r === 'acolyte') return 'home';
  const o = (c.seed % 100) / 100;
  if (hour < 6 + o || hour >= 21 + o) return 'home';
  if (hour >= 18 + o && c.seed % 3 === 0) return 'inn';
  if (r === 'adventurer' || r === 'noble' || r === 'servant' || r === 'apprentice') return (c.seed >> 3) % 4 === 0 && hour > 11 && hour < 15 ? 'out' : 'home';
  return c.seed % 3 === 1 && hour > 12 + o && hour < 13.5 + o ? 'home' : 'out';
}
const BUILDINGS_KEEPERS = new Set(Object.values(BUILDINGS).map((b) => b.keeper).filter(Boolean));
export const isDungeonType = (t) => !!DUNGEONS[t];
