# Aerhelgard

A first-person, 3D, procedurally generated open-world sim RPG in the style of early-90s PC role-playing games.
It runs in the browser with no build step: everything — terrain, towns, citizens, dungeons, textures, sprites,
icons and sound effects — is generated at runtime from a world seed.

## Running

```
npm start          # serves the folder at http://localhost:8080
```

Any static file server works (the game uses ES modules, so it must be served over http rather than opened
from disk). `http://localhost:8080/?dev=<seed>` skips the menus and drops a test character into the world.

## Controls

| Key | Action | Key | Action |
| --- | --- | --- | --- |
| W A S D | Move | Tab / I | Inventory |
| Mouse / arrow keys | Look / turn | C | Character sheet & perks |
| Shift | Sprint | M | World map & fast travel |
| Space | Jump | J | Journal |
| X | Sneak | B | Spellbook |
| Left mouse (or F) | Attack, hold to draw a bow | R | Rest / wait |
| Right mouse (or G) | Block, or off-hand attack | 1–4 | Quick slots |
| Q | Cast readied spell | F5 / F9 | Quick-save / quick-load |
| E | Interact, talk, take all | Esc | Menu |

## The game

**Character.** Five abilities (Well-being, Power, Intellect, Willpower, Guile) start at 4 with 6 points to
spend. Seventeen skills start at 20 with 200 points to distribute. Skills rise only by use — swing a short
sword to train Short Blades, get hit in armor to train it, pick locks, brew, forge, haggle. Every 25 levels
of a skill unlocks a perk (68 in all). Every eight skill-ups is a character level and an ability point.
Carry weight is 25 lb per point of Power (100 lb at Power 4).

**Inventory.** Head, body, arms, legs and feet armor; left and right hand; belt, amulet and two rings.
Items have weight, value, condition, material tier, quality and enchantments. Two-handed weapons, shields,
dual wielding, torches, stacking, quick slots, item comparison, dropping, containers.

**World.** A 48 × 48 km continent divided into large biome regions (forest, desert, plains, mountains,
swamp), each with its own palette, fog, lighting, flora, forage and monsters. Nearly 900 locations are placed
with at least 650 m between their edges (typically about a kilometre to the nearest neighbour): farms (2–5 buildings), villages (5–15), towns (20–50), cities
(100–500) and walled castle-cities (500–1000 around a great castle, four gates), plus crypts, caves, monster
dens, ruins and towers. Terrain streams in seamlessly around the player; roads link the settlements; wayshrines,
standing stones, bandit camps, abandoned carts, ore outcrops and mushroom rings dot the wilds.

**Citizens.** Every building has at least one named resident with a unique look and a daily routine
(home, streets, the inn in the evening). Ask them about the current location, what's new, the nearest work,
the nearest city and castle, who they are, and where to find any service — they point it out on your compass
and mark distant places on your map.

**Interiors.** Smithies (8 rooms, forge and anvil), inns (12 rooms, rent a bed), general traders (5 rooms),
apothecaries, arcanists, guild halls (contracts, trainers), churches (healing), castles (22 rooms, king and
queen in the great hall) and homes. Enter through the front door.

**Quests.** Parcel deliveries to other settlements, relic recovery from dungeons, bounties on dungeon
bosses, culling monsters, foraging, and supply contracts. Guild standing improves pay.

**Also.** Real-time melee, archery and three schools of magic; lock-picking minigame; alchemy from shared
ingredient effects; smelting, forging, tempering and repair; mining; day/night cycle; resting and ambushes;
a full-scale map with fog of war, auto-pins and town plans; fast travel to visited places; save slots.

**Graphics options** (Esc → Options): pixel size, sun and moon shadows (off / on / high), flowing clouds,
and view distance (near / normal / far / very far).

## Design notes

- **Location spacing.** The original brief asked for 2000 m between locations; after play-testing that felt
  empty, so the minimum gap is now 650 m (`MIN_GAP` in `src/world.js`) with roughly three times as many places.

A few places where the brief was open to interpretation:

- **Skill points.** "200 points to put into each" is read as a pool of 200 points to distribute across the
  skills at character creation (at most +40 in any one). Skills cap at 100, giving four perks per skill.
- **Armor slots.** The brief lists legs twice; the fifth armor slot is feet.
- **Biome size.** Biome regions are cells of a jittered 6 km grid, so each is at least ~13 km² and
  neighbouring cells of the same biome merge into larger regions.
- **Extra shops.** Apothecaries and arcanists were added so Alchemy and the three magic schools have a
  source of supplies and spells.

## Code map

| File | Purpose |
| --- | --- |
| `src/world.js` | Biome regions, height function, location placement, roads, points of interest |
| `src/settlement.js` | Settlement layouts, dungeon entrances, citizens and routines |
| `src/terrain.js`, `src/exterior.js` | Streaming terrain chunks, flora, building exteriors, colliders |
| `src/interior.js` | Building interiors and dungeons (rooms, caves, towers), pathing |
| `src/entities.js` | Citizens, monsters, AI, projectiles, spawning |
| `src/player.js`, `src/items.js` | Stats, perks, inventory, combat, magic, item generation |
| `src/quests.js`, `src/dialog.js` | Quests, conversations, shops and prices |
| `src/ui.js`, `src/ui2.js` | HUD, windows, menus, character creation, crafting |
| `src/art.js`, `src/sprites.js` | Procedural textures, sprite atlases, characters, monsters, icons |
| `src/main.js` | Boot, main loop, input, interaction, transitions, save/load |

Three.js (MIT) is vendored in `vendor/`; the fonts VT323 and Pirata One (OFL) are in `assets/fonts/`.
